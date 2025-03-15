document.addEventListener("DOMContentLoaded", function () {
    const isHttps = window.location.href.startsWith("https");
    const protocol = isHttps ? "https" : "http";
    const host = window.location.host;
    const urlParams = new URLSearchParams(window.location.search);
    const uploadId = urlParams.get("id"); // Get 'id' from URL (e.g., ?id=abc)
    const healthCheckURL = `${protocol}://${host}/healthcheck/${uploadId}`;
    const apiURL = `${protocol}://${host}/upload-chunk/${uploadId}`;

    fetch(healthCheckURL, { method: "GET" })
        .then(async (response) => {
            if (!response.ok) {
                try {
                    const errorData = await response.json(); // Try parsing JSON response
                    errorMessage = errorData.error || "Unknown error";
                } catch (e) {
                    console.error("Error parsing JSON response:", e);
                }
                throw { status: response.status, message: errorMessage };
            }
            return response.json();
        })
        .then(result => {
            document.getElementById("healthcheck").textContent = result.message || "Healthcheck failed";
            document.getElementById("sessionId").textContent = "Session ID: " + result.sessionId || "temp";
            if (result.sessionId) {
                localStorage.setItem("sessionId", result.sessionId);
            }
        })
        .catch(error => {
            console.error("Error:", error.message);
            document.getElementById("healthcheck").textContent = `${error.message}`;
        });

    document.getElementById("uploadForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        const fileInput = document.getElementById("fileInput");
        if (!fileInput.files.length) {
            alert("Please select at least one file!");
            return;
        }

        // const apiURL = `${protocol}://${host}/upload-chunk`;
        const CHUNK_SIZE = 7 * 1024 * 1024; // 7MB chunks
        let uploadedCount = 0, failedCount = 0;

        let giveup = false;
        for (const file of fileInput.files) {
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            for (let i = 0; i < totalChunks; i++) {
                let status = (totalChunks==1)? 'single' : (i == totalChunks-1) ? 'end' : (i == 0) ? 'start' : '';
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                const buffer = await chunk.arrayBuffer();
                const checksum = adler32(new Uint8Array(buffer)); // Compute Adler-32 checksum

                try {
                    await uploadChunk(file, chunk, i, totalChunks, checksum, status);
                } catch (error) {
                    failedCount++;
                    giveup = true;
                    break; // Stop uploading this file on failure
                }
            }
            if(giveup){
                // if one of the chunk retry and fail to max attemp, give up that file, proceed to next
                giveup = false; //reset give up status
                break; // GIVE UP this file 
            }
            uploadedCount++;
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

        async function uploadChunk(file, chunk, chunkIndex, totalChunks, checksum, status, attempt = 0) {
            const formData = new FormData();
            formData.append("chunk", chunk);
            formData.append("originalName", file.name);
            formData.append("chunkIndex", chunkIndex);
            formData.append("totalChunks", totalChunks);
            formData.append("checksum", checksum); // Send checksum
            formData.append("req_sessionId", localStorage.getItem("sessionId")); // Attach session ID
            formData.append("status", status); // get upload starting and ending status

            try {
                const response = await fetch(apiURL, { method: "POST", body: formData });
                const result = await response.json();
                if (!response.ok) {
                    throw {
                        status: response.status,
                        message: result.error || 'Unknown error',
                    };
                }
                console.log(`Uploaded chunk ${chunkIndex}/${totalChunks} of ${file.name}. Checksum: ${checksum}`);
            } catch (error) {
                // normal chunk upload error got 3 times retry
                if (attempt < 3 && error.status !== 400) {
                    console.error(`Error uploading chunk ${chunkIndex} of ${file.name}`);
                    console.log(`Retrying chunk ${chunkIndex}, attempt ${attempt + 1}`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
                    return uploadChunk(file, chunk, chunkIndex, totalChunks, checksum, status, attempt + 1 );
                } // error from status code 400, do not retry
                else if(error.status === 400) {
                    console.error(`File upload failed, error: ${error.message}`);
                    throw error;
                } else {
                    console.error(`Failed to upload chunk ${chunkIndex} after ${attempt} attempts, error: ${error.message} `);
                    throw error;
                }
            }
        }

        document.getElementById("message").textContent =
            `Uploaded: ${uploadedCount}, Failed: ${failedCount}`;
    });
});




document.addEventListener("DOMContentLoaded", function () {
    const fileInput = document.getElementById("fileInput");
    const selectFilesBtn = document.getElementById("selectFilesBtn");
    const uploadBtn = document.getElementById("uploadBtn");
    const fileList = document.getElementById("fileList");
    const uploadHeader = document.getElementById("uploadHeader");
    let uploadState = false;
    let files = [];

    selectFilesBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", handleFileSelection);
    uploadBtn.addEventListener("click", startUpload);

    function handleFileSelection() {
        files = Array.from(fileInput.files);
        if (files.length > 0) {
            uploadHeader.textContent = `${files.length} files selected`;
            renderFileList();
        } else {
            uploadHeader.textContent = "Select Files to Upload";
            fileList.innerHTML = "";
        }
    }

    function renderFileList() {
        fileList.innerHTML = "";
        files.slice(0, 5).forEach((file, index) => {
            const li = document.createElement("li");
            li.innerHTML = `
                <div class="flex justify-between items-center border p-2 rounded bg-gray-100">
                    <span>${file.name}</span>
                    <div class="w-1/2 h-2 bg-gray-300 rounded overflow-hidden">
                        <div id="progress-${index}" class="h-full bg-gray-500 w-0"></div>
                    </div>
                    <span id="status-${index}" class="text-sm text-gray-600">Pending</span>
                </div>
            `;
            fileList.appendChild(li);
        });
    }

    function startUpload() {
        if(!uploadState){
            uploadState = true;
            let uploadedCount = 0, failedCount = 0;
            uploadHeader.textContent = `Uploading file (0/${files.length})`;
            uploadBtn.innerText = "Cancel"; // Change button text
            files.forEach((file, index) => {
                simulateUpload(file, index).then(() => {
                    uploadedCount++;
                    updateHeader(uploadedCount, failedCount);
                }).catch(() => {
                    failedCount++;
                    updateHeader(uploadedCount, failedCount);
                });
            });
        }else{
            uploadBtn.innerText = "Upload now"; // Change button text
        }
        
    }

    function simulateUpload(file, index) {
        return new Promise((resolve, reject) => {
            const progressBar = document.getElementById(`progress-${index}`);
            const statusText = document.getElementById(`status-${index}`);
            let progress = 0;

            const interval = setInterval(() => {
                if (progress >= 100) {
                    clearInterval(interval);
                    if (Math.random() > 0.1) {
                        progressBar.classList.replace("bg-gray-500", "bg-green-500");
                        statusText.textContent = "Success";
                        statusText.classList.replace("text-gray-600", "text-green-600");
                        resolve();
                    } else {
                        progressBar.classList.replace("bg-gray-500", "bg-red-500");
                        statusText.textContent = "Failed";
                        statusText.classList.replace("text-gray-600", "text-red-600");
                        reject();
                    }
                } else {
                    progress += 10;
                    progressBar.style.width = `${progress}%`;
                    statusText.textContent = `${progress}%`;
                }
            }, 300);
        });
    }

    function updateHeader(uploaded, failed) {
        uploadHeader.textContent = `Uploading file (${uploaded + failed}/${files.length})`;
    }
});