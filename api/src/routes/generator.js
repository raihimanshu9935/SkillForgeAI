import express from "express";
import Job from "../models/Job.js";
import { runCodegenJob } from "../utils/codegenWorker.js";
import path from "path";
import fs from "fs-extra";

const router = express.Router();

// POST /projects/generate
router.post("/generate", async (req, res) => {
  try {
    const { userId, templateId } = req.body || {};
    if (!userId || !templateId) {
      return res
        .status(400)
        .json({ error: "userId and templateId are required" });
    }

    const job = await Job.create({
      userId: String(userId),
      templateId: String(templateId),
      status: "queued",
      logs: [],
    });

    // Fire-and-forget (MVP): run job in background
    runCodegenJob(job._id).catch((e) =>
      console.error("[CodegenJob] background error:", e.message)
    );

    return res.json({ message: "Job started", jobId: job._id });
  } catch (err) {
    console.error("generator POST error:", err);
    return res
      .status(500)
      .json({ error: "Internal error while generating project" });
  }
});

// GET /projects/job/:id - fetch job status/logs
router.get("/job/:id", async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

// (Optional convenience) GET /projects/artifact/:id - stream zip if ready
router.get("/artifact/:id", async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "done" || !job.artifactPath)
    return res
      .status(409)
      .json({ error: "Artifact not ready. Check job status later." });

  const abs = path.join(process.cwd(), job.artifactPath);
  const exists = await fs.pathExists(abs);
  if (!exists) return res.status(404).json({ error: "Artifact not found" });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${path.basename(abs)}"`
  );
  fs.createReadStream(abs).pipe(res);
});

export default router;
