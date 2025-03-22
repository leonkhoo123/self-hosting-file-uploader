document.addEventListener("DOMContentLoaded", function () {
    //api related const
    const isHttps = window.location.href.startsWith("https");
    const protocol = isHttps ? "https" : "http";
    const host = window.location.host;
    const urlParams = new URLSearchParams(window.location.search);
    const uploadId = urlParams.has("id") && urlParams.get("id")?.trim() ? urlParams.get("id").trim() : "invalid";
    const healthCheckURL = `${protocol}://${host}/healthcheck/${uploadId}`;
    const apiURL = `${protocol}://${host}/upload-chunk/${uploadId}`;

    //UI related const
    const fileInput = document.getElementById("fileInput");
    const selectFilesBtn = document.getElementById("selectFilesBtn");
    const fileList = document.getElementById("fileList");
    const uploadHeader = document.getElementById("uploadHeader");
    const healthCheckContainer = document.getElementById("healthcheck");
    const titleArea = document.getElementById("titleArea");
    const uploadHeaderHolder = document.getElementById("uploadHeaderHolder");
    const listlength = 100; 
    let uploadState = false;
    let giveup = false;
    selectFilesBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", handleFileSelection);

    fetch(healthCheckURL, { method: "GET" })
    .then(async (response) => {
        return response.json();
    })
    .then(result => {
        titleArea.innerHTML = `
            <h1  class="text-4xl font-bold text-gray-800">${result.servername || "Leon NAS"}</h1>
            <span class="text-xs text-gray-500">${result.path|| " "}</span>
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
        <button id="uploadBtn" class="${result.status === 200 ? '' : 'hidden'} bg-green-500 text-white px-2 py-2 rounded sm:px-3 sm:py-2">Upload Now</button>
        <button id="cancelBtn" class="bg-gray-500 text-white px-2 py-2 rounded sm:px-3 sm:py-2 hidden">Cancel</button>
        `;

        if (result.sessionId) {
            localStorage.setItem("sessionId", result.sessionId);
        }

        // Attach the event listener AFTER adding the button to the DOM
        document.getElementById("uploadBtn").addEventListener("click", startUpload);
        document.getElementById("cancelBtn").addEventListener("click", stopUpload);
    })
    .catch(error => {
        console.error("Error:", error.message);
        document.getElementById("healthcheck").textContent = `${error.message}`;
    });

    function handleFileSelection() {
        if (fileInput.files.length > 0) {
            uploadHeader.textContent = `${fileInput.files.length} files selected`;
            renderFileList();
        } else {
            uploadHeader.textContent = "Select Files to Upload";
            uploadHeaderHolder.classList.remove("pb-2");
            uploadHeaderHolder.classList.remove("mb-2");
            fileList.innerHTML = "";
        }
    }

    function renderFileList() {
        if (fileInput.files.length > 0) {
            uploadHeaderHolder.classList.add("pb-2");
            uploadHeaderHolder.classList.add("mb-2");
            fileList.innerHTML = "";
            for (let i = 0; i < Math.min(fileInput.files.length, listlength); i++) {
                const file = fileInput.files[i];
                const li = document.createElement("li");
                li.innerHTML = `
                    <div id="list-${file.name}" class="flex justify-between items-center p-2 rounded bg-gray-100">
                        <span class = "w-4/12 overflow-hidden text-ellipsis whitespace-nowrap mr-3">${file.name}</span>
                        <div class="w-5/12 sm:w-6/12 h-2 bg-gray-300 rounded overflow-hidden">
                            <div id="progress-${file.name}" class="h-full bg-gray-500 w-0"></div>
                        </div>
                        <div class="flex w-3/12 sm:w-2/12 overflow-hidden justify-center items-center">
                            <span id="status-${file.name}"  class="text-sm text-gray-600 ml-2">Pending</span>
                        </div>
                    </div>
                `;
                fileList.appendChild(li);
            };
        } else {
            uploadHeader.textContent = "Select Files to Upload";
            uploadHeaderHolder.classList.remove("pb-2");
            uploadHeaderHolder.classList.remove("mb-2");
            fileList.innerHTML = "";
        }
    }

    async function startUpload() {
        console.log(`file length: ${fileInput.files.length}`);
        renderFileList();
    
        if (!uploadState) {
            console.log("start!!");
            uploadState = true;
    
            let uploadedCount = 0, failedCount = 0;
            uploadHeader.textContent = `Uploading file (0/${fileInput.files.length})`;
            document.getElementById("uploadBtn").classList.add("hidden");
            document.getElementById("cancelBtn").classList.remove("hidden");
            selectFilesBtn.classList.add("hidden");
    
            const CHUNK_SIZE = 7 * 1024 * 1024; // 7MB chunks
            const MAX_PARALLEL_UPLOADS = 3; // Max parallel uploads
            let fileQueue = [...fileInput.files]; // Convert FileList to Array
            let uploadPromises = []; // Initialize properly
    
            async function processFile(file) {
                let failchunk = false;
                const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
                updateProgressBarStarting(file.name, totalChunks)
                for (let i = 0; i < totalChunks; i++) {
                    let status = (totalChunks == 1) ? 'single' : (i == totalChunks - 1) ? 'end' : (i == 0) ? 'start' : '';
                    const start = i * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);
    
                    const buffer = await chunk.arrayBuffer();
                    const checksum = adler32(new Uint8Array(buffer)); // Compute Adler-32 checksum
    
                    try {
                        await uploadChunk(file, chunk, i, totalChunks, checksum, status);
                    } catch (error) {
                        failedCount++;
                        updateProgressBarFailed(file.name);
                        failchunk = true;
                        break; // Stop uploading this file on failure
                    }
    
                    if (giveup) {
                        failedCount++;
                        updateProgressBarCancel(file.name);
                        console.log(`Aborted Chunk`);
                        failchunk = true;
                        break;
                    }
    
                    updateProgressBar(file.name, i, totalChunks);
                }
    
                if (!failchunk) {
                    uploadedCount++;
                }
    
                updateFileList(file.name, uploadedCount + failedCount);
    
                // Start the next file immediately if available
                if (fileQueue.length > 0) {
                    let nextFile = fileQueue.shift();
                    let nextPromise = processFile(nextFile);
                    uploadPromises.push(nextPromise); // Track the new upload
                    await nextPromise; // Wait for it to finish (prevents unhandled rejections)
                }
            }
    
            // Start initial uploads (max 3) & track them
            for (let i = 0; i < MAX_PARALLEL_UPLOADS && fileQueue.length > 0; i++) {
                let nextFile = fileQueue.shift();
                uploadPromises.push(processFile(nextFile));
            }
    
            // Wait until all uploads finish
            await Promise.all(uploadPromises);
    
            // Upload ended, reset all states
            uploadState = false;
            giveup = false;
    
            if (fileInput.files.length > 0) {
                uploadHeader.textContent = `Upload completed (${uploadedCount + failedCount}/${fileInput.files.length})`;
            } else {
                uploadHeader.textContent = "Select Files to Upload";
            }
    
            document.getElementById("uploadBtn").classList.remove("hidden");
            document.getElementById("cancelBtn").classList.add("hidden");
            selectFilesBtn.classList.remove("hidden");
            document.getElementById("fileInput").value = "";
            console.log("end!!");
        } else {
            console.log(`Please wait for the upload to complete.`);
        }
    } 
    
    function stopUpload(){
        if(uploadState){
            giveup=true;
            document.getElementById("cancelBtn").textContent = `Stoping`;
        }
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
        } catch (error) {
            // normal chunk upload error got 3 times retry
            if (attempt < 3 && error.status !== 400) {
                console.error(`Error uploading chunk ${chunkIndex+1} of ${file.name}`);
                console.log(`Retrying chunk ${chunkIndex+1}, attempt ${attempt + 1}`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
                return uploadChunk(file, chunk, chunkIndex, totalChunks, checksum, status, attempt + 1 );
            } // error from status code 400, do not retry
            else if(error.status === 400) {
                console.error(`File upload failed, Error: ${error.message}`);
                throw error;
            } else {
                console.error(`Failed to upload chunk ${chunkIndex+1} after ${attempt} attempts, Error: ${error.message} `);
                throw error;
            }
        }
        console.log(`Uploaded chunk ${chunkIndex +1}/${totalChunks} of ${file.name}. Checksum: ${checksum}`);
    }

    function updateFileList(filename,uploadCount){
        uploadHeader.textContent = `Uploading file (${uploadCount}/${fileInput.files.length})`;

        if(fileInput.files.length>1 && uploadCount!=fileInput.files.length){
            const listItem = document.getElementById(`list-${filename}`);
            if (!listItem) return; // Skip if the element isn't found
    
            listItem.style.transition = "opacity 0.5s, transform 0.5s";
            listItem.style.opacity = "0";
            listItem.style.transform = "translateY(35px)";
        
            setTimeout(() => {
                fileList.appendChild(listItem); // Move to the bottom
            }, 500); // Wait for animation to complete
            
            setTimeout(() => {
                listItem.style.opacity = "1";
                listItem.style.transform = "translateY(0px)";
            }, 700); // Slight delay after moving
        }
    }

    function updateProgressBarStarting(filename,totalChunks) {
        const progressBar = document.getElementById(`progress-${filename}`);
        if (!progressBar) return; // Skip if the element isn't found
        progressBar.style.transition = "width 0.5s ease-in-out"; // Apply smooth transition

        console.log(`Starting filename: ${filename}, totalChunks: ${totalChunks}`)
        document.getElementById(`progress-${filename}`).style.width = `${0}%`; 
        document.getElementById(`status-${filename}`).textContent = `${0}%`;
    }

    function updateProgressBar(filename,chunkIndex,totalChunks) {
        console.log(`filename: ${filename}, chunk: ${chunkIndex+1}, totalChunks: ${totalChunks}, Percent: ${(((chunkIndex + 1) / totalChunks) * 100).toFixed(0)}%`)
        document.getElementById(`progress-${filename}`).style.width = `${(((chunkIndex + 1) / totalChunks) * 100).toFixed(0)}%`; 
        document.getElementById(`status-${filename}`).textContent = `${(((chunkIndex + 1) / totalChunks) * 100).toFixed(0)}%`;
        if((chunkIndex+1) == totalChunks){
            document.getElementById(`progress-${filename}`).style.backgroundColor = '#00c951';
        }
    }

    function updateProgressBarFailed(filename) {
        console.log(`filename: ${filename}, failed to upload`)
        document.getElementById(`status-${filename}`).style.color = 'red';
        document.getElementById(`status-${filename}`).textContent = `Fail`;
    }

    function updateProgressBarCancel(filename) {
        console.log(`filename: ${filename}, cancelled`)
        document.getElementById(`status-${filename}`).style.color = 'red';
        document.getElementById(`status-${filename}`).textContent = `Cancel`;

        if(fileInput.files.length>1){
            const listItem = document.getElementById(`list-${filename}`);
            
            if (!listItem) return; // Skip if the element isn't found
        
            listItem.style.transition = "opacity 0.3s, transform 0.3s";
            listItem.style.opacity = "0";
            listItem.style.transform = "translateY(35px)";
            
            setTimeout(() => {
                fileList.appendChild(listItem); // Move to the bottom
            }, 300); // Wait for animation to complete
            
            setTimeout(() => {
                listItem.style.opacity = "1";
                listItem.style.transform = "translateY(0px)";
            }, 500); // Slight delay after moving
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