# Customer Quick Start Guide

This guide explains how a new person or customer can run and use the Codity distributed job scheduler locally.

## What this project does

Codity is a small monorepo that includes:
- a REST API for managing jobs, queues, schedules, and users,
- a background worker that processes jobs,
- a React frontend for managing the system,
- MongoDB and Redis for local development.

## Before you begin

Make sure you have:
- Node.js 20 or newer
- MongoDB installed and running
- Redis installed and running
- PowerShell on Windows

## 1. Open the project folder

Run all commands from the repository root, which is the folder that contains the main package.json file.

Example:
```powershell
Set-Location 'C:\Users\Rishi Narayana\Desktop\Codity'
```

## 2. Install dependencies

Run:
```powershell
npm install
```

## 3. Start the required services

Start MongoDB and Redis.

If you installed them in the default Windows locations, use:
```powershell
New-Item -ItemType Directory -Force -Path C:\data\db | Out-Null
& 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe' --dbpath C:\data\db
& 'C:\Program Files\Redis\redis-server.exe'
```

If your install paths are different, update the paths accordingly.

## 4. Load demo data

Run the database migration and seed scripts:
```powershell
npm run --prefix api db:migrate
npm run --prefix api db:seed
```

This creates a demo admin account:
- Email: admin@codity.com
- Password: password123

## 5. Start the application

You can start everything from the repository root with:
```powershell
.\start-all.ps1
```

Or start each part manually:
```powershell
npm run start:api
npm run start:worker
npm run start:frontend
```

## 6. Open the app

After the services are running:
- API health check: http://127.0.0.1:4000/health
- Frontend: http://127.0.0.1:5173

## 7. Sign in and use the dashboard

1. Open the frontend in your browser.
2. Sign in with the demo account:
   - Email: admin@codity.com
   - Password: password123
3. Use the dashboard to:
   - view jobs,
   - enqueue new jobs,
   - inspect queues and retry policies,
   - view workers and scheduled jobs.

## 8. Common customer workflow

A typical flow is:
1. Create or review a queue.
2. Create or review a retry policy.
3. Enqueue a job from the UI.
4. Watch the worker process it.
5. Review the job history and status.

## Troubleshooting

If something does not start:
- confirm MongoDB and Redis are running,
- confirm you ran the seed command,
- confirm you are running the commands from the repository root,
- check the terminal output for connection or port errors.

## Support

If you need help, share:
- the terminal output,
- the browser error message,
- and whether the API health endpoint is responding.
