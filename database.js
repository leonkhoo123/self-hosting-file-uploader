const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { consoleLogOut, consoleErrorOut } = require("./logger"); // import custom logger
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

// Path to the database file (stores it in your app folder)
const dbPath = path.join(NAS_PATH, 'upload_ids.db');
const applicationName = `DataSource`;
// Create or open the database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        consoleErrorOut(applicationName,`system_log`,"❌ Database connection failed:", err.message);
    } else {
        consoleLogOut(applicationName,`system_log`,"✅ Connected to SQLite database");
    }
});

// Create the table if it doesn't exist
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS url_session (
            id INTEGER PRIMARY KEY,
            session_id TEXT NOT NULL UNIQUE,
            startTime INTEGER,
            endTime INTEGER,
            path TEXT,
            status TEXT,
            createdTime INTEGER
        )
    `);
    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_session_id ON url_session (session_id);
    `);
});
//CREATE UNIQUE INDEX idx_session_id ON url_session (session_id);

module.exports = db;
