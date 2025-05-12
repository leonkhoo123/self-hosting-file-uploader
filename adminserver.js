const express = require('express');
const app = express();
const path = require("path");
const port = 3001;
const { consoleLogOut, consoleErrorOut } = require("./logger"); // import custom logger
const hostname = process.env.HOSTNAME || "localhost:3000";
const envMode = process.env.ENV || 'prod'; // fallback to 'production'
const applicationName = `AdminServer`;


const generator = require("./routes/generator");
// const shareRouter = require("./routes/share");


app.use("/generator", generator.router);
app.use("/generator", express.static(path.join(__dirname, "public/generator"))); // static page
// app.use("/share", shareRouter);

//Shared style.css
app.use(`/style.css`, (req, res) => {
    res.sendFile(path.join(__dirname, "public/style.css"));
});

app.listen(port, () => {
    consoleLogOut(applicationName,`system_log`, `Starting server with env: ${envMode}, hostname: ${hostname}MB`);
    consoleLogOut(applicationName,`system_log`,`Server running on port ${port}`);
});
