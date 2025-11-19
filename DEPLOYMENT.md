# Deployment Guide - SkillForge AI

This guide covers how to deploy the SkillForge AI platform using Vercel (Frontend), Render (Backend & Worker), and MongoDB Atlas (Database).

## Prerequisites

- GitHub Account
- Vercel Account
- Render Account
- MongoDB Atlas Account
- OpenAI API Key

## 1. Database (MongoDB Atlas)

1.  Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2.  Create a new Cluster (Free Tier is fine).
3.  Create a Database User (Username/Password).
4.  Allow Network Access (IP Whitelist): Add `0.0.0.0/0` (allow all) for easiest deployment, or specific IPs.
5.  Get Connection String: `mongodb+srv://<user>:<password>@cluster0.mongodb.net/skillforge?retryWrites=true&w=majority`

## 2. Backend (Render)

1.  Log in to [Render](https://render.com/).
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub repository.
4.  **Service 1: API**
    -   **Name:** `skillforge-api`
    -   **Root Directory:** `api`
    -   **Environment:** Node
    -   **Build Command:** `npm install`
    -   **Start Command:** `npm start`
    -   **Environment Variables:**
        -   `NODE_VERSION`: `18.17.0`
        -   `MONGODB_URI`: (Your Atlas Connection String)
        -   `JWT_SECRET`: (Generate a random string)
        -   `OPENAI_API_KEY`: (Your OpenAI Key)
        -   `FRONTEND_URL`: (Your Vercel URL, add later)

5.  **Service 2: AI Worker**
    -   **Name:** `skillforge-worker`
    -   **Root Directory:** `ai-worker`
    -   **Environment:** Python 3
    -   **Build Command:** `pip install -r requirements.txt`
    -   **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
    -   **Environment Variables:**
        -   `PYTHON_VERSION`: `3.9.0`

## 3. Frontend (Vercel)

1.  Log in to [Vercel](https://vercel.com/).
2.  Click **Add New...** -> **Project**.
3.  Import your GitHub repository.
4.  **Configure Project:**
    -   **Framework Preset:** Vite
    -   **Root Directory:** `client`
    -   **Build Command:** `npm run build`
    -   **Output Directory:** `dist`
    -   **Environment Variables:**
        -   `VITE_API_URL`: (Your Render API URL, e.g., `https://skillforge-api.onrender.com`)

5.  Click **Deploy**.

## 4. Final Configuration

1.  Once Frontend is deployed, copy the Vercel URL (e.g., `https://skillforge.vercel.app`).
2.  Go back to Render -> `skillforge-api` -> Environment.
3.  Update `FRONTEND_URL` with the Vercel URL.
4.  Redeploy API.

## 5. CI/CD

A GitHub Actions workflow has been created in `.github/workflows/ci.yml`. It will automatically run tests (if enabled) and build checks on every push to `main`.
