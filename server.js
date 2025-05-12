const cron = require("node-cron");
const express = require("express");
const path = require("path");
const fs = require("fs");
const { consoleLogOut, consoleErrorOut } = require("./logger"); // import custom logger
const applicationName = `Server`;
const app = express();
const PORT = 3000;
const chunkSize = process.env.CHUNK_SIZE || 3 // 3MB per chunk default
const envMode = process.env.ENV || 'prod'; // fallback to 'production'

const uploads = require("./routes/uploads");
// const shareRouter = require("./routes/share");

app.use("/uploads", uploads.router);
app.use("/uploads", express.static(path.join(__dirname, "public/uploader"))); // static page

// app.use("/share", shareRouter);

// 6. Shared style.css served explicitly
app.use(`/style.css`, (req, res) => {
    res.sendFile(path.join(__dirname, "public/style.css"));
});

// Schedule cleanup every night at 5 AM
cron.schedule("0 5 * * *", uploads.clearTempUploads, {
    timezone: "Asia/Singapore",
});

// Start server
app.listen(PORT, () => {
    consoleLogOut(applicationName,`system_log`, `Starting server with env: ${envMode}, chunk size: ${chunkSize}MB`);
    uploads.clearTempUploads();
    uploads.loadUploadSessions();
    consoleLogOut(applicationName,`system_log`, `Server is running on http://localhost:${PORT}`);
});

