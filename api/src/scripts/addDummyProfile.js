// src/scripts/addDummyProfile.js

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const { default: Profile } = await import("../models/Profile.js");

await Profile.create({
  userId: "123",
  rawResume:
    "Experienced MERN developer skilled in React, Node.js, Express, MongoDB, and REST APIs.",
  skills: ["React", "Node", "Express", "MongoDB", "JavaScript"],
  githubUsername: "testuser",
  githubRepos: [
    {
      name: "ai-chatbot",
      description: "Chatbot using Node.js and OpenAI",
      url: "https://github.com/testuser/ai-chatbot",
    },
    {
      name: "portfolio-site",
      description: "Personal portfolio built with React",
      url: "https://github.com/testuser/portfolio-site",
    },
  ],
  summary:
    "Full-stack developer passionate about AI and scalable web apps.",
});

console.log("✅ Dummy profile added!");
await mongoose.disconnect();
