/*
  This requires both NodeJS and MongoDB to be installed onto your PC


*/

// Importing required modules and the environment file
require("dotenv").config();
const multer = require("multer");
const mongoose = require("mongoose");
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const File = require("./models/file.js");
const fs = require("fs");
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

//triggers when the upload button is pressed
app.post("/upload", upload.single("file"), async (req, res) => {
  //Creates a file object
  const fileData = {
    path: req.file.path,
    originalName: req.file.originalname,
  };

  //Hashes password and stores it if present
  if (req.body.password !== null && req.body.password !== "") {
    fileData.password = await bcrypt.hash(req.body.password, 5);
  }

  //Creates file
  const file = await File.create(fileData);
  encryptFile(file.path, req.body.password);

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
  decryptFile(file.path, req.body.password);
  res.download(file.path, file.originalName, (err) => {
    if (err) {
      res.status(500).send("Error downloading the file.");
    } else {
      encryptFile(file.path, req.body.password);
    }
  });
}

// Encryption settings
const algorithm = "aes-256-cbc"; // Algorithm to use
const iterations = 100000; // Number of iterations for PBKDF2
const keyLength = 32; // Key length for AES-256
const ivLength = 16; // IV length for AES

// Function to derive a key and IV from a passphrase and salt
function deriveKeyAndIV(password, salt) {
  // Derive the key using PBKDF2
  const key = crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    keyLength,
    "sha256"
  );
  const iv = key.slice(0, ivLength); // Use the first 16 bytes as the IV
  return { key, iv };
}

// Function to encrypt the file content
function encryptFile(filePath, password) {
  try {
    // Generate a random salt
    const salt = crypto.randomBytes(16);

    // Derive the key and IV from the passphrase and salt
    const { key, iv } = deriveKeyAndIV(password, salt);

    // Read the file data
    const fileData = fs.readFileSync(filePath);

    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    // Encrypt the data
    const encryptedData = Buffer.concat([
      cipher.update(fileData),
      cipher.final(),
    ]);

    // Write the salt and encrypted data back to the file
    fs.writeFileSync(filePath, Buffer.concat([salt, encryptedData]));

    console.log("File encrypted successfully.");
  } catch (error) {
    console.error("Error during encryption:", error.message);
  }
}

// Function to decrypt the file content
function decryptFile(filePath, password) {
  try {
    // Read the file data
    const fileData = fs.readFileSync(filePath);

    // Extract the salt (first 16 bytes) and the encrypted data
    const salt = fileData.slice(0, 16);
    const encryptedData = fileData.slice(16);

    // Derive the key and IV from the passphrase and extracted salt
    const { key, iv } = deriveKeyAndIV(password, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(algorithm, key, iv);

    // Decrypt the data
    const decryptedData = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    // Write the decrypted data back to the file
    fs.writeFileSync(filePath, decryptedData);

    console.log("File decrypted successfully.");
  } catch (error) {
    console.error("Error during decryption:", error.message);
  }
}

app.listen(process.env.PORT);
