import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import { DemoNav } from '../components/DemoNav';
import {
  PA_COLS,
  bbox,
  canFitAnywhere,
  canFitInMode,
  cellsForAnchor,
  isFreeCell,
  PA_BLOCK_DEFS,
  type BlockDef,
  type GridCell,
  strandedCount,
  touchesPreviousBlock,
  validCells,
  validNonPagedAnchors,
  firstFreeCell,
  initPaGrid,
  colorIdxForStamp,
} from '../data/pagedAttentionGame';
import { DemoTutorialOverlay } from '../components/DemoTutorialOverlay';
import { HatLogo } from '../components/HatLogo';
import { shuffle } from '../utils/shuffle';
import '../styles/paged-attention.css';

type InsightVariant = '' | 'hi' | 'warn' | 'bad' | 'good';

type OverlayState = {
  emoji: string;
  pages: number;
  blocksPlaced: number;
  modeLabel: string;
  otherModeLabel: string;
  hasPrev: boolean;
  prevScore: number | null;
  prevModeLabel: string | null;
  paged: boolean;
};

function shufflePool(): BlockDef[] {
  return shuffle([...PA_BLOCK_DEFS, ...PA_BLOCK_DEFS]);
}

function buildDragImageEl(req: BlockDef): HTMLDivElement {
  const bb = bbox(req.sh);
  const shSet = new Set(req.sh.map(([r, c]) => r * 100 + c));
  const wrap = document.createElement('div');
  wrap.style.display = 'grid';
  wrap.style.gridTemplateColumns = `repeat(${bb.cols}, 28px)`;
  wrap.style.gap = '3px';
  wrap.style.padding = '6px';
  wrap.style.background = 'white';
  wrap.style.borderRadius = '8px';
  wrap.style.border = `2px solid ${req.brd}`;
  for (let r = 0; r < bb.rows; r++) {
    for (let c = 0; c < bb.cols; c++) {
      const cell = document.createElement('div');
      cell.style.width = '28px';
      cell.style.height = '28px';
      cell.style.borderRadius = '4px';
      cell.style.background = shSet.has(r * 100 + c) ? req.color : 'transparent';
      wrap.appendChild(cell);
    }
  }
  return wrap;
}

export function PagedAttentionPage() {
  const [paged, setPaged] = useState(false);
  const [grid, setGrid] = useState<GridCell[]>(() => initPaGrid());
  const queueRef = useRef({ pool: shufflePool(), idx: 0 });

  const [currentBlock, setCurrentBlock] = useState<BlockDef | null>(null);
  const [nextBlock, setNextBlock] = useState<BlockDef | null>(null);

  const [totalPagesPlaced, setTotalPagesPlaced] = useState(0);
  const [placed, setPlaced] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [lastPlacedIdx, setLastPlacedIdx] = useState(-1);
  const [placementCount, setPlacementCount] = useState(0);

  const [prevScore, setPrevScore] = useState<number | null>(null);
  const [prevModeLabel, setPrevModeLabel] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [hoverCell, setHoverCell] = useState<number | null>(null);

  const [insight, setInsight] = useState({
    title: 'How to play',
    text:
      'Drag the block from the panel onto the grid. Without PagedAttention it must land at the orange zone. With PagedAttention it can go anywhere that fits.',
    variant: '' as InsightVariant,
  });

  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [oomPulse, setOomPulse] = useState(false);

  const ghostRef = useRef<HTMLDivElement>(null);

  const drawNext = useCallback((): BlockDef => {
    let { pool, idx } = queueRef.current;
    if (idx >= pool.length) {
      pool = shufflePool();
      idx = 0;
    }
    const block = pool[idx];
    queueRef.current = { pool, idx: idx + 1 };
    return block;
  }, []);

  const resetInsightDefault = useCallback((modePaged: boolean) => {
    setInsight({
      title: 'How to play',
      text: modePaged
        ? 'Drag the block onto the grid anywhere that fits. Notice how many requests you can place despite the blocked cells.'
        : 'First block must go at the first free cell. Each block after must touch the last placed one (up/down/left/right only). Blocked cells can strand free space permanently.',
      variant: '',
    });
  }, []);

  const doReset = useCallback(
    (keepPrev: boolean, modePaged: boolean) => {
      queueRef.current = { pool: shufflePool(), idx: 0 };
      let cur = drawNext();
      let nxt = drawNext();
      setGrid(initPaGrid());
      setPlaced(0);
      setRejected(0);
      setTotalPagesPlaced(0);
      setPlacementCount(0);
      setHoverCell(null);
      setIsDragging(false);
      setLastPlacedIdx(-1);
      setOverlay(null);
      if (!keepPrev) {
        setPrevScore(null);
        setPrevModeLabel(null);
      }

      const g0 = initPaGrid();
      if (!canFitInMode(g0, cur.sh, modePaged, -1)) {
        cur = drawNext();
        nxt = drawNext();
      }
      setCurrentBlock(cur);
      setNextBlock(nxt);
      resetInsightDefault(modePaged);
    },
    [drawNext, resetInsightDefault],
  );

  useEffect(() => {
    doReset(false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  const setInsightCls = useCallback((title: string, text: string, variant: InsightVariant) => {
    setInsight({ title, text, variant });
  }, []);

  const { previewSet, previewOk, zoneSet } = useMemo(() => {
    const previewSet = new Set<number>();
    let previewOk = false;
    const zoneSet = new Set<number>();
    const req = currentBlock;
    if (isDragging && req && hoverCell !== null) {
      const hr = Math.floor(hoverCell / PA_COLS);
      const hc = hoverCell % PA_COLS;
      let bestAr: number | null = null;
      let bestAc: number | null = null;
      let bestCells: (number | null)[] | null = null;
      for (const [dr, dc] of req.sh) {
        const tryAr = hr - dr;
        const tryAc = hc - dc;
        const tryCells = cellsForAnchor(req.sh, tryAr, tryAc);
        if (validCells(grid, tryCells)) {
          bestAr = tryAr;
          bestAc = tryAc;
          bestCells = tryCells;
          break;
        }
      }
      if (bestCells && bestAr !== null && bestAc !== null) {
        const allowed = paged ? true : touchesPreviousBlock(req.sh, bestAr, bestAc, grid, lastPlacedIdx);
        bestCells.forEach((i) => {
          if (i !== null) previewSet.add(i);
        });
        previewOk = allowed;
      } else {
        previewSet.add(hoverCell);
        previewOk = false;
      }
    }

    if (!paged && req) {
      if (lastPlacedIdx < 0) {
        const ff = firstFreeCell(grid);
        const ffr = Math.floor(ff / PA_COLS);
        const ffc = ff % PA_COLS;
        cellsForAnchor(req.sh, ffr, ffc).forEach((i) => {
          if (i !== null) zoneSet.add(i);
        });
      } else {
        validNonPagedAnchors(req.sh, grid, lastPlacedIdx).forEach(({ r, c }) => {
          cellsForAnchor(req.sh, r, c).forEach((i) => {
            if (i !== null) zoneSet.add(i);
          });
        });
      }
    }

    return { previewSet, previewOk, zoneSet };
  }, [isDragging, currentBlock, hoverCell, grid, paged, lastPlacedIdx]);

  const freeCount = grid.filter((c) => isFreeCell(c)).length;
  const stranded = strandedCount(grid, lastPlacedIdx, paged);

  const cannotPlaceCurrent = Boolean(
    currentBlock && !canFitInMode(grid, currentBlock.sh, paged, lastPlacedIdx),
  );
  /** False when hardware-reserved + placements leave no geometric footprint for this shape */
  const geomFitCurrent = Boolean(
    currentBlock && canFitAnywhere(grid, currentBlock.sh),
  );
  /** Empty cells may exist, but non-paged frontier forbids placing here — not the same as OOM */
  const frontierBlockedOnly = cannotPlaceCurrent && geomFitCurrent && !paged;

  useEffect(() => {
    if (!cannotPlaceCurrent) {
      setOomPulse(false);
      return;
    }
    setOomPulse(false);
    const id = window.setTimeout(() => setOomPulse(true), 4000);
    return () => window.clearTimeout(id);
  }, [cannotPlaceCurrent]);

  const moveGhost = useCallback((e: DragEvent | globalThis.DragEvent) => {
    const g = ghostRef.current;
    if (!g || g.style.display === 'none') return;
    g.style.left = `${e.clientX + 12}px`;
    g.style.top = `${e.clientY + 12}px`;
  }, []);

  const buildGhostDom = useCallback((req: BlockDef) => {
    const g = ghostRef.current;
    if (!g) return;
    const bb = bbox(req.sh);
    const shSet = new Set(req.sh.map(([r, c]) => r * 100 + c));
    g.innerHTML = '';
    g.style.display = 'grid';
    g.style.gridTemplateColumns = `repeat(${bb.cols}, 24px)`;
    for (let r = 0; r < bb.rows; r++) {
      for (let c = 0; c < bb.cols; c++) {
        const d = document.createElement('div');
        d.className = 'dg-cell';
        d.style.background = shSet.has(r * 100 + c) ? req.color : 'transparent';
        g.appendChild(d);
      }
    }
    g.classList.add('show');
  }, []);

  const hideGhost = useCallback(() => {
    const g = ghostRef.current;
    if (!g) return;
    g.style.display = 'none';
    g.classList.remove('show');
  }, []);

  const onBlockDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!currentBlock || cannotPlaceCurrent) return;
      setIsDragging(true);
      const req = currentBlock;
      const ghost = buildDragImageEl(req);
      ghost.style.position = 'absolute';
      ghost.style.top = `${e.clientY - 10}px`;
      ghost.style.left = `${e.clientX - 10}px`;
      ghost.style.zIndex = '1';
      ghost.style.pointerEvents = 'none';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 10, 10);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'current');
      window.setTimeout(() => ghost.remove(), 0);

      document.addEventListener('dragover', moveGhost as EventListener);
      buildGhostDom(req);
    },
    [currentBlock, cannotPlaceCurrent, buildGhostDom, moveGhost],
  );

  const onBlockDragEnd = useCallback(() => {
    setIsDragging(false);
    setHoverCell(null);
    hideGhost();
    document.removeEventListener('dragover', moveGhost as EventListener);
  }, [hideGhost, moveGhost]);

  const showDoneOverlay = useCallback(
    (pages: number, blocks: number, modePaged: boolean, scorePrev: number | null, labelPrev: string | null) => {
      const emoji = pages >= 40 ? '🏆' : pages >= 25 ? '🎉' : pages >= 15 ? '👏' : '😤';
      const modeLabel = modePaged ? 'With PagedAttention' : 'Without PagedAttention';
      const otherModeLabel = modePaged ? 'Without PagedAttention' : 'With PagedAttention ✓';
      setOverlay({
        emoji,
        pages,
        blocksPlaced: blocks,
        modeLabel,
        otherModeLabel,
        hasPrev: scorePrev !== null,
        prevScore: scorePrev,
        prevModeLabel: labelPrev,
        paged: modePaged,
      });
      setCurrentBlock(null);
      setNextBlock(null);
    },
    [],
  );

  const acknowledgeOom = useCallback(() => {
    showDoneOverlay(totalPagesPlaced, placed, paged, prevScore, prevModeLabel);
  }, [totalPagesPlaced, placed, paged, prevScore, prevModeLabel, showDoneOverlay]);

  const handleCellDrop = useCallback(
    (i: number) => (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setHoverCell(null);
      setIsDragging(false);
      hideGhost();
      document.removeEventListener('dragover', moveGhost as EventListener);

      const req = currentBlock;
      if (!req) return;

      const hr = Math.floor(i / PA_COLS);
      const hc = i % PA_COLS;
      let ar: number | null = null;
      let ac: number | null = null;
      let cells: (number | null)[] | null = null;
      for (const [dr, dc] of req.sh) {
        const tryAr = hr - dr;
        const tryAc = hc - dc;
        const tryCells = cellsForAnchor(req.sh, tryAr, tryAc);
        if (validCells(grid, tryCells)) {
          ar = tryAr;
          ac = tryAc;
          cells = tryCells;
          break;
        }
      }
      if (ar === null || cells === null) {
        setInsightCls(
          'Does not fit here',
          'The block cannot be placed with any alignment at this position.',
          'warn',
        );
        return;
      }

      if (!paged && !touchesPreviousBlock(req.sh, ar, ac, grid, lastPlacedIdx)) {
        setRejected((r) => r + 1);
        const strand = strandedCount(grid, lastPlacedIdx, paged);
        setInsightCls(
          'Rejected — must touch a previous block',
          `Without PagedAttention each new block must be adjacent to an already-placed one. This placement is isolated — it does not touch any existing block. ${strand} free cells are now unreachable. Switch to PagedAttention to place freely!`,
          'bad',
        );
        return;
      }

      const stamp = placementCount;
      const newGrid = [...grid];
      cells.forEach((ci) => {
        if (ci !== null) newGrid[ci] = stamp;
      });
      const newTotalPages = totalPagesPlaced + req.sh.length;
      const newPlaced = placed + 1;
      const newLastPlacedIdx = stamp;
      const newPc = stamp + 1;

      const nc = nextBlock;
      const nn = drawNext();

      const stranded2 = strandedCount(newGrid, newLastPlacedIdx, paged);

      setGrid(newGrid);
      setTotalPagesPlaced(newTotalPages);
      setPlaced(newPlaced);
      setLastPlacedIdx(newLastPlacedIdx);
      setPlacementCount(newPc);

      if (!nc) {
        setInsightCls(
          `Placed: ${req.name} (+${req.sh.length} pages, total: ${newTotalPages})`,
          paged
            ? `${newTotalPages} pages scheduled — no more blocks in queue.`
            : `${newTotalPages} pages scheduled — no more blocks in queue.`,
          'good',
        );
        showDoneOverlay(newTotalPages, newPlaced, paged, prevScore, prevModeLabel);
        return;
      }

      if (!canFitInMode(newGrid, nc.sh, paged, newLastPlacedIdx)) {
        setCurrentBlock(nc);
        setNextBlock(nn);
        const geomOk = canFitAnywhere(newGrid, nc.sh);
        if (!geomOk) {
          setInsightCls(
            'No geometric fit',
            `The next block (${nc.name}) cannot be placed without overlapping blocked GPU cells or existing pages — like true OOM. Tap the button below to end this run.`,
            'bad',
          );
        } else if (!paged) {
          setInsightCls(
            'Frontier rule blocks this shape',
            `There are free cells, but without PagedAttention the next block must touch the last placed block (edge-adjacent). This shape has no valid anchor — fragmentation stranded usable memory. Tap below to end the run.`,
            'warn',
          );
        } else {
          setInsightCls(
            'No valid placement',
            `Cannot place ${nc.name}. Tap below to end the run.`,
            'bad',
          );
        }
        return;
      }

      setInsightCls(
        `Placed: ${req.name} (+${req.sh.length} pages, total: ${newTotalPages})`,
        paged
          ? `${newTotalPages} pages scheduled so far. Keep going!`
          : `${newTotalPages} pages scheduled so far.${stranded2 > 0 ? ` ${stranded2} free cells now isolated.` : ''}`,
        'good',
      );

      setCurrentBlock(nc);
      setNextBlock(nn);
    },
    [
      currentBlock,
      grid,
      paged,
      lastPlacedIdx,
      placementCount,
      totalPagesPlaced,
      placed,
      nextBlock,
      drawNext,
      hideGhost,
      moveGhost,
      showDoneOverlay,
      prevScore,
      prevModeLabel,
      setInsightCls,
    ],
  );

  const handleGridDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const el = (e.target as HTMLElement).closest('[data-i]');
      const idx = el ? parseInt(el.getAttribute('data-i')!, 10) : null;
      if (idx !== null && idx !== hoverCell) setHoverCell(idx);
    },
    [isDragging, hoverCell],
  );

  const handleGridDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    const g = e.currentTarget;
    if (!e.relatedTarget || !g.contains(e.relatedTarget as Node)) {
      setHoverCell(null);
    }
  }, []);

  const switchMode = useCallback(
    (newPaged: boolean) => {
      setPaged(newPaged);
      doReset(true, newPaged);
    },
    [doReset],
  );

  const closeOverlaySwitch = useCallback(() => {
    if (!overlay) return;
    setPrevScore(overlay.pages);
    setPrevModeLabel(overlay.modeLabel);
    const nextPaged = !overlay.paged;
    setPaged(nextPaged);
    doReset(true, nextPaged);
    setOverlay(null);
  }, [overlay, doReset]);

  const closeOverlayReset = useCallback(() => {
    setOverlay(null);
    doReset(false, paged);
  }, [doReset, paged]);

  const gridCells: ReactNode[] = [];
  for (let i = 0; i < grid.length; i++) {
    const val = grid[i];
    let cls = 'mc ';
    let style: React.CSSProperties | undefined;
    if (val === 'B') cls += 'blocked';
    else if (typeof val === 'number') {
      const def = PA_BLOCK_DEFS[colorIdxForStamp(val)];
      cls += 'occ';
      style = { background: def.bg, border: `1.5px solid ${def.brd}` };
    } else if (previewSet.has(i)) cls += previewOk ? 'drop-ok' : 'drop-no';
    else if (zoneSet.has(i)) cls += 'zone';
    else cls += 'free';

    gridCells.push(
      <div
        key={i}
        className={cls.trim()}
        style={style}
        data-i={i}
        title={typeof val === 'number' ? PA_BLOCK_DEFS[colorIdxForStamp(val)].name : undefined}
        onDragOver={handleGridDragOver}
        onDrop={handleCellDrop(i)}
      />,
    );
  }

  const renderCurrentCard = () => {
    const req = currentBlock;
    if (!req) {
      return <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--ink-light)', padding: '8px 0' }}>All done!</div>;
    }
    const bb = bbox(req.sh);
    const shSet = new Set(req.sh.map(([r, c]) => r * 100 + c));
    const shapeCells: ReactNode[] = [];
    for (let r = 0; r < bb.rows; r++) {
      for (let c = 0; c < bb.cols; c++) {
        const filled = shSet.has(r * 100 + c);
        shapeCells.push(
          <div
            key={`${r}-${c}`}
            className="bs-cell"
            style={{
              background: filled ? req.bg : 'transparent',
              border: filled ? `1.5px solid ${req.brd}` : 'none',
            }}
          />,
        );
      }
    }

    return (
      <div
        className={`block-card${isDragging ? ' dragging-src' : ''}${cannotPlaceCurrent ? ' block-card--no-fit' : ''}`}
        draggable={!cannotPlaceCurrent}
        onDragStart={onBlockDragStart}
        onDragEnd={onBlockDragEnd}
        style={{ background: req.bg, borderColor: req.brd }}
      >
        <div className="block-card-top">
          <div className="block-icon">{req.icon}</div>
          <div className="block-info">
            <div className="block-name" style={{ color: req.color }}>
              {req.name}
            </div>
            <div className="block-pages">{req.sh.length} pages — drag onto grid</div>
          </div>
        </div>
        <div
          className="block-shape-grid"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${bb.cols}, 18px)`, gap: 3 }}
        >
          {shapeCells}
        </div>
      </div>
    );
  };

  const renderNextPreview = () => {
    const nxt = nextBlock;
    if (!nxt) return null;
    const bb = bbox(nxt.sh);
    const shSet = new Set(nxt.sh.map(([r, c]) => r * 100 + c));
    const cells: ReactNode[] = [];
    for (let r = 0; r < bb.rows; r++) {
      for (let c = 0; c < bb.cols; c++) {
        cells.push(
          <div
            key={`${r}-${c}`}
            className="ns-cell"
            style={{ background: shSet.has(r * 100 + c) ? nxt.color : 'transparent' }}
          />,
        );
      }
    }
    return (
      <div className="next-card">
        <div className="next-label">Up next</div>
        <div className="next-row">
          <div
            className="next-shape"
            style={{ display: 'grid', gridTemplateColumns: `repeat(${bb.cols}, 13px)`, gap: 2 }}
          >
            {cells}
          </div>
          <div className="next-text">
            {nxt.icon} {nxt.name} ({nxt.sh.length}p)
          </div>
        </div>
        <div className="queue-count">Keep going until you run out of space!</div>
      </div>
    );
  };

  const diff =
    overlay && overlay.hasPrev && overlay.prevScore !== null ? overlay.pages - overlay.prevScore : 0;
  const diffLabel =
    diff > 0 ? `+${diff} more pages` : diff === 0 ? 'Same score' : `${diff} fewer pages`;
  const diffColor = diff > 0 ? 'var(--green)' : diff === 0 ? 'var(--ink-mid)' : 'var(--red)';

  return (
    <div className="pa-page">
      <DemoTutorialOverlay
        storageKey="paged-attention"
        theme="paged-attention"
        title="Memory Tetris — how to play"
        stepLabels={['Choose mode', 'Drag blocks onto the grid', 'Maximize pages scheduled']}
      >
        <p>
          Each request is a shaped block. Drag it onto the grid. Keep placing blocks until you get stuck — your score
          is the total memory pages scheduled. Without PagedAttention each block must touch the last placed one, so
          blocked cells strand free space. With PagedAttention you can place anywhere. Try to get the maximum amount of
          blocks and notice how PagedAttention affects your scheduling flexibility and cell utilization.
        </p>
      </DemoTutorialOverlay>
      <DemoNav title="KV Cache Management" badge="07 / 07" />

      <div className="pa-hero">
        <div className="eyebrow">
          <div className="eyebrow-dot" />
          Memory Tetris
        </div>
        <h1>
          Pack the GPU.
          <br />
          <strong>PagedAttention</strong> makes it possible.
        </h1>
        <p className="hero-sub">
          Each request is a shaped block. <strong>Drag it onto the grid.</strong> Keep placing blocks until you get
          stuck — your score is the total memory pages scheduled. Without PagedAttention each block must touch the last
          placed one, so blocked cells strand free space. With PagedAttention you can place anywhere.
        </p>
      </div>

      <div ref={ghostRef} className="drag-ghost" aria-hidden />

      <div className="arena">
        <div className="top-row">
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn${!paged ? ' active' : ''}`}
              onClick={() => switchMode(false)}
            >
              Without PagedAttention
            </button>
            <button type="button" className={`mode-btn${paged ? ' active' : ''}`} onClick={() => switchMode(true)}>
              With PagedAttention ✓
            </button>
          </div>
          <span className="mode-tag">
            {paged
              ? 'PagedAttention ON — drag the block anywhere it fits on the grid.'
              : 'Each block must touch the most recently placed block (first block is free). Blocked cells can cut you off from free space you can no longer reach.'}
          </span>
        </div>

        <div className="stats-row">
          <div className="sc2 ac">
            <div className="sv">{totalPagesPlaced}</div>
            <div className="sl">Pages scheduled</div>
          </div>
          <div className="sc2 bad">
            <div className="sv">{rejected}</div>
            <div className="sl">Rejected</div>
          </div>
          <div className="sc2">
            <div className="sv">{freeCount}</div>
            <div className="sl">Free cells</div>
          </div>
          <div className="sc2 warn">
            <div className="sv">{stranded}</div>
            <div className="sl">Stranded cells</div>
          </div>
        </div>

        <div className="cols">
          <div className="grid-wrap">
            <div className="grid-top">
              <div className="grid-title">GPU Memory — 9 × 8 = 72 cells</div>
              <div className="legend">
                <div className="leg">
                  <div className="lsw" style={{ background: '#F5F3EF', border: '1.5px solid #E8E6E0' }} />
                  Free
                </div>
                <div className="leg">
                  <div className="lsw" style={{ background: '#2a2a2a' }} />
                  Blocked
                </div>
                <div className="leg">
                  <div
                    className="lsw"
                    style={{ boxShadow: 'inset 0 0 0 2.5px var(--amber)', background: '#FFF8E1' }}
                  />
                  Must-start
                </div>
              </div>
            </div>
            <div
              className="mem-grid"
              style={{ gridTemplateColumns: `repeat(${PA_COLS}, var(--cell))` }}
              onDragLeave={handleGridDragLeave}
            >
              {gridCells}
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-reset" onClick={() => doReset(false, paged)}>
                ↺ Reset
              </button>
            </div>
          </div>

          <div>
            <div className="block-panel">
              <div className="panel-title">Drag this block onto the grid</div>
              <div id="current-card">{renderCurrentCard()}</div>
              {renderNextPreview()}
              {cannotPlaceCurrent ? (
                <button
                  type="button"
                  className={`pa-oom-btn${oomPulse ? ' pa-oom-btn--pulse' : ''}${frontierBlockedOnly ? ' pa-oom-btn--frontier' : ''}`}
                  onClick={acknowledgeOom}
                >
                  <span className="pa-oom-btn-title">
                    {frontierBlockedOnly ? 'Frontier blocked — tap to end run' : 'OOM — memory limit reached'}
                  </span>
                  <span className="pa-oom-btn-sub">
                    {frontierBlockedOnly
                      ? 'Without PagedAttention the new block must touch the last one — you can still see empty cells that are unreachable.'
                      : 'No anchor clears blocked hardware cells (dark stripes) and existing fills — tap to finish run'}
                  </span>
                </button>
              ) : null}
            </div>

            <div className={`insight${insight.variant ? ` ${insight.variant}` : ''}`}>
              <h4>{insight.title}</h4>
              <p>{insight.text}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="pa-section">
        <div className="section-divider" />
        <h2>How PagedAttention Works</h2>
        <div className="eg">
          <div className="ec">
            <h3>The Fragmentation Problem</h3>
            <p>
              Without virtual memory, KV cache blocks must be placed contiguously from the current frontier. Reserved
              OS cells create gaps — requests get rejected even when total free memory is sufficient.
            </p>
          </div>
          <div className="ec">
            <h3>PagedAttention</h3>
            <p>
              vLLM maps KV cache to fixed-size pages tracked in a page table, like OS virtual memory. A contiguous
              logical block maps to physically scattered pages — any free cell is usable.
            </p>
          </div>
          <div className="ec">
            <h3>Real Impact</h3>
            <p>
              Pre-PagedAttention frameworks wasted ~30% of GPU memory to fragmentation. PagedAttention reduces this to
              near zero, fitting significantly more concurrent requests on the same hardware.
            </p>
          </div>
          <div className="ec">
            <h3>Prefix Sharing</h3>
            <p>
              Non-contiguous pages also enable copy-on-write prefix sharing — multiple requests pointing to the same
              physical pages means prefix caching is essentially free in memory terms.
            </p>
          </div>
        </div>
        <div className="rhs">
          <h3>
            <HatLogo size={18} />
            Red Hat
          </h3>
          <p>PagedAttention is the default KV-cache memory manager in vLLM — block-based allocation that cuts fragmentation and raises throughput.</p>
          <div className="rhs-links">
            <a className="rhl" href="https://vllm.ai/blog/vllm" target="_blank" rel="noreferrer">
              vLLM PagedAttention
            </a>
            <a
              className="rhl"
              href="https://developers.redhat.com/articles/2025/07/24/how-pagedattention-resolves-memory-waste-llm-systems"
              target="_blank"
              rel="noreferrer"
            >
              PagedAttention Developer Blog
            </a>
            <a className="rhl" href="https://www.redhat.com/en/topics/ai/what-is-vllm" target="_blank" rel="noreferrer">
              Red Hat vLLM Topic
            </a>
            <a className="rhl" href="https://www.youtube.com/shorts/DJ9RqILwj6Y" target="_blank" rel="noreferrer">
              PagedAttention Explained
            </a>
          </div>
        </div>
      </div>

      {overlay && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="overlay-box">
            <div className="overlay-emoji">{overlay.emoji}</div>
            <div className="overlay-title">{overlay.pages} pages scheduled</div>
            <div className="overlay-sub">{overlay.modeLabel}</div>
            <div className="overlay-stats">
              <div className="ov-stat">
                <div className="ov-v">{overlay.pages}</div>
                <div className="ov-l">Pages scheduled</div>
              </div>
              <div className="ov-stat">
                <div className="ov-v">{overlay.blocksPlaced}</div>
                <div className="ov-l">Blocks placed</div>
              </div>
            </div>

            {overlay.hasPrev && overlay.prevScore !== null && overlay.prevModeLabel && (
              <div className="pa-compare-box">
                <div className="pa-compare-head">Score comparison</div>
                <div className="pa-compare-grid">
                  <div style={{ textAlign: 'center' }}>
                    <div className="pa-compare-num">{overlay.prevScore}</div>
                    <div className="pa-compare-label">{overlay.prevModeLabel}</div>
                  </div>
                  <div className="pa-compare-arrow">→</div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="pa-compare-num cur">{overlay.pages}</div>
                    <div className="pa-compare-label">{overlay.modeLabel}</div>
                  </div>
                </div>
                <div className="pa-compare-diff" style={{ color: diffColor }}>
                  {diffLabel}
                </div>
              </div>
            )}

            <div className="overlay-cta">
              {overlay.hasPrev ? (
                <>
                  {overlay.paged && overlay.pages > (overlay.prevScore ?? 0) ? (
                    <>
                      PagedAttention scheduled <strong>{overlay.pages - (overlay.prevScore ?? 0)} more pages</strong>{' '}
                      with the same grid — that is the whole point!
                    </>
                  ) : !overlay.paged && overlay.pages > (overlay.prevScore ?? 0) ? (
                    <>
                      Interesting! Try <strong>With PagedAttention</strong> to see if you can do even better.
                    </>
                  ) : (
                    <>Try again to see if you can improve your score!</>
                  )}
                </>
              ) : (
                <>
                  Now try <strong>{overlay.otherModeLabel}</strong> — can you schedule more pages?
                </>
              )}
            </div>

            {overlay.hasPrev ? (
              <button type="button" className="overlay-btn" onClick={closeOverlayReset}>
                Play again
              </button>
            ) : (
              <>
                <button type="button" className="overlay-btn" onClick={closeOverlaySwitch}>
                  Try {overlay.otherModeLabel}
                </button>
                <button type="button" className="overlay-btn secondary" onClick={closeOverlayReset}>
                  Same mode again
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
