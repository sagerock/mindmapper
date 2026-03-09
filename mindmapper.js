// ── Constants ──────────────────────────────────────────────
const NODE_W = 180, NODE_MIN_H = 40, H_GAP = 60, V_GAP = 12;
const TEXT_PAD_X = 12, TEXT_PAD_Y = 10, LINE_H = 18, MAX_CHARS = 22;
const DEPTH_COLORS = ['#6C5CE7', '#4A90D9', '#00B894', '#55C9A6'];
const COLLAPSE_R = 10;

function wrapText(text) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (test.length > MAX_CHARS && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function nodeHeight(node) {
  const lines = wrapText(node.text);
  node._lines = lines;
  return Math.max(NODE_MIN_H, TEXT_PAD_Y * 2 + lines.length * LINE_H);
}

// ── Default Map ────────────────────────────────────────────
const DEFAULT_MAP = {
  version: 1,
  name: 'Criminal Homicide',
  root: {
    id: 'node_1', text: 'Criminal Homicide', collapsed: false, children: [
      { id: 'node_2', text: 'Murder', collapsed: false, children: [
        { id: 'node_3', text: 'First Degree', collapsed: false, children: [
          { id: 'node_4', text: 'Premeditated', collapsed: false, children: [] },
          { id: 'node_5', text: 'Felony Murder', collapsed: false, children: [] },
        ]},
        { id: 'node_6', text: 'Second Degree', collapsed: false, children: [
          { id: 'node_7', text: 'Intent to Kill', collapsed: false, children: [] },
          { id: 'node_8', text: 'Extreme Recklessness', collapsed: false, children: [] },
        ]},
      ]},
      { id: 'node_9', text: 'Manslaughter', collapsed: false, children: [
        { id: 'node_10', text: 'Voluntary', collapsed: false, children: [
          { id: 'node_11', text: 'Heat of Passion', collapsed: false, children: [] },
          { id: 'node_12', text: 'Imperfect Self-Defense', collapsed: false, children: [] },
        ]},
        { id: 'node_13', text: 'Involuntary', collapsed: false, children: [
          { id: 'node_14', text: 'Criminal Negligence', collapsed: false, children: [] },
          { id: 'node_15', text: 'Misdemeanor Manslaughter', collapsed: false, children: [] },
        ]},
      ]},
      { id: 'node_16', text: 'Negligent Homicide', collapsed: false, children: [
        { id: 'node_17', text: 'Ordinary Negligence', collapsed: false, children: [] },
        { id: 'node_18', text: 'Vehicular Homicide', collapsed: false, children: [] },
      ]},
      { id: 'node_19', text: 'Defenses', collapsed: false, children: [
        { id: 'node_20', text: 'Self-Defense', collapsed: false, children: [] },
        { id: 'node_21', text: 'Insanity', collapsed: false, children: [] },
        { id: 'node_22', text: 'Intoxication', collapsed: false, children: [] },
      ]},
    ]
  }
};

// ── App State ──────────────────────────────────────────────
const state = {
  root: null,
  selectedId: null,
  nextId: 100,
  pan: { x: 60, y: 0 },
  zoom: 1,
  // Pan drag
  dragging: false,
  dragStart: { x: 0, y: 0 },
  panStart: { x: 0, y: 0 },
  // Node drag-to-reparent
  nodeDrag: null, // { id, startX, startY, active, ghost, dropTargetId }
};

// ── DOM refs ───────────────────────────────────────────────
const svg = document.getElementById('canvas');
const viewport = document.getElementById('viewport');
const renameInput = document.getElementById('rename-input');
const fileInput = document.getElementById('file-input');

// ── Helpers ────────────────────────────────────────────────
function genId() { return 'node_' + (state.nextId++); }

function findNode(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const c of node.children) {
    const r = findNode(c, id);
    if (r) return r;
  }
  return null;
}

function findParent(node, id) {
  if (!node) return null;
  for (const c of node.children) {
    if (c.id === id) return node;
    const r = findParent(c, id);
    if (r) return r;
  }
  return null;
}

function createNode(text) {
  return { id: genId(), text, collapsed: false, children: [] };
}

function maxIdIn(node) {
  let m = parseInt(node.id.split('_')[1]) || 0;
  for (const c of node.children) m = Math.max(m, maxIdIn(c));
  return m;
}

function isDescendant(ancestor, id) {
  for (const c of ancestor.children) {
    if (c.id === id || isDescendant(c, id)) return true;
  }
  return false;
}

function depthColor(d) { return DEPTH_COLORS[Math.min(d, DEPTH_COLORS.length - 1)]; }

// ── Layout ─────────────────────────────────────────────────
function layoutTree(node, depth, yOffset) {
  const visibleChildren = node.collapsed ? [] : node.children;
  node._x = depth * (NODE_W + H_GAP);
  node._depth = depth;
  node._h = nodeHeight(node);

  if (visibleChildren.length === 0) {
    node._y = yOffset;
    node._subtreeH = node._h;
    return yOffset + node._h + V_GAP;
  }

  let y = yOffset;
  for (const child of visibleChildren) {
    y = layoutTree(child, depth + 1, y);
  }

  const first = visibleChildren[0];
  const last = visibleChildren[visibleChildren.length - 1];
  const firstMid = first._y + first._h / 2;
  const lastMid = last._y + last._h / 2;
  node._y = (firstMid + lastMid) / 2 - node._h / 2;
  node._subtreeH = y - yOffset - V_GAP;
  return y;
}

// ── SVG Rendering ──────────────────────────────────────────
function render() {
  if (!state.root) return;
  layoutTree(state.root, 0, 0);

  // Center vertically on first render
  if (state.pan.y === 0) {
    state.pan.y = (window.innerHeight - 48) / 2 - state.root._y;
  }

  viewport.setAttribute('transform',
    `translate(${state.pan.x},${state.pan.y + 48}) scale(${state.zoom})`);

  viewport.innerHTML = '';
  renderEdges(state.root);
  renderNodes(state.root);
  autoSave();
}

function renderEdges(node) {
  if (node.collapsed) return;
  for (const child of node.children) {
    const x1 = node._x + NODE_W;
    const y1 = node._y + node._h / 2;
    const x2 = child._x;
    const y2 = child._y + child._h / 2;
    const cx = (x1 + x2) / 2;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`);
    path.setAttribute('class', 'edge');
    viewport.appendChild(path);

    renderEdges(child);
  }
}

function renderNodes(node) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  // Node rect
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', node._x);
  rect.setAttribute('y', node._y);
  rect.setAttribute('width', NODE_W);
  rect.setAttribute('height', node._h);
  rect.setAttribute('fill', depthColor(node._depth));
  rect.setAttribute('class', 'node-rect' + (node.id === state.selectedId ? ' selected' : ''));
  rect.dataset.id = node.id;
  g.appendChild(rect);

  // Node text with wrapping via tspans
  const lines = node._lines || wrapText(node.text);
  const textBlockH = lines.length * LINE_H;
  const textStartY = node._y + (node._h - textBlockH) / 2 + LINE_H * 0.75;
  const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  txt.setAttribute('class', 'node-text');
  for (let i = 0; i < lines.length; i++) {
    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan.setAttribute('x', node._x + TEXT_PAD_X);
    tspan.setAttribute('y', textStartY + i * LINE_H);
    tspan.textContent = lines[i];
    txt.appendChild(tspan);
  }
  g.appendChild(txt);

  // Collapse indicator
  if (node.children.length > 0) {
    const cx = node._x + NODE_W + COLLAPSE_R + 4;
    const cy = node._y + node._h / 2;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', COLLAPSE_R);
    circle.setAttribute('class', 'collapse-circle');
    circle.dataset.collapseId = node.id;
    g.appendChild(circle);

    const sym = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    sym.setAttribute('x', cx);
    sym.setAttribute('y', cy + 4);
    sym.setAttribute('text-anchor', 'middle');
    sym.setAttribute('class', 'collapse-text');
    sym.textContent = node.collapsed ? '+' : '−';
    sym.dataset.collapseId = node.id;
    g.appendChild(sym);
  }

  viewport.appendChild(g);

  if (!node.collapsed) {
    for (const child of node.children) renderNodes(child);
  }
}

// ── Node Operations ────────────────────────────────────────
function addChild() {
  const parent = findNode(state.root, state.selectedId);
  if (!parent) return;
  parent.collapsed = false;
  const child = createNode('New Node');
  parent.children.push(child);
  state.selectedId = child.id;
  render();
}

function addSibling() {
  if (!state.selectedId || state.selectedId === state.root.id) return;
  const parent = findParent(state.root, state.selectedId);
  if (!parent) return;
  const idx = parent.children.findIndex(c => c.id === state.selectedId);
  const sib = createNode('New Node');
  parent.children.splice(idx + 1, 0, sib);
  state.selectedId = sib.id;
  render();
}

function moveNode(dir) {
  if (!state.selectedId || state.selectedId === state.root.id) return;
  const parent = findParent(state.root, state.selectedId);
  if (!parent) return;
  const idx = parent.children.findIndex(c => c.id === state.selectedId);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= parent.children.length) return;
  [parent.children[idx], parent.children[newIdx]] = [parent.children[newIdx], parent.children[idx]];
  render();
}

function deleteSelected() {
  if (!state.selectedId || state.selectedId === state.root.id) return;
  const parent = findParent(state.root, state.selectedId);
  if (!parent) return;
  parent.children = parent.children.filter(c => c.id !== state.selectedId);
  state.selectedId = parent.id;
  render();
}

// ── Inline Rename ──────────────────────────────────────────
function startRename(nodeId) {
  const node = findNode(state.root, nodeId);
  if (!node) return;

  // Find the rect element for positioning
  const rects = viewport.querySelectorAll('.node-rect');
  let targetRect = null;
  for (const r of rects) {
    if (r.dataset.id === nodeId) { targetRect = r; break; }
  }
  if (!targetRect) return;

  const box = targetRect.getBoundingClientRect();
  renameInput.style.left = box.left + 'px';
  renameInput.style.top = box.top + 'px';
  renameInput.style.width = box.width + 'px';
  renameInput.style.height = Math.max(box.height, 40) + 'px';
  renameInput.style.display = 'block';
  renameInput.value = node.text;
  renameInput.dataset.id = nodeId;
  renameInput.select();
  renameInput.focus();
}

function commitRename() {
  if (renameInput.style.display === 'none') return;
  const node = findNode(state.root, renameInput.dataset.id);
  if (node && renameInput.value.trim()) {
    node.text = renameInput.value.trim();
  }
  renameInput.style.display = 'none';
  render();
}

renameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
  if (e.key === 'Escape') { renameInput.style.display = 'none'; }
  e.stopPropagation();
});
renameInput.addEventListener('blur', commitRename);

// ── SVG Events ─────────────────────────────────────────────
const DRAG_THRESHOLD = 8;

function hitTestNode(clientX, clientY) {
  // Find which node rect is under the pointer
  const rects = viewport.querySelectorAll('.node-rect');
  for (const r of rects) {
    const box = r.getBoundingClientRect();
    if (clientX >= box.left && clientX <= box.right &&
        clientY >= box.top && clientY <= box.bottom) {
      return r.dataset.id;
    }
  }
  return null;
}

function createGhost(node) {
  const el = document.createElement('div');
  el.className = 'drag-ghost';
  el.textContent = node.text;
  el.style.background = depthColor(node._depth);
  document.body.appendChild(el);
  return el;
}

function cleanupNodeDrag() {
  if (state.nodeDrag) {
    if (state.nodeDrag.ghost) state.nodeDrag.ghost.remove();
    const prev = viewport.querySelector('.node-rect.drop-target');
    if (prev) prev.classList.remove('drop-target');
    state.nodeDrag = null;
  }
}

svg.addEventListener('pointerdown', e => {
  // Collapse toggle
  if (e.target.dataset.collapseId) {
    const node = findNode(state.root, e.target.dataset.collapseId);
    if (node) { node.collapsed = !node.collapsed; render(); }
    return;
  }

  // Start potential node drag
  if (e.target.dataset.id) {
    state.nodeDrag = {
      id: e.target.dataset.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      ghost: null,
      dropTargetId: null,
    };
    // Don't capture pointer yet — let dblclick fire naturally.
    // Capture only when drag activates (past threshold).
    return;
  }

  // Pan start
  state.dragging = true;
  state.dragStart = { x: e.clientX, y: e.clientY };
  state.panStart = { ...state.pan };
  svg.classList.add('panning');
  svg.setPointerCapture(e.pointerId);
});

svg.addEventListener('pointermove', e => {
  // Node drag
  if (state.nodeDrag) {
    const dx = e.clientX - state.nodeDrag.startX;
    const dy = e.clientY - state.nodeDrag.startY;

    if (!state.nodeDrag.active) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      // Activate drag
      const dragNode = findNode(state.root, state.nodeDrag.id);
      if (!dragNode || state.nodeDrag.id === state.root.id) {
        state.nodeDrag = null;
        return;
      }
      state.nodeDrag.active = true;
      state.nodeDrag.ghost = createGhost(dragNode);
      try { svg.setPointerCapture(state.nodeDrag.pointerId); } catch {}
    }

    // Move ghost
    state.nodeDrag.ghost.style.left = (e.clientX + 12) + 'px';
    state.nodeDrag.ghost.style.top = (e.clientY - 16) + 'px';

    // Hit-test for drop target
    // Temporarily hide ghost so elementFromPoint doesn't hit it
    state.nodeDrag.ghost.style.display = 'none';
    const targetId = hitTestNode(e.clientX, e.clientY);
    state.nodeDrag.ghost.style.display = '';

    const prevTarget = viewport.querySelector('.node-rect.drop-target');
    if (prevTarget) prevTarget.classList.remove('drop-target');

    const draggedNode = findNode(state.root, state.nodeDrag.id);
    if (targetId && targetId !== state.nodeDrag.id && !isDescendant(draggedNode, targetId)) {
      state.nodeDrag.dropTargetId = targetId;
      const rects = viewport.querySelectorAll('.node-rect');
      for (const r of rects) {
        if (r.dataset.id === targetId) { r.classList.add('drop-target'); break; }
      }
    } else {
      state.nodeDrag.dropTargetId = null;
    }
    return;
  }

  // Pan
  if (!state.dragging) return;
  state.pan.x = state.panStart.x + (e.clientX - state.dragStart.x);
  state.pan.y = state.panStart.y + (e.clientY - state.dragStart.y);
  viewport.setAttribute('transform',
    `translate(${state.pan.x},${state.pan.y + 48}) scale(${state.zoom})`);
});

svg.addEventListener('pointerup', e => {
  // Node drag end
  if (state.nodeDrag) {
    if (state.nodeDrag.active && state.nodeDrag.dropTargetId) {
      const dragId = state.nodeDrag.id;
      const dropId = state.nodeDrag.dropTargetId;
      const dragNode = findNode(state.root, dragId);
      const oldParent = findParent(state.root, dragId);
      const newParent = findNode(state.root, dropId);

      if (dragNode && oldParent && newParent) {
        // Remove from old parent
        oldParent.children = oldParent.children.filter(c => c.id !== dragId);
        // Add to new parent
        newParent.collapsed = false;
        newParent.children.push(dragNode);
        state.selectedId = dragId;
        cleanupNodeDrag();
        render();
        return;
      }
    }

    const wasActive = state.nodeDrag.active;
    const nodeId = state.nodeDrag.id;
    cleanupNodeDrag();

    // If it wasn't a drag, treat as click to select
    if (!wasActive) {
      const prev = viewport.querySelector('.node-rect.selected');
      if (prev) { prev.classList.remove('selected'); prev.style.filter = ''; }
      const rects = viewport.querySelectorAll('.node-rect');
      for (const r of rects) {
        if (r.dataset.id === nodeId) {
          r.classList.add('selected');
          r.style.filter = 'drop-shadow(0 0 6px rgba(255,215,0,0.5))';
          break;
        }
      }
      state.selectedId = nodeId;
    }
    return;
  }

  // Pan end
  state.dragging = false;
  svg.classList.remove('panning');
});

// Double-click to rename
svg.addEventListener('dblclick', e => {
  if (e.target.dataset.id) {
    state.selectedId = e.target.dataset.id;
    startRename(e.target.dataset.id);
  }
});

// Zoom
function applyZoom(factor) {
  state.zoom = Math.max(0.3, Math.min(3, state.zoom * factor));
  updateZoomLabel();
  render();
}

function updateZoomLabel() {
  const label = document.getElementById('zoom-level');
  if (label) label.textContent = Math.round(state.zoom * 100) + '%';
}

svg.addEventListener('wheel', e => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  // Gentler zoom: clamp deltaY so trackpad pinch isn't too aggressive
  const clamped = Math.max(-3, Math.min(3, e.deltaY));
  const factor = 1 - clamped * 0.03;
  applyZoom(factor);
}, { passive: false });

document.getElementById('btn-zoom-in').addEventListener('click', () => applyZoom(1.2));
document.getElementById('btn-zoom-out').addEventListener('click', () => applyZoom(1 / 1.2));
document.getElementById('btn-fit-zoom').addEventListener('click', fitView);

// ── Keyboard ───────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (renameInput.style.display !== 'none') return; // editing
  // Don't intercept keys when quiz/settings modals are open
  const modalOpen = document.querySelector('.modal-backdrop.visible');
  if (modalOpen) return;

  if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    saveMap();
    return;
  }

  if (e.altKey && e.key === 'ArrowUp') {
    e.preventDefault();
    moveNode(-1);
    return;
  }
  if (e.altKey && e.key === 'ArrowDown') {
    e.preventDefault();
    moveNode(1);
    return;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    addChild();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    addSibling();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelected();
  } else if (e.key === 'Escape') {
    state.selectedId = null;
    render();
  } else if (e.key === 'F2') {
    if (state.selectedId) startRename(state.selectedId);
  }
});

// ── File I/O ───────────────────────────────────────────────
let fileHandle = null; // Persistent handle for File System Access API

function stripLayout(node) {
  const { _x, _y, _h, _depth, _subtreeH, _lines, ...clean } = node;
  return { ...clean, children: node.children.map(stripLayout) };
}

function serializeMap() {
  return JSON.stringify(
    { version: 1, name: state.root.text, root: stripLayout(state.root) },
    null, 2
  );
}

async function saveMap() {
  if (!state.root) return;
  const json = serializeMap();

  // Try writing to existing handle first
  if (fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(json);
      await writable.close();
      flashSaved();
      return;
    } catch { fileHandle = null; }
  }

  // Try File System Access API (Chrome/Edge)
  if (window.showSaveFilePicker) {
    try {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: (state.root.text.replace(/[^a-z0-9]+/gi, '_') || 'mindmap') + '.mindmap.json',
        types: [{ description: 'Mind Map', accept: { 'application/json': ['.mindmap.json', '.json'] } }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(json);
      await writable.close();
      flashSaved();
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // user cancelled
      fileHandle = null;
    }
  }

  // Fallback: download
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (state.root.text.replace(/[^a-z0-9]+/gi, '_') || 'mindmap') + '.mindmap.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function loadFile() {
  // Try File System Access API
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Mind Map', accept: { 'application/json': ['.mindmap.json', '.json'] } }],
      });
      fileHandle = handle;
      const file = await handle.getFile();
      const json = await file.text();
      loadMap(json);
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  // Fallback: file input
  fileInput.click();
}

function loadMap(json) {
  try {
    const data = JSON.parse(json);
    if (!data.root || !data.root.id || !data.root.text) throw new Error('Invalid format');
    state.root = data.root;
    state.selectedId = null;
    state.nextId = maxIdIn(state.root) + 1;
    state.pan = { x: 60, y: 0 };
    state.zoom = 1;
    render();
  } catch (err) {
    alert('Failed to load mind map: ' + err.message);
  }
}

function newMap() {
  fileHandle = null;
  state.root = createNode('New Mind Map');
  state.selectedId = state.root.id;
  state.pan = { x: 60, y: 0 };
  state.zoom = 1;
  render();
}

const STORAGE_KEY = 'mindmapper_autosave';

function autoSave() {
  if (!state.root) return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeMap());
  } catch {}
}

function flashSaved() {
  const btn = document.getElementById('btn-save');
  const orig = btn.textContent;
  btn.textContent = 'Saved!';
  btn.style.background = '#27ae60';
  setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1200);
}

// ── Fit View ───────────────────────────────────────────────
function fitView() {
  if (!state.root) return;
  layoutTree(state.root, 0, 0);
  // Find bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function walk(n) {
    minX = Math.min(minX, n._x);
    minY = Math.min(minY, n._y);
    maxX = Math.max(maxX, n._x + NODE_W);
    maxY = Math.max(maxY, n._y + n._h);
    if (!n.collapsed) n.children.forEach(walk);
  }
  walk(state.root);

  const treeW = maxX - minX + 40;
  const treeH = maxY - minY + 40;
  const viewW = window.innerWidth;
  const viewH = window.innerHeight - 48;
  state.zoom = Math.min(1.5, Math.min(viewW / treeW, viewH / treeH));
  state.pan.x = (viewW - treeW * state.zoom) / 2 - minX * state.zoom;
  state.pan.y = (viewH - treeH * state.zoom) / 2 - minY * state.zoom;
  updateZoomLabel();
  render();
}

// ── Text Tree ──────────────────────────────────────────────
const TREE_WRAP_WIDTH = 80;

function wrapTreeText(text, prefixLen, wrapWidth) {
  const maxText = wrapWidth - prefixLen;
  if (maxText <= 10 || text.length <= maxText) return [text];
  const lines = [];
  const words = text.split(/\s+/);
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (test.length > maxText && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

function generateTextTree(node, prefix, isLast) {
  if (prefix === undefined) {
    // Root node — no connector
    const wrapped = wrapTreeText(node.text, 0, TREE_WRAP_WIDTH);
    let result = wrapped[0] + '\n';
    for (let i = 1; i < wrapped.length; i++) {
      result += wrapped[i] + '\n';
    }
    for (let i = 0; i < node.children.length; i++) {
      result += generateTextTree(node.children[i], '', i === node.children.length - 1);
    }
    return result;
  }
  const connector = isLast ? '└── ' : '├── ';
  const continuePfx = prefix + (isLast ? '    ' : '│   ');
  const wrapped = wrapTreeText(node.text, (prefix + connector).length, TREE_WRAP_WIDTH);
  let result = prefix + connector + wrapped[0] + '\n';
  for (let i = 1; i < wrapped.length; i++) {
    result += continuePfx + wrapped[i] + '\n';
  }
  const childPrefix = continuePfx;
  for (let i = 0; i < node.children.length; i++) {
    result += generateTextTree(node.children[i], childPrefix, i === node.children.length - 1);
  }
  return result;
}

function showTextTree() {
  if (!state.root) return;
  const text = generateTextTree(state.root);
  document.getElementById('tree-modal-text').textContent = text;
  document.getElementById('tree-modal-backdrop').classList.add('visible');
}

function hideTextTree() {
  document.getElementById('tree-modal-backdrop').classList.remove('visible');
}

document.getElementById('btn-print-tree').addEventListener('click', showTextTree);
document.getElementById('tree-modal-close').addEventListener('click', hideTextTree);
document.getElementById('tree-modal-backdrop').addEventListener('click', e => {
  if (e.target === e.currentTarget) hideTextTree();
});
document.getElementById('tree-copy').addEventListener('click', () => {
  const text = document.getElementById('tree-modal-text').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('tree-copy');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy to Clipboard'; }, 1200);
  });
});
document.getElementById('tree-print').addEventListener('click', () => {
  window.print();
});

// ── Toolbar ────────────────────────────────────────────────
document.getElementById('btn-new').addEventListener('click', newMap);
document.getElementById('btn-save').addEventListener('click', saveMap);
document.getElementById('btn-load').addEventListener('click', loadFile);
document.getElementById('btn-add-child').addEventListener('click', addChild);
document.getElementById('btn-add-sibling').addEventListener('click', addSibling);
document.getElementById('btn-delete').addEventListener('click', deleteSelected);
document.getElementById('btn-move-up').addEventListener('click', () => moveNode(-1));
document.getElementById('btn-move-down').addEventListener('click', () => moveNode(1));
document.getElementById('btn-fit').addEventListener('click', fitView);

fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadMap(reader.result);
  reader.readAsText(file);
  fileInput.value = '';
});

// ── Init ───────────────────────────────────────────────────
function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.root && data.root.id && data.root.text) {
        state.root = data.root;
        state.nextId = maxIdIn(state.root) + 1;
        state.selectedId = state.root.id;
        render();
        return;
      }
    } catch {}
  }
  state.root = JSON.parse(JSON.stringify(DEFAULT_MAP.root));
  state.nextId = maxIdIn(state.root) + 1;
  state.selectedId = state.root.id;
  render();
}

init();

// ── Quiz Bot: API Layer ─────────────────────────────────────
const API_KEY_STORAGE = 'mindmapper_api_key';

function getApiKey() { return localStorage.getItem(API_KEY_STORAGE) || ''; }
function setApiKey(key) { localStorage.setItem(API_KEY_STORAGE, key); }
function clearApiKey() { localStorage.removeItem(API_KEY_STORAGE); }

function parseJsonFromClaude(text) {
  const cleaned = text.replace(/^```json?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
  return JSON.parse(cleaned);
}

async function callClaude(systemPrompt, userMessage) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API key not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ── Quiz Bot: Settings Modal ────────────────────────────────
function showSettingsModal() {
  document.getElementById('api-key-input').value = getApiKey();
  document.getElementById('settings-modal-backdrop').classList.add('visible');
}
function hideSettingsModal() {
  document.getElementById('settings-modal-backdrop').classList.remove('visible');
}

document.getElementById('btn-settings').addEventListener('click', showSettingsModal);
document.getElementById('settings-modal-close').addEventListener('click', hideSettingsModal);
document.getElementById('settings-modal-backdrop').addEventListener('click', e => {
  if (e.target === e.currentTarget) hideSettingsModal();
});
document.getElementById('save-api-key').addEventListener('click', () => {
  const key = document.getElementById('api-key-input').value.trim();
  if (key) {
    setApiKey(key);
    hideSettingsModal();
  }
});
document.getElementById('clear-api-key').addEventListener('click', () => {
  clearApiKey();
  document.getElementById('api-key-input').value = '';
});

// ── Quiz Bot: Quiz State ────────────────────────────────────
const quizState = {
  questions: [],
  currentIndex: 0,
  results: [],       // { correct: bool|null, feedback: string, userAnswer: string }
  selectedMC: null,   // selected MC letter
  isLoading: false,
};

// ── Quiz Bot: Config Modal ──────────────────────────────────
function showQuizConfig() {
  if (!getApiKey()) {
    showSettingsModal();
    return;
  }
  if (!state.root || state.root.children.length === 0) {
    alert('Add some content to your mind map first.');
    return;
  }
  document.getElementById('quiz-config-backdrop').classList.add('visible');
}
function hideQuizConfig() {
  document.getElementById('quiz-config-backdrop').classList.remove('visible');
}

document.getElementById('btn-quiz').addEventListener('click', showQuizConfig);
document.getElementById('quiz-config-close').addEventListener('click', hideQuizConfig);
document.getElementById('quiz-config-backdrop').addEventListener('click', e => {
  if (e.target === e.currentTarget) hideQuizConfig();
});

const quizCountSlider = document.getElementById('quiz-count');
const quizCountLabel = document.getElementById('quiz-count-label');
quizCountSlider.addEventListener('input', () => {
  quizCountLabel.textContent = quizCountSlider.value;
});

// ── Quiz Bot: Quiz Modal ────────────────────────────────────
function showQuizModal() {
  document.getElementById('quiz-modal-backdrop').classList.add('visible');
}
function hideQuizModal() {
  document.getElementById('quiz-modal-backdrop').classList.remove('visible');
}

document.getElementById('quiz-modal-close').addEventListener('click', hideQuizModal);
document.getElementById('quiz-modal-backdrop').addEventListener('click', e => {
  if (e.target === e.currentTarget) hideQuizModal();
});

function showQuizSection(id) {
  ['quiz-loading', 'quiz-error', 'quiz-question-area', 'quiz-feedback-area', 'quiz-summary'].forEach(s => {
    document.getElementById(s).style.display = 'none';
  });
  document.getElementById(id).style.display = '';
}

// ── Quiz Bot: Generate Questions ────────────────────────────
async function generateQuiz() {
  const format = document.getElementById('quiz-format').value;
  const count = parseInt(quizCountSlider.value);

  hideQuizConfig();
  showQuizModal();
  showQuizSection('quiz-loading');
  document.getElementById('quiz-header-text').textContent = 'Quiz';

  const treeText = generateTextTree(state.root);

  let formatInstruction = '';
  if (format === 'mc') formatInstruction = 'Use ONLY "mc" (multiple choice) type.';
  else if (format === 'fill') formatInstruction = 'Use ONLY "fill" (fill-in-the-blank) type.';
  else if (format === 'open') formatInstruction = 'Use ONLY "open" (open-ended) type.';
  else formatInstruction = 'Use a mix of "mc", "fill", and "open" types.';

  const systemPrompt = `You are a quiz generator. Given a mind map structure, generate quiz questions that test understanding of the content, relationships, and hierarchy shown in the mind map. Respond ONLY with valid JSON. No markdown fences, no explanation.`;

  const userPrompt = `Here is a mind map:

${treeText}

Generate exactly ${count} quiz questions. ${formatInstruction}

Return JSON exactly like this structure:
{"questions":[
  {"type":"mc","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"B","explanation":"..."},
  {"type":"fill","question":"Statement with ___ blank...","answer":"the answer","explanation":"..."},
  {"type":"open","question":"Explain...","modelAnswer":"...","explanation":"..."}
]}`;

  try {
    const raw = await callClaude(systemPrompt, userPrompt);
    const data = parseJsonFromClaude(raw);
    if (!data.questions || !data.questions.length) throw new Error('No questions generated');
    quizState.questions = data.questions;
    quizState.currentIndex = 0;
    quizState.results = [];
    quizState.selectedMC = null;
    showQuestion();
  } catch (err) {
    showQuizSection('quiz-error');
    document.getElementById('quiz-error').textContent = 'Failed to generate quiz: ' + err.message;
  }
}

document.getElementById('quiz-start').addEventListener('click', generateQuiz);

// ── Quiz Bot: Show Question ─────────────────────────────────
function showQuestion() {
  const q = quizState.questions[quizState.currentIndex];
  const total = quizState.questions.length;
  document.getElementById('quiz-header-text').textContent = `Question ${quizState.currentIndex + 1} of ${total}`;

  showQuizSection('quiz-question-area');

  const questionText = document.getElementById('quiz-question-text');
  const mcOptions = document.getElementById('quiz-mc-options');
  const answerInput = document.getElementById('quiz-answer-input');
  const submitBtn = document.getElementById('quiz-submit-answer');

  questionText.textContent = q.question;
  mcOptions.innerHTML = '';
  answerInput.style.display = 'none';
  answerInput.value = '';
  submitBtn.disabled = true;
  quizState.selectedMC = null;

  if (q.type === 'mc') {
    mcOptions.style.display = '';
    for (const opt of q.options) {
      const btn = document.createElement('button');
      btn.className = 'quiz-mc-btn';
      btn.textContent = opt;
      btn.dataset.letter = opt.charAt(0);
      btn.addEventListener('click', () => {
        mcOptions.querySelectorAll('.quiz-mc-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        quizState.selectedMC = btn.dataset.letter;
        submitBtn.disabled = false;
      });
      mcOptions.appendChild(btn);
    }
  } else {
    mcOptions.style.display = 'none';
    answerInput.style.display = '';
    answerInput.placeholder = q.type === 'fill' ? 'Fill in the blank...' : 'Type your answer...';
    answerInput.focus();
    answerInput.addEventListener('input', function handler() {
      submitBtn.disabled = !answerInput.value.trim();
    });
  }
}

// ── Quiz Bot: Submit Answer ─────────────────────────────────
async function submitAnswer() {
  const q = quizState.questions[quizState.currentIndex];
  const submitBtn = document.getElementById('quiz-submit-answer');
  submitBtn.disabled = true;

  let userAnswer = '';
  let correct = false;
  let feedbackText = '';

  if (q.type === 'mc') {
    userAnswer = quizState.selectedMC;
    correct = userAnswer.toUpperCase() === q.answer.toUpperCase();
    feedbackText = correct ? 'Correct!' : `The correct answer is ${q.answer}.`;
    if (q.explanation) feedbackText += ' ' + q.explanation;
    // Highlight correct/incorrect options
    document.querySelectorAll('#quiz-mc-options .quiz-mc-btn').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.letter.toUpperCase() === q.answer.toUpperCase()) btn.classList.add('correct');
      else if (btn.classList.contains('selected')) btn.classList.add('incorrect');
    });
  } else if (q.type === 'fill') {
    userAnswer = document.getElementById('quiz-answer-input').value.trim();
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    correct = normalize(userAnswer).includes(normalize(q.answer)) ||
              normalize(q.answer).includes(normalize(userAnswer));
    feedbackText = correct ? 'Correct!' : `The answer is: ${q.answer}.`;
    if (q.explanation) feedbackText += ' ' + q.explanation;
  } else {
    // Open-ended: use Claude to evaluate
    userAnswer = document.getElementById('quiz-answer-input').value.trim();
    try {
      const evalSystem = 'You are an answer evaluator. Compare the student answer to the model answer for accuracy and completeness. Respond ONLY with valid JSON: {"score":0-10,"feedback":"..."}';
      const evalUser = `Question: ${q.question}\nModel answer: ${q.modelAnswer}\nStudent answer: ${userAnswer}`;
      const raw = await callClaude(evalSystem, evalUser);
      const result = parseJsonFromClaude(raw);
      const score = result.score ?? 0;
      correct = score >= 7 ? true : score >= 4 ? null : false; // null = partial
      feedbackText = result.feedback || '';
      if (q.explanation) feedbackText += '\n\n' + q.explanation;
    } catch {
      correct = null;
      feedbackText = `Could not evaluate. Model answer: ${q.modelAnswer}`;
    }
  }

  quizState.results.push({ correct, feedbackText, userAnswer });
  showFeedback(q, correct, feedbackText);
}

document.getElementById('quiz-submit-answer').addEventListener('click', submitAnswer);

// ── Quiz Bot: Show Feedback ─────────────────────────────────
function showFeedback(q, correct, feedbackText) {
  showQuizSection('quiz-feedback-area');

  document.getElementById('quiz-question-review').textContent = q.question;

  const box = document.getElementById('quiz-feedback-box');
  box.className = 'quiz-feedback ' + (correct === true ? 'correct' : correct === null ? 'partial' : 'incorrect');

  const badge = document.getElementById('quiz-feedback-badge');
  badge.textContent = correct === true ? 'Correct!' : correct === null ? 'Partial Credit' : 'Incorrect';

  document.getElementById('quiz-feedback-text').textContent = feedbackText;

  const nextBtn = document.getElementById('quiz-next');
  nextBtn.textContent = quizState.currentIndex >= quizState.questions.length - 1 ? 'See Results' : 'Next Question';
}

document.getElementById('quiz-next').addEventListener('click', () => {
  quizState.currentIndex++;
  if (quizState.currentIndex >= quizState.questions.length) {
    showSummary();
  } else {
    showQuestion();
  }
});

// ── Quiz Bot: Summary ───────────────────────────────────────
function showSummary() {
  showQuizSection('quiz-summary');
  document.getElementById('quiz-header-text').textContent = 'Quiz Results';

  const total = quizState.results.length;
  const correctCount = quizState.results.filter(r => r.correct === true).length;
  const partialCount = quizState.results.filter(r => r.correct === null).length;
  const pct = Math.round((correctCount + partialCount * 0.5) / total * 100);

  const scoreNum = document.getElementById('quiz-score-number');
  scoreNum.textContent = `${pct}%`;
  scoreNum.style.color = pct >= 70 ? '#00B894' : pct >= 40 ? '#fdcb6e' : '#e17055';

  document.getElementById('quiz-score-label').textContent =
    `${correctCount} correct${partialCount ? `, ${partialCount} partial` : ''} out of ${total} questions`;

  const reviewList = document.getElementById('quiz-review-list');
  reviewList.innerHTML = '';
  quizState.questions.forEach((q, i) => {
    const r = quizState.results[i];
    const div = document.createElement('div');
    div.className = 'quiz-review-item ' + (r.correct === true ? 'correct' : r.correct === null ? 'partial' : 'incorrect');
    div.innerHTML = `<div class="quiz-review-q">${i + 1}. ${escapeHtml(q.question)}</div>
      <div class="quiz-review-a">Your answer: ${escapeHtml(r.userAnswer || '(none)')}</div>`;
    reviewList.appendChild(div);
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Quiz keyboard shortcuts
document.addEventListener('keydown', e => {
  const quizVisible = document.getElementById('quiz-modal-backdrop').classList.contains('visible');
  if (!quizVisible) return;

  if (e.key === 'Escape') { hideQuizModal(); return; }

  const questionArea = document.getElementById('quiz-question-area');
  const feedbackArea = document.getElementById('quiz-feedback-area');

  if (questionArea.style.display !== 'none') {
    const q = quizState.questions[quizState.currentIndex];
    // MC: A-D to select
    if (q && q.type === 'mc' && /^[a-dA-D]$/.test(e.key)) {
      const letter = e.key.toUpperCase();
      document.querySelectorAll('#quiz-mc-options .quiz-mc-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.letter === letter) btn.classList.add('selected');
      });
      quizState.selectedMC = letter;
      document.getElementById('quiz-submit-answer').disabled = false;
    }
    // Enter to submit
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      const submitBtn = document.getElementById('quiz-submit-answer');
      if (!submitBtn.disabled) submitBtn.click();
    }
  }

  if (feedbackArea.style.display !== 'none' && e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('quiz-next').click();
  }
});

document.getElementById('quiz-retry').addEventListener('click', () => {
  hideQuizModal();
  showQuizConfig();
});
document.getElementById('quiz-close-final').addEventListener('click', hideQuizModal);
