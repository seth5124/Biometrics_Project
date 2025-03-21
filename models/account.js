const mongoose = require("mongoose");

const Account = new mongoose.Schema({
  id: new Uint8Array(16),
  name: {
    type: String,
    required: true,
  },
});
