Design:
A simple File Upload Webserver build using Express js.
Allow public access thru cloudflare Tunnel.

Consist of 2 different services.

Service 1 (adminserver.js) = this service do not designed to expose to public, allow admin to generate new unique upload URLs.(Currently accessing thru VPN to the server, if want to direct expose to public, need to add a authentication method for it, which currently dont have)

Service 2 (server.js) = this service allow public to access the website using the unique URLs generated, then upload files into your configured directory.

To prevent public abuse the upload feature,
Generated URLs will have an expiry date or admin can manually disable the specific URL before it expired.


Installation:
install node v18.19.1
then run 
npm install


Execution:
local debuging need to run 2 node server
ENV=local node server.js
ENV=local node adminserver.js

(for private access to genenerate/disable upload URLs id)
adminserver.js port = 3001 

(for public access, will check URLs validity, able to upload files to the path configured in adminserver.js)
server.js port = 3000 

sample url to access the adminserver.js
localhost:3001/generator (to generate new valid url id for server.js)
sample url to access the server.js
localhost:3000/uploads/?id=xxxxxxxxxxxxxxxx (the id is generated from adminserver.js)


Environment variable: 
HOSTNAME (allow copy full URL with hostname after generated the URL id) 

CHUNK_SIZE (control size of upload chunk, poor network can set to smaller value)

ENV (prod = point to /mnt/nas_uploads in container, mount your system direcotry to this path during setting up container, so container able to direct modify the directory.)


To Dokerize:
to pack it into docker image:
docker build -t synology-upload-mini:v1 .

if wan to export the image as a physical file and manually load it into your server (avoid docker hub)
docker save -o synology-upload-mini-v1.tar synology-upload-mini:v1



