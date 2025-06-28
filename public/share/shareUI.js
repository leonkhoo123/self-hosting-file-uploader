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
    // downloadFileBtn.addEventListener("click", () => handleFileDownload());
    downloadFileBtn.addEventListener("click", () => streamDownload());

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

    async function streamDownload() {
        // Use a placeholder URL for demonstration. You would replace this
        // with a real URL to a large file.
        // const fileUrl = 'https://speed.hetzner.de/100MB.bin'; // A public test file
        const suggestedFilename = 'test.mp4'; // Default file name if not provided

        const statusElement = document.getElementById('status');
        statusElement.textContent = 'Preparing to download...';

        // Check if the File System Access API is supported.
        if ('showSaveFilePicker' in window) {
            // streamDownload(downloadURL, fileName);
        } else {
            let expMsg = 'Your browser does not support the File System Access API. Please use a modern browser like Chrome, Edge, or a recent version of Firefox.';
            // alert(expMsg);
            statusElement.textContent = expMsg;
            return;
        }

        try {
            // 1. Prompt user for a save location and get a file handle.
            // This will open the native "Save As" dialog.
            statusElement.textContent = 'Waiting for you to select a save location...';
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: suggestedFilename,
            });

            // 2. Create a writable stream to write data to the file.
            // This stream is linked to the file handle.
            const writableStream = await fileHandle.createWritable();

            // 3. Fetch the data with streaming in mind.
            // The response.body is a ReadableStream.
            statusElement.textContent = 'Fetching file from the server...';
            const response = await fetch(downloadURL);

            // Check if the network request was successful (HTTP status code 200-299).
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 4. Pipe the readable stream from the fetch response to the writable stream.
            // This is the core of the streaming process. Data chunks are automatically
            // read from the network and written to the file on disk.
            statusElement.textContent = 'Downloading in progress...';
            const reader = response.body.getReader();
            const writer = writableStream.getWriter();

            let downloadedBytes = 0;
            const totalBytes = response.headers.get('content-length') ? parseInt(response.headers.get('content-length'), 10) : null;

            // Loop to read and write chunks
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break; // All data has been read
                }
                await writer.write(value);
                downloadedBytes += value.length;

                // Update status with progress (if total size is known)
                if (totalBytes) {
                    const progress = ((downloadedBytes / totalBytes) * 100).toFixed(0);
                    let downloadedMb = (downloadedBytes / 1024 / 1024).toFixed(2);; // Convert bytes to MB
                    let totalMb = (totalBytes / 1024 / 1024).toFixed(2);; // Convert bytes
                    statusElement.textContent = `Downloading... ${progress}% (${downloadedMb}MB / ${totalMb}MB)`;
                }// } else {
                //     statusElement.textContent = `Downloading... ${downloadedBytes} bytes downloaded`;
                // }
            }

            // Finalize the writing process.
            await writer.close();

            statusElement.textContent = 'Download complete!';
            console.log('Download complete!');

        } catch (error) {
            console.error('Download failed:', error);
            statusElement.textContent = `Download failed: ${error.message}`;
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