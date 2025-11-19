
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import importRoutes from "./routes/import.js";
import recommenderRoutes from "./routes/recommender.js"; // 🧠 Phase 3: AI Recommender
import generatorRoutes from "./routes/generator.js";
import rateLimit from "./middleware/rateLimit.js";
import assistantRoutes from "./routes/assistant.js";

// ---------- Resolve __dirname in ES Modules ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Load .env file from parent directory ----------
dotenv.config({ path: path.join(__dirname, "../.env") });

// ---------- Express app ----------
const app = express();

// ---------- Middlewares ----------
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use("/projects", generatorRoutes); // mounts /projects/generate, /projects/job/:id, /projects/artifact/:id
app.use("/assistant", assistantRoutes);

app.use("/assistant", rateLimit);

// ---------- Routes ----------
app.use("/auth", authRoutes);
app.use("/import", importRoutes);
app.use("/projects", recommenderRoutes); // 🧩 Recommender Route (Phase 3)

// ---------- Health check ----------
app.get("/", (req, res) => res.send("SkillForge API running ✅"));
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// ---------- MongoDB connection + Server start ----------
const PORT = process.env.PORT || 4000;

// For Vercel serverless, we need to connect to MongoDB on each request
let isConnected = false;

async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    throw err;
  }
}

// Middleware to ensure DB connection before handling requests
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    res.status(500).json({ error: "Database connection failed" });
  }
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  connectToDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 SkillForge API running on port ${PORT}`);
      console.log(`🔗 Visit: http://localhost:${PORT}/health`);
    });
  });
}

// Export for Vercel
export default app;

/**
 * 🧪 Test Steps:
 *  1️⃣ Run embeddings setup:  node ./src/utils/embedTemplates.js
 *  2️⃣ Start server:          node ./src/index.js
 *  3️⃣ Test recommender:      GET http://localhost:4000/projects/suggest?userId=123
 * 
 * Expected output:
 * [
 *   {
 *     "id": "ai-ecommerce",
 *     "title": "AI E-Commerce Recommender",
 *     "similarity": 0.91,
 *     "tags": ["AI","ecommerce"],
 *     "stack": ["React","Node","MongoDB"],
 *     "shortReason": "Matches your skills: React, Node"
 *   }
 * ]
 */

