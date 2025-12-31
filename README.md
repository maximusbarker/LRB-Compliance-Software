# LRB Compliance Software

## What This Is

This is a web-based software system for managing compliance data submissions. It has two main parts:
- **Front-end**: The web pages you see and interact with (forms, buttons, tables)
- **Back-end**: The server that stores your data in a database and handles user accounts

Think of it like a filing cabinet (back-end) with a desk (front-end) where you fill out forms. Everything you enter gets saved permanently in the database.

---

## Build Versions Explained

### Local Build (Reference Version)
**What it is**: A working prototype that saves everything in your web browser's temporary storage.

**Why it exists**: This was the first working version. It's kept as a reference so you can always go back and see how things worked before we connected it to a real database.

**Where to find it**:
- Main file: `LRB Brand Reference/index LRB compliance skeleton.v1RB.html`
- Backup copy: `BACKUPS/LRB Compliance skeleton 2.0.html`

**Important note**: This version doesn't need a server running. You can just open the HTML file in a browser and it works. However, if you close your browser or clear your browser data, all the information you entered will be lost.

### Enterprise Build (Current Version)
**What it is**: The production-ready version that saves everything to a real database file on your computer.

**Why it's better**: Your data is stored permanently in a database file (`dev.db`). Even if you close your browser or restart your computer, all your submissions, user accounts, and uploaded files are safe.

**Where to find it**: `LRB Brand Reference/index LRB compliance skeleton.html`

**Important note**: This version requires the server to be running. You need to start the server first (see setup instructions below), then open the HTML file in your browser.

---

## Understanding the Parts

### The Server (`server/` folder)
**What it does**: This is the "brain" of the system. It:
- Stores all your data in a database file
- Handles user logins and account creation
- Receives form submissions and saves them
- Stores uploaded PDF files

**Technical details**: It's built using Node.js (a program that runs JavaScript on your computer) and Express (a framework that makes it easy to build web servers). The database is SQLite, which stores everything in a single file on your hard drive.

### The Client Helper (`client/apiClient.js`)
**What it does**: This is a small piece of code that helps the web pages talk to the server. It handles:
- Sending login requests
- Submitting forms
- Uploading files
- Fetching data to display in tables

**Why it exists**: Instead of writing the same code over and over in the HTML file, we put all the "talking to the server" code in one place. This makes it easier to maintain and update.

### The Web Interface (HTML files)
**What it does**: This is what you see and click on. It includes:
- Login pages
- Data entry forms (External Data Request, Internal Data Request)
- The Internal Database view (where you see all submissions)
- Account Management page (for admins)

---

## How to Set Up and Run the Software

### Prerequisites (What You Need First)

1. **Node.js** (version 18 or higher)
   - **What it is**: A program that lets you run JavaScript code on your computer
   - **How to get it**: Download from https://nodejs.org/ (get the LTS version)
   - **How to check if you have it**: Open a terminal/command prompt and type `node --version`. If you see a number like "v20.17.0", you're good.

2. **npm** (comes with Node.js)
   - **What it is**: A package manager that downloads and installs code libraries
   - **How to check if you have it**: Type `npm --version` in a terminal. You should see a version number.

### Step-by-Step Setup Instructions

#### Option 1: Automated Setup (Easiest - Windows Only)

If you're on Windows and want everything set up automatically:

1. Open PowerShell (search for "PowerShell" in your Start menu)
2. Navigate to the project folder:
   ```
   cd "C:\Users\YourName\OneDrive\Documents\Cursor Builds\LRB Compliance Software"
   ```
   (Replace "YourName" with your actual Windows username)
3. Run the setup script:
   ```
   powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
   ```
4. Wait for it to finish. The script will:
   - Install or update Node.js to version 20.17.0
   - Download all required code libraries
   - Create the configuration file
   - Set up the database

5. When it's done, start the server:
   ```
   cd server
   npm run dev
   ```

6. You should see a message like "Server running on port 4000" or "API listening at http://localhost:4000"

7. Now open the HTML file in your browser:
   - Navigate to: `LRB Brand Reference/index LRB compliance skeleton.html`
   - Double-click it, or right-click and choose "Open with" → your web browser

#### Option 2: Manual Setup (All Operating Systems)

If you prefer to do it step-by-step yourself, or if you're not on Windows:

1. **Open a terminal/command prompt**
   - Windows: Press `Win + R`, type `cmd`, press Enter
   - Mac: Press `Cmd + Space`, type "Terminal", press Enter
   - Linux: Press `Ctrl + Alt + T`

2. **Navigate to the server folder**:
   ```
   cd "path\to\LRB Compliance Software\server"
   ```
   (Replace the path with your actual folder location)

3. **Install dependencies** (download all the code libraries needed):
   ```
   npm install
   ```
   This might take a few minutes. You'll see a lot of text scrolling by - that's normal. It's downloading all the pieces the server needs to work.

4. **Create the configuration file**:
   - Look for a file called `env.sample` in the `server` folder
   - Copy it and rename the copy to `.env` (just a dot, then "env", no extension)
   - On Windows: You might need to show file extensions first (File Explorer → View → check "File name extensions")
   - The `.env` file contains settings like database location and secret keys. The defaults work fine for local testing.

5. **Set up the database**:
   ```
   npm run db:migrate
   ```
   This creates the database file and sets up all the tables (like creating an empty filing cabinet with labeled drawers).

6. **Start the server**:
   ```
   npm run dev
   ```
   You should see messages indicating the server is running. Keep this terminal window open - if you close it, the server stops.

7. **Open the web interface**:
   - Navigate to the `LRB Brand Reference` folder
   - Double-click `index LRB compliance skeleton.html`
   - It should open in your default web browser

---

## How to Use the Software

### First Time Setup

1. **Start the server** (see instructions above)
2. **Open the HTML file** in your browser
3. **Create an account**:
   - Click "Client Portal" on the landing page
   - You'll need an organization code (ask your administrator)
   - Enter your email and create a password
   - Click "Sign Up"

### Daily Use

1. **Start the server** (if it's not already running):
   - Open terminal/command prompt
   - Navigate to the `server` folder
   - Type `npm run dev` and press Enter
   - Keep this window open

2. **Open the web interface**:
   - Double-click `index LRB compliance skeleton.html`

3. **Log in**:
   - Use the email and password you created
   - The system will automatically show you the right pages based on your account type

4. **Submit data**:
   - Fill out the External Data Request form or Internal Data Request form
   - Click "Submit"
   - Your data is now saved in the database

5. **View submissions**:
   - Go to the "Internal Database" tab
   - You'll see all submissions organized by year and client
   - You can search, filter, and sort the data

### Stopping the Server

When you're done for the day:
1. Go back to the terminal window where the server is running
2. Press `Ctrl + C` (hold Control and press C)
3. The server will stop

---

## File Locations Explained

### Where Your Data is Stored

- **Database file**: `server/dev.db`
  - This is a SQLite database file containing all submissions, user accounts, and metadata
  - You can back this up by copying the file
  - **Important**: Don't delete this file! It contains all your data.

- **Uploaded files**: `uploads/` folder (at the root of the project)
  - All PDF files that users upload are stored here
  - Files are named with a timestamp and the original filename
  - Example: `202412291430_project-map.pdf`

### Configuration Files

- **`.env` file**: `server/.env`
  - Contains settings like database location, secret keys, and email configuration
  - **Important**: Never share this file publicly - it contains sensitive information

---

## Troubleshooting

### "Cannot find module" error
**Problem**: The server can't find required code libraries.
**Solution**: Run `npm install` in the `server` folder again.

### "Port 4000 already in use" error
**Problem**: Another program is using port 4000.
**Solution**: 
- Close any other programs that might be using that port
- Or change the port number in `server/.env` file (look for `PORT=4000` and change it to something else like `PORT=4001`)

### "Database is locked" error
**Problem**: The database file is being used by another process.
**Solution**: 
- Make sure you only have one server running
- Close any other programs that might be accessing `server/dev.db`
- Restart your computer if the problem persists

### The web page shows errors in the browser console
**Problem**: The front-end can't connect to the server.
**Solution**:
- Make sure the server is running (check the terminal window)
- Make sure the server is running on port 4000 (check the startup messages)
- Try refreshing the web page
- Check that `window.API_BASE_URL` in the HTML matches your server address

### "Organization code invalid" error
**Problem**: The organization code you're using doesn't exist in the database.
**Solution**: 
- Ask your administrator for the correct organization code
- Or, if you're an admin, create the organization first using the Account Management page

---

## Moving the Software to Another Computer

### What to Copy

1. **The entire project folder** (everything)
2. **Don't copy**:
   - `node_modules/` folder (this gets recreated when you run `npm install`)
   - `uploads/` folder (unless you want to keep old uploads)
   - `server/dev.db` (unless you want to keep the data - but be careful, this contains all user accounts and submissions)

### Setting Up on the New Computer

1. Copy the entire project folder to the new computer
2. Follow the setup instructions above (starting from "Install dependencies")
3. If you copied `dev.db`, make sure it's in the `server/` folder
4. Start the server and test that everything works

---

## Getting Help

If you run into problems:
1. Check the troubleshooting section above
2. Look at the server terminal window for error messages
3. Check the browser console (press F12, then click the "Console" tab) for error messages
4. Make sure all prerequisites are installed correctly

---

## Technical Details (For Developers)

### API Endpoints

The server provides these endpoints:
- `POST /api/auth/signup` - Create a new user account
- `POST /api/auth/login` - Log in with email and password
- `GET /api/me` - Get current user information
- `POST /api/submissions` - Create a new submission
- `GET /api/submissions` - List all submissions (filtered by organization)
- `POST /api/uploads` - Upload a PDF file

### Database Schema

The database has these main tables:
- `organizations` - Client organizations
- `users` - User accounts
- `submissions` - Form submissions (stored as JSON)
- `uploads` - Uploaded file metadata

See `server/src/db.js` for the complete schema definition.

---

## Next Steps (Future Development)

- Connect the Account Management page to the backend API
- Add email notifications for password resets
- Implement role-based access control in the UI
- Add data export features
- Set up automated backups
