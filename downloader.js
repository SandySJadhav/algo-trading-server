process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
const fs = require("fs");
const { mkdir } = require("fs/promises");
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const path = require("path");

const downloadFile = (async () => {
    const res = await fetch("https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json").then(response => response.body);
    if (!fs.existsSync("downloads")) await mkdir("downloads"); //Optional if you already have downloads directory
    const destination = path.resolve("./downloads", "allInstruments.json");
    const fileStream = fs.createWriteStream(destination);
    await finished(Readable.fromWeb(res).pipe(fileStream));
});

downloadFile();