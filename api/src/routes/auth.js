import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

/* --------------------- 🌐 GITHUB OAUTH --------------------- */
router.get("/github", (req, res) => {
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    process.env.GITHUB_OAUTH_CALLBACK
  )}&scope=user:email`;

  console.log("🌐 Redirecting user to GitHub:", redirectUrl);
  res.redirect(redirectUrl);
});

router.get("/github/callback", async (req, res) => {
  const { code } = req.query;
  console.log("↩️ Callback hit with code:", code);

  try {
    // 🔹 Step 1: Exchange code for access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    console.log("🔍 GitHub Token Response:", tokenResponse.data);

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) throw new Error("❌ No access token received");

    // 🔹 Step 2: Fetch user info
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log("👤 GitHub User Data:", userResponse.data);
    const { login, name, email } = userResponse.data;

    // GitHub sometimes doesn’t return email → fallback
    const finalEmail = email || `${login}@github.com`;

    // 🔹 Step 3: Find or create user in MongoDB
    let user = await User.findOne({ email: finalEmail });
    if (!user) {
      user = await User.create({
        name: name || login,
        email: finalEmail,
        githubId: login,
      });
      console.log("🆕 New GitHub user created:", user.email);
    } else {
      console.log("🔁 Existing user found:", user.email);
    }

    // 🔹 Step 4: Create signed JWT
    const payload = { id: user._id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    console.log("✅ JWT Payload:", payload);
    console.log("✅ JWT Generated:", token);

    // 🔹 Step 5: Redirect back to frontend with encoded token
    const redirectUrl = `${process.env.FRONTEND_URL}/login?token=${encodeURIComponent(token)}`;
    console.log("🔑 Redirecting user to frontend with token:", redirectUrl);

    return res.redirect(redirectUrl);
  } catch (err) {
    console.error("❌ GitHub OAuth error:", err.message);
    if (err.response?.data) {
      console.error("🧾 GitHub Response:", err.response.data);
    }
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
});

/* --------------------- 📝 SIGNUP --------------------- */
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Signup failed" });
  }
});

/* --------------------- 🔐 LOGIN --------------------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "All fields required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

export default router;



