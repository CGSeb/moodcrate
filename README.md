# Moodcrate

A desktop app for artists to gather, label, categorize visual references and create moodboards from selected images.

Built with **Tauri v2** (Rust) + **React 19** + **TypeScript** + **Vite**.

<!-- Screenshot: app overview -->

## Features

### Collections

Organize your visual references into collections — folders of images you can browse, tag, and filter.

<!-- Screenshot: collection view -->

- **Import images** via file picker or clipboard paste (copy or reference modes)
- **Grid view** with adjustable columns per row
- **Full-screen image viewer** for detailed inspection
- **Delete images** from collections

### Tags

A hierarchical tagging system to categorize and filter your images.

<!-- Screenshot: tag sidebar -->

- **Create tags** with parent-child nesting (unlimited depth)
- **Drag-and-drop** tags in the sidebar to reorganize hierarchy
- **Tag images** directly from the collection grid
- **Filter by tag** — click the search icon on any tag to show only matching images (includes descendants)
- **Global duplicate prevention** — tag names are unique across the entire library (case-insensitive)

### Moodboards

Free-form canvases to arrange your selected references spatially.

<!-- Screenshot: moodboard view -->

- **Infinite canvas** with pan (middle-click) and zoom (scroll wheel)
- **Add images** from any collection via the moodboard picker on each image tile
- **Create moodboards on the fly** — the "New moodboard" option in the picker creates a board, adds the image, and navigates to it
- **Freely arrange** images by dragging them on the canvas
- **Resize images** using the corner handle
- **Box-select** multiple images with a marquee (left-click drag on empty canvas)
- **Multi-drag** — move all selected images together
- **Shift+click** to toggle individual image selection
- **Zoom-to-fit** on open — the view automatically centers and scales to show all images
- **Dot grid background** for visual reference

### Interface

<!-- Screenshot: sidebar -->

- **Custom titlebar** with home navigation
- **Collapsible sidebar** with collections and moodboards sections
- **Settings popover** to adjust grid column count
- **Dark theme** throughout

## Installation

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) 1.93+
- [Node.js](https://nodejs.org/) 24+ with npm

### Development

```bash
# Install dependencies
npm install

# Run in dev mode (hot reload)
npm run tauri dev
```

### Build

```bash
# Build production binary
npm run tauri build
```

The built installer will be in `src-tauri/target/release/bundle/`.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript |
| Bundler | Vite |
| Icons | lucide-react |
| Persistence | localStorage |
| Tauri plugins | dialog, opener, clipboard-manager |

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
