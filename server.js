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

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/portfolioDB";
mongoose.connect(MONGO_URI)
.then(()=>console.log("MongoDB Connected successfully"))
.catch(err=>console.log("MongoDB Connection Error:", err.message));

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

const transporter = nodemailer.createTransport({
  service:"gmail",
  auth:{
    user:process.env.EMAIL,
    pass:process.env.PASS ? process.env.PASS.replace(/\s+/g, '') : ""
  }
});

// ================= VISITOR TRACKING =================

// ❗ Only track main pages (not CSS, JS, images)
app.use(async (req, res, next) => {
  try {
    if(req.originalUrl === "/" || req.originalUrl === "/login"){
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

    // Save to DB
    const newMessage = new Message({ name,email,subject,message });
    await newMessage.save();

    // Send Email notification to personal inbox
    try {
      if (process.env.EMAIL && process.env.PASS) {
        await transporter.sendMail({
          from: `"Portfolio Contact" <${process.env.EMAIL}>`,
          replyTo: email,
          to: process.env.EMAIL,
          subject: `[Portfolio Inquiry] ${subject || 'New Message'} from ${name}`,
          text: `You have received a new contact message from your portfolio website:\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
              <h2 style="color: #8b5cf6; margin-top: 0; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">New Portfolio Contact Message</h2>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #8b5cf6;">${email}</a></p>
              <p><strong>Subject:</strong> ${subject}</p>
              <div style="margin-top: 15px; padding: 15px; background: #f1f5f9; border-left: 4px solid #8b5cf6; border-radius: 6px;">
                <p style="margin: 0; white-space: pre-wrap;">${message}</p>
              </div>
              <p style="margin-top: 20px; font-size: 0.85em; color: #64748b;">
                Tip: You can hit <strong>Reply</strong> directly to respond to ${name} (${email}).
              </p>
            </div>
          `
        });
        console.log(`Email successfully delivered to ${process.env.EMAIL}`);
      }
    } catch (mailErr) {
      console.log("Email notification error:", mailErr.message);
    }

    res.json({ success:true, message:"Message sent successfully" });

  }catch(err){
    console.log("Contact form error:", err);
    res.status(500).json({ error:"Something went wrong" });
  }
});

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
    const messages = await Message.find().sort({date:-1});
    const visitors = await Visitor.find().sort({date:-1});

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

// ================= SERVER =================

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>{
  console.log(`Server running on port ${PORT}`);
});