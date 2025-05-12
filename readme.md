# 📂 Self-Hosting File Uploader

- A lightweight Express.js web server that enables secure file uploads to your NAS or any self-hosted server.  

- Public access is served via Cloudflare Tunnel, while admin control is restricted to VPN or local network access.


<br>
<br>

## 🛠️ Features

- 🔐 **Two-Service Architecture**:
  - `adminserver.js`: Admin-only service to generate, manage, and revoke unique upload URLs.
  - `server.js`: Public-facing service that allows file uploads through the generated URLs.
  
- 📡 **Cloudflare Tunnel Friendly**: Expose only the public-facing `server.js`, while keeping `adminserver.js` behind VPN or LAN.

- ⏱️ **Expiry-Controlled URLs**: Each upload URL has an expiry timestamp and can also be manually disabled.

- 🧩 **Chunked Uploads**: Upload large files in smaller chunks. Configurable chunk size for unstable networks.

- 🧾 **Simple API Structure**:
  - Public uploads: `http://<hostname>:3000/uploads/?id=<generated-id>`
  - Admin generator: `http://localhost:3001/generator`


<br>
<br>


## 📦 Installation

1. Install **Node.js v18.19.1**
2. Clone the repository
3. Install dependencies:

```bash
npm install
````

<br>
<br>


## 🚀 Execution

Start the two services in separate terminals:

### 🔧 Admin Server (private - for generating/upload ID management):

```bash
ENV=local node adminserver.js
```

* Port: `3001`
* Access (local/VPN only):
  `http://localhost:3001/generator`
  *(used to generate or disable unique upload URLs)*

### 🌐 Public Server (exposed via Cloudflare Tunnel):

```bash
ENV=local node server.js
```

* Port: `3000`
* Upload access:
  `http://localhost:3000/uploads/?id=<generated-id>`


<br>
<br>


## 🌍 Environment Variables

| Variable     | Description                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `ENV`        | Set to `prod` to mount real server directory to (`/mnt/nas_uploads`). `local` for debug/testing. |
| `CHUNK_SIZE` | Maximum file chunk size in MB (e.g., `3` for 3MB). Smaller values help with poor networks.       |
| `HOSTNAME`   | Used in admin to generate full upload URLs (e.g., `https://mydomain.com/uploads/?id=<generated-id>`).                       |


<br>
<br>


## 🐳 Docker Support

### 🏗️ Build Docker Image

```bash
docker build -t synology-upload-mini:v1 .
```

### 📦 Export Docker Image

```bash
docker save -o synology-upload-mini-v1.tar synology-upload-mini:v1
```

> Useful if you want to manually import the image on your server without using Docker Hub.


<br>
<br>


## 🧱 Container Setup (Production Mode)

If using in `ENV=prod` mode (default `prod` if not specified):

* Ensure your local directory is mounted into `/mnt/nas_uploads` inside the container.
* Example `docker run` (simplified):

```bash
docker run -d \
  -p 3000:3000 \    
  -p 3001:3001 \   
  -v /your/server/upload/path:/mnt/nas_uploads \  # Mount upload directory
  synology-upload-mini:v1
```

<br>
<br>

## ⚠️ Security Notes

* `adminserver.js` **should NOT be exposed publicly** unless proper authentication is added (currently **NOT**).
* Use **Cloudflare Tunnel** to expose only `server.js`.
* Each upload ID is:

  * Time-limited
  * Optional to revoke early via admin

<br>
<br>

## 📌 Roadmap Ideas

* [ ] Add file sharing support (cloud drive style)

<br>
<br>
<br>
<br>

