import { shuffle } from '../utils/shuffle';

export type PromptEntry = {
  text: string;
  /** Shared leading text for this family; cache hit = this key already in the store. */
  prefix: string;
  group: string;
};

export const PROMPT_BANK: PromptEntry[] = [
  {
    text: 'You are a helpful assistant. What is the capital of France?',
    prefix: 'You are a helpful assistant. What is the capital of ',
    group: 'A',
  },
  {
    text: 'You are a helpful assistant. What is the capital of Germany?',
    prefix: 'You are a helpful assistant. What is the capital of ',
    group: 'A',
  },
  {
    text: 'You are a helpful assistant. What is the capital of Japan?',
    prefix: 'You are a helpful assistant. What is the capital of ',
    group: 'A',
  },
  {
    text: 'You are a helpful assistant. Explain photosynthesis briefly.',
    prefix: 'You are a helpful assistant. ',
    group: 'A',
  },
  {
    text: 'You are a helpful assistant. Explain gravity briefly.',
    prefix: 'You are a helpful assistant. ',
    group: 'A',
  },
  {
    text: 'You are a helpful assistant. Define machine learning.',
    prefix: 'You are a helpful assistant. ',
    group: 'A',
  },
  {
    text: 'Write Python code to sort a list of numbers.',
    prefix: 'Write Python code to ',
    group: 'B',
  },
  {
    text: 'Write Python code to filter even numbers from a list.',
    prefix: 'Write Python code to ',
    group: 'B',
  },
  { text: 'Write Python code to reverse a string.', prefix: 'Write Python code to ', group: 'B' },
  {
    text: 'Write Python code to find the maximum in a list.',
    prefix: 'Write Python code to ',
    group: 'B',
  },
  {
    text: 'Write Python code to count words in a sentence.',
    prefix: 'Write Python code to ',
    group: 'B',
  },
  {
    text: 'Summarize the following document: Neural networks are a class of machine learning models.',
    prefix: 'Summarize the following document: ',
    group: 'C',
  },
  {
    text: 'Summarize the following document: Large language models process text as tokens.',
    prefix: 'Summarize the following document: ',
    group: 'C',
  },
  {
    text: 'Summarize the following document: Transformers use attention mechanisms.',
    prefix: 'Summarize the following document: ',
    group: 'C',
  },
  {
    text: 'Summarize the following document: Open source software enables collaboration.',
    prefix: 'Summarize the following document: ',
    group: 'C',
  },
  {
    text: 'Translate the following to Spanish: Hello, how are you today?',
    prefix: 'Translate the following to Spanish: ',
    group: 'D',
  },
  {
    text: 'Translate the following to Spanish: The weather is beautiful.',
    prefix: 'Translate the following to Spanish: ',
    group: 'D',
  },
  {
    text: 'Translate the following to Spanish: I love open source software.',
    prefix: 'Translate the following to Spanish: ',
    group: 'D',
  },
  {
    text: 'Translate the following to Spanish: Artificial intelligence is transforming computing.',
    prefix: 'Translate the following to Spanish: ',
    group: 'D',
  },
  {
    text: 'Given the system context: You are an AI assistant for Red Hat. How do I install OpenShift?',
    prefix: 'Given the system context: You are an AI assistant for Red Hat. ',
    group: 'E',
  },
  {
    text: 'Given the system context: You are an AI assistant for Red Hat. What is RHEL?',
    prefix: 'Given the system context: You are an AI assistant for Red Hat. ',
    group: 'E',
  },
  {
    text: 'Given the system context: You are an AI assistant for Red Hat. Explain Ansible briefly.',
    prefix: 'Given the system context: You are an AI assistant for Red Hat. ',
    group: 'E',
  },
  {
    text: 'Given the system context: You are an AI assistant for Red Hat. What is vLLM used for?',
    prefix: 'Given the system context: You are an AI assistant for Red Hat. ',
    group: 'E',
  },
  // Standalone-style prompts: prefix = leading snippet (cache hits only if another prompt shared it and was completed first)
  { text: 'What is speculative decoding and why is it fast?', prefix: 'What is speculative ', group: 'F' },
  { text: 'Explain the difference between latency and throughput.', prefix: 'Explain the difference ', group: 'F' },
  { text: 'What does GPU memory bandwidth mean?', prefix: 'What does GPU memory ', group: 'F' },
  { text: 'Why do large language models need so much memory?', prefix: 'Why do large language ', group: 'F' },
  { text: 'What is quantization in the context of neural networks?', prefix: 'What is quantization in ', group: 'F' },
  { text: 'How does attention work in transformer models?', prefix: 'How does attention work ', group: 'F' },
  { text: 'What is the KV cache and why does it matter?', prefix: 'What is the KV cache ', group: 'F' },
];

export const PREFIX_GAME_LENGTH = 6;

/** Split an integer budget across weights (largest-remainder). Sum of result === budget. */
function distributeIntegerBudget(budget: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const wsum = weights.reduce((a, b) => a + b, 0);
  if (wsum <= 0) {
    const base = Math.floor(budget / weights.length);
    let r = budget - base * weights.length;
    return weights.map((_, i) => base + (i < r ? 1 : 0));
  }
  const floats = weights.map((w) => (budget * w) / wsum);
  const base = floats.map((x) => Math.floor(x));
  let left = budget - base.reduce((a, b) => a + b, 0);
  const order = floats
    .map((x, i) => ({ i, f: x - Math.floor(x) }))
    .sort((a, b) => (b.f !== a.f ? b.f - a.f : a.i - b.i));
  const out = [...base];
  let s = 0;
  while (left > 0) {
    out[order[s % order.length].i] += 1;
    left--;
    s++;
  }
  return out;
}

/**
 * After typing `fullText` in `elapsedMs`, seed cache entries for future prompts whose
 * prefix is a prefix of `fullText`. Allocated ms partition `elapsedMs` (no overlap inflation).
 */
export function seedPrefixesFromCompletion(
  prev: Record<string, number>,
  fullText: string,
  currentIdx: number,
  promptList: PromptEntry[],
  elapsedMs: number,
): Record<string, number> {
  const next = { ...prev };
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const other of promptList.slice(currentIdx + 1)) {
    const pre = other.prefix;
    if (!pre || seen.has(pre)) continue;
    if (next[pre] !== undefined) continue;
    if (!fullText.startsWith(pre)) continue;
    seen.add(pre);
    keys.push(pre);
  }
  if (keys.length === 0) return next;
  const budget = Math.max(1, Math.round(elapsedMs));
  const weights = keys.map((k) => k.length);
  const alloc = distributeIntegerBudget(budget, weights);
  keys.forEach((k, i) => {
    next[k] = Math.max(1, alloc[i]);
  });
  return next;
}

/**
 * Always record KV for the prompt just finished. `seedPrefixesFromCompletion` only seeds keys for
 * **later** prompts in the list, so without this the last prompt (and any prefix with no matching
 * later row) would never appear — and “keep cache” would drop most warmed prefixes.
 */
export function recordCompletedPromptPrefix(
  prev: Record<string, number>,
  entry: PromptEntry,
  elapsedMs: number,
): Record<string, number> {
  const pre = entry.prefix.trim();
  if (!pre.length || !entry.text.startsWith(pre)) return { ...prev };
  const next = { ...prev };
  const share = Math.max(1, Math.round(elapsedMs * (pre.length / Math.max(1, entry.text.length))));
  next[pre] = Math.max(next[pre] ?? 0, share);
  return next;
}

/** Prompts must share a non-empty prefix with the full text and have a suffix to type. */
function usablePrompts(): PromptEntry[] {
  return PROMPT_BANK.filter(
    (e) =>
      e.prefix.trim().length > 0 &&
      e.text.startsWith(e.prefix) &&
      e.text.length > e.prefix.length,
  );
}

/** Random prompts per round; prefix cache is built as you play (order is random each run). */
export function pickPrompts(): PromptEntry[] {
  const pool = usablePrompts();
  return shuffle([...pool]).slice(0, PREFIX_GAME_LENGTH);
}

export function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
