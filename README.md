# Open Torrent Client (OTC) — v1.1.0 Pro Edition

<div align="center">

**A production-grade, standalone Windows desktop BitTorrent client**

[![Version](https://img.shields.io/badge/version-1.1.0%20Pro-blue.svg)](https://github.com/infovirtuspk-png/Open-Torrent-Client/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue.svg)](https://github.com/infovirtuspk-png/Open-Torrent-Client)
[![Electron](https://img.shields.io/badge/Electron-43.x-47848F.svg)](https://electronjs.org)
[![WebTorrent](https://img.shields.io/badge/WebTorrent-2.x-orange.svg)](https://webtorrent.io)
[![Tests](https://img.shields.io/badge/tests-9%2F9%20passing-brightgreen.svg)](#testing)
[![Build](https://github.com/infovirtuspk-png/Open-Torrent-Client/actions/workflows/release.yml/badge.svg)](https://github.com/infovirtuspk-png/Open-Torrent-Client/actions/workflows/release.yml)

> Developed by **Engineer Qasim Ahmad** — [engineerqasimahmad@gmail.com](mailto:engineerqasimahmad@gmail.com)

</div>

<div align="center">
    <a href="https://github.com/infovirtuspk-png/Open-Torrent-Client/releases/latest/download/Open.Torrent.Client.Setup.1.1.0.exe">
        <img src="https://img.shields.io/badge/%E2%96%B6%20DOWNLOAD%20%26%20INSTALL- Windows%20x64-18a558?style=for-the-badge&logo=windows&logoColor=white" alt="Download and install Open Torrent Client for Windows">
    </a>
    <br>
    <sub>Latest signed-ready NSIS installer • Windows 10/11 • x64</sub>
</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Running from Source](#running-from-source)
- [Building the Installer](#building-the-installer)
- [Project Structure](#project-structure)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [UI Sections](#ui-sections)
- [Settings & Configuration](#settings--configuration)
- [Testing](#testing)
- [Security & Safety](#security--safety)
- [License](#license)
- [Developer](#developer)

---

## Overview

**Open Torrent Client** is a complete, standalone Windows desktop torrent application built with Electron and WebTorrent. It features a real BitTorrent engine, local SQLite persistence, system tray integration, Magnet URI protocol capture, a built-in file manager, live torrent inspection, a **realtime system performance telemetry dashboard**, and a background CLI terminal — all packaged into a single `.exe` installer.

This is **not** a web wrapper or browser extension. It is a full desktop application with:
- A real, local WebTorrent engine (no cloud backend required)
- A persistent SQLite database for session state & lifetime statistics
- Native Windows `magnet:` protocol registration
- A system tray daemon with live speed tooltips
- **Zero fake or randomized statistics** — all values come directly from the engine
- **Background operation** — downloads continue even when minimized to tray
- **Realtime telemetry** — live CPU, RAM, Disk I/O, Network, GPU & torrent metrics

## Screenshots

<div align="center">
    <img src="media/screenshots/dashboard-desktop.png" alt="Open Torrent Client desktop dashboard" width="900">
    <br><br>
    <img src="media/screenshots/statistics-desktop.png" alt="Open Torrent Client statistics dashboard" width="900">
    <br><br>
    <img src="media/screenshots/terminal-desktop.png" alt="Open Torrent Client terminal view" width="900">
    <br><br>
    <img src="media/screenshots/dashboard-mobile.png" alt="Open Torrent Client responsive dashboard" width="360">
</div>

App icon files are available in [`media/`](media/) for packaging, branding, and distribution:

- [`Open-Torrent-Client-icon.png`](media/Open-Torrent-Client-icon.png)
- [`Open-Torrent-Client-icon.ico`](media/Open-Torrent-Client-icon.ico)

---

## Features

### Core Torrent Engine
- BitTorrent protocol (DHT, PEX, Trackers, peer discovery)
- Magnet URI support with metadata retrieval
- `.torrent` file support (open, drag-and-drop, file association)
- Multi-file torrent with per-file priority (Do Not Download / Low / Normal / High / Maximum)
- Piece-level verification and force recheck
- Seeding with ratio and time-based auto-stop
- Force start with queue bypass
- Download/upload bandwidth limits (global and per-torrent)
- Speed scheduler (time-based bandwidth rules)
- **Non-stop background downloading** — engine runs fully when minimized or hidden to tray

### User Interface
- Dark-mode professional UI (glassmorphism, smooth animations, micro-interactions)
- Sidebar navigation with live torrent counters
- Multi-column torrent table (sortable, searchable, filterable by status)
- Right-click context menu with state-aware actions
- Drag-and-drop `.torrent` files onto the window
- Command Palette (Ctrl+K) for quick actions
- Responsive layout with collapsible sidebar
- Light / Dark theme toggle

### Realtime System Telemetry Terminal *(New in v1.1.0 Pro)*

The Terminal View now embeds a **live 6-card performance dashboard** that updates every second:

| Card | Live Metrics |
|------|-------------|
| CPU Load | Usage %, core count, animated progress bar, CPU model |
| RAM Memory | Used / Total MB, usage %, process RSS footprint |
| Disk I/O | Write & Read speeds, active transfer queue count |
| Network / Wi-Fi | Live Download / Upload speeds, port, DHT status |
| GPU Hardware | Hardware acceleration mode (D3D11 / WebGL), compositing status |
| Downloading Telemetry | Active torrent name, progress bar, download speed, Peers/Seeds, ETA |

### Torrent Inspector (7-Tab Panel)

| Tab | Contents |
|-----|----------|
| Overview | Name, hash, progress, speed, ETA, seeds, peers, ratio, timestamps |
| Files | Folder tree with per-file progress and priority selector |
| Peers | Live peer table — IP, client, connection type, flags, speeds |
| Trackers | URL, status, seeder/leecher counts, add/remove trackers |
| Pieces | Live canvas visual piece map (completed / downloading / missing) |
| Speed | Real-time download/upload speed graphs (1m / 5m / 15m / 1h) |
| Logs | Per-torrent engine event log |

### Network & Connectivity
- DHT (Distributed Hash Table) with live node count
- PEX (Peer Exchange)
- UPnP / NAT-PMP port mapping
- Configurable listening port (default: 6881)
- IPv4 and IPv6 support
- Proxy support (SOCKS4, SOCKS5, HTTP)

### System Integration
- Windows `magnet:` protocol handler (single-instance lock)
- Clipboard watcher for automatic Magnet link detection toast
- System tray with live download/upload speed tooltip
- **Minimize-to-tray** and **close-to-tray** with active background downloads
- Native Windows desktop notifications
- Auto-launch on Windows startup (optional)
- File association for `.torrent` files
- **Power save blocker** — prevents system sleep during active downloads/seeding

### File Manager
- Built-in file browser for download directories
- Folder tree, file list, search, sort, rename, move, copy, delete
- Create folders, open files, open containing folder, copy paths
- Path traversal protection and permission error handling
- Safe delete confirmation dialogs

### Database & Persistence
- SQLite via sql.js (WAL mode) — no external DB server required
- Auto session restore on startup (torrent state, queue, priorities)
- Crash recovery with transaction-safe writes
- Download history log with search and sort
- **Real lifetime statistics** — today and all-time data pulled live from SQLite

### Developer Terminal
- Built-in background CLI terminal (Ctrl+~)
- OTC-specific commands: `help`, `status`, `list`, `ping`, `bg`, `exec <cmd>`
- Log level filtering (INFO / WARN / ERROR / CMD / SUCCESS)
- Auto-scroll, clear, export log to file
- **Realtime System Performance Dashboard** embedded above the log viewport

---

## Architecture

```
+---------------------------------------------+
|              Renderer Process               |
|    HTML5 / CSS3 / Vanilla JS Components     |
|  (Navigation, Table, Inspector, Settings,   |
|   Terminal Telemetry Dashboard)             |
+------------------+--------------------------+
                   |  contextBridge (IPC)
+------------------v--------------------------+
|              Main Process (main.js)         |
|  - Single-instance lock                     |
|  - BrowserWindow lifecycle                  |
|  - IPC handlers (UI <-> Engine)             |
|  - Power save blocker                       |
|  - backgroundThrottling: false              |
+---+----------+--------+---------+-----------+
    |          |        |         |
+---v--+  +----v--+  +---v----+  +-----------+
|Engine|  | DB    |  | Tray   |  | Terminal  |
|(WbTr)|  |(SQLite)|  |Service |  | Service   |
+---+--+  +-------+  +--------+  +-----------+
    |
+---v--------------------------------------------+
|           WebTorrent Engine                    |
|  DHT * PEX * Trackers * Peers * Pieces         |
|  1s realtime_stats broadcast ->                |
|  { speed, torrents, telemetry:{cpu,mem,gpu} }  |
+------------------------------------------------+
```

### Realtime Stats Broadcast (1s interval)

Every second the engine broadcasts a `realtime_stats` IPC event containing:
- `downloadSpeed`, `uploadSpeed`, `totalDownloaded`, `totalUploaded`
- `activeTorrentsCount`, `dhtStatus`, `port`, `dhtNodes`
- `counters`, `torrents[]`
- `telemetry.cpu` — percent, cores, model (via CPU tick delta)
- `telemetry.memory` — totalMB, freeMB, usedMB, rssMB, percent
- `telemetry.disk` — writeSpeed, readSpeed, activeQueue
- `telemetry.gpu` — status, compositing, webgl (via Electron GPU API)

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Desktop Framework | Electron 43.x |
| Torrent Engine | WebTorrent 2.x |
| Database | SQLite (sql.js 1.x, WAL mode) |
| Frontend | HTML5 + CSS3 + Vanilla JavaScript (ES Modules) |
| UI System | Bootstrap 5 + Custom CSS (dark glassmorphism) |
| Icons | Lucide Icons |
| Charts | Chart.js (speed graphs) |
| System Telemetry | Node.js `os` module + Electron GPU API |
| Build Tool | electron-builder 26.x (NSIS installer) |
| Package Manager | npm |

---

## Installation

### Download & Install

Click the animated-style download badge above to get the latest Windows installer from GitHub Releases. The installer is generated locally in the `dist/` folder after running the production build:

```
dist/Open Torrent Client Setup 1.1.0.exe
```

**System Requirements:**
- Windows 10 or Windows 11 (64-bit)
- ~250 MB disk space
- No external runtimes required (Node.js, Python, etc. are NOT needed on the end-user machine)

**Installation Steps:**
1. Run `Open Torrent Client Setup 1.1.0.exe`
2. Follow the NSIS installer wizard
3. Choose installation directory (default: `%LocalAppData%\Programs\Open Torrent Client`)
4. The installer creates Desktop and Start Menu shortcuts
5. The `magnet:` Windows protocol handler is registered automatically on first launch
6. Launch from the Desktop shortcut or Start Menu

---

## Running from Source

### Prerequisites

- [Node.js](https://nodejs.org) v18+ (LTS recommended)
- npm (comes with Node.js)
- Windows 10/11 64-bit

### Setup

```bash
# Navigate to project directory
cd G:\Project\Open-Torrent-Client

# Install dependencies
npm install

# Start the application in development mode
npm start
```

> The app launches in Electron. All IPC communication goes through the secure `contextBridge` defined in `preload.js`. Node integration is disabled in the renderer.

---

## Building the Installer

### Build NSIS Installer (.exe)

```bash
npm run build:exe
```

This command:
1. Generates a multi-resolution `.ico` icon (`scripts/make-ico.js`) — 19KB, all standard sizes
2. Packages the Electron app into `dist/win-unpacked/` (x64)
3. Signs the executable with `signtool.exe`
4. Builds the NSIS setup installer: `dist/Open Torrent Client Setup 1.1.0.exe`
5. Signs the installer and uninstaller
6. Generates a block map for differential updates

**Build output:** `dist/Open Torrent Client Setup 1.1.0.exe`

### Build Portable Executable

```bash
npm run build:portable
```

Outputs a portable `.exe` directly to `dist/` — no installation required.

### Run Tests Before Building

```bash
npm test
```

All 4 test suites (9 test cases) must pass before producing a release build.

---

## Project Structure

```
Open-Torrent-Client/
|-- main.js                     # Electron main process + IPC handlers
|-- preload.js                  # Secure IPC contextBridge
|-- package.json                # Project config & electron-builder settings
|-- README.md                   # This file
|
|-- src/                        # Frontend (Renderer Process)
|   |-- index.html              # Application shell (all view panels)
|   |-- app.js                  # App entry — wires all UI components
|   |-- styles/
|   |   |-- main.css            # Full design system & component styles
|   |   +-- terminal.css        # Terminal view + telemetry dashboard styles
|   +-- components/
|       |-- navigation.js       # Sidebar navigation & view switching
|       |-- torrent-table.js    # Main torrent list table
|       |-- details-panel.js    # 7-tab torrent inspector panel
|       |-- context-menu.js     # Right-click context menu
|       |-- settings-ui.js      # Settings panel (5 tabs)
|       |-- dialogs.js          # Add Torrent / Add Magnet dialogs
|       |-- command-palette.js  # Ctrl+K command palette
|       |-- file-manager-ui.js  # Built-in file manager UI
|       |-- history-ui.js       # Download history panel
|       |-- statistics-ui.js    # Statistics dashboard (live SQLite data)
|       +-- terminal-ui.js      # CLI terminal + realtime telemetry dashboard
|
|-- backend/                    # Main process services
|   |-- engine.js               # WebTorrent engine + 1s realtime_stats broadcast
|   |-- torrent-manager.js      # Torrent state machine
|   |-- bandwidth-manager.js    # Speed limits & scheduling
|   |-- capture-manager.js      # Magnet link & .torrent capture
|   |-- clipboard-watcher.js    # Clipboard Magnet link detection
|   |-- file-manager.js         # Secure filesystem operations
|   |-- tray-service.js         # System tray, tray_only_mode, notifications
|   |-- terminal-service.js     # Background CLI terminal engine
|   |-- register-protocol.js    # Windows magnet: protocol registration
|   |-- diagnostics.js          # Logging + CPU/Memory/GPU realtime telemetry
|   +-- notification.js         # Desktop notification helper
|
|-- database/
|   +-- db.js                   # SQLite WAL database + getLifetimeStats()
|
|-- scripts/
|   |-- make-ico.js             # Multi-resolution ICO generator (16-256px)
|   |-- gen-app-icon.js         # App icon generator
|   |-- gen-icons.js            # Icon set generator
|   +-- register-protocol.js    # Standalone protocol registration script
|
|-- tests/
|   |-- run-tests.js            # Test suite runner
|   |-- torrent.test.js         # Torrent engine unit tests (4 cases)
|   |-- filesystem.test.js      # Filesystem safety tests (1 case)
|   |-- terminal.test.js        # Terminal command tests (6 cases)
|   +-- network.test.js         # Network, bandwidth & telemetry tests (9 cases)
|
|-- assets/
|   +-- icon.ico                # Multi-resolution app icon (19KB, 16-256px)
|
+-- dist/
    |-- Open Torrent Client Setup 1.1.0.exe        # NSIS Installer
    |-- Open Torrent Client Setup 1.1.0.exe.blockmap
    +-- win-unpacked/
        +-- Open Torrent Client.exe                # Unpacked app
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Add `.torrent` File |
| `Ctrl+M` | Add Magnet Link |
| `Ctrl+K` | Open Command Palette |
| `Ctrl+F` | Focus Global Search |
| `Ctrl+,` | Open Settings |
| `Ctrl+B` | Toggle Sidebar |
| `Ctrl+~` | Toggle Terminal (with Telemetry Dashboard) |
| `Ctrl+Shift+P` | Pause All Torrents |
| `Ctrl+Shift+A` | Resume All Torrents |
| `Delete` | Remove Selected Torrent |
| `Esc` | Close dialogs / Command Palette |

---

## UI Sections

### Dashboard
Live statistics cards showing download/upload speed, active downloads, DHT status, total downloaded/uploaded, and active peers. All values updated in real-time from the WebTorrent engine every second.

### Torrent List
Filterable, sortable torrent table. Filter views: All / Downloading / Seeding / Completed / Paused / Queued / Errors. Sidebar badges update automatically. Supports multi-selection, keyboard navigation, and right-click context menu.

**Torrent Table Columns:** Name, Status badge, Progress bar, Size, Download Speed, Upload Speed, ETA, Seeds, Peers, Ratio, Added date, Save Path.

### Torrent Inspector
Expandable panel at the bottom of the torrent list showing 7 tabs for the currently selected torrent. All data is live (speed chart, peer list, piece map, tracker list).

### File Manager
Built-in filesystem browser scoped to configured download directories. Supports rename, move, copy, delete with confirmation, create folder, search, and sort. Path traversal protection enforced.

### History
Persistent log of completed/removed torrents. Columns: Name, Hash, Added date, Completed date, Downloaded, Uploaded, Ratio, Duration, Path. Searchable and sortable.

### Statistics
**Live SQLite data** — today's downloaded/uploaded bytes, session counters, average speeds, and real all-time lifetime totals queried directly from the database.

### Terminal (with Realtime Telemetry Dashboard)
Background CLI with structured log output and a **live 6-card system performance grid** above the log viewport:
- **CPU Load** — real % via CPU tick delta sampling across all cores
- **RAM Memory** — system total, used, free, and process RSS in MB
- **Disk I/O** — write/read speeds correlated with torrent activity
- **Network Traffic** — live BitTorrent download/upload bandwidth
- **GPU Hardware** — Electron D3D11/WebGL hardware acceleration status
- **Downloading Telemetry** — active torrent name, progress bar, speed, peers/seeds, ETA

Supports OTC internal commands and shell passthrough via `exec`. All metrics update every 1 second.

### Settings (5 Tabs)

| Tab | Key Settings |
|-----|-------------|
| General & Tray | Auto-launch, minimize/close-to-tray, theme toggle |
| Downloads & Storage | Default path, completed path, incomplete path, auto-organize |
| Bandwidth & Network | Global limits, port, proxy (SOCKS4/5/HTTP), DHT, PEX, UPnP |
| Notifications & Power | Per-event notification toggles, power save blocker |
| Integration & Protocols | Magnet handler, file association, clipboard watcher mode |

### About
Developer profile (Engineer Qasim Ahmad), version details, tech stack badges, and application feature highlights.

---

## Settings & Configuration

All settings are persisted in the SQLite database. No external config files needed.

| Setting | Default |
|---------|---------|
| Download Path | `%USERPROFILE%\Downloads\Torrents` |
| Listening Port | `6881` |
| Max Active Downloads | `3` |
| Max Active Torrents | `5` |
| Global Download Limit | Unlimited |
| Global Upload Limit | Unlimited |
| Minimize to Tray | Enabled |
| Close to Tray | Enabled |
| Clipboard Watcher | Enabled |
| DHT | Enabled |
| PEX | Enabled |
| Power Save Blocker | Enabled (during downloads) |

---

## Testing

Run the full test suite:

```bash
npm test
```

### Test Coverage (9 test cases — 100% pass rate)

| Suite | Cases | Tests |
|-------|-------|-------|
| torrent.test.js | 4 | Magnet URI parsing/validation, bandwidth calculations, queue ordering & force start, integration diagnostics |
| filesystem.test.js | 1 | Path traversal protection, safe delete, path normalization |
| terminal.test.js | 6 | CLI commands: help, ping, bg, status, list, exec, log buffer & clear |
| network.test.js | 9 | Speed formatters, bandwidth limit parsing, ETA calculations, DHT diagnostics, bytes formatter, tray stats, lifetime stats query, realtime CPU/Memory/GPU telemetry |

Expected output:

```
====================================================
       OPEN TORRENT CLIENT TEST SUITE
====================================================

=== Running Torrent Engine Unit Tests ===
✔ Magnet URI parsing & validation rules passed.
✔ Bandwidth calculations passed.
✔ Queue state & Force Start logic passed.
✔ Integration diagnostics passed.
=== All Torrent Tests Passed Successfully! ===

=== Running Filesystem Unit Tests ===
✔ Path traversal protection passed.
=== All Filesystem Tests Passed Successfully! ===

=== Running Terminal & Background Worker Unit Tests ===
✔ Help command passed.
✔ Ping command passed.
✔ Background status command passed.
✔ Status & List commands passed.
✔ Exec shell command passed.
✔ Log buffer and clear passed.
=== All Terminal Unit Tests Passed Successfully! ===

=== Running Network Feature Unit Tests ===
✔ Speed formatter passed.
✔ Bandwidth limit parsing passed.
✔ ETA calculation passed.
✔ Unlimited ETA edge cases passed.
✔ Network diagnostics report structure passed.
✔ Bytes formatter passed.
✔ Realtime Tray Stats & Live Tooltip update passed.
✔ Background Tray Status & Lifetime Stats query passed.
✔ Realtime CPU, Memory & GPU telemetry methods passed.
=== All Network Unit Tests Passed Successfully! ===

✨ ALL SUITE TESTS COMPLETED WITH 100% SUCCESS PASS RATE! ✨
```

---

## Security & Safety

| Concern | Mitigation |
|---------|-----------|
| Path traversal attacks | Resolved paths validated against approved root directories before any FS operation |
| Arbitrary file execution | Downloaded files are never auto-executed |
| Proxy credentials | Not stored in plaintext; not written to logs |
| Single instance | app.requestSingleInstanceLock() — second instance forwards args and quits immediately |
| Context isolation | Electron contextBridge with no nodeIntegration in renderer process |
| Database corruption | WAL mode + transaction-safe writes + crash recovery on startup |
| Filesystem race conditions | Locked-file detection and permission error handling with user feedback |
| Torrent path injection | Torrent metadata cannot create arbitrary paths outside the configured download directory |
| Background throttling | backgroundThrottling: false — engine runs at full speed regardless of window visibility |

---

## License

This project is released under the **MIT License**.

```
MIT License

Copyright (c) 2026 Engineer Qasim Ahmad

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Developer

| | |
|---|---|
| **Name** | Engineer Qasim Ahmad |
| **Role** | Lead Developer & Software Architect |
| **Email** | [engineerqasimahmad@gmail.com](mailto:engineerqasimahmad@gmail.com) |
| **Specialization** | Desktop Application Systems, Windows Native APIs, Electron Architecture, BitTorrent Protocol, SQLite, Real-time UI Engineering, System Telemetry |

---

<div align="center">

**Open Torrent Client v1.1.0 Pro Edition** — Designed for legitimate torrent usage: Linux distributions, open-source software, and public-domain content.

*BitTorrent & Magnet Specification Compliant*

Copyright (c) 2026 Engineer Qasim Ahmad — MIT License

</div>
