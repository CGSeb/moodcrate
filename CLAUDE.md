# CLAUDE.md

## Project Overview

**Moodcrate** — A desktop app for artists to gather, label, categorize visual references and create moodboards from selected images.

## Tech Stack

| Layer | Tech |
|---|---|
| Shell / backend | **Tauri v2** (Rust) |
| Frontend | **React 19** + TypeScript + Vite |
| Database | **SQLite** via `rusqlite` or `sqlx` |
| Image storage | Local filesystem |
| Image processing | `image` crate (thumbnails, metadata) |

## Architecture

```
Moodcrate/
  src/                  # React frontend
    App.tsx             #   Root component
    main.tsx            #   Entry point
    assets/             #   Static assets
  src-tauri/            # Rust backend (Tauri)
    src/
      lib.rs            #   Tauri commands and setup
      main.rs           #   Entry point
    Cargo.toml          #   Rust dependencies
    tauri.conf.json     #   Tauri configuration
    capabilities/       #   Tauri permission capabilities
    icons/              #   App icons
  public/               # Static public assets
  index.html            # HTML entry point
  package.json          # Node dependencies
  vite.config.ts        # Vite configuration
  tsconfig.json         # TypeScript config
```

## Core Features

- Import images (drag-and-drop, file picker, clipboard paste)
- Tag and categorize images with custom labels
- Search and filter by tags, categories, colors
- Create moodboards from selected images
- Arrange images freely on a canvas (moodboard editor)

## Environment

- **Rust 1.93+** + **Tauri v2**
- **Node.js 24+** + **npm**
- **OS**: Windows (primary target)

## Running

```bash
# Install dependencies
npm install

# Dev mode (hot reload)
npm run tauri dev

# Build production binary
npm run tauri build
```

## Git Conventions

- Do NOT add a `Co-Authored-By` line to commit messages
