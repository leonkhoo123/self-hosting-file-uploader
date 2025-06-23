const cron = require("node-cron");
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require('../database'); // Import database.js
const { consoleLogOut, consoleErrorOut } = require("./logger"); // import custom logger
const applicationName = `Server`;
const app = express();
const PORT = 3000;
const servername = "Leon NAS"
const chunkSize = process.env.CHUNK_SIZE || 7 // 7MB per chunk
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
const basePath = "/uploads";

// Middleware to parse JSON body
// app.use(express.json());
// app.use(express.static("public/uploader"));
// app.use("/style.css", (req, res) => {
//     res.sendFile(__dirname + "/public/style.css");
// });

//Create router
const router = express.Router();
//Apply middleware to router
router.use(express.json());



const uploadDir = path.join(NAS_PATH,"temp_uploads/"); // Using direct NAS mount

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    dest: uploadDir,
    limits: { fileSize: chunkSize * 1024 * 1024 }, // 7MB per chunk
  });

  
let uploadSessions = {}; // In-memory cache

// Load active sessions into memory
const loadUploadSessions = () => {
    db.all(`SELECT session_id, startTime, endTime, path FROM url_session WHERE status = "A"`, [], (err, rows) => {
        if (err) {
            consoleErrorOut(`ReloadCache`,``, `Error loading sessions into cache: ${err.message}`);
            return;
        }
        uploadSessions = {}; // Reset cache
        rows.forEach(row => {
            uploadSessions[row.session_id] = row;
        });
        consoleLogOut(`ReloadCache`,``, `Cache reloaded`);
    });
};

// Middleware: Check Upload Auth
const checkUploadAuth = (req, res, next) => {
    const { id } = req.params;
    const session = uploadSessions[id];

    if (!session) {
        consoleLogOut(`UploadAuth`, `Received forbidden access with URL: ${id}`);
        return res.status(400).json({
            status: 400,
            message: "Invalid URL",
        });
    }

    // Check if the session is expired
    const currentTime = Date.now();

    if (currentTime < session.startTime || currentTime > session.endTime) {
        consoleLogOut(`UploadAuth`, `Expired or invalid access for URL: ${id}`);
        return res.status(400).json({ error: "URL expired or not yet activated" });
    }

    // Store the upload path in request object for later use
    req.uploadPath = session.path;
    // consoleLogOut(`UploadAuth`, `Valid access granted for URL: ${id}`);
    next();
};

// API to Reload Cache
router.post('/reload-cache', (req, res) => {
    loadUploadSessions();
    res.status(200).json({ message: "Upload session cache reloaded successfully" });
});

router.post("/upload-chunk/:id",checkUploadAuth, upload.single("chunk"), async (req, res) => {
    const { originalName, chunkIndex, totalChunks, checksum , req_sessionId, status} = req.body;
    if (!req.file || !originalName || chunkIndex === undefined || !totalChunks || !checksum || !req_sessionId) {
        return res.status(400).json({ error: "Invalid chunk data" });
    }

    const nas_mount_location = path.join(share_folder, req.uploadPath); // Using direct NAS mount

    const sessionUploadDir = path.join(uploadDir, req_sessionId); // Form new dir for each visit session
    if (!fs.existsSync(sessionUploadDir)) {
        fs.mkdirSync(sessionUploadDir, { recursive: true }); // Create folder for the session
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for File IO respond
    }

    if (status === 'start') { // first chunk of the file
        try {
            //clear any left over chunk that same name with current upload
            fs.readdirSync(sessionUploadDir).forEach(file => {
                if (file.startsWith(originalName)) {
                    fs.unlinkSync(path.join(sessionUploadDir, file));
                }
            });
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay before starting new upload
            consoleLogOut(req_sessionId,`Cleared old chunks for ${originalName} in ${sessionUploadDir}`);
        } catch (err) {
            consoleErrorOut(req_sessionId,`Error clearing old chunks: ${err.message}`);
            return res.status(400).json({ error: "Error clearing leftover, please refresh page and upload again" });
        }
    }

    const chunkPath = path.join(sessionUploadDir, `${originalName}.part${chunkIndex}`);
    
    // Compute checksum to verify integrity
    const buffer = fs.readFileSync(req.file.path);
    const computedChecksum = adler32(buffer);

    if (parseInt(checksum) !== computedChecksum) {
        consoleErrorOut(req_sessionId,`Checksum mismatch for chunk ${chunkIndex} of ${originalName}`);
        fs.unlinkSync(req.file.path); // Delete the corrupt chunk
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay before returning error
        return res.status(409).json({ error: "Checksum mismatch, chunk corrupted" });
    }

    fs.renameSync(req.file.path, chunkPath);
    consoleLogOut(req_sessionId,`Received chunk ${parseInt(chunkIndex)+1}/${totalChunks} for ${originalName}.Checksum:${computedChecksum}`);

    //receiving end status from frontend, means last chunk uploaded
    if (status == 'end' || status == 'single') { // proceed to merge
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for File IO respond
        const receivedChunks = fs.readdirSync(sessionUploadDir).filter(file => file.startsWith(originalName)).length;
        consoleLogOut(req_sessionId,`"${status}" flag received,Total:${parseInt(totalChunks)}, Received: ${receivedChunks}`);
        if (receivedChunks !== parseInt(totalChunks)) {
            consoleErrorOut(req_sessionId, `Mismatch: Expected ${totalChunks} chunks, but received ${receivedChunks}`);
            return res.status(400).json({ error: "Incomplete upload, please retry" });
        }

        try{
            consoleLogOut(req_sessionId,`Start merging ${originalName}.`);
            await mergeChunks(originalName, totalChunks,sessionUploadDir,nas_mount_location,req_sessionId); // proceed to merge
        }catch (error){
            consoleLogOut(`Sending back 400, uploaded failed, SMB issue`)
            return res.status(400).json({ error: `${error.message}` });
        }
    }
    res.status(200).json({ message: `Chunk ${chunkIndex} uploaded successfully` });
});

router.get("/healthcheck/:id",checkUploadAuth, async (req, res) => {
    try {
        const { id } = req.params; // Extract id from request parameters
        
        const generateSessionId = () => {
            const today = new Date().getDate().toString().padStart(2, '0'); // Get day (DD)
            const timestamp = Date.now().toString(36);
            const randomPart = Math.random().toString(36).slice(-3);
        
            return `${today}-${timestamp}-${randomPart}`;
        };

        const sessionId = generateSessionId();
        consoleLogOut(sessionId, `Valid access granted for URL: ${id}`);

        if(!fs.existsSync(uploadDir)){
            consoleLogOut(sessionId, `Health check not able to find ${uploadDir}`);
            try{
                consoleLogOut(sessionId, `Health check creating ${uploadDir}`);
                fs.mkdirSync(uploadDir, { recursive: true });
            } catch (error){
                throw new Error(`Not able to access mounted path: ${uploadDir}. Error: ${error}`);
            }
        }
        res.status(200).json({ 
            status: 200,
            message: "Connection is healthy",
            sessionId: sessionId,
            path:req.uploadPath,
            servername: servername,
            chunkSize: chunkSize
        });
    } catch (err) {
        console.error("Health Check Failed:", err);
        return res.status(400).json({ error: "Health Check Failed" });
        // res.status(400).json({ 
        //     message: "SMB connection failed.",
        //     sessionId: null 
        // });
    }
});

async function mergeChunks(originalName, totalChunks, sessionUploadDir,nas_mount_location, req_sessionId) {
    
    const finalFilePath = path.join(sessionUploadDir, originalName);
    const writeStream = fs.createWriteStream(finalFilePath);

    for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(sessionUploadDir, `${originalName}.part${i}`);
        if (!fs.existsSync(chunkPath)) {
            consoleErrorOut(req_sessionId, `Chunk ${i} for ${originalName} missing, aborting merge.`);
            throw new Error(`Chunk ${i} for ${originalName} missing, aborting merge.`);
        }
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
        fs.unlinkSync(chunkPath); // Delete chunk after merging
    }
    writeStream.end();
    consoleLogOut(req_sessionId, `File ${originalName} successfully assembled.`);

    try {
        if (!fs.existsSync(nas_mount_location)) {
            fs.mkdirSync(nas_mount_location, { recursive: true }); // Create final folder in the nas
        }

        const uniqueFilename = await getUniqueFilename(originalName, nas_mount_location, req_sessionId);
        const destinationPath = path.join(nas_mount_location, uniqueFilename);

        // Move file to NAS path
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for File IO respond
        fs.renameSync(finalFilePath, destinationPath);
        consoleLogOut(req_sessionId, `${originalName} moved to NAS at ${destinationPath}`);
    } catch (error) {
        consoleErrorOut(req_sessionId, `${originalName} move to NAS failed:`, error);
        throw new Error(`${originalName} move to NAS failed`);
    }
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

async function getUniqueFilename(originalFilename, nas_mount_location, req_sessionId) {
    const ext = path.extname(originalFilename);
    const name = path.basename(originalFilename, ext);
    let uniqueFilename = originalFilename;
    let counter = 2;

    try {
        if (!fs.existsSync(nas_mount_location)) {
            fs.mkdirSync(nas_mount_location, { recursive: true }); // Create final folder in the nas
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for File IO respond
        }
        while (fs.existsSync(path.join(nas_mount_location, uniqueFilename))) {
            uniqueFilename = `${name} (${counter})${ext}`;
            consoleLogOut(req_sessionId, `Name conflict, trying name: ${uniqueFilename}`);
            counter++;
        }
    } catch (error) {
        consoleErrorOut(req_sessionId, `Failed to access NAS directory:`, error);
        throw new Error(`Failed to access NAS directory to get unique filename.`);
    }

    return uniqueFilename;
}


// Function to clear temp_uploads
function clearTempUploads() {
    if (isClearing) return; // Prevent duplicate cleanup runs

    consoleLogOut(applicationName,``, `Starting nightly cleanup...`);
    isClearing = true;

    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            consoleErrorOut(applicationName,``, `Error reading temp_uploads directory: ${err}`);
            isClearing = false;
            return;
        }
        files.forEach((file) => {
            const filePath = path.join(uploadDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    consoleErrorOut(applicationName,``, `Failed to read ${file}: ${err}`);
                    return;
                }

                if (stats.isDirectory()) {
                    // Remove directories recursively
                    fs.rm(filePath, { recursive: true, force: true }, (err) => {
                        if (err) {
                            consoleErrorOut(applicationName,``, `Failed to delete directory ${file}: ${err}`);
                        }
                    });
                } else {
                    // Remove files
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            consoleErrorOut(applicationName,``, `Failed to delete ${file}: ${err}`);
                        }
                    });
                }
            });
        });
        consoleLogOut(applicationName,``, `Nightly cleanup completed.`);
        isClearing = false;
    });
}

// Schedule cleanup every night at 5 AM
cron.schedule("0 5 * * *", clearTempUploads, {
    timezone: "Asia/Singapore",
});

// 4. Mount router at basePath
app.use(basePath, router);

// 5. Static UI under basePath
app.use(basePath, express.static(path.join(__dirname, "public/uploader")));

// 6. Shared style.css served explicitly
app.use(`${basePath}/style.css`, (req, res) => {
    res.sendFile(path.join(__dirname, "public/style.css"));
});

// Global error handler (mainly for upload size limit)
app.use((err, req, res, next) => {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: `Chunk too large. Max allowed size is ${fileSize}MB.` });
    }
    next(err);
  });

// Start server
app.listen(PORT, () => {
    consoleLogOut(applicationName,``, `Starting server with environment: ${envMode}, chunk size: ${chunkSize}MB`);
    clearTempUploads();
    loadUploadSessions();
    consoleLogOut(applicationName,``, `Server is running on http://localhost:${PORT}${basePath}`);
});



// const checkUploadAuth = (req, res, next) => {
//     const { id } = req.params;

//     db.get(`SELECT * FROM url_session WHERE session_id = ? and status == "A"`, [id], (err, row) => {
//         if (err || !row) {
//             consoleLogOut(`UploadAuth`, `Received forbidden access with URL: ${id}`);
//             // return res.status(400).json({ error: "Invalid URL" });
//             return res.status(400).json({ 
//                 status: 400,
//                 message: "Invalid URL",
//             });
//         }

//         // Check if the ID is expired
//         // const currentTime = Math.floor(Date.now() / 1000); // Get current time in seconds
//         const currentTime = Date.now(); // Get current time in seconds
//         consoleLogOut(`UploadAuth`,`${currentTime}`);
//         if (currentTime < row.startTime || currentTime > row.endTime) {
//             consoleLogOut(`UploadAuth`, `Expired or invalid access for URL: ${id}`);
//             return res.status(400).json({ error: "URL expired or not yet Activate" });
//         }

//         // Store the upload path in request object for later use
//         req.uploadPath = row.path;
        
//         consoleLogOut(`UploadAuth`, `Valid access granted for URL: ${id}`);
//         next(); // Proceed to the next middleware
//     });
// };