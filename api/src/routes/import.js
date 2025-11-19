import express from "express";
import axios from "axios";
import Profile from "../models/Profile.js";

const router = express.Router();

// 🧾 Resume importer
router.post("/resume", async (req, res) => {
  try {
    const { userId, text } = req.body;
    if (!text) return res.status(400).json({ error: "Resume text required" });

    const skills = extractSkills(text);
    const profile = await Profile.findOneAndUpdate(
      { userId },
      { rawResume: text, skills },
      { upsert: true, new: true }
    );
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🐙 GitHub importer
router.post("/github", async (req, res) => {
  try {
    const { userId, username } = req.body;
    if (!username)
      return res.status(400).json({ error: "GitHub username required" });

    const reposRes = await axios.get(
      `https://api.github.com/users/${username}/repos?per_page=5`
    );

    const repos = await Promise.all(
      reposRes.data.map(async (r) => {
        let readme = "";
        try {
          const readmeRes = await axios.get(
            `https://raw.githubusercontent.com/${username}/${r.name}/main/README.md`
          );
          readme = readmeRes.data;
        } catch {
          readme = "";
        }
        return {
          name: r.name,
          description: r.description,
          url: r.html_url,
          readme,
        };
      })
    );

    const profile = await Profile.findOneAndUpdate(
      { userId },
      { githubUsername: username, githubRepos: repos },
      { upsert: true, new: true }
    );

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🧠 Skill extractor helper
function extractSkills(text) {
  const skillList = [
    "JavaScript",
    "TypeScript",
    "React",
    "Node",
    "Express",
    "MongoDB",
    "Tailwind",
    "Git",
    "Docker",
    "LangChain",
    "Python",
    "Next.js",
  ];
  const lower = text.toLowerCase();
  return skillList.filter((s) => lower.includes(s.toLowerCase()));
}

export default router;
