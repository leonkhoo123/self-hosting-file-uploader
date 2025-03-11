document.addEventListener("DOMContentLoaded", function () {
    const startDateInput = document.getElementById("start-date");
    const endDateInput = document.getElementById("end-date");
    const pathSelect = document.getElementById("nas-path");
    const addPathButton = document.getElementById("add-path");
    const generateButton = document.getElementById("generate");
    const urlList = document.getElementById("url-list");
    
    const isHttps = window.location.href.startsWith("https");
    const protocol = isHttps ? "https" : "http";
    const host = window.location.host;
    const urlPath = `${protocol}://${host}/`;

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
    
    // Add new NAS path
    addPathButton.addEventListener("click", function () {
        const newPath = prompt("Enter new NAS path:");
        if (newPath) {
            const option = document.createElement("option");
            option.value = newPath;
            option.textContent = newPath;
            pathSelect.appendChild(option);
            pathSelect.value = newPath;
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
            alert("Generated URL: " + data.url);
            loadUrls();
        });
    });
    
    // Fetch and display generated URLs
    function loadUrls() {
        fetch(`${urlPath}sessions`)
            .then(response => response.json())
            .then(urls => {
                urlList.innerHTML = "";
                urls.forEach(url => {
                    const listItem = document.createElement("li");
                    listItem.innerHTML = `
                        <strong>${url.id}</strong> - ${new Date(url.startTime).toLocaleString()} to ${new Date(url.endTime).toLocaleString()} - ${url.path} - Status: ${url.status}
                        <button onclick="copyToClipboard('${url.id}')">Copy</button>
                        <button onclick="disableUrl('${url.id}')">Disable</button>
                    `;
                    urlList.appendChild(listItem);
                });
            });
    }
    loadUrls();
    
    // Copy URL to clipboard
    window.copyToClipboard = function (id) {
        const url = `https://hostname.com/?id=${id}`;
        navigator.clipboard.writeText(url);
        alert("Copied: " + url);
    };
    
    // Disable a URL
    window.disableUrl = function (id) {
        fetch(`${urlPath}disable`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        })
        .then(response => response.json())
        .then(() => loadUrls());
    };
});