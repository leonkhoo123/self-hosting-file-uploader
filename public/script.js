document.addEventListener("DOMContentLoaded", function () {
    // Get the current hostname dynamically
    const host = window.location.hostname;
    const healthCheckURL = `http://${host}:3000/healthcheck`;

    fetch(healthCheckURL, { method: "GET" })
        .then(response => response.json()) // Parse JSON response
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

        const apiURL = `http://${host}:3000/upload`;

        const files = fileInput.files;
        let uploadedCount = 0;
        let failedCount = 0;
    
        for (const file of files) {
            const formData = new FormData();
            formData.append("file", file); // Send one file per request
    
            fetch(apiURL, {
                method: "POST",
                body: formData
            })
            .then(response => response.json())
            .then(result => {
                console.log(`File ${file.name} uploaded successfully`);
                uploadedCount++;
                if (uploadedCount + failedCount === files.length) {
                    document.getElementById("message").textContent = 
                        `Uploaded: ${uploadedCount}, Failed: ${failedCount}`;
                }
            })
            .catch(error => {
                console.error(`Error uploading ${file.name}:`, error);
                failedCount++;
                if (uploadedCount + failedCount === files.length) {
                    document.getElementById("message").textContent = 
                        `Uploaded: ${uploadedCount}, Failed: ${failedCount}`;
                }
            });
        }
    });
});
