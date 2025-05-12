module.exports = {
    apps: [
        {
            name: "server",
            script: "./server.js",
            watch: true,
            ignore_watch: [
                "upload_ids.db",
                "upload_ids.db-journal",
                "logs",          // Ignore log directory
                "*.log",         // Ignore all .log files
                "node_modules",  // Ignore dependencies
                "pm2_logs",      // Ignore PM2 logs (if you store them separately)
                ".git",          // Ignore Git repo
                "npm-debug.log", // Ignore npm debug logs
            ],
            autorestart: true,
            restart_delay: 5000,
            merge_logs: true,
        },
        {
            name: "adminserver",
            script: "./adminserver.js",
            watch: true,
            ignore_watch: [
                "upload_ids.db",
                "upload_ids.db-journal",
                "logs",
                "*.log",
                "node_modules",
                "pm2_logs",
                ".git",
                "npm-debug.log",
            ],
            autorestart: true,
            restart_delay: 5000,
            merge_logs: true,
        },
    ],
};
