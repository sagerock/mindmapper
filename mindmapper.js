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
