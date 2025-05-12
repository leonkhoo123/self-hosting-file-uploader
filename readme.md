Yes, GitHub's `README.md` supports full [Markdown syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax), including:

* Code blocks (` ``` `)
* Tables
* Headings (`#`, `##`, etc.)
* Links and checklists

Here’s the enhanced `README.md` content in **Markdown format** you can copy directly into your `README.md` file:

---

````markdown
# 📂 Synology Upload Mini

A lightweight Express.js web server that enables secure file uploads to your NAS, with public access via Cloudflare Tunnel and administrative control via VPN or local network.

---

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

---

## 📦 Installation

1. Install **Node.js v18.19.1**
2. Clone the repository
3. Install dependencies:

```bash
npm install
````

---

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

---

## 🌍 Environment Variables

| Variable     | Description                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `ENV`        | Set to `prod` to mount real NAS directory (`/mnt/nas_uploads`). Local testing uses a debug path. |
| `CHUNK_SIZE` | Maximum file chunk size in MB (e.g., `3` for 3MB). Smaller values help with poor networks.       |
| `HOSTNAME`   | Used in admin to generate full upload URLs (e.g., `https://mydomain.com`).                       |

---

## 🐳 Docker Support

### 🏗️ Build Docker Image

```bash
docker build -t synology-upload-mini:v1 .
```

### 📦 Export Docker Image

```bash
docker save -o synology-upload-mini-v1.tar synology-upload-mini:v1
```

> Useful if you want to manually import the image on your NAS without using Docker Hub.

---

## 🧱 NAS Setup (Production Mode)

If using in `prod` mode:

* Ensure your NAS directory is mounted into `/mnt/nas_uploads` inside the container.
* Example `docker run` (simplified):

```bash
docker run -d \
  -p 3000:3000 \
  -v /volume1/upload:/mnt/nas_uploads \
  synology-upload-mini:v1
```

---

## ⚠️ Security Notes

* `adminserver.js` **should NOT be exposed publicly** unless proper authentication is added.
* Use **Cloudflare Tunnel** to expose only `server.js`.
* Each upload ID is:

  * Time-limited
  * Optional to revoke early via admin

---

## 📌 Roadmap Ideas

* [ ] Add login/auth for admin dashboard
* [ ] Add file listing and download support (cloud drive style)
* [ ] Support resumable uploads
* [ ] Add per-upload size quota

---

## 📄 License

MIT — free to use, modify, and deploy.

```

---

✅ **Summary**:
- You can copy-paste this directly into your `README.md`.
- It uses proper GitHub-supported markdown: ✅ headings, ✅ tables, ✅ code blocks, ✅ emojis.
- Let me know if you want `docker-compose.yml` or `.env.example` added.

Would you like a matching `.env.example` file as well?
```
