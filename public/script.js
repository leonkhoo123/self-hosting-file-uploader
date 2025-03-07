document.addEventListener("DOMContentLoaded", function () {
    const isHttps = window.location.href.startsWith("https");
    const protocol = isHttps ? "https" : "http";
    const host = window.location.host;
    const healthCheckURL = `${protocol}://${host}/healthcheck`;

    fetch(healthCheckURL, { method: "GET" })
        .then(response => response.json())
        .then(result => {
            document.getElementById("healthcheck").textContent = result.message || "Healthcheck failed";
            document.getElementById("sessionId").textContent = "Session ID: " + result.sessionId || "";
            if (result.sessionId) {
                localStorage.setItem("sessionId", result.sessionId);
            }
        })
        .catch(error => {
            console.error("Error:", error);
            document.getElementById("healthcheck").textContent = "Healthcheck failed";
        });

    document.getElementById("uploadForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        const fileInput = document.getElementById("fileInput");
        if (!fileInput.files.length) {
            alert("Please select at least one file!");
            return;
        }

        const apiURL = `${protocol}://${host}/upload-chunk`;
        const CHUNK_SIZE = 7 * 1024 * 1024; // 7MB chunks
        let uploadedCount = 0, failedCount = 0;

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

        async function uploadChunk(file, chunk, chunkIndex, totalChunks, checksum, attempt = 1) {
            const formData = new FormData();
            formData.append("chunk", chunk);
            formData.append("originalName", file.name);
            formData.append("chunkIndex", chunkIndex);
            formData.append("totalChunks", totalChunks);
            formData.append("checksum", checksum); // Send checksum
            formData.append("req_sessionId", localStorage.getItem("sessionId")); // Attach session ID

            try {
                const response = await fetch(apiURL, { method: "POST", body: formData });
                const result = await response.json();
                if (!response.ok || result.error) throw new Error(result.message || `Chunk ${chunkIndex} failed`);
                console.log(`Uploaded chunk ${chunkIndex + 1}/${totalChunks} of ${file.name}.Checksum:${checksum}`);
            } catch (error) {
                console.error(`Error uploading chunk ${chunkIndex} of ${file.name}, attempt ${attempt}:`, error);
                if (attempt < 3) {
                    console.log(`Retrying chunk ${chunkIndex}, attempt ${attempt + 1}`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
                    return uploadChunk(file, chunk, chunkIndex, totalChunks, checksum, attempt + 1);
                } else {
                    console.error(`Failed to upload chunk ${chunkIndex} after 3 attempts`);
                    throw error;
                }
            }
        }

        let giveup = false;
        for (const file of fileInput.files) {
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                const buffer = await chunk.arrayBuffer();
                const checksum = adler32(new Uint8Array(buffer)); // Compute Adler-32 checksum

                try {
                    await uploadChunk(file, chunk, i, totalChunks, checksum);
                } catch (error) {
                    failedCount++;
                    giveup = true;
                    break; // Stop uploading this file on failure
                }
            }
            if(giveup){
                // if one of the chunk retry and fail to max attemp, give up that file, proceed to next
                break;
            }
            uploadedCount++;
        }

        document.getElementById("message").textContent =
            `Uploaded: ${uploadedCount}, Failed: ${failedCount}`;
    });
});
