const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/config', (req, res) => {
    const localConfigPath = path.join(__dirname, 'config.local.json');
    const defaultConfigPath = path.join(__dirname, 'config.json');
    const targetPath = fs.existsSync(localConfigPath) ? localConfigPath : defaultConfigPath;

    fs.readFile(targetPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to load configuration' });
        }
        res.json(JSON.parse(data));
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});