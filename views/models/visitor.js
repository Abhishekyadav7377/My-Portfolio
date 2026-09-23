const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema({
  ip: String,
  userAgent: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Visitor", visitorSchema);