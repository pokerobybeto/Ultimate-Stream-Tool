const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

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

console.log("Server Base Dir:", baseDir);

app.use(express.static(guiPath));
app.use('/Resources', express.static(resourcesPath));

app.get(/\/api\/json\/(.*)/, (req, res) => {
    try {
        const fileParam = req.params[0];
        const filePath = path.resolve(mainPath, fileParam + '.json');

        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            console.error("File not found:", filePath);
            res.status(404).send('File not found');
        }
    } catch (error) {
        console.error("Error reading file:", error);
        res.status(500).send('Error reading file');
    }
});

let lastUpdateTimestamp = Date.now();

app.get('/api/last-update', (req, res) => {
    res.json({ timestamp: lastUpdateTimestamp });
});

// API to update ScoreboardInfo and text files
app.post('/api/scoreboard', (req, res) => {
    try {
        const scoreboardJson = req.body;
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
        res.send({ status: 'success' });
    } catch (error) {
        console.error("Error writing scoreboard:", error);
        res.status(500).send('Error writing scoreboard');
    }
});

app.listen(port, () => {
    console.log(`Web interface running at http://localhost:${port}`);
});

module.exports = app;
