document.addEventListener("DOMContentLoaded", function () {
    const isHttps = window.location.href.startsWith("https");
    const protocol = isHttps ? "https" : "http";
    const host = window.location.host;
    const healthCheckURL = `${protocol}://${host}/healthcheck`;

    fetch(healthCheckURL, { method: "GET" })
        .then(response => response.json())
        .then(result => {
            document.getElementById("healthcheck").textContent = result.message || "Healthcheck failed";
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

        async function uploadChunk(file, chunk, chunkIndex, totalChunks, attempt = 1) {
            const formData = new FormData();
            formData.append("chunk", chunk);
            formData.append("originalName", file.name);
            formData.append("chunkIndex", chunkIndex);
            formData.append("totalChunks", totalChunks);

            try {
                const response = await fetch(apiURL, { method: "POST", body: formData });
                if (!response.ok) throw new Error(`Chunk ${chunkIndex} failed`);
                console.log(`Uploaded chunk ${chunkIndex + 1}/${totalChunks} of ${file.name}`);
            } catch (error) {
                console.error(`Error uploading chunk ${chunkIndex} of ${file.name}, attempt ${attempt}:`, error);
                if (attempt < 3) {
                    console.log(`Retrying chunk ${chunkIndex}, attempt ${attempt + 1}`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
                    return uploadChunk(file, chunk, chunkIndex, totalChunks, attempt + 1);
                } else {
                    console.error(`Failed to upload chunk ${chunkIndex} after 3 attempts`);
                    throw error;
                }
            }
        }
        
        for (const file of fileInput.files) {
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);
                try {
                    await uploadChunk(file, chunk, i, totalChunks);
                } catch (error) {
                    failedCount++;
                    break; // Stop uploading this file on failure
                }
            }
            uploadedCount++;
        }

        document.getElementById("message").textContent =
            `Uploaded: ${uploadedCount}, Failed: ${failedCount}`;
    });
});
