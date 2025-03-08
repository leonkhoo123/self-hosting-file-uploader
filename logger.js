function getFormattedTime() {
    const now = new Date();
    return new Date(now.getTime() + 8 * 60 * 60 * 1000) // Convert to GMT+8
        .toISOString()
        .replace('T', ' ')
        .replace('Z', ''); // Format to readable output
}

// log output pattern
function consoleLogOut(sessionId, ...messages) {
    console.log(`[${getFormattedTime()}][${sessionId}][INFO]:`, ...messages);
}

function consoleErrorOut(sessionId, ...messages) {
    console.error(`[${getFormattedTime()}][${sessionId}][ERROR]:`, ...messages);
}

module.exports = { consoleLogOut, consoleErrorOut };
