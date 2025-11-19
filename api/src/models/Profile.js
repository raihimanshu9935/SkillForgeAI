import mongoose from "mongoose";

const ProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    rawResume: String,
    skills: [String],
    githubUsername: String,
    githubRepos: [
      {
        name: String,
        description: String,
        url: String,
        readme: String,
      },
    ],
    summary: String,
  },
  { timestamps: true }
);

const Profile = mongoose.model("Profile", ProfileSchema);

export default Profile;
