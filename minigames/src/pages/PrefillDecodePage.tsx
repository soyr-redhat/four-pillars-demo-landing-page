import { useCallback, useEffect, useRef, useState } from 'react';
import { DemoNav } from '../components/DemoNav';
import { DemoTutorialOverlay } from '../components/DemoTutorialOverlay';
import { HatLogo } from '../components/HatLogo';
import { RhDocLink } from '../components/RhDocLink';
import {
  advanceTick,
  BATCH_SIZE,
  BASE_MS,
  buildResult,
  countTicksToComplete,
  freshSimState,
  generateBatch,
  PAINT_BASE,
  TRANSFER,
  type Pot,
  type ResultCard,
  type WorkerKind,
  WASH_BASE,
  workerActivitySummary,
  workerLabel,
} from '../data/prefillPotterySim';
import '../styles/demo-shell.css';
import '../styles/demo-widgets.css';
import '../styles/prefill-pottery.css';

type InsightVariant = '' | 'hi' | 'warn' | 'good';

/** Playback rates relative to BASE_MS — lower value = slower wall-clock */
const SPEEDS = [
  { label: '3×', value: 3 },
  { label: '1×', value: 1 },
  { label: '½×', value: 0.55 },
] as const;

function simPotClass(state: Pot['state']): string {
  if (state === 'done') return 'pw-done-pot';
  if (state === 'queued') return 'pw-queued';
  if (state === 'washing') return 'pw-washing';
  if (state === 'transferring') return 'pw-transferring';
  return 'pw-painting';
}

function potLabel(p: Pot): string {
  if (p.state === 'queued') return '⏳ Queue';
  if (p.state === 'washing')
    return `🧽 ${Math.min(100, Math.round((p.wDone / p.wTotal) * 100))}%`;
  if (p.state === 'transferring')
    return `🔄 ${Math.min(100, Math.round((p.xDone / TRANSFER) * 100))}%`;
  if (p.state === 'painting')
    return `🖌️ ${Math.min(100, Math.round((p.pDone / p.pTotal) * 100))}%`;
  return '✅ Done';
}

export function PrefillDecodePage() {
  const [batchPots, setBatchPots] = useState(() => generateBatch());
  const [results, setResults] = useState<{
    brush: ResultCard | null;
    sponge: ResultCard | null;
    disagg: ResultCard | null;
  }>({ brush: null, sponge: null, disagg: null });

  const [speed, setSpeed] = useState(1);
  const [simRunning, setSimRunning] = useState(false);
  const [simVisible, setSimVisible] = useState(false);
  const [simWorker, setSimWorker] = useState<WorkerKind | null>(null);
  const [simState, setSimState] = useState<ReturnType<typeof freshSimState> | null>(null);

  const [insight, setInsight] = useState<{
    title: string;
    text: string;
    variant: InsightVariant;
  }>({
    title: 'How it works',
    text:
      'Choose a worker to send the batch of 5 pots. Watch each pot move through washing and painting. When done, the results card appears below. Try all three workers — the cards stay up so you can compare times directly.',
    variant: '',
  });

  const simRef = useRef<ReturnType<typeof freshSimState> | null>(null);
  const workerRef = useRef<WorkerKind | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickBudgetRef = useRef(1);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const finishSim = useCallback(
    (worker: WorkerKind, final: ReturnType<typeof freshSimState>) => {
      clearTimer();
      setSimRunning(false);
      setSimVisible(false);
      setSimWorker(null);
      simRef.current = null;
      workerRef.current = null;

      const r = buildResult(final, speed);
      setResults(prev => {
        const next = { ...prev, [worker]: r };
        const completed = (['brush', 'sponge', 'disagg'] as const).filter(k => next[k]);

        queueMicrotask(() => {
          if (completed.length < 3) {
            setInsight({
              title: 'Result saved!',
              text: `${workerLabel(worker)} finished in ${r.totalSec}s. Try the other ${3 - completed.length} worker${3 - completed.length > 1 ? 's' : ''} to compare.`,
              variant: 'hi',
            });
          } else {
            const times = {
              brush: parseFloat(next.brush!.totalSec),
              sponge: parseFloat(next.sponge!.totalSec),
              disagg: parseFloat(next.disagg!.totalSec),
            };
            const fastest = Math.min(times.brush, times.sponge, times.disagg);
            const slowest = Math.max(times.brush, times.sponge, times.disagg);
            const speedup = (slowest / fastest).toFixed(1);
            const fastestWorker = (['brush', 'sponge', 'disagg'] as const).find(
              w => Math.abs(times[w] - fastest) < 0.001,
            );

            setInsight({
              title: 'All three compared! 🎉',
              text: `${workerLabel(fastestWorker!)} finished in ${fastest.toFixed(1)}s — ${speedup}× faster than the slowest option (${slowest.toFixed(1)}s). Notice the disaggregated pipeline time breakdown: the transfer cost is tiny compared to the time saved by running each phase at full speed.`,
              variant: 'good',
            });
          }
        });

        return next;
      });
    },
    [clearTimer, speed],
  );

  const startSim = useCallback(
    (worker: WorkerKind) => {
      if (simRunning) return;
      if (results[worker]) {
        setInsight({
          title: 'Already done!',
          text: `You already sent this batch to the ${workerLabel(worker)}. Try a different worker, or hit New Batch to start fresh.`,
          variant: 'warn',
        });
        return;
      }

      tickBudgetRef.current = countTicksToComplete(batchPots, worker);
      const init = freshSimState(batchPots);
      simRef.current = init;
      workerRef.current = worker;
      setSimState(init);
      setSimWorker(worker);
      setSimVisible(true);
      setSimRunning(true);

      const intervalMs = BASE_MS / speed;
      timerRef.current = setInterval(() => {
        const w = workerRef.current!;
        const cur = simRef.current!;
        const next = advanceTick(cur, w);
        simRef.current = next;
        setSimState({ ...next });

        if (next.done >= BATCH_SIZE) {
          finishSim(w, next);
        }
      }, intervalMs);
    },
    [batchPots, finishSim, results, simRunning, speed],
  );

  const resetAll = useCallback(() => {
    clearTimer();
    setSimRunning(false);
    setSimVisible(false);
    setSimWorker(null);
    setSimState(null);
    simRef.current = null;
    workerRef.current = null;
    const nextBatch = generateBatch();
    setBatchPots(nextBatch);
    setResults({ brush: null, sponge: null, disagg: null });
    setInsight({
      title: 'How it works',
      text:
        'Choose a worker to send the batch of 5 pots. Watch the simulation, then try the other workers. All three result cards stay visible so you can compare times directly.',
      variant: '',
    });
  }, [clearTimer]);

  const WORKERS: WorkerKind[] = ['brush', 'sponge', 'disagg'];
  const doneCount = WORKERS.filter(w => results[w]).length;

  const fastestSec = (() => {
    const ts = WORKERS.filter(w => results[w]).map(w => parseFloat(results[w]!.totalSec));
    return ts.length ? Math.min(...ts) : null;
  })();

  const progFillClass =
    simState?.pots.some(p => p.state === 'transferring')
      ? 'pw-prog-xfer'
      : simState?.pots.some(p => p.state === 'painting')
        ? 'pw-prog-paint'
        : 'pw-prog-wash';

  /** Elapsed ticks vs exact budget — fills to 100% as the last pot finishes */
  const progPct =
    simState && tickBudgetRef.current > 0
      ? Math.min(100, Math.round((simState.elapsed / tickBudgetRef.current) * 100))
      : 0;

  const elapsedSec =
    simState && simRunning ? ((simState.elapsed * BASE_MS) / speed / 1000).toFixed(1) : '0.0';

  return (
    <div className="demo-page prefill-page pw-layout" data-demo-theme="prefill-decode">
      <DemoTutorialOverlay
        storageKey="prefill-decode"
        theme="prefill-decode"
        title="Wash vs paint — two different skills"
        stepLabels={['Pick a worker', 'Watch wash → paint', 'Compare all three']}
      >
        <p>
          Every pot needs washing then painting. The sponge worker washes fast but paints slowly. The brush worker
          paints fast but washes slowly. Decide which worker you assign each pot. Or — disaggregate: let each worker do
          only what it excels at, running in parallel, with a small hand-off cost. Experiment and compare efficiency.
        </p>
      </DemoTutorialOverlay>
      <DemoNav title="Prefill / Decode Disaggregation" badge="04 / 07" />
      <div className="hero">
        <div className="eyebrow">
          <div className="eyebrow-dot" />
          The Pottery Workshop
        </div>
        <h1>
          Same batch. <strong>Three workers.</strong>
          <br />
          Who finishes fastest?
        </h1>
        <p className="hero-sub">
          Here is a batch of 5 pots that need washing then painting. Send the whole batch to each worker — one at a time
          — and watch how long it takes. Your results stay on screen so you can compare all three side by side once you
          have tried them all.
        </p>
      </div>

      <div className="arena pw-arena">
        <div className="pw-reset-row">
          <button type="button" className="pw-reset-btn" onClick={resetAll}>
            ↺ New batch
          </button>
          <div className="pw-speed-toggle">
            {SPEEDS.map(s => (
              <button
                key={s.label}
                type="button"
                className={`pw-speed-btn${speed === s.value ? ' active' : ''}`}
                onClick={() => setSpeed(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pw-batch-section">
          <div className="pw-batch-header">
            <div>
              <div className="pw-batch-title">Your batch of 5 pots</div>
              <div className="pw-batch-subtitle">Same pots will be sent to whichever worker you choose</div>
            </div>
          </div>
          <div className="pw-pot-cards">
            {batchPots.map(p => (
              <div key={p.id} className="pw-pot-card">
                <div className="pw-pot-card-top">
                  <div className="pw-pot-card-emoji">{p.emoji}</div>
                  <div className="pw-pot-card-name">{p.name}</div>
                </div>
                <div className="pw-spec-row">
                  <span className="pw-spec-label">🧽 Wash</span>
                  <span className="pw-spec-val">{p.wTotal}t</span>
                </div>
                <div className="pw-spec-bar-wrap">
                  <div
                    className="pw-spec-bar"
                    style={{
                      width: `${Math.round((p.wTotal / (WASH_BASE + 8)) * 100)}%`,
                      background: 'var(--blue)',
                    }}
                  />
                </div>
                <div className="pw-spec-row" style={{ marginTop: 4 }}>
                  <span className="pw-spec-label">🖌️ Paint</span>
                  <span className="pw-spec-val">{p.pTotal}t</span>
                </div>
                <div className="pw-spec-bar-wrap">
                  <div
                    className="pw-spec-bar"
                    style={{
                      width: `${Math.round((p.pTotal / (PAINT_BASE + 8)) * 100)}%`,
                      background: 'var(--green)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pw-worker-buttons">
          <div className="pw-worker-btn pw-brush-btn">
            <div className="pw-wb-header">
              <div className="pw-wb-icon">🖌️</div>
              <div className="pw-wb-name">Brush Worker</div>
            </div>
            <div className="pw-wb-specs">
              Washes at <strong>1×</strong> speed (slow)
              <br />
              Paints at <strong>4×</strong> speed (fast)
              <br />
              One worker, sequential
            </div>
            <button
              type="button"
              className="pw-wb-cta pw-brush-cta"
              disabled={simRunning || !!results.brush}
              onClick={() => startSim('brush')}
            >
              {results.brush ? '✓ Done — results saved' : 'Send batch to Brush Worker →'}
            </button>
          </div>
          <div className="pw-worker-btn pw-sponge-btn">
            <div className="pw-wb-header">
              <div className="pw-wb-icon">🧽</div>
              <div className="pw-wb-name">Sponge Worker</div>
            </div>
            <div className="pw-wb-specs">
              Washes at <strong>4×</strong> speed (fast)
              <br />
              Paints at <strong>1×</strong> speed (slow)
              <br />
              One worker, sequential
            </div>
            <button
              type="button"
              className="pw-wb-cta pw-sponge-cta"
              disabled={simRunning || !!results.sponge}
              onClick={() => startSim('sponge')}
            >
              {results.sponge ? '✓ Done — results saved' : 'Send batch to Sponge Worker →'}
            </button>
          </div>
          <div className="pw-worker-btn pw-disagg-btn">
            <div className="pw-wb-header">
              <div className="pw-wb-icon">⚡</div>
              <div className="pw-wb-name">Disaggregated</div>
            </div>
            <div className="pw-wb-specs">
              Sponge washes at <strong>4×</strong>
              <br />
              Small hand-off cost (6 ticks)
              <br />
              Brush paints at <strong>4×</strong> in parallel
            </div>
            <button
              type="button"
              className="pw-wb-cta pw-disagg-cta"
              disabled={simRunning || !!results.disagg}
              onClick={() => startSim('disagg')}
            >
              {results.disagg ? '✓ Done — results saved' : 'Send batch to Disaggregated →'}
            </button>
          </div>
        </div>

        <div className={`pw-sim-section${simVisible ? '' : ' pw-hidden'}`}>
          <div className="pw-sim-header">
            <div className="pw-sim-icon">
              {simWorker === 'brush' ? '🖌️' : simWorker === 'sponge' ? '🧽' : '⚡'}
            </div>
            <div>
              <div className="pw-sim-title">
                {simWorker ? `${workerLabel(simWorker)} — processing batch` : 'Running…'}
              </div>
              <div className="pw-sim-sub">
                {simState && simWorker ? workerActivitySummary(simState, simWorker) : ''}
              </div>
              {simWorker ? (
                <div className="pw-sim-hint">
                  {simWorker === 'brush'
                    ? 'Sequential: slow wash → fast paint per pot'
                    : simWorker === 'sponge'
                      ? 'Sequential: fast wash → slow paint per pot'
                      : 'Parallel: sponge wash lane + brush paint lane + short hand-off'}
                </div>
              ) : null}
            </div>
          </div>
          <div className="pw-sim-pots">
            {(simState?.pots ?? []).map(p => (
              <div key={p.id} className={`pw-sim-pot ${simPotClass(p.state)}`}>
                <div className="pw-sim-pot-emoji">{p.emoji}</div>
                <div className="pw-sim-pot-label">{potLabel(p)}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="pw-sim-progress-label">
              <span>{simState ? `${simState.done}/${BATCH_SIZE} pots done` : 'Working…'}</span>
              <span>{elapsedSec}s</span>
            </div>
            <div className="pw-prog-track">
              <div className={`pw-prog-fill ${progFillClass}`} style={{ width: `${progPct}%` }} />
            </div>
          </div>
        </div>

        <div className="pw-results-section">
          <div className="pw-results-title">
            📊 Results — try all three to compare
            <span style={{ fontFamily: "'Red Hat Mono', monospace", fontSize: 9, color: 'var(--ink-light)' }}>
              {doneCount} / 3 completed
            </span>
          </div>
          <div className="pw-results-grid">
            {WORKERS.map(w => {
              const r = results[w];
              const colors = { brush: 'var(--amber)', sponge: 'var(--blue)', disagg: 'var(--green)' };
              const icons = { brush: '🖌️', sponge: '🧽', disagg: '⚡' };
              const isFastest =
                r &&
                fastestSec !== null &&
                Math.abs(parseFloat(r.totalSec) - fastestSec) < 0.05 &&
                doneCount > 1 &&
                WORKERS.filter(x => results[x]).length > 1;

              if (!r) {
                return (
                  <div key={w} className="pw-result-card pw-empty-card">
                    <div className="pw-result-card-header">
                      <div className="pw-rc-icon">{icons[w]}</div>
                      <div className="pw-rc-name">{workerLabel(w)}</div>
                      <span className="pw-rc-badge pw-pending-badge">Not tried</span>
                    </div>
                    <div className="pw-result-pending">Send the batch to this worker to see results</div>
                  </div>
                );
              }

              return (
                <div key={w} className={`pw-result-card pw-${w}-card${isFastest ? ' pw-winner' : ''}`}>
                  <div className="pw-result-card-header">
                    <div className="pw-rc-icon">{icons[w]}</div>
                    <div className="pw-rc-name">{workerLabel(w)}</div>
                    {isFastest ? <span className="pw-rc-badge pw-winner-badge">🏆 Fastest</span> : null}
                  </div>
                  <div className="pw-result-big" style={{ color: colors[w] }}>
                    {r.totalSec}s
                  </div>
                  <div className="pw-result-big-label">Total time for 5 pots</div>
                  <div className="pw-result-stats">
                    <div className="pw-result-stat-row">
                      <span className="pw-rst-label">Washing</span>
                      <span className="pw-rst-val">{r.washPct}% of time</span>
                    </div>
                    {w === 'disagg' ? (
                      <div className="pw-result-stat-row">
                        <span className="pw-rst-label">Transfer</span>
                        <span className="pw-rst-val">{r.xferPct}% of time</span>
                      </div>
                    ) : null}
                    <div className="pw-result-stat-row">
                      <span className="pw-rst-label">Painting</span>
                      <span className="pw-rst-val">{r.paintPct}% of time</span>
                    </div>
                    <div className="pw-result-stat-row">
                      <span className="pw-rst-label">Idle</span>
                      <span className="pw-rst-val">{r.idlePct}% of time</span>
                    </div>
                  </div>
                  <div className="pw-result-bar-track">
                    <div className="pw-rb-seg" style={{ flex: r.washPct, background: 'var(--blue)' }} />
                    {w === 'disagg' ? (
                      <div className="pw-rb-seg" style={{ flex: r.xferPct, background: 'var(--amber)' }} />
                    ) : null}
                    <div className="pw-rb-seg" style={{ flex: r.paintPct, background: 'var(--green)' }} />
                    <div className="pw-rb-seg" style={{ flex: r.idlePct, background: '#eeecea' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`pw-insight${insight.variant ? ` pw-${insight.variant}` : ''}`}>
          <h4>{insight.title}</h4>
          <p>{insight.text}</p>
        </div>
      </div>

      <div className="section">
        <div className="section-divider" />
        <h2>From Pottery to GPUs</h2>
        <div className="explainer-grid">
          <div className="exp-card">
            <h3>Washing = Prefill</h3>
            <p>
              Processing the entire pot surface at once — like reading a whole prompt in one parallel pass.
              Compute-intensive: you can scan all surfaces simultaneously.
            </p>
          </div>
          <div className="exp-card">
            <h3>Painting = Decode</h3>
            <p>
              Applying glaze stroke by stroke — like generating one token at a time. Memory-bandwidth-bound: every stroke
              reads the KV cache from where you left off.
            </p>
          </div>
          <div className="exp-card">
            <h3>The Bottleneck Problem</h3>
            <p>
              A single GPU doing both is bottlenecked by the phase it handles worst. Brush worker: every pot waits on the
              slow wash. Sponge worker: every pot waits on the slow paint.
            </p>
          </div>
          <div className="exp-card">
            <h3>Disaggregation + Transfer Cost</h3>
            <p>
              The hand-off adds a small fixed cost per pot. But both phases run at full speed in parallel on separate
              workers — the pipeline throughput wins by a large margin.
            </p>
          </div>
        </div>

        <div className="rh-section">
          <h3>
            <HatLogo size={20} />
            Red Hat&apos;s Contribution
          </h3>
          <p>
            Red Hat contributes to vLLM&apos;s disaggregated prefill implementation and LMCache for practical KV cache
            transfer between P/D nodes.
          </p>
          <div className="rh-links">
            <RhDocLink newTab href="https://www.redhat.com/en/blog/cracking-inference-code">
              High Performance AI Red Hat Blog
            </RhDocLink>
            <RhDocLink newTab href="https://www.redhat.com/en/topics/ai/what-is-distributed-inference">
              Distributed Inference Red Hat Topic
            </RhDocLink>
            <RhDocLink
              newTab
              href="https://developers.redhat.com/articles/2025/11/21/introduction-distributed-inference-llm-d"
            >
              llm-d Developer Blog
            </RhDocLink>
          </div>
        </div>

        <div className="projects-label">Upstream Projects</div>
        <div className="projects-row">
          <a className="proj-card" href="https://github.com/vllm-project/vllm" target="_blank" rel="noreferrer">
            <div className="proj-dot" />
            <div>
              <div className="pname">vLLM</div>
              <div className="pdesc">Disaggregated prefill scheduling</div>
            </div>
          </a>
          <a className="proj-card" href="https://github.com/LMCache/LMCache" target="_blank" rel="noreferrer">
            <div className="proj-dot" />
            <div>
              <div className="pname">LMCache</div>
              <div className="pdesc">KV cache transfer between P/D nodes</div>
            </div>
          </a>
          <a className="proj-card" href="https://github.com/sgl-project/sglang" target="_blank" rel="noreferrer">
            <div className="proj-dot" />
            <div>
              <div className="pname">SGLang</div>
              <div className="pdesc">High-perf P/D split inference</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
