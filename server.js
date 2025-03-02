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
            cb(null, "uploads/"); // Ensure this directory exists
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        }
    })
});

// Samba client setup
const client = new SambaClient({
    address: process.env.SMB_ADDRESS || "//192.168.1.6/share_space",
    username: process.env.SMB_USERNAME || "publicuser",
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
        res.status(200).json({ message: "File uploaded successfully." });
    } catch (err) {
        console.error("Upload failed:", err);
        res.status(500).json({ error: "File upload failed." });
    } finally {
        // Clean up temporary file
        fs.unlinkSync(tempPath);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
