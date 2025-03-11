const express = require('express');
const app = express();
const port = 3001;
const db = require('./database'); // Import database.js
const { consoleLogOut, consoleErrorOut } = require("./logger"); // import custom logger

app.use(express.json());
app.use(express.static("public/generator"));

function generateBase36Id(length = 32) {
    return [...Array(length)]
        .map(() => Math.floor(Math.random() * 36).toString(36))
        .join('');
}

// 1. Generate Secure URL
app.post('/generate', (req, res) => {
    const { startTime, endTime, path } = req.body;
    if (!startTime || !endTime || !path) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const id = generateBase36Id();
    const createdTime = Date.now();
    const status = 'A';
    
    db.run(`INSERT INTO url_session (id, startTime, endTime, path, status, createdTime) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, startTime, endTime, path, status, createdTime],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ url: `https://hostname.com/?id=${id}` });
        }
    );
});

// 2. Fetch All URLs
app.get('/sessions', (req, res) => {
    db.all(`SELECT * FROM url_session`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 3. Disable a URL
app.post('/disable', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ error: 'Missing ID' });
    }
    
    db.run(`UPDATE url_session SET status = 'D' WHERE id = ?`, [id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'URL disabled successfully' });
    });
});

// 4. Fetch Distinct NAS Paths
app.get('/paths', (req, res) => {
    db.all(`SELECT DISTINCT path FROM url_session`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows.map(row => row.path));
    });
});

app.listen(port, () => {
    consoleLogOut(`Generator`,`Server running on port ${port}`);
});
