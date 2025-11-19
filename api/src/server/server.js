import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// ✅ Add this block
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://192.168.29.101:5173",
      "https://preplacental-christi-interactive.ngrok-free.dev"
    ],
    credentials: true,
  })
);

app.use(express.json());
