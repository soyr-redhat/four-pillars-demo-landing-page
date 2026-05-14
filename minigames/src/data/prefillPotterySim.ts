/** Pottery workshop sim — analog for prefill (wash) vs decode (paint) vs disaggregated pipeline */

export const POT_TEMPLATES = [
  { n: 'Vase', e: '🏺' },
  { n: 'Bowl', e: '🥣' },
  { n: 'Mug', e: '☕' },
  { n: 'Jug', e: '🫗' },
  { n: 'Plate', e: '🍽️' },
] as const;

export const BRUSH_WASH = 1;
export const BRUSH_PAINT = 4;
export const SPONGE_WASH = 4;
export const SPONGE_PAINT = 1;
export const TRANSFER = 6;

export const WASH_BASE = 24;
export const PAINT_BASE = 24;
export const BATCH_SIZE = 5;
/** Real-time ms per tick — higher = slower, easier to follow */
export const BASE_MS = 48;

export type PotState = 'queued' | 'washing' | 'transferring' | 'painting' | 'done';

export type Pot = {
  id: number;
  name: string;
  emoji: string;
  wTotal: number;
  pTotal: number;
  wDone: number;
  pDone: number;
  xDone: number;
  state: PotState;
};

export type WorkerKind = 'brush' | 'sponge' | 'disagg';

export type SimCounters = {
  pots: Pot[];
  elapsed: number;
  washTicks: number;
  paintTicks: number;
  xferTicks: number;
  done: number;
};

export function generateBatch(): Pot[] {
  return POT_TEMPLATES.map((t, i) => ({
    id: i + 1,
    name: t.n,
    emoji: t.e,
    wTotal: WASH_BASE + (i % 3) * 4,
    pTotal: PAINT_BASE + ((i + 1) % 3) * 4,
    wDone: 0,
    pDone: 0,
    xDone: 0,
    state: 'queued' as PotState,
  }));
}

export function freshSimState(potsTemplate: Pot[]): SimCounters {
  return {
    pots: potsTemplate.map(p => ({
      ...p,
      wDone: 0,
      pDone: 0,
      xDone: 0,
      state: 'queued' as PotState,
    })),
    elapsed: 0,
    washTicks: 0,
    paintTicks: 0,
    xferTicks: 0,
    done: 0,
  };
}

/** One simulation tick — mirrors the reference HTML implementation */
export function advanceTick(s: SimCounters, worker: WorkerKind): SimCounters {
  const pots = s.pots.map(p => ({ ...p }));
  let washTicks = s.washTicks;
  let paintTicks = s.paintTicks;
  let xferTicks = s.xferTicks;
  let done = s.done;

  if (worker !== 'disagg') {
    const wSpd = worker === 'brush' ? BRUSH_WASH : SPONGE_WASH;
    const pSpd = worker === 'brush' ? BRUSH_PAINT : SPONGE_PAINT;

    const idx = pots.findIndex(p => p.state === 'washing' || p.state === 'painting');
    if (idx === -1) {
      const qi = pots.findIndex(p => p.state === 'queued');
      if (qi !== -1) {
        pots[qi] = { ...pots[qi], state: 'washing' };
      }
      return finishTick(s, pots, washTicks, paintTicks, xferTicks, done);
    }

    const pot = pots[idx];
    if (pot.state === 'washing') {
      const wDone = pot.wDone + wSpd;
      washTicks++;
      if (wDone >= pot.wTotal) {
        pots[idx] = { ...pot, wDone, state: 'painting' };
      } else {
        pots[idx] = { ...pot, wDone };
      }
    } else {
      const pDone = pot.pDone + pSpd;
      paintTicks++;
      if (pDone >= pot.pTotal) {
        pots[idx] = { ...pot, pDone, state: 'done' };
        done++;
      } else {
        pots[idx] = { ...pot, pDone };
      }
    }
    return finishTick(s, pots, washTicks, paintTicks, xferTicks, done);
  }

  const washPot = pots.find(p => p.state === 'washing' || p.state === 'transferring');
  if (!washPot) {
    const qi = pots.findIndex(p => p.state === 'queued');
    if (qi !== -1) {
      pots[qi] = { ...pots[qi], state: 'washing' };
    }
    return advancePaintOnly(pots, washTicks, paintTicks, xferTicks, done, s);
  }

  const wi = pots.findIndex(p => p.id === washPot.id);
  const w = pots[wi];
  if (w.state === 'washing') {
    const wDone = w.wDone + SPONGE_WASH;
    washTicks++;
    if (wDone >= w.wTotal) {
      pots[wi] = { ...w, wDone, state: 'transferring' };
    } else {
      pots[wi] = { ...w, wDone };
    }
  } else {
    const xDone = w.xDone + 1;
    xferTicks++;
    if (xDone >= TRANSFER) {
      pots[wi] = { ...w, xDone, state: 'painting' };
    } else {
      pots[wi] = { ...w, xDone };
    }
  }

  return advancePaintOnly(pots, washTicks, paintTicks, xferTicks, done, s);
}

function advancePaintOnly(
  pots: Pot[],
  washTicks: number,
  paintTicks: number,
  xferTicks: number,
  done: number,
  s: SimCounters,
): SimCounters {
  const paintPot = pots.find(p => p.state === 'painting');
  if (paintPot) {
    const pi = pots.findIndex(p => p.id === paintPot.id);
    const p = pots[pi];
    const pDone = p.pDone + BRUSH_PAINT;
    let pt = paintTicks + 1;
    let d = done;
    if (pDone >= p.pTotal) {
      pots[pi] = { ...p, pDone, state: 'done' };
      d++;
    } else {
      pots[pi] = { ...p, pDone };
    }
    return finishTick(s, pots, washTicks, pt, xferTicks, d);
  }
  return finishTick(s, pots, washTicks, paintTicks, xferTicks, done);
}

function finishTick(
  s: SimCounters,
  pots: Pot[],
  washTicks: number,
  paintTicks: number,
  xferTicks: number,
  done: number,
): SimCounters {
  return {
    pots,
    elapsed: s.elapsed + 1,
    washTicks,
    paintTicks,
    xferTicks,
    done,
  };
}

export type ResultCard = {
  totalSec: string;
  totalTicks: number;
  washPct: number;
  paintPct: number;
  xferPct: number;
  idlePct: number;
};

export function buildResult(sim: SimCounters, speed: number): ResultCard {
  const washT = sim.washTicks;
  const paintT = sim.paintTicks;
  const xferT = sim.xferTicks;
  const totalT = washT + paintT + xferT || 1;
  const totalSec = ((sim.elapsed * BASE_MS) / speed / 1000).toFixed(1);
  return {
    totalSec,
    totalTicks: sim.elapsed,
    washPct: Math.round((washT / totalT) * 100),
    paintPct: Math.round((paintT / totalT) * 100),
    xferPct: Math.round((xferT / totalT) * 100),
    idlePct: Math.max(
      0,
      100 -
        Math.round((washT / totalT) * 100) -
        Math.round((paintT / totalT) * 100) -
        Math.round((xferT / totalT) * 100),
    ),
  };
}

export function workerLabel(w: WorkerKind): string {
  return w === 'brush' ? 'Brush Worker' : w === 'sponge' ? 'Sponge Worker' : 'Disaggregated Pipeline';
}

/** Exact tick count until batch completes — used for progress bar */
export function countTicksToComplete(template: Pot[], worker: WorkerKind): number {
  let s = freshSimState(template);
  let n = 0;
  while (s.done < BATCH_SIZE && n < 500000) {
    s = advanceTick(s, worker);
    n++;
  }
  return Math.max(1, n);
}

/** Short live caption for what the pipeline is doing */
export function workerActivitySummary(sim: SimCounters, worker: WorkerKind): string {
  const pots = sim.pots;
  if (worker === 'brush' || worker === 'sponge') {
    const active = pots.find(p => p.state === 'washing' || p.state === 'painting');
    if (!active) return 'Starting pipeline…';
    if (active.state === 'washing') {
      const pct = Math.min(100, Math.round((active.wDone / active.wTotal) * 100));
      return `${worker === 'brush' ? '🖌️ Brush' : '🧽 Sponge'} washing ${active.name}… ${pct}%`;
    }
    const pct = Math.min(100, Math.round((active.pDone / active.pTotal) * 100));
    return `${worker === 'brush' ? '🖌️ Brush' : '🧽 Sponge'} painting ${active.name}… ${pct}%`;
  }

  const wash = pots.find(p => p.state === 'washing' || p.state === 'transferring');
  const painting = pots.filter(p => p.state === 'painting');

  const parts: string[] = [];
  if (wash) {
    if (wash.state === 'washing') {
      const pct = Math.min(100, Math.round((wash.wDone / wash.wTotal) * 100));
      parts.push(`🧽 Sponge washing ${wash.name}… ${pct}%`);
    } else {
      const pct = Math.min(100, Math.round((wash.xDone / TRANSFER) * 100));
      parts.push(`🔄 Hand-off ${wash.name}… ${pct}%`);
    }
  }
  if (painting.length > 0) {
    const p = painting[0];
    const pct = Math.min(100, Math.round((p.pDone / p.pTotal) * 100));
    parts.push(`🖌️ Brush painting ${p.name}… ${pct}%`);
    if (painting.length > 1) parts.push(`(+${painting.length - 1} more)`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Pipeline starting…';
}
