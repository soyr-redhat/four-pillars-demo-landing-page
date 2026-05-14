// ─── Image-based quantization quiz ───────────────────────────────────────────
//
// Images live in `public/`. Use `publicUrl('filename.png')` so Vite `base` is applied.
// Use `base: '/'` (or `/subdir/`) for hosting — `base: './'` breaks nested client routes.
//
// Multiple-choice options are built from ANSWER_BANK: four labels are chosen at
// random per question — always including the correct `name` plus three distractors.
// Keep every correct answer in the bank (or distractors only; correct is injected).
//
// Images are drawn onto a canvas and pixelated at lower bit depths — any
// recognizable image works well. Square images look best (they're cropped to
// a square canvas), but any aspect ratio is fine.

import { publicUrl } from '../publicUrl';
import { shuffle } from '../utils/shuffle';

export type ImageQuestion = {
  name: string; // correct answer shown in quiz
  file: string; // resolved URL from `publicUrl(...)`
};

/** All labels that may appear as a quiz option (distractors + every correct name). */
export const ANSWER_BANK: string[] = [
  'Batman',
  'Bob the Minion',
  'Bulbasaur',
  'Captain America',
  'Deadpool',
  'Donkey',
  'Eevee',
  'Fiona',
  'Gandalf',
  'Goku',
  'Gollum',
  'Grogu',
  'Hello Kitty',
  'Iron Man',
  'Joker',
  'Link',
  'Luigi',
  'Mario',
  'Mickey Mouse',
  'Obi-Wan',
  'Perry the Platypus',
  'Peter Griffin',
  'Pikachu',
  'Shrek',
  'Sonic',
  'Spider-Man',
  'Stitch',
  'Superman',
  'Wonder Woman',
  'Yoda',
];

export const IMAGE_QUESTIONS: ImageQuestion[] = [
  { name: 'Mario', file: publicUrl('q_mario.png') },
  { name: 'Pikachu', file: publicUrl('q_pika.png') },
  { name: 'Yoda', file: publicUrl('q_yoda.png') },
  { name: 'Captain America', file: publicUrl('q_cap.jpg') },
  { name: 'Goku', file: publicUrl('q_goku.png') },
  { name: 'Shrek', file: publicUrl('q_shrek.png') },
  { name: 'Hello Kitty', file: publicUrl('q_kitty.png') },
  { name: 'Bob the Minion', file: publicUrl('q_minion.png') },
  { name: 'Peter Griffin', file: publicUrl('q_peta.png') },
  { name: 'Perry the Platypus', file: publicUrl('q_perry.png') },
];

export const BIT_LEVELS = [
  { name: '1-bit', pixelSize: 32, colorLevels: 2, bar: 2, desc: 'Binarization — just black or white' },
  { name: 'INT2', pixelSize: 16, colorLevels: 4, bar: 15, desc: '4 possible values — barely usable' },
  { name: 'INT8', pixelSize: 8, colorLevels: 16, bar: 35, desc: '16 values — strong compression, still usable' },
  { name: 'FP16', pixelSize: 3, colorLevels: 256, bar: 65, desc: 'Half precision — near-lossless for inference' },
  { name: 'FP32', pixelSize: 1, colorLevels: 256, bar: 100, desc: 'Full precision — same as training' },
] as const;

export type BitLevel = (typeof BIT_LEVELS)[number];

export { shuffle };

/**
 * Build `total` options: always includes `correct`, rest are random distinct labels
 * from `bank` (excluding `correct`).
 */
export function pickQuizChoices(
  correct: string,
  bank: readonly string[],
  total: number = 4,
): string[] {
  const wrongPool = [...new Set(bank.filter((label) => label !== correct))];
  if (wrongPool.length < total - 1) {
    throw new Error(
      `ANSWER_BANK needs at least ${total - 1} labels other than "${correct}" (got ${wrongPool.length}).`,
    );
  }
  const wrong = shuffle(wrongPool).slice(0, total - 1);
  return shuffle([correct, ...wrong]);
}

// Draw an HTMLImageElement onto a canvas, pixelated to simulate quantization.
// pixelSize=1 = full resolution; higher = blockier.
export function drawPixelated(canvas: HTMLCanvasElement, img: HTMLImageElement, pixelSize: number) {
  const SIZE = 200;
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const small = document.createElement('canvas');
  const steps = Math.max(1, Math.floor(SIZE / pixelSize));
  small.width = steps;
  small.height = steps;
  const sCtx = small.getContext('2d');
  if (!sCtx) return;
  sCtx.drawImage(img, 0, 0, steps, steps);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, SIZE, SIZE);
}
