document.addEventListener("DOMContentLoaded", function () {
    //api related const
    const isHttps = window.location.href.startsWith("https");
    const protocol = isHttps ? "https" : "http";
    const host = window.location.host;
    const urlParams = new URLSearchParams(window.location.search);
    const uploadId = urlParams.has("id") && urlParams.get("id")?.trim() ? urlParams.get("id").trim() : "invalid";
    const basePath = "share";
    const healthCheckURL = `${protocol}://${host}/${basePath}/healthcheck/${uploadId}`;
    const apiURL = `${protocol}://${host}/${basePath}/upload-chunk/${uploadId}`;
    // const downloadURL = `${protocol}://${host}/${basePath}/download/${uploadId}`;
    const downloadURL = `${protocol}://${host}/${basePath}/download/video`; //debug ver

    //UI related const
    const healthCheckContainer = document.getElementById("healthcheck");
    const titleArea = document.getElementById("titleArea");
    const downloadFileBtn = document.getElementById("downloadFileBtn");
    let chunkSize = 3; // 3MB default
    downloadFileBtn.addEventListener("click", () => handleFileDownload());

    console.log("Download URL:", downloadURL);
    fetch(healthCheckURL, { method: "GET" })
        .then(async (response) => {
            return response.json();
        })
        .then(result => {
            titleArea.innerHTML = `
            <h1  class="text-4xl font-bold text-gray-800">${result.servername || "Leon NAS"}</h1>
            <span class="text-xs text-gray-500">${result.path || " "}</span>
        `;
            // Construct new HTML
            healthCheckContainer.innerHTML = `
        <div class="flex flex-col pl-1">
            <div class="flex items-center space-x-2">
                <span class="w-3 h-3 ${result.status === 200 ? 'bg-green-500' : 'bg-red-500'} rounded-full"></span>
                <span class="text-sm font-semibold text-gray-700">${result.message || "Healthcheck failed"}</span>
            </div>
            <span class="${result.status === 200 ? '' : 'hidden'} text-xs text-gray-500 pt-1 pl-5">Session ID: <span id="sessionId">${result.sessionId || " "}</span></span>
        </div>
        `;

            if (result.sessionId) {
                localStorage.setItem("sessionId", result.sessionId);
            }
            chunkSize = result.chunkSize || 3; // Set chunk size from server response (default 3MB)

            // Attach the event listener AFTER adding the button to the DOM
        })
        .catch(error => {
            console.error("Error:", error.message);
            document.getElementById("healthcheck").textContent = `${error.message}`;
        });

    async function handleFileDownload() {
        try {
            // 1. Prompt user to pick save location and filename
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: 'video.mp4', // or dynamically set this
                types: [
                    {
                        description: 'MP4 Video',
                        accept: { 'video/mp4': ['.mp4'] }
                    }
                ]
            });

            // 2. Create writable stream to selected file
            const writableStream = await fileHandle.createWritable();

            // 3. Start fetching the file from your backend
            const response = await fetch(downloadURL);
            if (!response.ok || !response.body) {
                throw new Error(`Download failed with status ${response.status}`);
            }

            // 4. Pipe stream directly from server to file
            const reader = response.body.getReader();
            while (true) {
                console.log("Reading chunk...");
                const { done, value } = await reader.read();
                if (done) break;
                await writableStream.write(value);
            }

            // 5. Close the file
            await writableStream.close();
            alert("Download completed.");
        } catch (err) {
            console.error("Download error:", err);
            alert("Download failed: " + err.message);
        }
    }


    function adler32(buffer) {
        let MOD_ADLER = 65521;
        let a = 1, b = 0;
        const len = buffer.length;
        for (let i = 0; i < len; i++) {
            a = (a + buffer[i]) % MOD_ADLER;
            b = (b + a) % MOD_ADLER;
        }
        return ((b << 16) | a) >>> 0; // Convert to unsigned 32-bit int
    }
});