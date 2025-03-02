const express = require("express");
const multer = require("multer");
const path = require("path");
const SambaClient = require("samba-client");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Serve static files from the 'public' directory
app.use(express.static("public"));

// Multer setup (store file temporarily on disk before uploading to SMB)
const upload = multer({ 
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = "uploads/";

            // Ensure the directory exists
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        }
    })
});

// Samba client setup
const smb_host = process.env.SMB_HOST || "localhost"
const smb_address = `//${smb_host}/share_space`
const client = new SambaClient({
    address: smb_address,
    username: process.env.SMB_USERNAME || "username",
    password: process.env.SMB_PASSWORD || "password"
});


// Health check route to verify SMB connection
app.get("/healthcheck", async (req, res) => {
    try {
        await client.list("/healthcheck"); // Try listing files in the share
        res.status(200).json({ message: "SMB connection is healthy." });

    } catch (err) {
        console.error("SMB Health Check Failed:", err);
        res.status(500).json({ message: "SMB connection failed." });

    }
});

// File upload endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
    }

    const tempPath = req.file.path;
    const fileName = req.file.originalname;

    try {
        // Upload file to SMB share
        await client.sendFile(tempPath, fileName);
        console.log(`${fileName} uploaded to ${smb_address}`);
        res.status(200).json({ message: "File uploaded successfully." });
    } catch (err) {
        console.error(`${fileName} upload failed:`, err);
        res.status(500).json({ error: "File upload failed." });
    } finally {
        // Clean up temporary file
        fs.unlinkSync(tempPath);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on localhost:${PORT}`);
});
