import { shuffle } from '../utils/shuffle';

export const PA_COLS = 9;
export const PA_ROWS = 8;
export const PA_TOTAL = PA_COLS * PA_ROWS;

/** Blocked hardware-reserved cells */
export const PA_BLOCKED = new Set([
  22, 24, 31, 37, 43, 48, 51, 56, 59, 67,
]);

export type Shape = readonly [number, number][];

export type BlockDef = {
  name: string;
  icon: string;
  color: string;
  bg: string;
  brd: string;
  sh: Shape;
};

export const PA_BLOCK_DEFS: BlockDef[] = [
  { name: 'Chat', icon: '💬', color: '#C2185B', bg: '#FCE4EC', brd: '#F48FB1', sh: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { name: 'Code gen', icon: '💻', color: '#1565C0', bg: '#E3F2FD', brd: '#90CAF9', sh: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },
  { name: 'Doc', icon: '📄', color: '#2E7D32', bg: '#E8F5E9', brd: '#A5D6A7', sh: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { name: 'Translate', icon: '🌐', color: '#E65100', bg: '#FFF3E0', brd: '#FFCC80', sh: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { name: 'RAG', icon: '🔍', color: '#6A1B9A', bg: '#F3E5F5', brd: '#CE93D8', sh: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { name: 'Long story', icon: '📖', color: '#00695C', bg: '#E0F2F1', brd: '#80CBC4', sh: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
  { name: 'Analysis', icon: '📊', color: '#AD1457', bg: '#FCE4EC', brd: '#F48FB1', sh: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]] },
  { name: 'Debug', icon: '🐛', color: '#1A237E', bg: '#E8EAF6', brd: '#9FA8DA', sh: [[0, 0], [0, 1], [1, 1], [1, 2]] },
  { name: 'Embedding', icon: '🧮', color: '#558B2F', bg: '#F1F8E9', brd: '#AED581', sh: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { name: 'Summary', icon: '📝', color: '#F57F17', bg: '#FFFDE7', brd: '#FFF176', sh: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
  { name: 'Classifier', icon: '🏷', color: '#37474F', bg: '#ECEFF1', brd: '#B0BEC5', sh: [[0, 0], [0, 1], [1, 0], [2, 0], [2, 1]] },
  { name: 'Vision', icon: '👁', color: '#880E4F', bg: '#FCE4EC', brd: '#F48FB1', sh: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]] },
];

export type GridCell = null | 'B' | number;

/** True if this cell can receive a new page (not blocked hardware and not occupied). */
export function isFreeCell(v: GridCell | undefined): boolean {
  return v === null || v === undefined;
}

export function initPaGrid(): GridCell[] {
  return Array.from({ length: PA_TOTAL }, (_, i) => (PA_BLOCKED.has(i) ? 'B' : null));
}

export function bbox(sh: Shape) {
  return {
    rows: Math.max(...sh.map(([r]) => r)) + 1,
    cols: Math.max(...sh.map(([, c]) => c)) + 1,
  };
}

export function cellsForAnchor(sh: Shape, ar: number, ac: number): (number | null)[] {
  return sh.map(([dr, dc]) => {
    const r = ar + dr;
    const c = ac + dc;
    if (r < 0 || r >= PA_ROWS || c < 0 || c >= PA_COLS) return null;
    return r * PA_COLS + c;
  });
}

export function validCells(grid: GridCell[], cells: (number | null)[]): boolean {
  return cells.every((i) => i !== null && isFreeCell(grid[i as number]));
}

export function firstFreeCell(grid: GridCell[]): number {
  for (let i = 0; i < PA_TOTAL; i++) if (isFreeCell(grid[i])) return i;
  return 0;
}

export function lastPlacedCells(grid: GridCell[], lastPlacedIdx: number): Set<number> {
  const s = new Set<number>();
  if (lastPlacedIdx < 0) return s;
  for (let i = 0; i < PA_TOTAL; i++) {
    if (grid[i] === lastPlacedIdx) s.add(i);
  }
  return s;
}

export function touchesPreviousBlock(
  sh: Shape,
  ar: number,
  ac: number,
  grid: GridCell[],
  lastPlacedIdx: number,
): boolean {
  if (lastPlacedIdx < 0) {
    const ff = firstFreeCell(grid);
    const ffr = Math.floor(ff / PA_COLS);
    const ffc = ff % PA_COLS;
    return ar === ffr && ac === ffc;
  }
  const lastCells = lastPlacedCells(grid, lastPlacedIdx);
  if (lastCells.size === 0) return true;
  const newCells = cellsForAnchor(sh, ar, ac);
  for (const ci of newCells) {
    if (ci === null) continue;
    const cr = Math.floor(ci / PA_COLS);
    const cc = ci % PA_COLS;
    const neighbours: [number, number][] = [
      [cr - 1, cc],
      [cr + 1, cc],
      [cr, cc - 1],
      [cr, cc + 1],
    ];
    for (const [nr, nc] of neighbours) {
      if (nr < 0 || nr >= PA_ROWS || nc < 0 || nc >= PA_COLS) continue;
      if (lastCells.has(nr * PA_COLS + nc)) return true;
    }
  }
  return false;
}

export function strandedCount(grid: GridCell[], lastPlacedIdx: number, paged: boolean): number {
  if (paged) return 0;
  if (lastPlacedIdx < 0) return 0;
  const lastCells = lastPlacedCells(grid, lastPlacedIdx);
  if (lastCells.size === 0) return 0;
  let n = 0;
  for (let i = 0; i < PA_TOTAL; i++) {
    if (!isFreeCell(grid[i])) continue;
    const r = Math.floor(i / PA_COLS);
    const c = i % PA_COLS;
    let nearLast = false;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < PA_ROWS && nc >= 0 && nc < PA_COLS && lastCells.has(nr * PA_COLS + nc)) {
        nearLast = true;
        break;
      }
    }
    if (!nearLast) n++;
  }
  return n;
}

export function validNonPagedAnchors(sh: Shape, grid: GridCell[], lastPlacedIdx: number): { r: number; c: number }[] {
  const anchors: { r: number; c: number }[] = [];
  for (let r = 0; r < PA_ROWS; r++) {
    for (let c = 0; c < PA_COLS; c++) {
      const cells = cellsForAnchor(sh, r, c);
      if (validCells(grid, cells) && touchesPreviousBlock(sh, r, c, grid, lastPlacedIdx)) anchors.push({ r, c });
    }
  }
  return anchors;
}

export function canFitAnywhere(grid: GridCell[], sh: Shape): boolean {
  for (let r = 0; r < PA_ROWS; r++) {
    for (let c = 0; c < PA_COLS; c++) {
      if (validCells(grid, cellsForAnchor(sh, r, c))) return true;
    }
  }
  return false;
}

export function canFitInMode(grid: GridCell[], sh: Shape, paged: boolean, lastPlacedIdx: number): boolean {
  if (paged) return canFitAnywhere(grid, sh);
  for (let r = 0; r < PA_ROWS; r++) {
    for (let c = 0; c < PA_COLS; c++) {
      const cells = cellsForAnchor(sh, r, c);
      if (validCells(grid, cells) && touchesPreviousBlock(sh, r, c, grid, lastPlacedIdx)) return true;
    }
  }
  return false;
}

export function colorIdxForStamp(stamp: number): number {
  return stamp % PA_BLOCK_DEFS.length;
}

export function shuffleBlocks(): BlockDef[] {
  return shuffle([...PA_BLOCK_DEFS, ...PA_BLOCK_DEFS]);
}
