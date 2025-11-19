
// Offline Embeddings Generator (no OpenAI needed)
// Run: node ./src/utils/embedTemplates.js

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Template from "../models/Template.js";
import { pipeline } from "@xenova/transformers";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📂 Read templates from /infra/templates
async function readTemplates() {
  const dir = path.join(__dirname, "../../../infra/templates");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  const items = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(dir, f), "utf-8");
    items.push(JSON.parse(raw));
  }
  return items;
}

// 🧠 Convert template object into text for embedding
function toEmbedText(tpl) {
  const tags = Array.isArray(tpl.tags) ? tpl.tags.join(", ") : "";
  const stack = Array.isArray(tpl.stack) ? tpl.stack.join(", ") : "";
  return `${tpl.title}\n${tpl.description}\nTags: ${tags}\nStack: ${stack}`;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI missing in .env");
  }

  console.log("🧠 Loading local embedding model (all-MiniLM-L6-v2)...");
  const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

  await mongoose.connect(process.env.MONGODB_URI);
  const templates = await readTemplates();

  let upserts = 0;

  for (const tpl of templates) {
    console.log(`⚙️ Embedding: ${tpl.id}`);

    const text = toEmbedText(tpl);
    const output = await embedder(text, { pooling: "mean", normalize: true });

    // ✅ Correct way to flatten tensor
    const embedding = Array.from(output.data);

    await Template.findOneAndUpdate(
      { id: tpl.id },
      {
        id: tpl.id,
        title: tpl.title,
        description: tpl.description,
        tags: tpl.tags,
        stack: tpl.stack,
        embedding,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    upserts++;
  }

  console.log(`✅ Upserted templates: ${upserts}`);
  await mongoose.disconnect();
  console.log("🎉 Done generating local embeddings.");
}

// 🚀 Run
main().catch(async (err) => {
  console.error("❌ embedTemplates error:", err.message);
  await mongoose.disconnect();
});
