const express = require("express");
const multer = require("multer");
const path = require("path");
const SambaClient = require("samba-client");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Middleware to parse JSON body
app.use(express.json());
app.use(express.static("public"));

const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

// Samba client setup
const smb_host = process.env.SMB_HOST || "localhost"
const smb_address = `//${smb_host}/share_space`
const client = new SambaClient({
    address: smb_address,
    username: process.env.SMB_USERNAME || "username",
    password: process.env.SMB_PASSWORD || "password"
});

app.listen(PORT, () => {
    consoleLogOut(`APP`,`Server is running on http://localhost:${PORT}`);
});

app.get("/healthcheck", async (req, res) => {
    try {
        await client.list("/healthcheck"); // Check SMB connection

        const generateSessionId = () => Date.now().toString(36) + Math.random().toString(36).slice(-3);
        const sessionId = generateSessionId();
        res.status(200).json({ 
            message: "SMB connection is healthy.",
            sessionId: sessionId 
        });
    } catch (err) {
        console.error("SMB Health Check Failed:", err);

        res.status(500).json({ 
            message: "SMB connection failed.",
            sessionId: null 
        });
    }
});

app.post("/upload-chunk", upload.single("chunk"), async (req, res) => {
    const { originalName, chunkIndex, totalChunks, checksum , req_sessionId, status} = req.body;
    if (!req.file || !originalName || chunkIndex === undefined || !totalChunks || !checksum || !req_sessionId) {
        return res.status(400).json({ error: "Invalid chunk data" });
    }
    if (status == 'start'){
        //initialise the temp upload folder

    }
    const chunkPath = path.join(uploadDir, `${originalName}.part${chunkIndex}`);
    
    // Compute checksum to verify integrity
    const buffer = fs.readFileSync(req.file.path);
    const computedChecksum = adler32(buffer);

    if (parseInt(checksum) !== computedChecksum) {
        consoleErrorOut(req_sessionId,`Checksum mismatch for chunk ${chunkIndex} of ${originalName}`);
        return res.status(409).json({ error: "Checksum mismatch, chunk corrupted" });
    }

    fs.renameSync(req.file.path, chunkPath);
    consoleLogOut(req_sessionId,`Received chunk ${chunkIndex}/${totalChunks} for ${originalName}.Checksum:${computedChecksum}`);

    //receiving end status from frontend, means last chunk uploaded
    if (status == 'end' || status == 'single') {
        try{
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay before merging
            await mergeChunks(originalName, totalChunks,req_sessionId);
        }catch (error){
            return res.status(400).json({ error: `${error.message}` });
        }
    }
    res.status(200).json({ message: `Chunk ${chunkIndex} uploaded successfully` });
});

async function mergeChunks(originalName, totalChunks,req_sessionId) {
    const finalFilePath = path.join(uploadDir, originalName);
    const writeStream = fs.createWriteStream(finalFilePath);

    for (let i = 1; i <= totalChunks; i++) {
        const chunkPath = path.join(uploadDir, `${originalName}.part${i}`);
        if (!fs.existsSync(chunkPath)) {
            consoleErrorOut(req_sessionId,`Chunk ${i} for ${originalName} missing, aborting merge.`);
            throw new Error(`Chunk ${i} for ${originalName} missing, aborting merge.`);
        }
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
        fs.unlinkSync(chunkPath); // Delete chunk after merging
    }
    writeStream.end();
    consoleLogOut(req_sessionId,`File ${originalName} successfully assembled.`);

    try {
        const uniqueFilename = await getUniqueFilename(originalName,req_sessionId);
        await client.sendFile(finalFilePath, `${smb_location}/${uniqueFilename}`);
        consoleLogOut(req_sessionId,`${originalName} uploaded as ${uniqueFilename} to ${smb_address}/${smb_location}`);
    } catch (error) {
        consoleErrorOut(req_sessionId,`${originalName} upload to SMB failed:`, error);
        throw new Error(`${originalName} upload to SMB failed`);
    } finally {
        fs.unlinkSync(finalFilePath); // Clean up assembled file
    }
}

function getTimestamp() {
    return new Date().toLocaleString('en-GB', { timeZoneName: 'short' });
}

function adler32(buffer) {
    let MOD_ADLER = 65521;
    let a = 1, b = 0;
    for (let i = 0; i < buffer.length; i++) {
        a = (a + buffer[i]) % MOD_ADLER;
        b = (b + a) % MOD_ADLER;
    }
    return ((b << 16) | a) >>> 0; // Convert to unsigned 32-bit int
}

async function getUniqueFilename(originalFilename,req_sessionId) {
    const ext = path.extname(originalFilename);
    const name = path.basename(originalFilename, ext);
    let uniqueFilename = originalFilename;
    let counter = 2;
    try {
        while (await client.fileExists(`/${smb_location}/${uniqueFilename}`)) {
            uniqueFilename = `${name} (${counter})${ext}`;
            consoleLogOut(req_sessionId,`Name conflict, trying name: ${uniqueFilename}`);
            counter++;
        }
    } catch (error) {
        consoleErrorOut(req_sessionId,`Failed to list SMB directory:`, err);
        throw new Error(`Failed to list SMB directory to get unique filename.`);
    }

    return uniqueFilename;
}

// log output pattern
function consoleLogOut(sessionId, ...messages){
    const now = new Date();
    const gmt8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000) // Convert to GMT+8
        .toISOString()
        .replace('T', ' ')
        .replace('Z', ''); // Format to readable output
    console.log(`[${gmt8Time}][${sessionId}][INFO]:`, ...messages);
}

function consoleErrorOut(sessionId, ...messages){
    const now = new Date();
    const gmt8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000) // Convert to GMT+8
        .toISOString()
        .replace('T', ' ')
        .replace('Z', ''); // Format to readable output
    console.error(`[${gmt8Time}][${sessionId}][ERROR]:`, ...messages);
}