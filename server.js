require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const cors = require("cors");

const app = express();

// Trust cloud proxy headers (Render, Railway, Heroku)
app.set("trust proxy", 1);

// Middleware
app.set("view engine","ejs");
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cors());

// ================= MONGODB CONNECTION =================

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/portfolioDB";

let isMongoConnected = false;

mongoose.connect(MONGO_URI)
.then(()=>{
  console.log("MongoDB Connected successfully to:", MONGO_URI.includes("mongodb.net") ? "MongoDB Atlas (Cloud)" : "Local MongoDB");
  isMongoConnected = true;
})
.catch(err=>{
  console.log("MongoDB Connection Error:", err.message);
  console.log("Server will still run but database features will be disabled.");
});

// ================= MODELS =================

// Message Schema
const messageSchema = new mongoose.Schema({
  name:String,
  email:String,
  subject:String,
  message:String,
  date:{ type:Date, default:Date.now }
});

const Message = mongoose.model("Message",messageSchema);

// Visitor Schema
const visitorSchema = new mongoose.Schema({
  ip:String,
  userAgent:String,
  date:{ type:Date, default:Date.now }
});

const Visitor = mongoose.model("Visitor",visitorSchema);

// ================= EMAIL CONFIG =================

// Build transporter lazily so env vars are always fresh
function createTransporter() {
  return nodemailer.createTransport({
    service:"gmail",
    auth:{
      user: process.env.EMAIL,
      pass: process.env.PASS ? process.env.PASS.replace(/\s+/g, '') : ""
    }
  });
}

// ================= VISITOR TRACKING =================

// Only track main pages (not CSS, JS, images)
app.use(async (req, res, next) => {
  try {
    if((req.originalUrl === "/" || req.originalUrl === "/login") && mongoose.connection.readyState === 1){
      const clientIp = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0].trim() : req.ip;
      const visitor = new Visitor({
        ip: clientIp,
        userAgent: req.headers["user-agent"]
      });
      await visitor.save();
    }
  } catch (err) {
    console.log("Visitor tracking error:", err.message);
  }
  next();
});

// ================= ROUTES =================

// Home
app.get("/",(req,res)=>{
  res.render("index");
});

// Contact Form
app.post("/send", async (req,res)=>{
  try{
    const {name,email,subject,message} = req.body;

    // Validation
    if(!name || !email || !message){
      return res.status(400).json({ error:"All fields required" });
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
      return res.status(400).json({ error:"Invalid email format" });
    }

    // Save to DB (only if connected)
    if(mongoose.connection.readyState === 1){
      try {
        const newMessage = new Message({ name,email,subject,message });
        await newMessage.save();
        console.log("Message saved to database.");
      } catch(dbErr) {
        console.log("DB save error (non-fatal):", dbErr.message);
      }
    } else {
      console.log("MongoDB not connected - skipping DB save, but continuing to send email.");
    }

    // Send Email notification to personal inbox
    const emailSuccess = await sendEmailNotification({ name, email, subject, message });

    if(emailSuccess){
      console.log("Email delivered to", process.env.EMAIL);
      res.json({ success:true, message:"Message sent successfully" });
    } else {
      // If email also fails, still respond success if at least saved to DB
      if(mongoose.connection.readyState === 1){
        res.json({ success:true, message:"Message saved successfully" });
      } else {
        res.status(500).json({ error:"Failed to send message. Please contact directly at abhis.26yadav@gmail.com" });
      }
    }

  }catch(err){
    console.log("Contact form error:", err);
    res.status(500).json({ error:"Something went wrong. Please try again." });
  }
});

// ================= EMAIL HELPER =================

async function sendEmailNotification({ name, email, subject, message }) {
  try {
    if (!process.env.EMAIL || !process.env.PASS) {
      console.log("Email credentials not set in environment variables.");
      return false;
    }

    const transporter = createTransporter();

    // Verify connection before sending
    await transporter.verify();

    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.EMAIL}>`,
      replyTo: email,
      to: process.env.EMAIL,
      subject: `[Portfolio Inquiry] ${subject || 'New Message'} from ${name}`,
      text: `You received a new contact message from your portfolio.\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #8b5cf6; margin-top: 0; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">
            📩 New Portfolio Contact Message
          </h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #8b5cf6;">${email}</a></p>
          <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
          <div style="margin-top: 15px; padding: 15px; background: #f1f5f9; border-left: 4px solid #8b5cf6; border-radius: 6px;">
            <p style="margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
          <p style="margin-top: 20px; font-size: 0.85em; color: #64748b;">
            💡 Tip: Hit <strong>Reply</strong> to respond directly to ${name} at ${email}.
          </p>
          <hr style="border-color: #e2e8f0; margin-top: 20px;">
          <p style="font-size: 0.8em; color: #94a3b8; margin: 0;">
            Sent from: <a href="https://my-portfolio-2lhg.onrender.com" style="color: #8b5cf6;">my-portfolio-2lhg.onrender.com</a>
          </p>
        </div>
      `
    });

    return true;
  } catch (mailErr) {
    console.log("Email notification error:", mailErr.message);
    return false;
  }
}

// ================= LOGIN =================

app.get("/login",(req,res)=>{
  res.render("login");
});

app.post("/login",(req,res)=>{
  const {username,password} = req.body;

  if(username === "Abhishekyadav" && password === "Abhishek@2005"){
    res.redirect("/admin");
  }else{
    res.send("Invalid login");
  }
});

// ================= ADMIN DASHBOARD =================

app.get("/admin", async (req,res)=>{
  try{
    const messages = mongoose.connection.readyState === 1 ? await Message.find().sort({date:-1}) : [];
    const visitors = mongoose.connection.readyState === 1 ? await Visitor.find().sort({date:-1}) : [];
    res.render("admin",{messages, visitors});
  }catch(err){
    console.log(err);
    res.send("Error loading dashboard");
  }
});

// ================= DELETE MESSAGE =================

app.get("/delete/:id", async (req,res)=>{
  try{
    await Message.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
  }catch(err){
    console.log(err);
    res.send("Delete error");
  }
});

// ================= HEALTH CHECK =================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    email: process.env.EMAIL ? "configured" : "not configured",
    timestamp: new Date().toISOString()
  });
});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>{
  console.log(`Server running on port ${PORT}`);
  console.log(`EMAIL env set: ${process.env.EMAIL ? "YES" : "NO"}`);
  console.log(`PASS env set: ${process.env.PASS ? "YES (length:" + (process.env.PASS.replace(/\s+/g,'').length) + ")" : "NO"}`);
  console.log(`MONGO_URI env set: ${process.env.MONGO_URI ? "YES (cloud)" : "NO (using local fallback)"}`);
});