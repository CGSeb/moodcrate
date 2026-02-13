# CLAUDE.md

## Project Overview

**Moodcrate** — A desktop app for artists to gather, label, categorize visual references and create moodboards from selected images.

## Tech Stack

| Layer | Tech |
|---|---|
| Shell / backend | **Tauri v2** (Rust) |
| Frontend | **React 19** + TypeScript + Vite |
| State | **localStorage** (via `useLocalStorage` hook) |
| Icons | **lucide-react** |
| Tauri plugins | `dialog`, `opener` |

## Architecture

```
Moodcrate/
  src/                          # React frontend
    App.tsx                     #   Root component (state, routing)
    main.tsx                    #   Entry point
    assets/                     #   Static assets (icon.svg)
    hooks/
      useLocalStorage.ts        #   Persistent state hook
    components/
      Titlebar/                 #   Custom window titlebar
      Sidebar/                  #   Navigation sidebar (collections + moodboards)
      CollectionView/           #   Image grid for a collection
      MoodboardView/            #   Moodboard canvas view
      ImageViewer/              #   Full-screen image viewer overlay
      TagSidebar/               #   Tag management panel
      NameDialog/               #   Reusable naming prompt dialog
      ConfirmDialog/            #   Reusable confirmation dialog
  src-tauri/                    # Rust backend (Tauri)
    src/
      lib.rs                    #   Tauri commands and setup
      main.rs                   #   Entry point
    Cargo.toml                  #   Rust dependencies
    tauri.conf.json             #   Tauri configuration
    capabilities/               #   Tauri permission capabilities
    icons/                      #   App icons
  public/                       # Static public assets
  index.html                    # HTML entry point
  package.json                  # Node dependencies
  vite.config.ts                # Vite configuration
  tsconfig.json                 # TypeScript config
```

## Core Features

### Implemented
- Import images into collections (file picker via Tauri dialog)
- Create and delete image collections
- View collection images in a grid with full-screen image viewer
- Tag images with custom labels; manage tags via TagSidebar
- Create, list, select, and delete moodboards
- Custom window titlebar with home navigation
- Collapsible sidebar with collections and moodboards sections

### Planned
- Drag-and-drop and clipboard paste image import
- Search and filter by tags, categories, colors
- Arrange images freely on a moodboard canvas
- Image thumbnails and metadata processing

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
