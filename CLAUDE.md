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
| Tauri plugins | `dialog`, `opener`, `clipboard-manager` |

## Architecture

```
Moodcrate/
  src/                          # React frontend
    App.tsx                     #   Root component (state, routing)
    main.tsx                    #   Entry point
    assets/                     #   Static assets (icon.svg)
    hooks/
      useLocalStorage.ts        #   Persistent state hook
    utils/
      tagTree.ts                #   Tag hierarchy helpers (flatten, children map, cycle detection)
    components/
      Titlebar/                 #   Custom window titlebar
      Sidebar/                  #   Navigation sidebar (collections + moodboards)
      CollectionView/           #   Image grid for a collection
      MoodboardView/            #   Moodboard canvas (pan, zoom, box-select, multi-drag)
      ImageViewer/              #   Full-screen image viewer overlay
      TagSidebar/               #   Tag management panel (hierarchical, drag-to-nest)
      ImportDialog/             #   Image import mode dialog (copy vs reference)
      NameDialog/               #   Reusable naming prompt dialog (with validation)
      ConfirmDialog/            #   Reusable confirmation dialog
      Tooltip/                  #   Reusable tooltip component
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
- Import images into collections (file picker, clipboard paste, copy or reference modes)
- Create and delete image collections
- View collection images in a grid with full-screen image viewer
- Delete images from collections
- Hierarchical tags with parent-child nesting (drag-to-nest in TagSidebar)
- Tag images with custom labels; filter images by tags (with descendant filtering)
- Duplicate tag name prevention (global, case-insensitive)
- Moodboard canvas with pan (middle-click), zoom (scroll wheel), and dot grid background
- Add images to moodboards from collections
- Arrange images freely on moodboard canvas (drag to move, resize handle)
- Box-select multiple images on moodboard (marquee selection)
- Multi-drag: move all selected images together
- Shift+click and Escape key for selection management
- Create, list, select, and delete moodboards
- Custom window titlebar with home navigation
- Collapsible sidebar with collections and moodboards sections

### Planned
- Search and filter by categories, colors
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
