const express = require("express");
const multer = require("multer");
const path = require("path");
const SambaClient = require("samba-client");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Middleware to parse JSON body
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static("public"));

// Setup a temporary storage directory for chunks
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup (stores file chunks temporarily)
const upload = multer({ dest: uploadDir });

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
        await client.list("/healthcheck");
        res.status(200).json({ message: "SMB connection is healthy." });
    } catch (err) {
        console.error("SMB Health Check Failed:", err);
        res.status(500).json({ message: "SMB connection failed." });
    }
});

// Handle chunked file uploads
app.post("/upload-chunk", upload.single("chunk"), async (req, res) => {
    const { originalName, chunkIndex, totalChunks } = req.body;

    if (!req.file || !originalName || chunkIndex === undefined || !totalChunks) {
        return res.status(400).json({ message: "Invalid chunk data" });
    }

    const chunkPath = path.join(uploadDir, `${originalName}.part${chunkIndex}`);
    fs.renameSync(req.file.path, chunkPath);

    console.log(`Received chunk ${chunkIndex} of ${totalChunks} for ${originalName}`);

    // Check if all chunks are received
    if (fs.readdirSync(uploadDir).filter(f => f.startsWith(originalName + ".part")).length == totalChunks) {
        console.log(`Waiting for FileSystem`)
        // setTimeout(async () => {
        //     await mergeChunks(originalName, totalChunks);
        // }, 1000); // Wait 1 second (1000ms)
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        await mergeChunks(originalName, totalChunks);
    }
    res.status(200).json({ message: `Chunk ${chunkIndex} uploaded` });
});

// Merge chunks once all are received
async function mergeChunks(originalName, totalChunks) {
    const finalFilePath = path.join(uploadDir, originalName);
    const writeStream = fs.createWriteStream(finalFilePath);

    for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(uploadDir, `${originalName}.part${i}`);
        if (!fs.existsSync(chunkPath)) {
            console.error(`Chunk ${i} missing, aborting merge.`);
            return;
        }
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
        console.log(`Merging ${i} chunpath = ${chunkPath}`);
        fs.unlinkSync(chunkPath); // Delete chunk after merging
    }

    writeStream.end();
    console.log(`File ${originalName} successfully assembled.`);
    try {
        // Upload merged file to SMB share
        await client.sendFile(finalFilePath, originalName);
        console.log(`${originalName} uploaded to ${smb_address}`);
    } catch (err) {
        console.error(`${originalName} upload failed:`, err);
    } finally {
        fs.unlinkSync(finalFilePath); // Clean up assembled file
    }
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
