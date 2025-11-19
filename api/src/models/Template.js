import mongoose from "mongoose";

const TemplateSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    tags: { type: [String], default: [] },
    stack: { type: [String], default: [] },
    // Embedding vector (e.g., 1536 dims for text-embedding-3-small)
    embedding: { type: [Number], default: [] },
  },
  { timestamps: true }
);

const Template = mongoose.model("Template", TemplateSchema);
export default Template;
