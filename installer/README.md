### LRB Jun30 Build Installer

This repo includes a self-install bootstrapper you can ship with a zip.

#### Build `install.exe` (recommended)

From repo root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\installer\build-install-exe.ps1
```

This produces:
- `installer\install.exe`

#### Run installer (EXE or PS1)

- Run `installer\install.exe`
  - Click **Yes** when prompted
  - It installs prerequisites via `winget` if missing (Git, Node.js LTS)
  - It creates a new folder: `LRB Jun30 Build` in the user profile
  - It installs server dependencies (`npm install`)
  - It creates desktop shortcuts:
    - `LRB Jun30 - Start`
    - `LRB Jun30 - Open UI`

Fallback (no EXE):

```powershell
powershell -ExecutionPolicy Bypass -File .\installer\Install-LRB.ps1
```

#### Notes
- Video files are excluded from the copy step.
- The UI is opened from the canonical file:
  - `LRB Brand Reference/index LRB compliance skeleton.html`


