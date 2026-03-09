# MindMapper

A browser-based mind map editor built with vanilla HTML, CSS, and SVG — no dependencies, no build step. Open `index.html` in your browser and start mapping.

![mindmapper screenshot](https://img.shields.io/badge/status-works%20in%20browser-brightgreen)

## Features

- **SVG rendering** with curved Bezier connection lines and depth-based color coding
- **Inline editing** — double-click any node to rename it
- **Keyboard-driven workflow** — Tab (add child), Enter (add sibling), Delete (remove), Alt+Up/Down (reorder), Ctrl+S (save), F2 (rename)
- **Drag to reparent** — drag a node onto another to move it
- **Collapse/expand** — click the +/− indicator to hide branches
- **Pan & zoom** — drag empty space to pan, Ctrl+scroll to zoom, Fit View button to reset
- **Save/Load** — uses the File System Access API (Chrome/Edge) so subsequent saves write directly to the same file. Falls back to download on other browsers.
- **Auto-save** — your current map is saved to localStorage automatically and restored on reload
- **Word wrapping** — long node labels wrap and the node grows taller to fit

## Getting Started

1. Clone the repo:
   ```
   git clone https://github.com/sagerock/mindmapper.git
   ```
2. Open `index.html` in a browser (Chrome or Edge recommended for direct file saving)
3. A sample "Criminal Homicide" mind map loads by default

## Keyboard Shortcuts

| Key | Action |
|---|---|
| Tab | Add child to selected node |
| Enter | Add sibling below selected node |
| Delete / Backspace | Delete selected node |
| Alt + Up/Down | Move node up/down among siblings |
| Ctrl + S | Save to file |
| F2 | Rename selected node |
| Escape | Deselect |
| Ctrl + Scroll | Zoom in/out |

## File Format

Maps are saved as `.mindmap.json` files:

```json
{
  "version": 1,
  "name": "My Mind Map",
  "root": {
    "id": "node_1",
    "text": "Root Topic",
    "collapsed": false,
    "children": [...]
  }
}
```

No position data is stored — the layout is computed on each render. Sample maps are included in the repo.

## Files

| File | Purpose |
|---|---|
| `index.html` | HTML shell, toolbar, and embedded CSS |
| `mindmapper.js` | All application logic (layout, rendering, events, file I/O) |
| `*.mindmap.json` | Sample mind maps |

## Browser Support

Best experience in **Chrome** or **Edge** (File System Access API for direct save). Works in Firefox and Safari with download-based saving.
