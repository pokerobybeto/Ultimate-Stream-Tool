const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const port = 1111;

app.use(cors());
app.use(bodyParser.json());

let baseDir;

const isDev = process.execPath.includes('node_modules');
if (isDev) {
    baseDir = path.resolve(__dirname, '..', '..', 'Stream Tool');
} else if (process.env.PORTABLE_EXECUTABLE_DIR) {
    baseDir = process.env.PORTABLE_EXECUTABLE_DIR;
} else {
    baseDir = path.dirname(process.execPath);
}

const mainPath = path.resolve(baseDir, 'Resources', 'Texts');
const guiPath = __dirname;
const resourcesPath = path.resolve(baseDir, 'Resources');
const remoteSettingsPath = path.join(mainPath, 'RemoteSettings.json');

console.log("Server Base Dir:", baseDir);

function readRemoteSettings() {
    try {
        if (!fs.existsSync(remoteSettingsPath)) return { password: "" };

        const settings = JSON.parse(fs.readFileSync(remoteSettingsPath, 'utf8'));
        return {
            password: typeof settings.password === 'string' ? settings.password : ""
        };
    } catch (error) {
        console.error("Error reading remote settings:", error);
        return { password: "" };
    }
}

function writeRemoteSettings(settings) {
    fs.writeFileSync(remoteSettingsPath, JSON.stringify(settings, null, 2));
}

let remotePassword = readRemoteSettings().password;

function isLocalRequest(request) {
    const address = request.ip || request.socket.remoteAddress || "";
    return address === "127.0.0.1" ||
        address === "::1" ||
        address === "::ffff:127.0.0.1" ||
        address === "localhost";
}

function getRequestPassword(request) {
    return request.get('x-stream-tool-password') ||
        request.query.password ||
        (request.body && request.body.password) ||
        "";
}

function passwordsMatch(providedPassword, expectedPassword) {
    if (!expectedPassword) return true;
    if (typeof providedPassword !== 'string') return false;

    const provided = Buffer.from(providedPassword);
    const expected = Buffer.from(expectedPassword);
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function requireRemotePassword(request, response, next) {
    if (!remotePassword || isLocalRequest(request) || passwordsMatch(getRequestPassword(request), remotePassword)) {
        next();
        return;
    }

    response.status(401).json({ error: "Invalid remote password" });
}

app.use(express.static(guiPath));
app.use('/Resources', express.static(resourcesPath));

app.get('/api/security', (request, response) => {
    if (isLocalRequest(request)) {
        response.json({ passwordEnabled: Boolean(remotePassword), password: remotePassword });
        return;
    }

    response.json({ passwordEnabled: Boolean(remotePassword) });
});

app.post('/api/security', (request, response) => {
    if (!isLocalRequest(request)) {
        response.status(403).json({ error: "Remote security settings can only be changed locally" });
        return;
    }

    remotePassword = typeof request.body.password === 'string' ? request.body.password.trim() : "";
    writeRemoteSettings({ password: remotePassword });
    response.json({ passwordEnabled: Boolean(remotePassword) });
});

app.get(/\/api\/json\/(.*)/, (request, response) => {
    try {
        const fileParam = request.params[0];
        const filePath = path.resolve(mainPath, fileParam + '.json');

        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            response.json(JSON.parse(data));
        } else {
            console.error("File not found:", filePath);
            response.status(404).send('File not found');
        }
    } catch (error) {
        console.error("Error reading file:", error);
        response.status(500).send('Error reading file');
    }
});

let lastUpdateTimestamp = Date.now();

app.get('/api/last-update', (request, response) => {
    response.json({ timestamp: lastUpdateTimestamp });
});

// API to update ScoreboardInfo and text files
app.post('/api/scoreboard', requireRemotePassword, (request, response) => {
    try {
        const scoreboardJson = { ...(request.body || {}) };
        delete scoreboardJson.password;
        const data = JSON.stringify(scoreboardJson, null, 2);

        fs.writeFileSync(path.join(mainPath, "ScoreboardInfo.json"), data);

        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Player 1.txt"), scoreboardJson.p1Name || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Player 2.txt"), scoreboardJson.p2Name || "");

        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Score 1.txt"), scoreboardJson.p1NScore || "0");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Score 2.txt"), scoreboardJson.p2NScore || "0");

        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Round.txt"), scoreboardJson.round || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Format.txt"), scoreboardJson.format || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Tournament Name.txt"), scoreboardJson.tournamentName || "");

        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Caster 1 Name.txt"), scoreboardJson.caster1Name || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Caster 1 Twitter.txt"), scoreboardJson.caster1Twitter || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Caster 1 Twitch.txt"), scoreboardJson.caster1Twitch || "");

        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Caster 2 Name.txt"), scoreboardJson.caster2Name || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Caster 2 Twitter.txt"), scoreboardJson.caster2Twitter || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", "Caster 2 Twitch.txt"), scoreboardJson.caster2Twitch || "");

        lastUpdateTimestamp = Date.now();

        console.log("Scoreboard updated");
        response.send({ status: 'success' });
    } catch (error) {
        console.error("Error writing scoreboard:", error);
        response.status(500).send('Error writing scoreboard');
    }
});

app.listen(port, () => {
    console.log(`Web interface running at http://localhost:${port}`);
});

module.exports = app;
