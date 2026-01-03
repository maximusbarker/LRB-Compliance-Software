### LRB Jun30 Compliance Software — Feature Document (Enterprise Build)

**Document purpose**: describe the build’s current capabilities, roles, workflows, data handling, reporting, and install/distribution model.

**Last updated**: 2026-01-03  
**Build baseline tag**: `stable-20260102-2037`

---

## Overview

The **LRB Jun30 Compliance Software** is a Windows-friendly, self-hosted (local) compliance workflow for capturing redevelopment project data, generating required reports, and managing role-based access for agencies and internal staff. It includes robust submission management (draft/edit/final), report generation (TIF + JUN30), and document retention (uploaded project PDFs).

---

## Users & Roles

- **External Client (role: `user`)**
  - Creates and manages their agency’s projects.
  - Saves drafts, edits drafts, and submits a final certified submission.
  - Can view prior submissions; **final submissions are view-only**.
- **Internal Staff (role: `internal`)**
  - Access to internal database views, reporting, and document retrieval by project.
  - Can review submissions and generate reports.
- **Admin (role: `admin`)**
  - All internal capabilities plus account management and system configuration.

---

## Authentication & Security

- **JWT authentication** with protected API endpoints.
- **Role-based access control**
  - External users see only the external workflow.
  - Internal/admin users see external + internal database + admin features.
- **County/Agency user grouping**
  - Users are associated with **County + Agency** during account creation.
  - Submissions are filtered so users only see their assigned County/Agency data.
- **Login attempt rate limiting**
  - After 5 failed attempts, requests are temporarily blocked.
- **Logout hardening**
  - Protected UI sections are hidden and UI state resets when session is invalidated.
- **Human verification for account creation**
  - A captcha slider/puzzle gate is required before signup completes.

---

## Data Model & Storage

### Core entities

- **Organizations**
  - Organization is created automatically based on selected County/Agency.
  - Organization code is auto-generated (not entered by the user).
- **Users**
  - Stored with role and County/Agency assignments.
- **Submissions**
  - Primary record for project reporting data.
  - Lifecycle states:
    - **draft**: editable, not certified
    - **final**: certified; locked for external users
- **Submission events (audit log)**
  - Event types: created / updated / finalized / deleted
  - **Before finalization**: stores **top-level changed fields** per update
  - **After finalization**: stores a **full payload snapshot** for finalized events and any post-final admin/internal updates
- **Uploads**
  - PDF uploads stored on disk; metadata stored in DB.
  - Internal/admin can retrieve documents by project/submission.

---

## External Client Workflow (Draft → Final)

### Primary actions

- **New Draft**
  - Clears the form, exits edit mode, resets draft state.
- **My Submissions**
  - Opens a modal picker with:
    - Search
    - Status filter (All / Draft / Final)
    - Sorting (most recently updated, etc.)
    - **Auto (Latest Draft)** for one-click load
- **Save Draft**
  - Creates/updates a server-side draft (local fallback if server unavailable).
- **Submit Final**
  - Visible only when a saved draft is loaded.
  - Requires certification checkbox + typed full name (electronic signature).
  - Locks submission as **final**.

### Final certification language

> “By typing your full name below, you certify that, to the best of your knowledge and belief, the information provided in this submission is complete, accurate, and true. You understand this submission will be treated as your organization’s official filing and may be relied upon by LRB Public Finance Advisors and the applicable agency.”

---

## Internal/Admin Workflow (Review & Reporting)

### Internal Database (June 30th Database)

- Provides **Search / Year / Status** filters to locate clients and projects.
- **Projects list** per client/year includes action buttons:
  - **TIF** report generation (Excel)
  - **JUN30** report generation (PDF)
  - **Details** view
  - **Docs** (documents by project)
  - Edit/Delete (subject to role and finalization rules)

### Documents by Project (submitted PDFs)

- Internal/admin users can access uploaded PDFs:
  - **Docs** button in the project row (modal list with Open/Download)
  - **Details** view includes a **Documents** section that loads server-stored uploads
- Files are served via the API from `/uploads/...`.

---

## Report Generation

### TIF report (Excel)

- Generated from submission data using template mapping.
- Stored under a **County → Agency → Project** folder structure in the configured reports directory.

### JUN30 report (PDF)

- Generated per project/submission and saved to the backend.
- Stored with report metadata and file persistence.

---

## UI/UX Improvements Included

- **Growth rate input UX**
  - Replaced JSON array textarea with dynamic year/rate rows (add/remove).
- **TIF-required values captured**
  - CRA housing requirements, developer payments, reimbursements, etc.
- **Consistent “bubble” styling**
  - TIF-related inputs are visually marked and aligned.
- **Action buttons remain on one row**
  - Maintains compact project list even with many projects.
- **Robust startup behavior**
  - Prevents unauthenticated API calls and suppresses expected 401s.

---

## Installation & Distribution (Windows)

### Installer artifacts

- `installer/install.exe` (built locally)
- `installer/Install-LRB.ps1` (fallback)
- `installer/build-install-exe.ps1` (build tool)

### Installer behavior

- One confirmation prompt
- Creates a new install folder: **`LRB Jun30 Build`**
- Installs prerequisites:
  - Uses `winget` when available
  - Falls back to **portable Node** when `winget` is unavailable (no admin)
- Runs `npm install` for `server/`
- Creates desktop shortcuts:
  - `LRB Jun30 - Start` (start server and open UI)
  - `LRB Jun30 - Open UI`
- Creates an install log under `%TEMP%\LRB-Installer\`

---

## Operational Notes

- **Local-first deployment**: API runs on `http://localhost:4000`.
- **Persistence**: SQLite database under server configuration.
- **Docs**: video files are ignored by git and removed from history; uploads/docs are accessed via the app UI per submission/project.


