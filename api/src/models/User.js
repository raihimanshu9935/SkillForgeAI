
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false }, // ✅ not required
    githubId: { type: String, required: false }, // ✅ allow null for GitHub users
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
