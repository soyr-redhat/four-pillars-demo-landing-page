/** Pastry menu + bake times (ticks at BASE_MS each). */
export const BAKERY_PASTRIES = [
  { name: 'Croissant', e: '🥐', t: 10 },
  { name: 'Cookie', e: '🍪', t: 4 },
  { name: 'Soufflé', e: '🎂', t: 22 },
  { name: 'Baguette', e: '🥖', t: 14 },
  { name: 'Muffin', e: '🧁', t: 6 },
  { name: 'Cin.Roll', e: '🌀', t: 18 },
  { name: 'Eclair', e: '🍫', t: 9 },
  { name: 'Danish', e: '🥧', t: 12 },
  { name: 'Brownie', e: '🍩', t: 5 },
  { name: 'Pretzel', e: '🥨', t: 7 },
] as const;

export type PastryIndex = number;

export const BAKERY_RACK_N = 4;
export const BAKERY_TIMEOUT = 120;
export const BAKERY_BASE_MS = 800;
export const BAKERY_TOTAL_ORDERS = 10;

/** Spawn attempt every N simulation ticks (higher = slower arrivals). Was 12; no concurrent order cap. */
export const BAKERY_ORDER_SPAWN_INTERVAL_TICKS = 96;

export type Rack = {
  name: string;
  e: string;
  t: number;
  id: number;
  left: number;
  total: number;
  locked: boolean;
  ready: boolean;
};

export type OrderItem = { name: string; e: string; filled: boolean };

export type Order = {
  id: number;
  items: OrderItem[];
  age: number;
  urgent: boolean;
  done: boolean;
};

export type OverflowItem = { name: string; e: string; id: number };

export type BakeryMode = 'static' | 'continuous';

export function mkRack(pi: PastryIndex, uid: number): Rack {
  const p = BAKERY_PASTRIES[pi];
  return {
    name: p.name,
    e: p.e,
    t: p.t,
    id: uid,
    left: p.t,
    total: p.t,
    locked: false,
    ready: false,
  };
}

/** Same semantics as the original HTML: increment creation count, then build order (or null if at cap). */
export function trySpawnOrder(oid: number, ordersCreated: number): { order: Order; nextCreated: number } | null {
  if (ordersCreated >= BAKERY_TOTAL_ORDERS) return null;
  const n = 1 + Math.floor(Math.random() * 3);
  const order: Order = {
    id: oid,
    items: Array.from({ length: n }, () => {
      const p = BAKERY_PASTRIES[Math.floor(Math.random() * BAKERY_PASTRIES.length)];
      return { name: p.name, e: p.e, filled: false };
    }),
    age: 0,
    urgent: false,
    done: false,
  };
  return { order, nextCreated: ordersCreated + 1 };
}

export function neededEmojiSet(orders: Order[]): Set<string> {
  const s = new Set<string>();
  for (const o of orders) {
    for (const i of o.items) {
      if (!i.filled) s.add(i.e);
    }
  }
  return s;
}
