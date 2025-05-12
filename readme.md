node server.js
node adminserver.js

docker build -t synology-upload-mini:v33 .
docker save -o synology-upload-mini-v33.tar synology-upload-mini:v33
