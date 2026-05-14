import { useState, useRef, useEffect, useCallback } from 'react';
import { DemoNav } from '../components/DemoNav';
import { DemoTutorialOverlay } from '../components/DemoTutorialOverlay';
import { HatLogo } from '../components/HatLogo';
import { RhDocLink } from '../components/RhDocLink';
import '../styles/demo-shell.css';
import '../styles/demo-widgets.css';

// ─── constants ───────────────────────────────────────────────────────────────

const TOTAL_TOKENS = 40;

const CORRECT_TOKENS = [
  'The', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy', 'dog', 'and',
  'then', 'ran', 'away', 'quickly', 'into', 'the', 'forest', 'where', 'it', 'found',
  'a', 'warm', 'and', 'cozy', 'den', 'to', 'rest', 'for', 'the', 'night',
  'before', 'returning', 'to', 'the', 'open', 'plains', 'once', 'more', 'and', 'again',
];

const WRONG_GUESSES = [
  'big', 'small', 'slow', 'fast', 'bright', 'dark', 'loud', 'soft', 'tall', 'wide',
  'runs', 'hides', 'sleeps', 'waits', 'leaps', 'falls', 'flies', 'walks', 'sits', 'stands',
  'through', 'past', 'under', 'beside', 'along', 'toward', 'beyond', 'within', 'across', 'upon',
];

// ─── types ────────────────────────────────────────────────────────────────────

type TokenKind = 'draft' | 'accepted' | 'rejected' | 'final';
type Token = { id: number; word: string; kind: TokenKind };
type LogLine = { t: string; cls: string; msg: string };

// ─── component ────────────────────────────────────────────────────────────────

export function SpeculativeDecodingPage() {
  // Slider values — live state so the UI stays in sync
  const [draftSpeed, setDraftSpeed] = useState(8);
  const [specWindow, setSpecWindow] = useState(4);
  const [acceptRate, setAcceptRate] = useState(75);

  // All display state — drives re-renders
  const [stream, setStream] = useState<Token[]>([]);
  const [log, setLog] = useState<LogLine[]>([{ t: '—', cls: '', msg: 'Ready. Press Run Simulation to begin.' }]);
  const [baselinePct, setBaselinePct] = useState(0);
  const [specPct, setSpecPct] = useState(0);
  const [stats, setStats] = useState({ specTokens: 0, accepted: 0, savedPasses: 0, speedup: '—' });
  const [running, setRunning] = useState(false);

  // stopRef is the only thing that needs to be a ref — it must be readable
  // inside setTimeout callbacks without going stale. Everything else is useState.
  const stopRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const wrongIdxRef = useRef(0);

  useEffect(() => () => {
    stopRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // ─── helpers ───────────────────────────────────────────────────────────────

  const wait = (fn: () => void, ms: number) => {
    timerRef.current = setTimeout(() => { if (!stopRef.current) fn(); }, ms);
  };

  const elapsed = () => ((Date.now() - startTimeRef.current) / 1000).toFixed(1) + 's';

  const appendLog = useCallback((cls: string, msg: string) => {
    setLog(prev => [...prev, { t: elapsed(), cls, msg }]);
  }, []);

  // ─── simulation ────────────────────────────────────────────────────────────

  const startSim = useCallback(() => {
    stopRef.current = false;
    wrongIdxRef.current = 0;
    startTimeRef.current = Date.now();

    setRunning(true);
    setStream([]);
    setLog([]);
    setBaselinePct(0);
    setSpecPct(0);
    setStats({ specTokens: 0, accepted: 0, savedPasses: 0, speedup: '—' });

    const acceptR = acceptRate / 100;
    const mainSpeed = Math.round(draftSpeed / 3);         // main model is ~3x slower than draft
    const draftMsPerToken = Math.round(1000 / draftSpeed);
    const mainMsPerToken = Math.round(1000 / mainSpeed);

    appendLog('verify', `Started — draft: ${draftSpeed} tok/s · main: ${mainSpeed} tok/s · window: ${specWindow}`);

    // ── baseline: ticks one token at a time, for the comparison bar ────────
    let baselineCount = 0;
    function tickBaseline() {
      if (stopRef.current || baselineCount >= TOTAL_TOKENS) return;
      baselineCount++;
      setBaselinePct(Math.round((baselineCount / TOTAL_TOKENS) * 100));
      if (baselineCount < TOTAL_TOKENS) wait(tickBaseline, mainMsPerToken);
    }

    // ── speculative path ───────────────────────────────────────────────────
    let tokenPos = 0;       // index of the next correct token to produce
    let specCount = 0;      // total tokens committed to output so far
    let totalAccepted = 0;  // draft tokens that were correct
    let verifyPasses = 0;   // number of main-model verification passes
    let nextId = 0;         // incrementing key for Token objects

    function runRound() {
      if (stopRef.current || specCount >= TOTAL_TOKENS) { finish(); return; }
      verifyPasses++;

      const win = Math.min(specWindow, TOTAL_TOKENS - specCount);

      // Draft model always proposes the full window.
      // acceptRate controls per-token accuracy: each token is correct or wrong independently.
      const proposals = Array.from({ length: win }, (_, i) => {
        const correct = CORRECT_TOKENS[tokenPos + i];
        const isRight = Math.random() < acceptR;
        return { correct, isRight, guessed: isRight ? correct : WRONG_GUESSES[wrongIdxRef.current++ % WRONG_GUESSES.length] };
      });

      // Show the full draft immediately
      setStream(prev => [...prev, ...proposals.map(p => ({ id: ++nextId, word: p.guessed, kind: 'draft' as TokenKind }))]);
      appendLog('draft', `Draft guesses ${win} tokens: "${proposals.map(p => p.guessed).join(' ')}"`);

      // After draft time elapses, main model verifies the whole window in one pass
      wait(() => {
        appendLog('verify', `Main model verifying ${win} token${win > 1 ? 's' : ''} in 1 pass…`);

        // The verifier accepts a leading prefix of correct tokens, then corrects the first wrong one
        const firstWrong = proposals.findIndex(p => !p.isRight);
        const acceptCount = firstWrong === -1 ? win : firstWrong;

        setStream(prev => {
          const next = [...prev];
          const base = next.length - win;
          // Mark each drafted token accepted or rejected
          for (let i = 0; i < win; i++) {
            next[base + i] = { ...next[base + i], kind: i < acceptCount ? 'accepted' : 'rejected' };
          }
          // Append the main model's correction for the first wrong token
          if (firstWrong !== -1) {
            next.push({ id: ++nextId, word: proposals[firstWrong].correct, kind: 'final' });
          }
          return next;
        });

        // Advance: accepted tokens + 1 correction (if a rejection occurred)
        const committed = acceptCount + (firstWrong !== -1 ? 1 : 0);
        tokenPos += committed;
        specCount += committed;
        totalAccepted += acceptCount;

        const savedPasses = Math.max(0, totalAccepted - verifyPasses);
        const speedup = baselineCount > 0 ? (specCount / baselineCount).toFixed(2) + '×' : '—';
        setSpecPct(Math.round((specCount / TOTAL_TOKENS) * 100));
        setStats({ specTokens: specCount, accepted: totalAccepted, savedPasses, speedup });

        if (acceptCount > 0)  appendLog('accept', `✓ ${acceptCount} token${acceptCount > 1 ? 's' : ''} correct`);
        if (firstWrong !== -1) appendLog('reject', `✗ Token ${firstWrong + 1} wrong — main model corrects it`);

        wait(() => { if (!stopRef.current && specCount < TOTAL_TOKENS) runRound(); else finish(); }, 80);
      }, draftMsPerToken * win);
    }

    function finish() {
      setRunning(false);
      appendLog('accept', `✅ Done in ${elapsed()}`);
    }

    wait(tickBaseline, 0);
    wait(runRound, 0);
  }, [draftSpeed, specWindow, acceptRate, appendLog]);

  const resetSim = useCallback(() => {
    stopRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setRunning(false);
    setStream([]);
    setLog([{ t: '—', cls: '', msg: 'Reset. Press Run Simulation to begin again.' }]);
    setBaselinePct(0);
    setSpecPct(0);
    setStats({ specTokens: 0, accepted: 0, savedPasses: 0, speedup: '—' });
  }, []);

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="demo-page" data-demo-theme="speculative">
      <DemoTutorialOverlay
        storageKey="speculative-decoding"
        theme="speculative"
        title="Slowed down so you can see it"
        stepLabels={['Tune sliders', 'Run simulation', 'Watch the verifier']}
      >
        <p>
          We&apos;ve slowed everything down by <strong>1000×</strong>. Adjust your parameters and hit{' '}
          <strong>Run Simulation</strong> to watch a tiny draft model race ahead to guess tokens, then see the big
          model verify them all at once — and feel why this is faster than doing it the normal way.
        </p>
      </DemoTutorialOverlay>
      <DemoNav title="Speculative Decoding" badge="01 / 07" />
      <div className="hero">
        <div className="eyebrow">
          <div className="eyebrow-dot" />
          Interactive Simulation
        </div>
        <h1>
          The <strong>Slowest</strong> Speculator
          <br />
          on Earth
        </h1>
        <p className="hero-sub">
          We&apos;ve slowed everything down by 1000×. Watch a tiny draft model race ahead to guess tokens, then see the
          big model verify them all at once — and feel why this is faster than doing it the normal way.
        </p>
      </div>

      <div className="arena">
        <div className="controls">
          <div className="ctrl-group">
            <div className="ctrl-label">Draft speed (tokens/sec)</div>
            <div className="ctrl-value">{draftSpeed} tok/s</div>
            <input type="range" min={4} max={16} value={draftSpeed} step={1}
              onChange={e => setDraftSpeed(+e.target.value)} disabled={running} />
          </div>
          <div className="ctrl-group">
            <div className="ctrl-label">Speculation window</div>
            <div className="ctrl-value">{specWindow} tokens</div>
            <input type="range" min={2} max={8} value={specWindow} step={1}
              onChange={e => setSpecWindow(+e.target.value)} disabled={running} />
          </div>
          <div className="ctrl-group">
            <div className="ctrl-label">Accept rate</div>
            <div className="ctrl-value">{acceptRate}%</div>
            <input type="range" min={40} max={95} value={acceptRate} step={5}
              onChange={e => setAcceptRate(+e.target.value)} disabled={running} />
          </div>
          <button type="button" className="btn-primary" disabled={running} onClick={startSim}>
            ▶ Run Simulation
          </button>
          <button type="button" className="btn-secondary" onClick={resetSim}>
            Reset
          </button>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="val">{stats.specTokens}</div>
            <div className="lbl">Tokens generated</div>
          </div>
          <div className="stat-card good">
            <div className="val">{stats.speedup}</div>
            <div className="lbl">Speedup vs baseline</div>
          </div>
          <div className="stat-card">
            <div className="val">{stats.accepted}</div>
            <div className="lbl">Draft tokens accepted</div>
          </div>
          <div className="stat-card good">
            <div className="val">{stats.savedPasses}</div>
            <div className="lbl">Verify passes saved</div>
          </div>
        </div>

        <div className="track-wrap">
          <div className="track-title">Generation progress — 40 tokens total</div>
          <div className="model-row">
            <div className="model-header">
              <div className="model-name">🐢 Baseline (main model, token-by-token)</div>
              <div className="model-stats">Progress: <span>{baselinePct}</span>%</div>
            </div>
            <div className="track">
              <div className="track-fill main-fill" style={{ width: `${baselinePct}%` }}>
                {baselinePct > 8 ? <span>{baselinePct}%</span> : null}
              </div>
            </div>
          </div>
          <div className="model-row">
            <div className="model-header">
              <div className="model-name">⚡ Speculative (draft → verify)</div>
              <div className="model-stats">Generated: <span>{stats.specTokens}</span> / 40 tokens</div>
            </div>
            <div className="track">
              <div className="track-fill combined-fill" style={{ width: `${specPct}%` }}>
                {specPct > 8 ? <span>{specPct}%</span> : null}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="track-title" style={{ marginBottom: 8 }}>Token stream (speculative path)</div>
            <div className="token-display">
              {stream.length === 0
                ? 'Waiting to start…'
                : stream.map(t => <span key={t.id} className={`tok tok-${t.kind}`}> {t.word}</span>)
              }
            </div>
          </div>
        </div>

        <div className="log">
          {log.map((line, i) => (
            <div key={i} className="log-line">
              <span className="log-time">{line.t}</span>
              <span className={line.cls ? `log-${line.cls}` : ''}>{line.msg}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-divider" />
        <h2>How Speculative Decoding Works</h2>
        <div className="explainer-grid">
          <div className="exp-card">
            <h3>The Problem with Normal Decoding</h3>
            <p>
              Standard LLM inference generates one token at a time. Each token requires a full forward pass through the
              entire model — billions of parameters — before the next token can even start.
            </p>
          </div>
          <div className="exp-card">
            <h3>The Speculative Solution</h3>
            <p>
              A tiny &quot;draft&quot; model (10–100× smaller) guesses the next N tokens in a burst. The large model then
              verifies all N guesses in a <em>single</em> parallel forward pass — the same cost as generating 1 token.
            </p>
          </div>
          <div className="exp-card">
            <h3>When a Draft Token is Rejected</h3>
            <p>
              If the draft model guesses the wrong word, the main model catches it and substitutes the correct one.
              The <strong>accept rate</strong> slider controls how often the draft model guesses correctly — higher means
              fewer wrong guesses and more speedup. Output correctness is always guaranteed.
            </p>
          </div>
          <div className="exp-card">
            <h3>Real-World Numbers</h3>
            <p>
              With a 70B parameter main model and a 7B draft model, speculative decoding typically achieves 2–3×
              throughput gains on well-matched workloads (code, structured text).
            </p>
          </div>
        </div>

        <div className="rh-section">
          <h3>
            <HatLogo size={20} />
            Red Hat&apos;s Contribution
          </h3>
          <p>
            Red Hat engineers are active contributors to vLLM&apos;s speculative decoding implementation, including EAGLE
            and n-gram based speculation. Red Hat AI also ships speculative decoding support in its enterprise inference
            stack built on vLLM.
          </p>
          <div className="rh-links">
            <RhDocLink
              newTab
              href="https://developers.redhat.com/articles/2025/11/19/speculators-standardized-production-ready-speculative-decoding"
            >
              Speculators Developer Blog
            </RhDocLink>
            <RhDocLink
              newTab
              href="https://developers.redhat.com/articles/2026/04/16/performance-improvements-speculative-decoding-vllm-gpt-oss"
            >
              Speculative Decoding Developer Blog
            </RhDocLink>
            <RhDocLink
              newTab
              href="https://docs.redhat.com/en/documentation/red_hat_ai_inference_server/3.4/pdf/speculative_decoding/Red_Hat_AI_Inference_Server-3.4-Speculative_decoding-en-US.pdf"
            >
              Speculative Decoding with Red Hat AI Inference Server
            </RhDocLink>
            <RhDocLink newTab href="https://github.com/vllm-project/speculators">
              vLLM Speculators
            </RhDocLink>
          </div>
        </div>
      </div>
    </div>
  );
}