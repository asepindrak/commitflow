# 🧠 CommitFlow - Smart Project Insights

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![Docker](https://img.shields.io/badge/Docker-ready-blue)
![OpenAI](https://img.shields.io/badge/AI-OpenAI-green)
![TypeScript](https://img.shields.io/badge/TypeScript-4.0%2B-blue)
![Node.js](https://img.shields.io/badge/Node.js-22.x-brightgreen)
![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-orange)

**CommitFlow** is an **AI-powered project management and analytics platform** designed for modern development teams.  
It connects with your **GitHub repositories** to automatically analyze commits, visualize contributor activity, and provide **smart project insights** — while also helping teams manage tasks via an integrated **Kanban board**.

With CommitFlow, you can **plan, track, and analyze your projects** — all in one place.

> 🧪 **Note:** Project Management features (Kanban board, task tracking, comments, etc.) are currently **under development** and will be available in upcoming releases.

---

## 📁 Folder Structure

```
.
├── backend/               # Backend API (NestJS)
├── frontend/              # Frontend web app (React + Vite)
├── scripts/               # Helper shell scripts
├── .env.sample            # Environment variable example
├── docker-compose.dev.yml # Docker setup for development (with hot reload)
├── docker-compose.yml     # Docker setup for production
└── README.md              # Project documentation
```

---

## ✨ Features

### 🔧 Project Management
- 🗂 **Kanban Board** – Organize your project visually with drag-and-drop task management.  
- 👥 **Assignees & Collaboration** – Assign tasks to contributors and manage team workloads.  
- 💬 **Task Comments & Reports** – Add comments or report directly within each task for clear communication and issue tracking.  
- 🗄️ **S3 Storage Integration** – Upload and store documents or images securely in AWS S3, linked directly to related tasks.  
- ⏱ **Task Tracking** – Track progress, completion time, and project milestones.  
- 🧾 **Project Overview** – View all tasks, commits, and discussions in one unified dashboard.  
> ⚙️ *This module is currently in development and will be released in a future update.*

### 📊 Developer Insights
- 📈 **GitHub Analytics** – Fetch organization repositories, commits, and contributor stats.
- 🔍 **Contribution Breakdown** – Understand who contributes what and when.
- 📆 **Activity Timeline** – Visualize commit frequency and collaboration trends.

### 🤖 AI-Powered Insights
- 💡 **AI Recommendations** – Get automatic suggestions for prioritization and sprint planning.
- 🧠 **Smart Summaries** – Let AI summarize repository activity and project status.
- 🗣️ **Insight Chatbot** – Ask questions like “Who’s most active this week?” or “Which repo grew fastest?”

### 🐳 Infrastructure & Security
- 🧩 **PostgreSQL Storage** – Store structured task and analytics data.
- 🔐 **Environment Management** – Secure credentials via `.env` file.
- ⚙️ **Docker Ready** – Run everything locally or in production with one command.

---
## ⚙️ Requirements

- [Docker](https://www.docker.com/get-started) and Docker Compose  
- A **GitHub Personal Access Token** (with `repo` scope)  
- An **OpenAI API Key** (for AI Insights & Automation)  
- **AWS S3 Credentials** (for document and image storage)

---

## 🚀 Setup with Docker

### 1. Copy the environment file

```bash
cp .env.sample .env
```

Then fill in your configuration values:

```env
# Environment
NODE_ENV="development"

# Logger
DISCORD_WEBHOOK_URL=
LOG_LEVEL=info

# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=commitflow
DB_PORT=5432

# pgAdmin
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin123
ADMIN_PORT=8080

# Prisma
DATABASE_URL=postgresql://postgres:password@db:5432/commitflow

# Backend
BE_PORT=8000
OPENAI_API_KEY=
BASE_URL=http://localhost:8000
API_KEY=""
JWT_SECRET=""

# GitHub Integration
GITHUB_OWNER=
GITHUB_TOKEN=

# Frontend
FE_PORT=3000
VITE_API_URL="http://localhost:8000"

# S3 Storage
S3_BUCKET_NAME=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
# S3 COMPATIBLE STORAGE
S3_ENDPOINT_URL=
```

> **Note:** Use `db` as the PostgreSQL host inside Docker (not `localhost`).

---

### 2. Build and start all containers
For production:
```bash
./scripts/build.sh
```
For development (with hot reload and live updates):
```bash
./scripts/build.dev.sh
```
---

### 3. Verify running containers

```bash
docker ps
```

| Service  | URL                     |
|-----------|------------------------|
| Frontend  | http://localhost:3000  |
| Backend   | http://localhost:8000  |
| pgAdmin   | http://localhost:8080  |

---

### 4. Access pgAdmin

- Email: `admin@example.com`  
- Password: `admin123`

Then add a new PostgreSQL server:

| Field     | Value        |
|------------|--------------|
| Host       | db           |
| Database   | commitflow   |
| User       | postgres     |
| Password   | password     |

---

## 🧩 Prisma

If this is your first time running CommitFlow, run a Prisma database sync:

```bash
docker exec -it commitflow-api npx prisma db push
```

> The `scripts/build.sh` script automatically handles Prisma setup on first run.

---

## 🧠 Running the Application

**Development (hot reload):**
```bash
NODE_ENV="development"
```

**Production:**
```bash
NODE_ENV="production"
```

You can switch between development and production using different Docker Compose files.

---

## 🤝 Contributing

CommitFlow is open source and welcomes contributions!  
If you’d like to improve the Kanban UI, enhance the AI insights, or build integrations for new project tools — feel free to fork and open a pull request.

---

## 🧾 License

This project is licensed under the **MIT License**.  
Feel free to use, modify, and distribute it for both personal and commercial projects.

---

### 💬 Credits

Created with ❤️ by developers who love open source, AI, and productivity.
