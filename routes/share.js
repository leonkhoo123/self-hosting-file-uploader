const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require('../database'); // Import database.js
const router = express.Router();
const { consoleLogOut, consoleErrorOut } = require("../servers/logger"); // import custom logger
const applicationName = `Uploads`;
const servername = "Leon NAS"
const chunkSize = process.env.CHUNK_SIZE || 3 // 3 MB per chunk
let isClearing = false;

let NAS_PATH;
const envMode = process.env.ENV || 'prod'; // fallback to 'production'
switch (envMode) {
    case 'docker-dev':
        NAS_PATH = "/mnt/c/my_docker_image/testpath";
        break;
    case 'local':
        NAS_PATH = "/home/leon/Documents/my_volume";
        break;
    case 'prod':
    default:
        NAS_PATH = "/mnt/nas_uploads";
        break;
}

const share_folder = path.join(NAS_PATH, "share_folder"); // Using direct NAS mount 
const uploadDir = path.join(NAS_PATH, "temp_uploads/"); // Using direct NAS mount
//Apply middleware to router
router.use(express.json());

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    dest: uploadDir,
    limits: { fileSize: chunkSize + 1 * 1024 * 1024 }, // X MB per chunk +1 MB for tolerance
});


let uploadSessions = {}; // In-memory cache

// Load active sessions into memory
const loadUploadSessions = () => {
    db.all(`SELECT session_id, startTime, endTime, path FROM url_session WHERE status = "A"`, [], (err, rows) => {
        if (err) {
            consoleErrorOut(`ReloadCache`, `system_log`, `Error loading sessions into cache: ${err.message}`);
            return;
        }
        uploadSessions = {}; // Reset cache
        rows.forEach(row => {
            uploadSessions[row.session_id] = row;
        });
        consoleLogOut(`ReloadCache`, `system_log`, `Cache reloaded`);
    });
};

// Middleware: Check Upload Auth
const checkUploadAuth = (req, res, next) => {
    const { id } = req.params;
    loadUploadSessions(); // temporarily reload sessions to ensure cache is up-to-date
    const session = uploadSessions[id];

    if (!session) {
        consoleLogOut(`UploadAuth`, `system_log`, `Received forbidden access with URL: ${id}`);
        return res.status(400).json({
            status: 400,
            message: "Invalid URL",
        });
    }

    // Check if the session is expired
    const currentTime = Date.now();

    if (currentTime < session.startTime || currentTime > session.endTime) {
        consoleLogOut(`UploadAuth`, `system_log`, `Expired or invalid access for URL: ${id}`);
        return res.status(400).json({ error: "URL expired or not yet activated" });
    }

    // Store the upload path in request object for later use
    req.uploadPath = session.path;
    // consoleLogOut(`UploadAuth`,`system_log`, `Valid access granted for URL: ${id}`);

    if (isClearing) {
        consoleLogOut(`UploadAuth`, `system_log`, `Clearing in process, stopping request from URL: ${id}`);
        return res.status(400).json({
            status: 400,
            message: "Maintanance in progress, please try again later",
        });
    }

    next();
};

// API to Reload Cache
router.post('/reload-cache', (req, res) => {
    loadUploadSessions();
    res.status(200).json({ message: "Upload session cache reloaded successfully" });
});

router.get("/healthcheck/:id",checkUploadAuth, async (req, res) => {
// router.get("/healthcheck/:id", async (req, res) => {  //temp remove auth check for healthcheck
    try {
        const { id } = req.params; // Extract id from request parameters

        const generateSessionId = () => {
            const today = new Date().getDate().toString().padStart(2, '0'); // Get day (DD)
            const timestamp = Date.now().toString(36);
            const randomPart = Math.random().toString(36).slice(-3);

            return `${today}-${timestamp}-${randomPart}`;
        };

        const sessionId = generateSessionId();
        consoleLogOut(applicationName, sessionId, `Valid access granted for URL: ${id}`);

        if (!fs.existsSync(uploadDir)) {
            consoleLogOut(applicationName, sessionId, `Health check not able to find ${uploadDir}`);
            try {
                consoleLogOut(applicationName, sessionId, `Health check creating ${uploadDir}`);
                fs.mkdirSync(uploadDir, { recursive: true });
            } catch (error) {
                throw new Error(`Not able to access mounted path: ${uploadDir}. Error: ${error}`);
            }
        }
        res.status(200).json({
            status: 200,
            message: "Connection is healthy",
            sessionId: sessionId,
            path: req.uploadPath,
            servername: servername,
            chunkSize: chunkSize
        });
    } catch (err) {
        console.error("Health Check Failed:", err);
        return res.status(400).json({ error: "Health Check Failed" });
    }
});

// Route to download JPG
router.get("/download/image", (req, res) => {
    const filePath = path.join(NAS_PATH, "test.jpg");
    res.download(filePath, "downloaded-image.jpg", (err) => {
        if (err) {
            console.error("Download failed:", err);
            res.status(500).send("Error downloading file.");
        }
    });
});

// Route to download MP4
router.get("/download/video", (req, res) => {
    const filePath = path.join(NAS_PATH, "sample.mp4");
    res.download(filePath, "downloaded-video.mp4", (err) => {
        if (err) {
            console.error("Download failed:", err);
            res.status(500).send("Error downloading file.");
        }
    });
});

function adler32(buffer) {
    let MOD_ADLER = 65521;
    let a = 1, b = 0;
    for (let i = 0; i < buffer.length; i++) {
        a = (a + buffer[i]) % MOD_ADLER;
        b = (b + a) % MOD_ADLER;
    }
    return ((b << 16) | a) >>> 0; // Convert to unsigned 32-bit int
}

module.exports = {
    router,
    loadUploadSessions
};
