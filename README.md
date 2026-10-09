# Values List & More

[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-v14+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19.2-blue.svg)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57.svg)](https://github.com/WiseLibs/better-sqlite3)

Values List & More is a small Express + SQLite web app for browsing item values, viewing value history, and comparing trades.

<div align="center">
  <strong>Browse Item Values → Compare Trades → Manage Data</strong><br>
  <em>Search & sorting • Value charts • Trade calculator • Admin bulk upload</em>
</div>

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Data Storage](#data-storage)
- [Project Structure](#project-structure)
- [API](#api)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

### Value List
- Search items by name
- Type `?` in search to list only items without an image
- Sort by value, name, demand, and existence count
- Open item detail modal with current stats and value history chart

### Trade Calculator
- Build both sides of a trade with item picker
- Compare total values instantly
- Reset and iterate quickly while negotiating

### Admin Area
- Password-protected admin panel
- Create, edit, and delete items
- Admin search also supports `?` to show only items without an image
- Bulk import items from CSV or JSON

### UI/UX
- Dark/light theme toggle
- Responsive layout for desktop and mobile

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Tschakala/UniversalItemValueListWebsite.git
cd UniversalItemValueListWebsite

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

Open `http://localhost:3001`.

---

## Prerequisites

Before running the app, install:

- Node.js (v14+ recommended)
- npm

---

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Tschakala/UniversalItemValueListWebsite.git
   cd UniversalItemValueListWebsite
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

---

## Usage

### Public Pages
- `/` - value list + trade calculator
- `/admin.html` - admin interface

### Admin Workflow
1. Open `/admin.html`
2. Log in with your admin password
3. Create, edit, or delete items
4. Upload a CSV or JSON file for bulk import

### Bulk Upload Format

**CSV header**
```csv
name,value,imageUrl,demand,existCount
```

**JSON array**
```json
[
  {
    "name": "Example item",
    "value": 12.5,
    "imageUrl": "https://example.com/image.png",
    "demand": "High",
    "existCount": 0
  }
]
```

---

## Configuration

Environment variables:

- `PORT` - server port (default: `3001`)
- `NODE_ENV` - `development` or `production` (default: `development`)
- `ADMIN_PASSWORD` - admin password (default: `admin123`)
- `ALLOWED_ORIGIN` - CORS origin in production (default: `https://tq.tschakala.at`)

Server entry point: `server.js`

---

## Data Storage

SQLite database location:

```text
data/items.db
```

On first startup, the app seeds sample items if the database is empty.

Item value history is automatically recorded when items are created or updated.

---

## Project Structure

```text
UniversalItemValueListWebsite/
├── server.js            # Express server and API routes
├── db.js                # SQLite schema, seed data, and DB helpers
├── package.json         # Node scripts and dependencies
├── README.md
├── data/
│   └── items.db         # SQLite database (created at runtime)
└── public/
    ├── index.html       # Main value list + calculator UI
    ├── admin.html       # Admin UI
    ├── script.js        # Frontend logic for list/calculator/details
    ├── admin.js         # Frontend logic for admin operations
    ├── style.css        # Styling and responsive layout
    └── theme.js         # Theme toggle logic
```

---

## API

### Public Endpoints
- `GET /api/items`
- `GET /api/items?search=term`
- `GET /api/items/:id`
- `GET /api/items/:id/history`

### Admin Endpoints (require `x-admin-password`)
- `GET /api/admin/verify`
- `POST /api/items`
- `PUT /api/items/:id`
- `DELETE /api/items/:id`
- `POST /api/items/upload`

---

## Troubleshooting

### Server does not start
**Error:** `EADDRINUSE` (port already in use)

**Fix:**
- Change `PORT` environment variable
- Or stop the process currently using that port

### Admin login fails
**Fix:**
- Ensure `x-admin-password` matches `ADMIN_PASSWORD`
- Confirm no extra spaces in your entered password

### Upload is rejected
**Fix:**
- Use valid CSV or JSON format
- Ensure each row/object has a non-empty `name` and numeric `value >= 0`
- Keep upload size within server limits

---

<div align="center">
  <strong>Made with ❤️ in Austria</strong>
</div>

---

## License

ISC License
