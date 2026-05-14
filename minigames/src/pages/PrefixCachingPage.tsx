import { useCallback, useEffect, useRef, useState } from 'react';
import { DemoNav } from '../components/DemoNav';
import { DemoTutorialOverlay } from '../components/DemoTutorialOverlay';
import { HatLogo } from '../components/HatLogo';
import { RhDocLink } from '../components/RhDocLink';
import {
  PREFIX_GAME_LENGTH,
  pickPrompts,
  recordCompletedPromptPrefix,
  seedPrefixesFromCompletion,
  type PromptEntry,
} from '../data/prefixGame';
import '../styles/demo-shell.css';
import '../styles/demo-widgets.css';

export function PrefixCachingPage() {
  const [screen, setScreen] = useState<'start' | 'game' | 'results'>('start');
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [timer, setTimer] = useState('0.0s');
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState('');
  const [cacheStore, setCacheStore] = useState<Record<string, number>>({});
  const [displayHits, setDisplayHits] = useState(0);
  const [displaySaved, setDisplaySaved] = useState(0);
  const [results, setResults] = useState({ time: '', hits: '', saved: '', eff: '', insight: '' });

  const hitsRef = useRef(0);
  const savedRef = useRef(0);
  const startTime = useRef<number | null>(null);
  const totalPaused = useRef(0);
  const pauseStart = useRef<number | null>(null);
  const promptStart = useRef<number | null>(null);
  const timerId = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const p = prompts[idx];

  const updateTimer = useCallback(() => {
    if (!startTime.current || paused) return;
    const elapsed = (Date.now() - startTime.current - totalPaused.current) / 1000;
    setTimer(elapsed.toFixed(1) + 's');
  }, [paused]);

  useEffect(() => {
    if (screen !== 'game' || paused) return;
    timerId.current = setInterval(updateTimer, 50);
    return () => {
      if (timerId.current) clearInterval(timerId.current);
    };
  }, [screen, paused, updateTimer]);

  /** New batch of prompts; optionally preserve KV entries from the previous round */
  const beginRound = useCallback((keepCache: boolean) => {
    const pr = pickPrompts();
    setPrompts(pr);
    setIdx(0);
    setTyped('');
    setPaused(false);
    hitsRef.current = 0;
    savedRef.current = 0;
    setDisplayHits(0);
    setDisplaySaved(0);
    if (!keepCache) setCacheStore({});
    totalPaused.current = 0;
    startTime.current = Date.now();
    promptStart.current = Date.now();
    setScreen('game');
  }, []);

  const startGame = () => beginRound(false);

  const cacheStoreRef = useRef(cacheStore);
  cacheStoreRef.current = cacheStore;

  const loadPromptUi = useCallback((prompt: PromptEntry) => {
    const store = cacheStoreRef.current;
    const cacheHit = store[prompt.prefix] !== undefined;
    setTyped(cacheHit ? prompt.prefix : '');
    setHint(
      cacheHit
        ? '⚡ Prefix cached! Type only the NEW part — press Enter when your text matches the prompt.'
        : 'Type the full prompt — press Enter when it matches.',
    );
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (screen !== 'game' || !p) return;
    loadPromptUi(p);
  }, [screen, idx, p, loadPromptUi]);

  const submitCorrectPhrase = () => {
    if (!p || !promptStart.current) return;
    const elapsed = Date.now() - promptStart.current;
    const prevStore = cacheStoreRef.current;
    const cacheHitBefore = prevStore[p.prefix] !== undefined;
    let nextStore = seedPrefixesFromCompletion(prevStore, p.text, idx, prompts, elapsed);
    nextStore = recordCompletedPromptPrefix(nextStore, p, elapsed);

    if (cacheHitBefore) {
      const saved = prevStore[p.prefix] ?? 0;
      hitsRef.current += 1;
      savedRef.current += saved;
      setDisplayHits(hitsRef.current);
      setDisplaySaved(savedRef.current);
    }

    setCacheStore(nextStore);

    const n = idx + 1;
    if (n >= PREFIX_GAME_LENGTH) {
      if (timerId.current) clearInterval(timerId.current);
      const totalTime = ((Date.now() - (startTime.current ?? Date.now()) - totalPaused.current) / 1000).toFixed(1);
      const eff = Math.round((hitsRef.current / PREFIX_GAME_LENGTH) * 100);
      setResults({
        time: totalTime + 's',
        hits: String(hitsRef.current),
        saved: (savedRef.current / 1000).toFixed(1) + 's',
        eff: eff + '%',
        insight:
          eff >= 50
            ? `You used prefix caching on ${hitsRef.current} prompts, saving ${(savedRef.current / 1000).toFixed(1)}s of retyping.`
            : `You got ${hitsRef.current} cache hits. Try again for more prefix groups!`,
      });
      setScreen('results');
      return;
    }
    setIdx(n);
    promptStart.current = Date.now();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || paused) return;
    e.preventDefault();
    if (p && typed === p.text) submitCorrectPhrase();
  };

  const onChange = (v: string) => {
    if (!p || paused) return;
    setTyped(v);
    if (p.text.startsWith(v)) {
      /* ok */
    }
  };

  const togglePause = () => {
    if (paused) {
      totalPaused.current += Date.now() - (pauseStart.current ?? Date.now());
      setPaused(false);
    } else {
      pauseStart.current = Date.now();
      setPaused(true);
    }
  };

  const cacheHitActive = !!(p && cacheStore[p.prefix] !== undefined);

  /** First-time typing: prefix KV is being built — show in cache panel as it’s typed */
  const prefixWarming =
    screen === 'game' &&
    !!p &&
    p.prefix.length > 0 &&
    cacheStore[p.prefix] === undefined &&
    p.text.startsWith(typed) &&
    p.prefix.startsWith(typed) &&
    typed.length > 0;

  const prefixWarmProgress = prefixWarming && p ? Math.min(1, typed.length / p.prefix.length) : 0;

  const cacheRows = (() => {
    const rows: { prefix: string; ms: number | null; progress: number; warming: boolean }[] = [];
    if (prefixWarming && p) {
      rows.push({
        prefix: p.prefix,
        ms: null,
        progress: prefixWarmProgress,
        warming: true,
      });
    }
    for (const [prefix, ms] of Object.entries(cacheStore)) {
      rows.push({ prefix, ms, progress: 1, warming: false });
    }
    return rows;
  })();

  const typeInputMismatch = !!(p && typed.length > 0 && !p.text.startsWith(typed));
  const typeInputClass =
    'type-input' + (typed === p?.text ? ' correct' : typeInputMismatch ? ' error' : '');

  return (
    <div className="demo-page" data-demo-theme="prefix-caching">
      <DemoTutorialOverlay
        storageKey="prefix-caching"
        theme="prefix-caching"
        title="Prefixes you’ve seen before"
        stepLabels={['Type prompts fast', 'Spot prefilled text', 'Feel the speedup']}
      >
        <p>
          Type {PREFIX_GAME_LENGTH} random prompts as fast as you can. If you&apos;ve already &quot;processed&quot; a shared
          prefix earlier in the run, it&apos;s prefilled — like prefix caching for LLMs. See how caching can help speed up
          your time.
        </p>
      </DemoTutorialOverlay>
      <DemoNav title="Continuous Batching + Prefix Caching" badge="05 / 07" />
      <div className="hero">
        <div className="eyebrow">
          <div className="eyebrow-dot" />
          Speed Typing Challenge
        </div>
        <h1>
          <strong>Type fast.</strong> Cache smarter.
          <br />
          Watch your time collapse.
        </h1>
        <p className="hero-sub">
          Type {PREFIX_GAME_LENGTH} random prompts. If you&apos;ve already &quot;processed&quot; a shared prefix earlier in
          the run, it&apos;s prefilled — like prefix caching for LLMs.
        </p>
      </div>

      <div className="arena">
        {screen === 'start' && (
          <div style={{ background: 'var(--white)', border: '1.5px solid var(--border)', borderRadius: 14, padding: 40, textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⌨️</div>
            <div style={{ fontFamily: '"Red Hat Display",sans-serif', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
              Ready to type {PREFIX_GAME_LENGTH} prompts?
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.75, maxWidth: 480, margin: '0 auto 24px' }}>
              When your input matches the prompt, press <strong>Enter</strong> once to submit and move on.
            </p>
            <button type="button" className="btn-start" onClick={startGame}>
              ▶ Start Challenge
            </button>
          </div>
        )}

        {screen === 'game' && p && (
          <div style={{ position: 'relative' }}>
            {paused && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(250,250,248,0.92)',
                  borderRadius: 14,
                  zIndex: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 12,
                  backdropFilter: 'blur(4px)',
                }}
              >
                <div style={{ fontFamily: '"Red Hat Display",sans-serif', fontSize: 28, fontWeight: 700 }}>⏸ Paused</div>
                <button type="button" className="btn-start" onClick={togglePause}>
                  ▶ Resume
                </button>
              </div>
            )}
            <div className="game-header">
              <div className="game-stats-row">
                <div className="gstat ac">
                  <div className="v">
                    {idx + 1}/{PREFIX_GAME_LENGTH}
                  </div>
                  <div className="l">Prompt</div>
                </div>
                <div className="gstat gr">
                  <div className="v">{(displaySaved / 1000).toFixed(1)}s</div>
                  <div className="l">Time saved</div>
                </div>
                <div className="gstat am">
                  <div className="v">{displayHits}</div>
                  <div className="l">Cache hits</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="timer-display">{timer}</div>
                <button type="button" className="btn-secondary" style={{ marginLeft: 0 }} onClick={togglePause}>
                  {paused ? '▶ Resume' : '⏸ Pause'}
                </button>
              </div>
            </div>

            <div className="cache-viewer">
              <div className="cache-viewer-label">📦 Prefix Cache</div>
              <div className="cache-slots">
                {cacheRows.length === 0 ? (
                  <div className="no-cache">No cached prefixes yet — start typing to warm the first prefix</div>
                ) : (
                  cacheRows.map((row, i) => (
                    <div
                      key={row.warming ? '__warming' : row.prefix}
                      className={`cache-slot${row.warming ? ' cache-slot-warming' : ''}`}
                    >
                      <div className="cache-slot-key">{i + 1}</div>
                      <div className="cache-slot-text">
                        &quot;{row.prefix.slice(0, 48)}
                        {row.prefix.length > 48 ? '…' : ''}&quot;
                      </div>
                      <div
                        className={
                          'cache-slot-save' +
                          (row.warming && row.progress < 1 ? ' cache-slot-progress' : '')
                        }
                      >
                        {row.warming
                          ? row.progress < 1
                            ? `${Math.round(row.progress * 100)}%`
                            : '~0.0s'
                          : `~${((row.ms ?? 0) / 1000).toFixed(1)}s`}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="phrase-card">
              <div className="phrase-meta">
                <div className="phrase-num">
                  Prompt {idx + 1} of {PREFIX_GAME_LENGTH}
                </div>
                <div className="cache-indicator">
                  <div className={cacheHitActive ? 'cache-badge' : 'cache-badge miss'}>
                    {cacheHitActive ? '⚡ CACHE HIT' : 'CACHE MISS'}
                  </div>
                </div>
              </div>
              <div className="target-phrase">
                <span className={cacheHitActive ? 'prefix-cached' : 'prefix-region'}>
                  {p.text.slice(0, p.prefix.length)}
                </span>
                <span className="prefix-uncached">{p.text.slice(p.prefix.length)}</span>
              </div>
              <div className="type-area">
                <input
                  ref={inputRef}
                  className={typeInputClass}
                  value={typed}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={paused}
                  placeholder="Start typing…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="accuracy-bar-wrap">
                  <div className="accuracy-bar" style={{ width: `${Math.min(100, Math.round((typed.length / p.text.length) * 100))}%` }} />
                </div>
              </div>
              <div style={{ marginTop: 10, fontFamily: '"Red Hat Mono",monospace', fontSize: 11, color: 'var(--ink-light)' }}>{hint}</div>
            </div>
          </div>
        )}

        {screen === 'results' && (
          <div className="results-screen show">
            <div className="results-title">Challenge Complete!</div>
            <div className="results-time">{results.time}</div>
            <div className="results-sublabel">Total time</div>
            <div className="results-breakdown">
              <div className="rb-card">
                <div className="rv" style={{ color: 'var(--ac)' }}>
                  {results.hits}
                </div>
                <div className="rl">Cache hits</div>
              </div>
              <div className="rb-card">
                <div className="rv" style={{ color: 'var(--green)' }}>
                  {results.saved}
                </div>
                <div className="rl">Time saved</div>
              </div>
              <div className="rb-card">
                <div className="rv" style={{ color: 'var(--amber)' }}>
                  {results.eff}
                </div>
                <div className="rl">Cache efficiency</div>
              </div>
            </div>
            <div className="results-insight">💡 {results.insight}</div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                alignItems: 'center',
                marginTop: 8,
                width: '100%',
                maxWidth: 420,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              <button type="button" className="btn-play-again" style={{ width: '100%' }} onClick={() => beginRound(true)}>
                Play again — keep cache
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => beginRound(false)}
              >
                Play again — clear cache
              </button>
              <button
                type="button"
                style={{
                  marginTop: 4,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontFamily: '"Red Hat Mono", monospace',
                  fontSize: 12,
                  color: 'var(--ink-light)',
                  textDecoration: 'underline',
                }}
                onClick={() => setScreen('start')}
              >
                Back to start
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-divider" />
        <h2>How Continuous Batching + Prefix Caching Work</h2>
        <div className="explainer-grid">
          <div className="exp-card">
            <h3>Continuous Batching</h3>
            <p>Insert new requests when a slot opens mid-generation — improving GPU utilization.</p>
          </div>
          <div className="exp-card">
            <h3>Prefix Caching</h3>
            <p>Reuse KV tensors for shared prompt prefixes so shared text is not recomputed.</p>
          </div>
          <div className="exp-card">
            <h3>PagedAttention</h3>
            <p>Non-contiguous KV pages enable dynamic allocation and larger batch sizes.</p>
          </div>
          <div className="exp-card">
            <h3>Combined Impact</h3>
            <p>Together these techniques multiply effective throughput on real workloads.</p>
          </div>
        </div>

        <div className="rh-section">
          <h3>
            <HatLogo size={20} />
            Red Hat&apos;s Contribution
          </h3>
          <p>Red Hat contributes to vLLM&apos;s prefix caching and LMCache for distributed KV sharing.</p>
          <div className="rh-links">
            <RhDocLink
              newTab
              href="https://developers.redhat.com/articles/2026/01/13/accelerate-multi-turn-workloads-llm-d"
            >
              llm-d Routing Developer Blog
            </RhDocLink>
            <RhDocLink newTab href="https://llm-d.ai/blog/kvcache-wins-you-can-see">
              Cache Wins in llm-d
            </RhDocLink>
            <RhDocLink newTab href="https://docs.vllm.ai/en/v0.5.3/automatic_prefix_caching/apc.html">
              vLLM Prefix Caching
            </RhDocLink>
            <RhDocLink newTab href="https://www.youtube.com/watch?v=8M6uCXlKI2c">
              Prefix Aware Routing Talk
            </RhDocLink>
          </div>
        </div>

        <div className="projects-label">Upstream Projects</div>
        <div className="projects-row">
          <a className="proj-card" href="https://github.com/vllm-project/vllm" target="_blank" rel="noreferrer">
            <div className="proj-dot" />
            <div>
              <div className="pname">vLLM</div>
              <div className="pdesc">PagedAttention + prefix caching</div>
            </div>
          </a>
          <a className="proj-card" href="https://github.com/sgl-project/sglang" target="_blank" rel="noreferrer">
            <div className="proj-dot" />
            <div>
              <div className="pname">SGLang</div>
              <div className="pdesc">RadixAttention prefix reuse</div>
            </div>
          </a>
          <a className="proj-card" href="https://github.com/LMCache/LMCache" target="_blank" rel="noreferrer">
            <div className="proj-dot" />
            <div>
              <div className="pname">LMCache</div>
              <div className="pdesc">Distributed KV cache sharing</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
