# Windows Handoff & Setup Plan

This playbook packages the project and gives Max (or any Windows user) a single command that installs every dependency: nvm, Node, npm packages, `.env`, and database migrations.

---

## 1. Prepare the bundle to send
1. From the repo root run (optional but recommended) to remove heavy folders:  
   `powershell -Command "Remove-Item -Recurse -Force server\node_modules, uploads, server\dev.db -ErrorAction SilentlyContinue"`
2. Zip the folder _from outside_ the repo directory so relative paths stay intact:  
   `Compress-Archive -Path '.\LRB Compliance Software' -DestinationPath '.\LRB-Compliance.zip'`
3. Share the ZIP plus this `SETUP_WINDOWS.md`. (Max only needs Windows + internet; the script downloads everything else.)

---

## 2. One-command install for Max
From the unzipped repo root:
```
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```

What the script now does automatically:
- Detects/installs **nvm for Windows**. If the bundled `nvm-setup.exe` is missing, it downloads the official installer silently.
- Installs and activates **Node 20.17.0** (change with `-NodeVersion 18.19.0` if needed).
- Runs `npm install` inside `server/`.
- Creates `server/.env` from `env.sample` if it doesn’t exist (use `-SkipEnvCopy` to opt out).
- Executes `npm run db:migrate` so the SQLite file is ready (use `-SkipMigrations` to skip).

Advanced flags (when needed):
- `-NvmInstallerPath C:\offline\nvm-setup.exe` → use a local installer instead of downloading.
- `-NvmDownloadUrl https://.../nvm-setup.exe` → override where the installer is fetched from.

---

## 3. Daily usage after the script
Every new shell (PowerShell):
```
nvm use 20.17.0
cd server
npm run dev   # or npm start
```
API will be available at `http://localhost:4000/api`, uploads land in `uploads/` (sibling to `server/`).

---

## 4. Troubleshooting checklist
- **`nvm` not recognized**: open a new PowerShell window and re-run `nvm use 20.17.0`.
- **Port already in use**: stop any other service on port 4000 or set a new `PORT` in `server/.env`.
- **Missing packages**: rerun the setup script or `cd server && npm install`.
- **Need a clean database**: delete `server/dev.db`, then rerun the setup script (or `npm run db:migrate`).

Re-run the same command on any Windows machine to bootstrap a clean environment—no manual installs required.

