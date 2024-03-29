//out requirements
import express from "express";
import compression from "compression";
import helmet from "helmet";
import useragent from "express-useragent";
import path from "path";
import { fileURLToPath } from 'url';
import { isWebUri } from "valid-url";
import {QRCodeCanvas} from "@loskir/styled-qr-code-node";




const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory


import shortId from 'shortid';
import { JSONFilePreset } from 'lowdb/node';


const port = 3000;

// set up the express server
const app = express();

app.use(helmet()); // set well-known security-related HTTP headers
app.use(compression());
app.use(useragent.express());

app.disable("x-powered-by");

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Define the directory where your HTML files (views) are located
app.set('views', path.join(__dirname, 'views'));

// Optionally, you can define a static files directory (CSS, JS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));


const removeFalsyElement = (object) => {
  const newObject = {};
  Object.keys(object).forEach(key => {
    if (object[key]) {
      newObject[key] = object[key];
    }
  });
  return newObject;
};

(async () => {

// Read or create db.json
const urlDefaultData = { redirects: [] };
const analyticsDefaultData = { events: [] };
const urlDB = await JSONFilePreset(path.join(__dirname, 'database', 'urlDB.json'), urlDefaultData);
const analyticsDB = await JSONFilePreset(path.join(__dirname, 'database', 'analyticsDB.json'), analyticsDefaultData);

app.get('/shorten', async (req, res) => {
  const url = req.query.url;
  const location = req.query.location ? req.query.location : "N/A";
  const style = req.query.style ? req.query.style : 1;
  const existingID = urlDB.data.redirects.find(obj => obj.url == url && obj.location == location && obj.style == style);
  const id = await existingID ? existingID['id'] : shortId.generate();

  if (!isWebUri(url)) { 
    res.sendStatus(400);
    return;
  }

  // Alternatively you can call db.write() explicitely later
  // to write to urlDB.json
  if (!existingID) {
    urlDB.data.redirects.push({ url: url, id: id, location: location, style: style});
    await urlDB.write();
  }

  const qrCode = await new QRCodeCanvas({
    width: 1000,
    height: 1000,
    image: path.join(__dirname, 'public', 'img', 'ucskydive.png'),
    data: `http://localhost:3000/${id}`,
    dotsOptions: {
        color: "#0f3858",
        type: "square"
    },
    backgroundOptions: {
        color: "#FFFFFF",
    },
    imageOptions: {
        hideBackgroundDots: false,
        margin: 0
    },
    qrCodeOptions: {
      qrOptions: "H"
    }
  });
  const base64QR = await qrCode.toDataUrl();

  res.render('index', {base64QR: base64QR, id: id});
});

app.get('/:id', async (req, res) => {
  const id = req.params.id;
  const urlObj = urlDB.data.redirects.find(obj => obj.id == id);
  
  let resolved = false;
  if (urlObj) {
    res.redirect(urlObj['url']);
    resolved = true;
  } else {
    res.sendStatus(404);
    resolved = false;
  }

  let userData = {
    id: id,
    url: urlObj ? urlObj['url'] : 'invalid ID',
    time: new Date().toLocaleString("en-US", {timeZone: "America/New_York"}),
    ip: JSON.stringify(req.ip),
    ...removeFalsyElement(req.useragent)
  };
  analyticsDB.data.events.push(userData);
  await analyticsDB.write();
});

app.get('/', async (req, res) => {
  res.render('index', {base64QR: undefined, id: undefined});
});

app.listen(port, () => {
  console.log(`Server started on port ${port}!`);
});
})();