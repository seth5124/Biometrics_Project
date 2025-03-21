/*
  This requires both NodeJS and MongoDB to be installed onto your PC


*/

// Importing required modules and the environment file
require("dotenv").config();
const multer = require("multer");
const mongoose = require("mongoose");
const express = require("express");
const bcrypt = require("bcrypt");
const File = require("./models/file.js");
const { fileLoader } = require("ejs");
const cookieParser = require("cookie-parser");

//set up Express web app
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//Creates uploads directory and handles file uploading
const upload = multer({ dest: "uploads" });

//Initiates connection to MongoDB
mongoose.connect(process.env.DATABASE_URL);

//Sets up EJS engine to render the index page
//This handles things like generating the file link
app.set("view engine", "ejs");

//Renders the home page when the site is initially loaded
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/ownerSearch", (req, res) => {
  res.render("ownerSearch");
});

//triggers when the upload button is pressed
app.post("/upload", upload.single("file"), async (req, res) => {
  //Creates a file object
  const fileData = {
    path: req.file.path,
    originalName: req.file.originalname,
  };

  // const passKey = await navigator.credentials.create({
  //   publicKey: {
  //     challenge: new Uint8Array([1, 2, 3, 4, 5, 6]),
  //     rp: { name: "Biometric File Transfer" },
  //     file: {
  //       id: new Uint8Array(16),
  //       name: fileData.originalName,
  //       displayName: fileData.originalName,
  //     },
  //     pubKeyCredParams: [
  //       { type: "public-key", alg: -7 },
  //       { type: "public-key", alg: -8 },
  //       { type: "public-key", alg: -257 },
  //     ],
  //   },
  // });

  //Hashes password and stores it if present
  if (req.body.password !== null && req.body.password !== "") {
    fileData.password = await bcrypt.hash(req.body.password, 5);
  }

  //Creates file
  const file = await File.create(fileData);

  //Re-renders the home page with the newly created file link
  res.render("index", { fileLink: `${req.headers.origin}/file/${file.id}` });
});

//Handles file links that have been clicked
app.route("/file/:id").get(handleDownload).post(handleDownload);

async function handleDownload(req, res) {
  const file = await File.findById(req.params.id);
  if (file.password !== null) {
    if (req.body.password == null) {
      res.render("password");
      return;
    }
  }

  if (!(await bcrypt.compare(req.body.password, file.password))) {
    res.render("password", { error: true });
    return;
  }

  file.downloadCount++;
  await file.save();
  console.log(file.downloadCount);

  res.download(file.path, file.originalName);
}

app.listen(process.env.PORT);
