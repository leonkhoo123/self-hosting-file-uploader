const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { consoleLogOut, consoleErrorOut } = require("./logger"); // import custom logger


// Path to the database file (stores it in your app folder)
const dbPath = path.join(__dirname, 'upload_ids.db');
const sessionId = `DataSource`
// Create or open the database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        consoleErrorOut(sessionId,"❌ Database connection failed:", err.message);
    } else {
        consoleLogOut(sessionId,"✅ Connected to SQLite database");
    }
});

// Create the table if it doesn't exist
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS url_session (
            id TEXT PRIMARY KEY,
            startTime INTEGER,
            endTime INTEGER,
            path TEXT,
            status TEXT,
            createdTime INTEGER
        )
    `);
});

module.exports = db;
