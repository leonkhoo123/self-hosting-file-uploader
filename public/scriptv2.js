document.addEventListener("DOMContentLoaded", function () {
    //api related const
    const isHttps = window.location.href.startsWith("https");
    const protocol = isHttps ? "https" : "http";
    const host = window.location.host;
    const urlParams = new URLSearchParams(window.location.search);
    const uploadId = urlParams.get("id"); // Get 'id' from URL (e.g., ?id=abc)
    const healthCheckURL = `${protocol}://${host}/healthcheck/${uploadId}`;
    const apiURL = `${protocol}://${host}/upload-chunk/${uploadId}`;

    //UI related const
    const fileInput = document.getElementById("fileInput");
    const selectFilesBtn = document.getElementById("selectFilesBtn");
    const uploadBtn = document.getElementById("uploadBtn");
    const fileList = document.getElementById("fileList");
    const uploadHeader = document.getElementById("uploadHeader");
    const healthCheckContainer = document.getElementById("healthcheck");
    let uploadState = false;
    let files = [];

    fetch(healthCheckURL, { method: "GET" })
    .then(async (response) => {
        // if (!response.ok) {
        //     try {
        //         const errorData = await response.json(); // Try parsing JSON response
        //         errorMessage = errorData.error || "Unknown error";
        //     } catch (e) {
        //         console.error("Error parsing JSON response:", e);
        //     }
        //     throw { status: response.status, message: errorMessage };
        // }
        return response.json();
    })
    .then(result => {
        // document.getElementById("healthcheck").textContent = result.message || "Healthcheck failed";
        // document.getElementById("sessionId").textContent = "Session ID: " + result.sessionId || "temp";
        // Construct new HTML
        healthCheckContainer.innerHTML = `
        <div class="flex flex-col pl-1">
            <div class="flex items-center space-x-2">
                <span class="w-3 h-3 ${result.status === 200 ? 'bg-green-500' : 'bg-red-500'} rounded-full"></span>
                <span class="text-sm font-semibold text-gray-700">${result.message || "Healthcheck failed"}</span>
            </div>
            <span class="${result.status === 200 ? '' : 'hidden'} text-xs text-gray-500 pt-1 pl-5">Session ID: <span id="sessionId">${result.sessionId || " "}</span></span>
        </div>
        <button id="uploadBtn" class="bg-green-500 text-white px-2 py-2 rounded sm:px-3 sm:py-2">Start Upload</button>
        `;

        if (result.sessionId) {
            localStorage.setItem("sessionId", result.sessionId);
        }

        // Attach the event listener AFTER adding the button to the DOM
        document.getElementById("uploadBtn").addEventListener("click", startUpload);
    })
    .catch(error => {
        console.error("Error:", error.message);
        document.getElementById("healthcheck").textContent = `${error.message}`;
    });

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
                    <span class = "w-4/12 overflow-hidden text-ellipsis whitespace-nowrap mr-3">${file.name}</span>
                    <div class="w-5/12 sm:w-6/12 h-2 bg-gray-300 rounded overflow-hidden">
                        <div id="progress-${index}" class="h-full bg-gray-500 w-0"></div>
                    </div>
                    <div class="flex w-3/12 sm:w-2/12 overflow-hidden justify-center items-center">
                        <span id="status-${index}"  class="text-sm text-gray-600 ml-2">Pending</span>
                    </div>
                </div>
            `;
            fileList.appendChild(li);
        });
    }

    function startUpload() {
        if(!uploadState){
            console.log("start!!")
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