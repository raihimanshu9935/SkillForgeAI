import mongoose from "mongoose";

const JobSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    templateId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["queued", "processing", "done", "failed"],
      default: "queued",
      index: true,
    },
    artifactPath: { type: String, default: "" }, // relative path to ZIP
    logs: { type: [String], default: [] }, // timestamped lines
  },
  { timestamps: true }
);

export default mongoose.model("Job", JobSchema);
