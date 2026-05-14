/**
 * URL for a file in Vite `public/` (`path` without leading slash). Honors `base` in vite.config.
 *
 * Note: `base: './'` makes `import.meta.env.BASE_URL` relative, so on client routes like
 * `/demos/quantization` the browser resolves `./q.png` under `/demos/` (404). Prefer `base: '/'`
 * for SPA hosting, or use a subpath base such as `/repo/`.
 */
export function publicUrl(path: string): string {
  const p = path.replace(/^\//, '');
  const base = import.meta.env.BASE_URL;
  if (base === './' || base === '.') {
    return `/${p}`;
  }
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}${p}`;
}
