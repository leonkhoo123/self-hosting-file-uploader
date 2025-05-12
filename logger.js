function getFormattedTime() {
    const now = new Date();
    return new Date(now.getTime() + 8 * 60 * 60 * 1000) // Convert to GMT+8
        .toISOString()
        .replace('T', ' ')
        .replace('Z', ''); // Format to readable output
}

// log output pattern
function consoleLogOut(application,sessionId, ...messages) {
    let session_id = sessionId || "";
    console.log(`[${getFormattedTime()}][${application}][sesionId:${session_id}][INFO]:`, ...messages);
}

function consoleErrorOut(application,sessionId, ...messages) {
    let session_id = sessionId || "";
    console.error(`[${getFormattedTime()}][${application}][sesionId:${session_id}][ERROR]:`, ...messages);
}

module.exports = { consoleLogOut, consoleErrorOut };
