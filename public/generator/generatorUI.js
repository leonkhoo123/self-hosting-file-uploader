document.addEventListener("DOMContentLoaded", function () {
    const startDateInput = document.getElementById("start-date");
    const endDateInput = document.getElementById("end-date");
    const pathSelect = document.getElementById("nas-path");
    const addPathButton = document.getElementById("add-path");
    const generateButton = document.getElementById("generate");
    const urlList = document.getElementById("url-list");
    const addPathBtn = document.getElementById("add-path");
    const modal = document.getElementById("path-modal");
    const cancelPathBtn = document.getElementById("cancel-path");
    const confirmPathBtn = document.getElementById("confirm-path");
    const newPathInput = document.getElementById("new-path");
    const nasPathSelect = document.getElementById("nas-path");

    const isHttps = window.location.href.startsWith("https");
    const protocol = isHttps ? "https" : "http";
    const host = window.location.host;
    const urlPath = `${protocol}://${host}/`;

    let tempPath = ""; // Temporary path storage
    let tempOption = null; // Reference to the temporary option

    // Get the current date and time
    const now = new Date();
    // Convert to GMT+8
    now.setMinutes(now.getMinutes() + 480); // 480 minutes = 8 hours
    // Format YYYY-MM-DDTHH:MM
    const formattedDateTime = now.toISOString().slice(0, 16);
    startDateInput.value = formattedDateTime;
    
    // Fetch and populate NAS paths
    function loadPaths() {
        fetch(`${urlPath}paths`)
            .then(response => response.json())
            .then(paths => {
                pathSelect.innerHTML = "";
                paths.forEach(path => {
                    const option = document.createElement("option");
                    option.value = path;
                    option.textContent = path;
                    pathSelect.appendChild(option);
                });
            });
    }
    loadPaths();
    
    // Open modal
    addPathBtn.addEventListener("click", () => {
        modal.classList.remove("hidden");
        newPathInput.value = tempPath; // Restore last unsaved value
        newPathInput.focus();
    });

    // Close modal on cancel
    cancelPathBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
        newPathInput.value = ""; // Clear input
    });

    // Confirm and update path
    confirmPathBtn.addEventListener("click", () => {
        let newPath = newPathInput.value.trim();
        if (newPath) {
            tempPath = newPath; // Store temporarily
            if (!tempOption) {
                // Create option if it doesn't exist
                tempOption = document.createElement("option");
                nasPathSelect.appendChild(tempOption);
            }
            tempOption.value = newPath;
            tempOption.textContent = newPath;
            nasPathSelect.value = newPath; // Select the new value
        }
        modal.classList.add("hidden"); // Close modal
    });

    // Close modal when clicking outside
    window.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.classList.add("hidden");
            newPathInput.value = ""; // Clear input
        }
    });
    
    // Generate Secure URL
    generateButton.addEventListener("click", function () {
        const startTime = new Date(startDateInput.value).getTime();
        const endTime = new Date(endDateInput.value).getTime();
        const path = pathSelect.value;
        
        if (!startTime || !endTime || !path) {
            alert("Please fill all fields");
            return;
        }
        
        fetch(`${urlPath}generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startTime, endTime, path })
        })
        .then(response => response.json())
        .then(data => {
            loadUrls();
        });
    });

    // Fetch and display generated URLs
    function loadUrls() {
        fetch(`${urlPath}sessions`)
            .then(response => response.json())
            .then(urls => {
                urlList.innerHTML = "";
                // Sort URLs in descending order (latest first)
                // urls.sort((a, b) => b.id - a.id);
                urls.forEach(url => {
                    const listItem = document.createElement("li");
                    listItem.classList.add("flex", "justify-between", "items-center", "p-2", "rounded-md","border-2", "cursor-pointer");
                    let status = "Active";
                    let statusclass = "text-green-500";
                    if (url.status=="D"){
                        status = "Disabled";
                        statusclass = "text-red-500"
                        listItem.classList.add("border-red-500");
                    }else{
                        listItem.classList.add("border-green-500");
                        listItem.classList.add("hover:bg-gray-100");
                    }


                    // Main content (click to copy)
                    const contentDiv = document.createElement("div");
                    contentDiv.classList.add("flex","flex-col","w-4/5");
                    contentDiv.innerHTML = `
                        <strong class="overflow-hidden text-ellipsis whitespace-nowrap">${url.session_id}</strong> 
                        <div class="flex flex-col w-full justify-between item-center">
                            <div>Start Time : ${new Date(url.startTime).toLocaleString("en-GB")}</div>
                            <div>End Time : ${new Date(url.endTime).toLocaleString("en-GB")}</div>
                        </div>     
                        <div class="flex flex-col sm:flex-row w-full justify-start item-center">
                            <div class = "w-4/5"> path : ${url.path} </div>
                            <div class = "${statusclass}">${status} </div>
                        </div>     
                    `;
                   
                    listItem.appendChild(contentDiv);
                    urlList.appendChild(listItem);

                    // Disable button (aligned right)
                    if (url.status!="D"){
                        const disableBtn = document.createElement("button");
                        disableBtn.textContent = "Disable";
                        disableBtn.classList.add("hidden","sm:inline","bg-red-500", "text-white", "px-3", "py-1", "rounded", "hover:bg-red-700");
                        disableBtn.onclick = (e) => {
                            e.stopPropagation(); // Prevent triggering the copy event
                            disableUrl(url.session_id);
                        };
                        listItem.appendChild(disableBtn);

                        const disableSmallBtn = document.createElement("button");
                        disableSmallBtn.textContent = "X";
                        disableSmallBtn.classList.add("sm:hidden","bg-red-500", "text-white", "px-3", "py-1", "rounded", "hover:bg-red-700");
                        disableSmallBtn.onclick = (e) => {
                            e.stopPropagation(); // Prevent triggering the copy event
                            disableUrl(url.session_id);
                        };
                        listItem.appendChild(disableSmallBtn);

                        contentDiv.onclick = () => copyToClipboard(url.session_id);
                    }

                });
            });
    }
    
    loadUrls();

    window.copyToClipboard = function (id) {
        const url = `https://hostname.com/?id=${id}`;
        navigator.clipboard.writeText(url);
    
        // Show toast message
        const toast = document.getElementById("toast-message");
        // toast.textContent = `Copied: ${url}`;
        toast.classList.remove("hidden", "opacity-0");
        toast.classList.add("opacity-100");
    
        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.add("opacity-0");
            setTimeout(() => toast.classList.add("hidden"), 300);
        }, 2000);
    };
    
    // Disable a URL
    window.disableUrl = function (session_id) {
        fetch(`${urlPath}disable`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id })
        })
        .then(response => response.json())
        .then(() => loadUrls());
    };
});