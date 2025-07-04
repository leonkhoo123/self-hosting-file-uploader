const express = require('express');
const router = express.Router();
const port = 3001;
const db = require('../database'); // Import database.js
const { consoleLogOut, consoleErrorOut } = require("../servers/logger"); // import custom logger
const hostname = process.env.HOSTNAME || "localhost:3000";
const axios = require('axios');
const uploadBasePath = 'uploads'
const applicationName = `Generator`;

router.use(express.json());


function generateBase36Id(length = 32) {
    return [...Array(length)]
        .map(() => Math.floor(Math.random() * 36).toString(36))
        .join('');
}

function callReloadCache(){
    // Call the reload-cache API after successful insertion
    axios.post(`http://localhost:3000/${uploadBasePath}/reload-cache`)
        .then(response => consoleLogOut(applicationName,`system_log`, `${response.data.message}`))
        .catch(error => consoleErrorOut(applicationName,`system_log`, `Error reloading cache: ${error.message}`));
}


// 1. Generate Secure URL
router.post('/generate', async (req, res) => {
    const { startTime, endTime, path } = req.body;
    if (!startTime || !endTime || !path) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const session_id = generateBase36Id();
    const createdTime = Date.now();
    const status = 'A';

    db.run(
        `INSERT INTO url_session (session_id, startTime, endTime, path, status, createdTime) VALUES (?, ?, ?, ?, ?, ?)`,
        [session_id, startTime, endTime, path, status, createdTime],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            callReloadCache();
            res.json({ url: `https://${hostname}/${uploadBasePath}/?id=${session_id}` });
        }
    );
});

// 2. Fetch All URLs
router.get('/sessions', (req, res) => {
    db.all(`SELECT * FROM url_session order by id desc limit 10`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        // res.json(rows);
        res.json({
            hostname: hostname, // or use req.hostname
            uploadPath: uploadBasePath,
            sessions: rows
        });
    });
});

// 3. Disable a URL
router.post('/disable', (req, res) => {
    const { session_id } = req.body;
    if (!session_id) {
        return res.status(400).json({ error: 'Missing session_id' });
    }
    
    db.run(`UPDATE url_session SET status = 'D' WHERE session_id = ?`, [session_id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        callReloadCache();
        res.json({ message: 'URL disabled successfully' });
    });
});

// 4. Fetch Distinct NAS Paths
router.get('/paths', (req, res) => {
    db.all(`SELECT DISTINCT path FROM url_session`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows.map(row => row.path));
    });
});


module.exports = {
    router,
  };
