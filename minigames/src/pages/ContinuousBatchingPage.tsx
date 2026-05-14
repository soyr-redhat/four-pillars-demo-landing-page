import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DemoNav } from '../components/DemoNav';
import {
  BAKERY_BASE_MS,
  BAKERY_ORDER_SPAWN_INTERVAL_TICKS,
  BAKERY_PASTRIES,
  BAKERY_RACK_N,
  BAKERY_TIMEOUT,
  BAKERY_TOTAL_ORDERS,
  neededEmojiSet,
  trySpawnOrder,
  mkRack,
  type BakeryMode,
  type Order,
  type OverflowItem,
  type PastryIndex,
  type Rack,
} from '../data/continuousBakeryGame';
import { DemoTutorialOverlay } from '../components/DemoTutorialOverlay';
import { HatLogo } from '../components/HatLogo';
import { RhDocLink } from '../components/RhDocLink';
import '../styles/continuous-bakery.css';

type InsightVariant = '' | 'hi' | 'warn' | 'bad';
type Insight = { title: string; text: string; variant: InsightVariant };

type ModeRunStats = {
  elapsedSec: number;
  elapsed: string;
  util: number;
  gonRed: number;
  fulfilled: number;
};

type BakeryOverlayState = {
  emoji: string;
  completedMode: BakeryMode;
  thisRun: ModeRunStats;
  staticRun: ModeRunStats | null;
  continuousRun: ModeRunStats | null;
};

type SimState = {
  racks: (Rack | null)[];
  stagedBatch: PastryIndex[];
  overflow: OverflowItem[];
  orders: Order[];
  uid: number;
  nextOrderId: number;
  ordersCreated: number;
  fulfilled: number;
  gonRed: number;
  tick: number;
  /** Cumulative rack·ticks with active baking (timer still running, left &gt; 0) */
  activeBakeRT: number;
  /** Cumulative rack·ticks with any pastry in the slot (baking or finished, waiting to clear) */
  occupiedRT: number;
  ordersServedTotal: number;
  gameStartTime: number;
};

function emptySim(): SimState {
  return {
    racks: Array(BAKERY_RACK_N).fill(null) as (Rack | null)[],
    stagedBatch: [],
    overflow: [],
    orders: [],
    uid: 0,
    nextOrderId: 0,
    ordersCreated: 0,
    fulfilled: 0,
    gonRed: 0,
    tick: 0,
    activeBakeRT: 0,
    occupiedRT: 0,
    ordersServedTotal: 0,
    gameStartTime: 0,
  };
}

function cloneOrders(orders: Order[]): Order[] {
  return orders.map((o) => ({
    ...o,
    items: o.items.map((i) => ({ ...i })),
  }));
}

/** Slots still baking (timer &gt; 0) ÷ slots holding any pastry — snapshot of the oven *right now*. */
function rackSnapshotUtilPct(racks: (Rack | null)[]): number | null {
  let active = 0;
  let occ = 0;
  for (let i = 0; i < BAKERY_RACK_N; i++) {
    const r = racks[i];
    if (!r) continue;
    occ += 1;
    if (r.left > 0) active += 1;
  }
  if (occ === 0) return null;
  return Math.round((active / occ) * 100);
}

/** Cumulative over the whole run — used at game end; drops if lots of “finished sitting” rack·ticks. */
function sessionBakeSharePct(s: SimState): number {
  const a = s.activeBakeRT ?? 0;
  const o = s.occupiedRT ?? 0;
  return o > 0 ? Math.round((a / o) * 100) : 0;
}

function autoAssign(
  orders: Order[],
  overflow: OverflowItem[],
  e: string,
  name: string,
  id: number,
): { orders: Order[]; overflow: OverflowItem[] } {
  const order = orders.find((o) => !o.done && o.items.some((s) => !s.filled && s.e === e));
  if (order) {
    const next = cloneOrders(orders);
    const o = next.find((x) => x.id === order.id)!;
    const slot = o.items.find((s) => !s.filled && s.e === e);
    if (slot) slot.filled = true;
    return { orders: next, overflow };
  }
  return { orders, overflow: [...overflow, { name, e, id }] };
}

function computeInsight(
  mode: BakeryMode,
  running: boolean,
  s: SimState,
  stagedLen: number,
): Insight {
  const ready = s.racks.filter((r) => r && r.ready).length;
  const locked = s.racks.filter((r) => r && r.locked).length;
  const snap = rackSnapshotUtilPct(s.racks);
  const utilStr = snap === null ? '—' : `${snap}`;
  const redOrders = s.orders.filter((o) => o.urgent).length;
  const ovenBusy = s.racks.some((r) => r !== null);
  const occ = s.racks.filter(Boolean) as Rack[];
  const allReady = occ.length > 0 && occ.every((r) => r.ready);
  const remaining = BAKERY_TOTAL_ORDERS - s.ordersCreated;

  if (redOrders > 0 && mode === 'static') {
    return {
      title: '⚠️ Orders going red!',
      text: `In static mode racks are locked until the whole batch finishes — items pile up. Live active ÷ occupied: ${
        utilStr
      }${snap === null ? '' : '%'}.`,
      variant: 'bad',
    };
  }
  if (allReady && mode === 'static') {
    return {
      title: 'Batch done — take it out!',
      text: 'All racks ready. Hit "Take out batch" to assign everything at once.',
      variant: 'hi',
    };
  }
  if (ready > 0 && mode === 'continuous') {
    return {
      title: `${ready} rack${ready > 1 ? 's' : ''} ready`,
      text: `Continuous mode auto-assigns as soon as baking finishes. Live active ÷ occupied: ${
        utilStr
      }${snap === null ? '' : '%'}.`,
      variant: 'hi',
    };
  }
  if (locked > 0) {
    return {
      title: `${locked} rack${locked > 1 ? 's' : ''} locked`,
      text: `Done but waiting for the rest of the static batch. Assemble your next batch now! Finished sitting in oven: ${
        (s.occupiedRT ?? 0) - (s.activeBakeRT ?? 0)
      } rack·ticks.`,
      variant: 'warn',
    };
  }
  if (!ovenBusy && running && mode === 'static' && stagedLen === 0) {
    return {
      title: 'Oven empty!',
      text: 'Pick pastries to build and fire a batch. Green ones match orders.',
      variant: '',
    };
  }
  if (mode === 'continuous' && !ovenBusy && running) {
    const free = s.racks.filter((r) => !r).length;
    return {
      title: 'Oven empty!',
      text: `Click pastries to add them directly. ${free} slots free.`,
      variant: '',
    };
  }
  if (stagedLen > 0 && !ovenBusy && mode === 'static') {
    return { title: `Ready to fire (${stagedLen}/4)`, text: 'Hit Fire Batch!', variant: 'hi' };
  }
  if (stagedLen > 0 && ovenBusy && mode === 'static') {
    return {
      title: `Next batch staged (${stagedLen}/4)`,
      text: 'Oven running — fire the moment it clears.',
      variant: 'hi',
    };
  }
  return {
    title: mode === 'static' ? 'Static batching' : 'Continuous batching',
    text:
      mode === 'static'
        ? `Full batch bakes together. ${remaining} orders remaining. Live active ÷ occupied: ${
            utilStr
          }${snap === null ? '' : '%'}.`
        : `Items go straight in. ${remaining} orders remaining. Live active ÷ occupied: ${
            utilStr
          }${snap === null ? '' : '%'}.`,
    variant: mode === 'continuous' ? 'hi' : '',
  };
}

function advanceTick(prev: SimState, mode: BakeryMode): SimState {
  const tick = prev.tick + 1;
  let gonRed = prev.gonRed;
  const racks = prev.racks.map((r) => (r ? { ...r } : null));
  let orders = cloneOrders(prev.orders);
  let overflow = [...prev.overflow];
  let ordersCreated = prev.ordersCreated;
  let nextOrderId = prev.nextOrderId;

  racks.forEach((r) => {
    if (r && !r.ready) r.left -= 1;
  });
  orders.forEach((o) => {
    if (!o.done) {
      o.age += 1;
      if (o.age >= BAKERY_TIMEOUT && !o.urgent) {
        o.urgent = true;
        gonRed += 1;
      }
    }
  });

  if (tick % BAKERY_ORDER_SPAWN_INTERVAL_TICKS === 0 && ordersCreated < BAKERY_TOTAL_ORDERS) {
    const sp = trySpawnOrder(nextOrderId, ordersCreated);
    if (sp) {
      orders = [...orders, sp.order];
      nextOrderId += 1;
      ordersCreated = sp.nextCreated;
    }
  }

  if (mode === 'static') {
    racks.forEach((r) => {
      if (r && !r.ready && r.left <= 0) r.ready = true;
    });
    const occupied = racks.filter(Boolean) as Rack[];
    if (occupied.length) {
      const everyReady = occupied.every((r) => r.ready);
      racks.forEach((r) => {
        if (r) r.locked = r.ready && !everyReady;
      });
    }
  } else {
    for (let i = 0; i < BAKERY_RACK_N; i++) {
      const r = racks[i];
      if (r && !r.ready && r.left <= 0) {
        const res = autoAssign(orders, overflow, r.e, r.name, r.id);
        orders = res.orders;
        overflow = res.overflow;
        racks[i] = null;
      }
    }
  }

  let activeBakeSlots = 0;
  let occupiedSlots = 0;
  for (let i = 0; i < BAKERY_RACK_N; i++) {
    const r = racks[i];
    if (!r) continue;
    occupiedSlots += 1;
    if (r.left > 0) activeBakeSlots += 1;
  }

  return {
    ...prev,
    racks,
    orders,
    overflow,
    tick,
    activeBakeRT: (prev.activeBakeRT ?? 0) + activeBakeSlots,
    occupiedRT: (prev.occupiedRT ?? 0) + occupiedSlots,
    gonRed,
    ordersCreated,
    nextOrderId,
  };
}

function initialOrdersState(): Pick<SimState, 'orders' | 'nextOrderId' | 'ordersCreated'> {
  let nextOrderId = 0;
  let ordersCreated = 0;
  const orders: Order[] = [];
  for (let i = 0; i < 3; i++) {
    const sp = trySpawnOrder(nextOrderId, ordersCreated);
    if (!sp) break;
    orders.push(sp.order);
    nextOrderId += 1;
    ordersCreated = sp.nextCreated;
  }
  return { orders, nextOrderId, ordersCreated };
}


function pickTimeWinner(s: ModeRunStats, c: ModeRunStats): 'static' | 'continuous' | 'tie' {
  const d = Math.abs(s.elapsedSec - c.elapsedSec);
  if (d < 0.05) return 'tie';
  return s.elapsedSec < c.elapsedSec ? 'static' : 'continuous';
}

function pickUtilWinner(s: ModeRunStats, c: ModeRunStats): 'static' | 'continuous' | 'tie' {
  if (s.util === c.util) return 'tie';
  return s.util > c.util ? 'static' : 'continuous';
}

function pickRedWinner(s: ModeRunStats, c: ModeRunStats): 'static' | 'continuous' | 'tie' {
  if (s.gonRed === c.gonRed) return 'tie';
  return s.gonRed < c.gonRed ? 'static' : 'continuous';
}

function CompareMetricRow({
  label,
  staticVal,
  continuousVal,
  winner,
}: {
  label: string;
  staticVal: string;
  continuousVal: string;
  winner: 'static' | 'continuous' | 'tie';
}) {
  return (
    <div className="bakery-compare-row">
      <div className="bakery-compare-label">{label}</div>
      <div className={`bakery-compare-cell${winner === 'static' ? ' better' : ''}`}>
        {staticVal}
        {winner === 'static' ? ' ✓' : ''}
      </div>
      <div className={`bakery-compare-cell${winner === 'continuous' ? ' better' : ''}`}>
        {continuousVal}
        {winner === 'continuous' ? ' ✓' : ''}
      </div>
    </div>
  );
}

export function ContinuousBatchingPage() {
  const [mode, setMode] = useState<BakeryMode>('static');
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(false);
  const [sim, setSim] = useState<SimState>(() => emptySim());
  const [servedRows, setServedRows] = useState<{ id: number; emojis: string[] }[]>([]);
  const [insight, setInsight] = useState<Insight>({
    title: 'How to play',
    text: 'Static: build a 4-item batch, fire it, assemble the next batch while it bakes. Continuous: click pastries to send them straight into the oven one at a time — they auto-assign when done.',
    variant: '',
  });
  const [overlay, setOverlay] = useState<BakeryOverlayState | null>(null);
  const completedRunsRef = useRef<{ static: ModeRunStats | null; continuous: ModeRunStats | null }>({
    static: null,
    continuous: null,
  });

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSim((prev) => advanceTick(prev, mode));
    }, BAKERY_BASE_MS / speed);
    return () => clearInterval(id);
  }, [running, speed, mode]);

  useEffect(() => {
    setInsight(computeInsight(mode, running, sim, sim.stagedBatch.length));
  }, [sim, mode, running]);

  const snapshotUtil = rackSnapshotUtilPct(sim.racks);
  const utilPct = snapshotUtil ?? 0;
  const ufClass =
    snapshotUtil === null ? '' : utilPct >= 75 ? 'good' : utilPct >= 45 ? 'mid' : '';
  const scUtilClass =
    snapshotUtil === null ? '' : utilPct >= 75 ? 'good' : utilPct >= 45 ? 'warn' : 'bad';

  const occ = sim.racks.filter(Boolean) as Rack[];
  const allReady = occ.length > 0 && occ.every((r) => r.ready);

  const startSim = useCallback(() => {
    const init = initialOrdersState();
    setServedRows([]);
    setOverlay(null);
    setSim({ ...emptySim(), ...init, gameStartTime: Date.now() });
    setRunning(true);
  }, []);

  const resetSim = useCallback(() => {
    setRunning(false);
    setOverlay(null);
    completedRunsRef.current = { static: null, continuous: null };
    setServedRows([]);
    setSim(emptySim());
    setInsight({
      title: 'How to play',
      text:
        mode === 'static'
          ? 'Pick up to 4 pastries into the batch slots, then Fire. While the oven runs, assemble your next batch ready to go.'
          : 'Click any pastry in the menu — it goes straight into the next empty oven slot and bakes immediately.',
      variant: '',
    });
  }, [mode]);

  const setModeSafe = useCallback(
    (m: BakeryMode) => {
      if (running) return;
      setMode(m);
      setSim(emptySim());
      setServedRows([]);
      setOverlay(null);
    },
    [running],
  );

  const addToStagedBatch = useCallback((pi: PastryIndex) => {
    setSim((prev) => {
      if (!running || prev.stagedBatch.length >= BAKERY_RACK_N) return prev;
      return { ...prev, stagedBatch: [...prev.stagedBatch, pi] };
    });
  }, [running]);

  const removeFromStagedBatch = useCallback((idx: number) => {
    setSim((prev) => ({
      ...prev,
      stagedBatch: prev.stagedBatch.filter((_, i) => i !== idx),
    }));
  }, []);

  const clearStagedBatch = useCallback(() => {
    setSim((prev) => ({ ...prev, stagedBatch: [] }));
  }, []);

  const fireBatch = useCallback(() => {
    setSim((prev) => {
      if (!prev.stagedBatch.length) return prev;
      if (prev.racks.some((r) => r !== null)) {
        queueMicrotask(() =>
          setInsight({
            title: 'Oven still running',
            text: 'Wait for the current batch to finish, take it out, then fire the next one.',
            variant: 'warn',
          }),
        );
        return prev;
      }
      let uid = prev.uid;
      const racks = [...prev.racks] as (Rack | null)[];
      prev.stagedBatch.forEach((pi, i) => {
        if (i < BAKERY_RACK_N) {
          racks[i] = mkRack(pi, uid);
          uid += 1;
        }
      });
      return { ...prev, racks, stagedBatch: [], uid };
    });
  }, []);

  const addContinuous = useCallback((pi: PastryIndex) => {
    if (!running) return;
    setSim((prev) => {
      const emptySlot = prev.racks.findIndex((r) => r === null);
      if (emptySlot === -1) {
        queueMicrotask(() =>
          setInsight({
            title: 'Oven full',
            text: 'All 4 racks are busy. Wait for one to finish.',
            variant: 'warn',
          }),
        );
        return prev;
      }
      const racks = [...prev.racks];
      racks[emptySlot] = mkRack(pi, prev.uid);
      return { ...prev, racks, uid: prev.uid + 1 };
    });
  }, [running]);

  const takeOutBatch = useCallback(() => {
    setSim((prev) => {
      const readyPairs = prev.racks
        .map((r, i) => ({ r, i }))
        .filter((x): x is { r: Rack; i: number } => Boolean(x.r && x.r.ready));
      if (!readyPairs.length) return prev;
      let orders = cloneOrders(prev.orders);
      let overflow = [...prev.overflow];
      const racks = [...prev.racks] as (Rack | null)[];
      readyPairs.forEach(({ r, i }) => {
        const res = autoAssign(orders, overflow, r.e, r.name, r.id);
        orders = res.orders;
        overflow = res.overflow;
        racks[i] = null;
      });
      return { ...prev, racks, orders, overflow };
    });
  }, []);

  const clickRack = useCallback((i: number) => {
    setSim((prev) => {
      const r = prev.racks[i];
      if (!r || !r.ready) return prev;
      const res = autoAssign(cloneOrders(prev.orders), [...prev.overflow], r.e, r.name, r.id);
      const racks = [...prev.racks];
      racks[i] = null;
      return { ...prev, racks, orders: res.orders, overflow: res.overflow };
    });
  }, []);

  const retryOverflow = useCallback((idx: number) => {
    setSim((prev) => {
      const item = prev.overflow[idx];
      if (!item) return prev;
      const order = prev.orders.find((o) => !o.done && o.items.some((s) => !s.filled && s.e === item.e));
      if (order) {
        const next = cloneOrders(prev.orders);
        const o = next.find((x) => x.id === order.id)!;
        const slot = o.items.find((s) => !s.filled && s.e === item.e);
        if (slot) slot.filled = true;
        const overflow = prev.overflow.filter((_, j) => j !== idx);
        return { ...prev, orders: next, overflow };
      }
      queueMicrotask(() =>
        setInsight({
          title: 'Still no match',
          text: `No order needs a ${item.name} right now.`,
          variant: '',
        }),
      );
      return prev;
    });
  }, []);

  const serveOrder = useCallback((orderId: number) => {
    setSim((prev) => {
      const o = prev.orders.find((x) => x.id === orderId);
      if (!o || !o.items.every((s) => s.filled)) return prev;

      const fulfilled = prev.fulfilled + 1;
      const ordersServedTotal = prev.ordersServedTotal + 1;
      let orders = prev.orders.filter((x) => x.id !== orderId);
      let nextOrderId = prev.nextOrderId;
      let ordersCreated = prev.ordersCreated;
      if (ordersCreated < BAKERY_TOTAL_ORDERS) {
        const sp = trySpawnOrder(nextOrderId, ordersCreated);
        if (sp) {
          orders = [...orders, sp.order];
          nextOrderId += 1;
          ordersCreated = sp.nextCreated;
        }
      }

      const leftToServe = BAKERY_TOTAL_ORDERS - ordersServedTotal;
      const tail =
        ordersServedTotal < BAKERY_TOTAL_ORDERS
          ? leftToServe > 0
            ? `${leftToServe} more to go!`
            : 'All orders created!'
          : 'Final order done!';

      queueMicrotask(() => {
        setInsight({
          title: 'Served!',
          text: `${fulfilled} order${fulfilled !== 1 ? 's' : ''} fulfilled. ${tail}`,
          variant: 'hi',
        });
        setServedRows((rows) => [...rows, { id: o.id, emojis: o.items.map((i) => i.e) }]);
        if (ordersServedTotal >= BAKERY_TOTAL_ORDERS) {
          setRunning(false);
          const elapsedSec = (Date.now() - prev.gameStartTime) / 1000;
          const elapsed = elapsedSec.toFixed(1);
          const util = sessionBakeSharePct(prev);
          const gonRed = prev.gonRed;
          const emoji = gonRed === 0 ? '🏆' : fulfilled >= Math.ceil(BAKERY_TOTAL_ORDERS * 0.8) ? '🎉' : '👏';
          const thisRun: ModeRunStats = {
            elapsedSec,
            elapsed,
            util,
            gonRed,
            fulfilled,
          };
          completedRunsRef.current = {
            ...completedRunsRef.current,
            [mode]: thisRun,
          };
          const { static: staticRun, continuous: continuousRun } = completedRunsRef.current;
          setOverlay({
            emoji,
            completedMode: mode,
            thisRun,
            staticRun,
            continuousRun,
          });
        }
      });

      return {
        ...prev,
        orders,
        fulfilled,
        ordersServedTotal,
        nextOrderId,
        ordersCreated,
      };
    });
  }, [mode]);

  const closeOverlayReset = useCallback(() => {
    setOverlay(null);
    resetSim();
    queueMicrotask(() => startSim());
  }, [resetSim, startSim]);

  const closeOverlaySwitch = useCallback(() => {
    setOverlay(null);
    const nextMode: BakeryMode = mode === 'static' ? 'continuous' : 'static';
    setRunning(false);
    setServedRows([]);
    setMode(nextMode);
    const init = (() => {
      let nextOrderId = 0;
      let ordersCreated = 0;
      const orders: Order[] = [];
      for (let i = 0; i < 3; i++) {
        const sp = trySpawnOrder(nextOrderId, ordersCreated);
        if (!sp) break;
        orders.push(sp.order);
        nextOrderId += 1;
        ordersCreated = sp.nextCreated;
      }
      return { orders, nextOrderId, ordersCreated };
    })();
    setSim({ ...emptySim(), ...init, gameStartTime: Date.now() });
    queueMicrotask(() => setRunning(true));
  }, [mode]);

  const needed = useMemo(() => neededEmojiSet(sim.orders), [sim.orders]);

  const orderBadgeText = running
    ? `${sim.orders.length} active · ${BAKERY_TOTAL_ORDERS - sim.ordersCreated} to come · ${sim.ordersServedTotal} served`
    : '0 active';

  const modeDesc =
    mode === 'static'
      ? 'Assemble a 4-item batch, fire the oven, take out all at once when done'
      : 'Click any pastry to send it straight into the next empty slot — no batching';

  const ovenBusy = sim.racks.some((r) => r !== null);
  const canFire = sim.stagedBatch.length > 0 && running && !ovenBusy;
  const fireLabel = (() => {
    if (!running) return '🔥 Fire batch';
    if (ovenBusy) return `🔥 Fire (${sim.stagedBatch.length}/4) — oven busy`;
    if (sim.stagedBatch.length === BAKERY_RACK_N) return '🔥 Fire batch — ready!';
    if (sim.stagedBatch.length > 0) return `🔥 Fire batch (${sim.stagedBatch.length}/4)`;
    return '🔥 Fire batch';
  })();

  const batchHint = (() => {
    if (!running) return { text: 'Start the bakery to begin.', warn: false };
    if (ovenBusy) return { text: 'Oven running — assemble your next batch now. Fire when it clears.', warn: true };
    if (sim.stagedBatch.length === 0) return { text: 'Pick pastries below. Green ones match current orders.', warn: false };
    if (sim.stagedBatch.length < BAKERY_RACK_N) {
      return {
        text: `${sim.stagedBatch.length}/4 — add ${BAKERY_RACK_N - sim.stagedBatch.length} more or fire early.`,
        warn: false,
      };
    }
    return { text: 'All 4 ready — hit Fire Batch!', warn: false };
  })();

  const batchFullStatic = sim.stagedBatch.length >= BAKERY_RACK_N;
  const ovenFullContinuous = sim.racks.every((r) => r !== null);

  let overlayEl: ReactNode = null;
  if (overlay) {
    const s = overlay.staticRun;
    const c = overlay.continuousRun;
    const showCompare = Boolean(s && c);
    const tw = s && c ? pickTimeWinner(s, c) : 'tie';
    const uw = s && c ? pickUtilWinner(s, c) : 'tie';
    const rw = s && c ? pickRedWinner(s, c) : 'tie';
    overlayEl = (
      <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="bakery-overlay-title">
        <div className={showCompare ? 'overlay-box overlay-box--compare' : 'overlay-box'}>
          <div className="overlay-emoji">{overlay.emoji}</div>
          <div className="overlay-title" id="bakery-overlay-title">
            All {BAKERY_TOTAL_ORDERS} orders served!
          </div>

          {showCompare && s && c ? (
            <>
              <div className="overlay-sub">Your static vs continuous runs</div>
              <p className="bakery-compare-just">
                Just finished: <strong>{overlay.completedMode === 'static' ? 'Static' : 'Continuous'}</strong> (
                {overlay.thisRun.elapsed}s · {overlay.thisRun.util}% session bake share · {overlay.thisRun.gonRed} red)
              </p>
              <div className="bakery-compare-table">
                <div className="bakery-compare-head">
                  <span />
                  <span>Static</span>
                  <span>Continuous</span>
                </div>
                <CompareMetricRow
                  label="Total time"
                  staticVal={`${s.elapsed}s`}
                  continuousVal={`${c.elapsed}s`}
                  winner={tw}
                />
                <CompareMetricRow
                  label="Session bake share"
                  staticVal={`${s.util}%`}
                  continuousVal={`${c.util}%`}
                  winner={uw}
                />
                <CompareMetricRow
                  label="Orders went red"
                  staticVal={`${s.gonRed}`}
                  continuousVal={`${c.gonRed}`}
                  winner={rw}
                />
              </div>
              <p className="bakery-compare-legend">
                ✓ = better for that row (faster time, higher session bake share, fewer reds).
              </p>
              <div className="overlay-cta">
                Run again below to tighten either side — or switch modes to fill in a missing column.
              </div>
            </>
          ) : (
            <>
              <div className="overlay-sub">
                {overlay.completedMode === 'static' ? 'Static' : 'Continuous'} Batching
              </div>
              <div className="overlay-stats">
                <div className="ov-stat">
                  <div className="ov-v">{overlay.thisRun.elapsed}s</div>
                  <div className="ov-l">Total time</div>
                </div>
                <div className="ov-stat">
                  <div className="ov-v">{overlay.thisRun.util}%</div>
                  <div className="ov-l">Session bake share</div>
                </div>
                <div className="ov-stat">
                  <div className="ov-v">{overlay.thisRun.fulfilled}</div>
                  <div className="ov-l">Orders served</div>
                </div>
                <div className="ov-stat">
                  <div className="ov-v">{overlay.thisRun.gonRed}</div>
                  <div className="ov-l">Went red</div>
                </div>
              </div>
              <div className="overlay-cta">
                Now try <strong>{overlay.completedMode === 'static' ? 'Continuous' : 'Static'} Batching</strong> and
                see if you can beat {overlay.thisRun.elapsed}s — then you&apos;ll get a side-by-side summary.
              </div>
            </>
          )}

          <button type="button" className="overlay-btn" onClick={closeOverlaySwitch}>
            Play as {overlay.completedMode === 'static' ? 'Continuous' : 'Static'}
          </button>
          <button type="button" className="overlay-btn secondary" onClick={closeOverlayReset}>
            Same mode again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bakery-page">
      <DemoTutorialOverlay
        storageKey="continuous-batching"
        theme="continuous-batching"
        title="Static batches vs continuous flow"
        stepLabels={['Build & fire ovens', 'Fill orders from racks', 'Compare modes']}
      >
        <p>
          Customer orders need specific pastries. In <strong>static mode</strong>: build a 4-item batch in the right
          panel, fire the oven, wait for your batch to complete, then click glowing racks to auto-fill orders. In{' '}
          <strong>continuous mode</strong> fire individual pastries as soon as an oven opens up. Hit <strong>Serve</strong>{' '}
          when an order is complete. See which approach yields faster order completions and less time with finished
          pastries sitting in the oven.
        </p>
      </DemoTutorialOverlay>
      <DemoNav title="Continuous Batching" badge="06 / 07" />

      <div className="bakery-hero">
        <div className="eyebrow">
          <div className="eyebrow-dot" />
          Bakery Simulation
        </div>
        <h1>
          The Continuous <strong>Bakery.</strong>
        </h1>
        <p className="hero-sub">
          Customer orders need specific pastries. Build a 4-item batch in the right panel, fire the oven, then click
          glowing racks to auto-fill orders. In <strong>static mode</strong> take out the whole batch at once with one
          button. In <strong>continuous mode</strong> each slot reloads as soon as you pull it out. Hit{' '}
          <strong>Serve</strong> when an order is complete.
        </p>
      </div>

      <div className="arena">
        <div className="top-row">
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn${mode === 'static' ? ' active' : ''}`}
              onClick={() => setModeSafe('static')}
            >
              Static Batching
            </button>
            <button
              type="button"
              className={`mode-btn${mode === 'continuous' ? ' active' : ''}`}
              onClick={() => setModeSafe('continuous')}
            >
              Continuous Batching
            </button>
          </div>
          <span className="mode-desc">{modeDesc}</span>
          <div className="speed-toggle">
            <button
              type="button"
              className={`speed-btn${speed === 3 ? ' active' : ''}`}
              onClick={() => setSpeed(3)}
            >
              3×
            </button>
            <button
              type="button"
              className={`speed-btn${speed === 1 ? ' active' : ''}`}
              onClick={() => setSpeed(1)}
            >
              1×
            </button>
            <button
              type="button"
              className={`speed-btn${speed === 0.4 ? ' active' : ''}`}
              onClick={() => setSpeed(0.4)}
            >
              ½×
            </button>
          </div>
        </div>

        <div className="stats-row">
          <div
            className={`sc2 ${scUtilClass}`}
            title="Right now: share of occupied slots where the timer is still running (not finished and waiting)."
          >
            <div className="sv">{snapshotUtil === null ? '—' : `${utilPct}%`}</div>
            <div className="sl">Active bake ÷ occupied</div>
            <div className="stats-metric-hint">Live · slots baking ÷ slots with food</div>
            <div className="ug">
              <div className={`uf ${ufClass}`} style={{ width: `${utilPct}%` }} />
            </div>
          </div>
          <div className="sc2 ac">
            <div className="sv">{sim.fulfilled}</div>
            <div className="sl">Orders served</div>
          </div>
          <div className="sc2">
            <div className="sv">{sim.gonRed}</div>
            <div className="sl">Gone red</div>
          </div>
          <div
            className="sc2"
            title="Rack·ticks where a slot held a finished pastry (done baking, not yet cleared to an order)."
          >
            <div className="sv">{(sim.occupiedRT ?? 0) - (sim.activeBakeRT ?? 0)}</div>
            <div className="sl">Finished sitting</div>
            <div className="stats-metric-hint">Done baking, still in oven</div>
          </div>
        </div>

        <div className="main-cols">
          <div className="left-col">
            <div className="sc">
              <div className="slabel">
                🧾 Customer orders <span className="badge badge-ac">{orderBadgeText}</span>
              </div>
              <div className="orders-board">
                {!running && sim.orders.length === 0 && (
                  <div className="orders-empty-msg">Hit Start to open the bakery</div>
                )}
                {running && sim.orders.length === 0 && (
                  <div className="orders-empty-msg">All orders served!</div>
                )}
                {sim.orders.map((o) => {
                  const allFilled = o.items.every((s) => s.filled);
                  const tLeft = Math.max(0, BAKERY_TIMEOUT - o.age);
                  return (
                    <div
                      key={o.id}
                      className={`order-card${o.urgent ? ' urgent' : ''}${allFilled ? ' complete' : ''}`}
                    >
                      <div className="order-top">
                        <span className="order-id">Order #{o.id + 1}</span>
                        <span className={`order-clock${o.urgent ? ' hot' : ''}`}>
                          {o.urgent ? '🔴 overdue' : `${tLeft}t`}
                        </span>
                      </div>
                      <div className="order-items-row">
                        {o.items.map((it, j) => (
                          <div key={j} className={`oi${it.filled ? ' filled' : ''}`}>
                            <span className="oi-e">{it.e}</span>
                            <span>{it.name}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={`order-serve-btn${allFilled ? ' ready' : ''}`}
                        disabled={!allFilled}
                        onClick={() => serveOrder(o.id)}
                      >
                        {allFilled ? '🛎️ Serve!' : 'Waiting…'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sc">
              <div className="slabel">
                🔥 Oven — 4 racks{' '}
                <span className="badge badge-ac">{mode === 'static' ? 'Static' : 'Continuous'}</span>
              </div>
              <div className="oven-wrap">
                {sim.racks.map((r, i) => {
                  if (!r) {
                    return (
                      <div key={i} className="rack empty">
                        <div className="rack-num">Rack {i + 1}</div>
                        <div className="rack-emoji" style={{ color: '#ccc', fontSize: 18 }}>
                          —
                        </div>
                        <div className="rack-info">
                          <div className="rack-name" style={{ color: 'var(--ink-light)', fontWeight: 400, fontSize: 11 }}>
                            Empty
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (r.ready) {
                    const pct = 100;
                    const inner = (
                      <>
                        <div className="rack-num">Rack {i + 1}</div>
                        <div className="rack-emoji">{r.e}</div>
                        <div className="rack-info">
                          <div className="rack-name">{r.name}</div>
                          <div className="rack-sub">
                            {mode === 'continuous' ? 'Tap to assign' : 'Ready — use Take Out Batch'}
                          </div>
                        </div>
                        <div className="rack-bar-wrap">
                          <div className="rack-bar-track">
                            <div className="rack-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="rack-bar-pct">{pct}%</div>
                        </div>
                        <div className="rack-tag tag-ready">✓ Done</div>
                      </>
                    );
                    if (mode === 'continuous') {
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className="rack ready"
                          style={{ border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                          onClick={() => clickRack(i)}
                        >
                          {inner}
                        </button>
                      );
                    }
                    return (
                      <div key={r.id} className="rack ready">
                        {inner}
                      </div>
                    );
                  }
                  const pct = Math.min(100, ((r.total - Math.max(0, r.left)) / r.total) * 100);
                  const RackTag = r.locked ? (
                    <div className="rack-tag tag-locked">⏳</div>
                  ) : null;
                  return (
                    <div key={r.id} className={`rack${r.locked ? ' locked' : ' baking'}`}>
                      <div className="rack-num">Rack {i + 1}</div>
                      <div className="rack-emoji">{r.e}</div>
                      <div className="rack-info">
                        <div className="rack-name">{r.name}</div>
                        <div className="rack-sub">
                          {r.locked ? 'Done — waiting for batch' : `${Math.max(0, r.left)} ticks left`}
                        </div>
                      </div>
                      <div className="rack-bar-wrap">
                        <div className="rack-bar-track">
                          <div className="rack-bar-fill" style={{ width: `${pct.toFixed(1)}%` }} />
                        </div>
                        <div className="rack-bar-pct">{Math.round(pct)}%</div>
                      </div>
                      {RackTag}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className={`takeout-btn${mode === 'static' ? ' visible' : ''}${allReady ? ' pulse' : ''}`}
                disabled={!allReady}
                onClick={takeOutBatch}
              >
                ✋ Take out batch & assign all
              </button>
            </div>

            {sim.overflow.length > 0 && (
              <div className="sc">
                <div className="slabel">
                  🍽️ Counter — no matching order{' '}
                  <span className="slabel-muted">· click to retry when a new order arrives</span>
                </div>
                <div className="overflow-row">
                  {sim.overflow.map((item, idx) => (
                    <button
                      key={`${item.id}-${idx}`}
                      type="button"
                      className="overflow-chip"
                      onClick={() => retryOverflow(idx)}
                    >
                      <div className="overflow-emoji">{item.e}</div>
                      <div>{item.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="sc">
              <div className="slabel">✅ Served orders</div>
              <div className="served-list">
                {servedRows.length === 0 && <div className="served-empty">Nothing served yet</div>}
                {servedRows.map((row) => (
                  <div key={row.id} className="served-row">
                    {row.emojis.map((e, k) => (
                      <span key={k}>{e}</span>
                    ))}
                    <span style={{ marginLeft: 5 }}>Order #{row.id + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="right-col">
            {mode === 'static' && (
              <div id="batch-panel-section">
                <div className="sc">
                  <div className="slabel">
                    🥐 Next batch <span className="badge badge-ac">{sim.stagedBatch.length}/4</span>
                  </div>
                  <div className="batch-builder">
                    <div className="batch-slots">
                      {Array.from({ length: BAKERY_RACK_N }, (_, i) => {
                        if (i < sim.stagedBatch.length) {
                          const p = BAKERY_PASTRIES[sim.stagedBatch[i]];
                          return (
                            <div
                              key={i}
                              className={`batch-slot filled${needed.has(p.e) ? ' needed' : ''}`}
                            >
                              <span className="bs-n">{i + 1}</span>
                              <button type="button" className="bs-x" aria-label="Remove" onClick={() => removeFromStagedBatch(i)}>
                                ✕
                              </button>
                              <span className="bs-e">{p.e}</span>
                              <span className="bs-name">{p.name}</span>
                            </div>
                          );
                        }
                        return (
                          <div key={i} className="batch-slot empty">
                            <span className="bs-n">{i + 1}</span>
                            <span className="bs-plus">+</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="batch-actions">
                      <button
                        type="button"
                        className={`fire-btn${sim.stagedBatch.length === BAKERY_RACK_N && canFire ? ' full' : ''}`}
                        disabled={!canFire}
                        onClick={fireBatch}
                      >
                        {fireLabel}
                      </button>
                      <button type="button" className="clear-btn" onClick={clearStagedBatch}>
                        ✕ Clear
                      </button>
                    </div>
                    <div className={`batch-hint${batchHint.warn ? ' warn' : ''}`}>{batchHint.text}</div>
                  </div>
                </div>
                <div className="sc">
                  <div className="slabel">
                    🍩 Menu — assemble batch <span className="slabel-muted">green = matches an order</span>
                  </div>
                  {needed.size > 0 && (
                    <div className="needed-pills">
                      {[...needed].map((e) => {
                        const p = BAKERY_PASTRIES.find((x) => x.e === e);
                        return (
                          <div key={e} className="needed-pill">
                            <span style={{ fontSize: 12 }}>{e}</span>
                            <span>{p ? p.name : e}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="picker-grid">
                    {BAKERY_PASTRIES.map((p, i) => {
                      const disabled = !running || batchFullStatic;
                      return (
                        <button
                          key={p.name}
                          type="button"
                          className={`picker-item${needed.has(p.e) ? ' needed' : ''}${disabled ? ' disabled' : ''}`}
                          disabled={disabled}
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            if (!disabled) addToStagedBatch(i);
                          }}
                        >
                          <div className="picker-emoji">{p.e}</div>
                          <div className="picker-name">{p.name}</div>
                          <div className="picker-ticks">{p.t}t</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {mode === 'continuous' && (
              <div id="cont-menu-section">
                <div className="sc">
                  <div className="slabel">
                    🍩 Click to bake <span className="slabel-muted">goes straight into next empty slot</span>
                  </div>
                  {needed.size > 0 && (
                    <div className="needed-pills">
                      {[...needed].map((e) => {
                        const p = BAKERY_PASTRIES.find((x) => x.e === e);
                        return (
                          <div key={e} className="needed-pill">
                            <span style={{ fontSize: 12 }}>{e}</span>
                            <span>{p ? p.name : e}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="picker-grid">
                    {BAKERY_PASTRIES.map((p, i) => {
                      const disabled = !running || ovenFullContinuous;
                      return (
                        <button
                          key={p.name}
                          type="button"
                          className={`picker-item${needed.has(p.e) ? ' needed' : ''}${disabled ? ' disabled' : ''}`}
                          disabled={disabled}
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            if (!disabled) addContinuous(i);
                          }}
                        >
                          <div className="picker-emoji">{p.e}</div>
                          <div className="picker-name">{p.name}</div>
                          <div className="picker-ticks">{p.t}t</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className={`insight${insight.variant ? ` ${insight.variant}` : ''}`}>
              <h4>{insight.title}</h4>
              <p>{insight.text}</p>
            </div>
          </div>
        </div>

        <div className="run-row">
          <button type="button" className="run-btn" disabled={running} onClick={startSim}>
            {running ? 'Baking…' : '▶ Open the Bakery'}
          </button>
          <button type="button" className="reset-btn" onClick={resetSim}>
            ↺ Reset
          </button>
        </div>
      </div>

      <div className="bakery-section">
        <div className="section-divider" />
        <h2>From Bakery to GPU</h2>
        <div className="eg">
          <div className="ec">
            <h3>Static Batching</h3>
            <p>
              All GPU slots lock until the slowest request finishes. Fast requests idle waiting for stragglers — like
              waiting for a soufflé before cookies can leave.
            </p>
          </div>
          <div className="ec">
            <h3>Continuous Batching</h3>
            <p>
              The moment any slot finishes a new request fills it. No waiting. 2–5× throughput improvement on real
              traffic. Default in vLLM, SGLang, TGI since 2022.
            </p>
          </div>
          <div className="ec">
            <h3>Why Batch Choice Matters</h3>
            <p>
              A good scheduler picks requests that match what&apos;s needed. Baking the right pastries for the right
              orders is exactly what a smart batching scheduler does.
            </p>
          </div>
          <div className="ec">
            <h3>Real-World Impact</h3>
            <p>
              Gains are largest when request length variance is high — exactly what happens in real chat and coding
              workloads where queries range from 10 to 800+ tokens.
            </p>
          </div>
        </div>
        <div className="rhs">
          <h3>
            <HatLogo size={18} />
            Red Hat&apos;s Contribution
          </h3>
          <p>
            Red Hat engineers are core contributors to vLLM&apos;s continuous batching scheduler, paired with
            PagedAttention. The Red Hat AI Inference Server ships vLLM as its production runtime with continuous
            batching on by default.
          </p>
          <div className="rh-links">
            <RhDocLink href="https://www.redhat.com/en/products/ai/red-hat-ai-inference-server" newTab>
              Red Hat AI Inference Server
            </RhDocLink>
            <RhDocLink href="https://docs.vllm.ai/" newTab>
              vLLM docs
            </RhDocLink>
          </div>
        </div>
        <div className="upstream-label">Upstream Projects</div>
        <div className="pr">
          <a className="pc" href="https://github.com/vllm-project/vllm" target="_blank" rel="noreferrer">
            <div className="pd" />
            <div>
              <div className="pn">vLLM</div>
              <div className="pp">PagedAttention + continuous batching</div>
            </div>
          </a>
          <a className="pc" href="https://github.com/sgl-project/sglang" target="_blank" rel="noreferrer">
            <div className="pd" />
            <div>
              <div className="pn">SGLang</div>
              <div className="pp">Continuous scheduling + RadixAttention</div>
            </div>
          </a>
          <a
            className="pc"
            href="https://github.com/huggingface/text-generation-inference"
            target="_blank"
            rel="noreferrer"
          >
            <div className="pd" />
            <div>
              <div className="pn">HF TGI</div>
              <div className="pp">Continuous batching inference server</div>
            </div>
          </a>
        </div>
      </div>

      {overlayEl}
    </div>
  );
}
