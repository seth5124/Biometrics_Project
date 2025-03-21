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

//set up Express web app
const app = express();
app.use(express.urlencoded({ extended: true }));

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

//triggers when the upload button is pressed
app.post("/upload", upload.single("file"), async (req, res) => {
  //Creates a file object
  const fileData = {
    path: req.file.path,
    originalName: req.file.originalname,
    owner: req.body.owner,
  };
  console.log(req.file);
  console.log(fileData);
  if (req.body.password !== null && req.body.password !== "") {
    fileData.password = await bcrypt.hash(req.body.password, 5);
  }
  const file = await File.create(fileData);

  //Re-renders the home page with the newly created file link
  res.render("index", { fileLink: `${req.headers.origin}/file/${file.id}` });
});

//Handles file links that have been clicked
app.route("/file/:id").get(handleDownload).post(handleDownload);

async function handleDownload(req, res) {
  console.log("test");
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
