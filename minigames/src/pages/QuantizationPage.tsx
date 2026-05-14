import { useCallback, useEffect, useRef, useState } from 'react';
import { DemoNav } from '../components/DemoNav';
import { DemoTutorialOverlay } from '../components/DemoTutorialOverlay';
import { HatLogo } from '../components/HatLogo';
import { RhDocLink } from '../components/RhDocLink';
import {
  ANSWER_BANK,
  BIT_LEVELS,
  IMAGE_QUESTIONS,
  drawPixelated,
  pickQuizChoices,
  shuffle,
  type ImageQuestion,
} from '../data/quantizationQuiz';
import '../styles/demo-shell.css';
import '../styles/demo-widgets.css';

// ─── image loader ─────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function clearOrigPlaceholder(canvas: HTMLCanvasElement) {
  const SIZE = 200;
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#e8eaef';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#8b919d';
  ctx.font = '600 13px "Red Hat Display", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Answer correctly', SIZE / 2, SIZE / 2 - 10);
  ctx.fillText('to reveal FP32', SIZE / 2, SIZE / 2 + 10);
}

// ─── component ────────────────────────────────────────────────────────────────

export function QuantizationPage() {
  const origRef = useRef<HTMLCanvasElement>(null);
  const quantRef = useRef<HTMLCanvasElement>(null);

  const [order, setOrder] = useState<number[]>(() => shuffle([...Array(IMAGE_QUESTIONS.length).keys()]));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [bitLevel, setBitLevel] = useState(3); // default INT8 — persists across questions; reset on Play again
  const [choices, setChoices] = useState<string[]>([]);
  const [guessResult, setGuessResult] = useState<null | 'wrong' | 'correct'>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState({ show: false, ok: false, text: '' });
  const [showResults, setShowResults] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const imgCacheRef = useRef<Record<string, HTMLImageElement>>({});

  const bitLevelRef = useRef(bitLevel);
  bitLevelRef.current = bitLevel;

  const currentQ: ImageQuestion = IMAGE_QUESTIONS[order[idx]];
  const b = BIT_LEVELS[bitLevel - 1];

  // ─── draw helpers ────────────────────────────────────────────────────────

  const paint = useCallback((img: HTMLImageElement, level: number, revealFp32: boolean) => {
    const bl = BIT_LEVELS[level - 1];
    if (quantRef.current) drawPixelated(quantRef.current, img, bl.pixelSize);
    if (origRef.current) {
      if (revealFp32) drawPixelated(origRef.current, img, 1);
      else clearOrigPlaceholder(origRef.current);
    }
  }, []);

  const getOrLoadImage = useCallback(async (q: ImageQuestion): Promise<HTMLImageElement | null> => {
    const hit = imgCacheRef.current[q.file];
    if (hit) return hit;
    try {
      const img = await loadImage(q.file);
      imgCacheRef.current[q.file] = img;
      return img;
    } catch {
      return null;
    }
  }, []);

  // ─── load question ───────────────────────────────────────────────────────

  const loadQuestion = useCallback(async (o: number[], i: number) => {
    const q = IMAGE_QUESTIONS[o[i]];
    setGuessResult(null);
    setSelected(null);
    setFeedback({ show: false, ok: false, text: '' });
    setLoadError(false);
    setChoices(pickQuizChoices(q.name, ANSWER_BANK, 4));

    const img = await getOrLoadImage(q);
    if (!img) {
      setLoadError(true);
      return;
    }
    const level = bitLevelRef.current;
    requestAnimationFrame(() => paint(img, level, false));
  }, [getOrLoadImage, paint]);

  // Full question load: new image + choices when index/order changes (or when leaving results).
  useEffect(() => {
    if (showResults) return;
    void loadQuestion(order, idx);
  }, [order, idx, showResults, loadQuestion]);

  // Canvas repaint only: bit-depth slider or reveal state changes without re-running loadQuestion.
  useEffect(() => {
    getOrLoadImage(currentQ).then(img => {
      if (!img) return;
      const reveal = guessResult === 'correct';
      requestAnimationFrame(() => paint(img, bitLevel, reveal));
    });
  }, [bitLevel, guessResult, currentQ.file, getOrLoadImage, paint]);

  // ─── quiz logic ──────────────────────────────────────────────────────────

  const checkAnswer = (chosen: string) => {
    if (guessResult !== null) return;
    setSelected(chosen);
    const levelName = BIT_LEVELS[bitLevel - 1].name;
    const isCorrect = chosen === currentQ.name;
    if (isCorrect) {
      setGuessResult('correct');
      setScore(s => s + 1);
      setFeedback({
        show: true,
        ok: true,
        text: `✓ Correct! You identified it even at ${levelName} precision — just like a quantized model can still perform well with fewer bits. The left image is full-resolution (FP32).`,
      });
      getOrLoadImage(currentQ).then(img => {
        if (img) requestAnimationFrame(() => paint(img, bitLevel, true));
      });
    } else {
      setGuessResult('wrong');
      setFeedback({
        show: true,
        ok: false,
        text: `Not quite — the answer was ${currentQ.name}. The original stays hidden until you get one right. Continue when you’re ready.`,
      });
    }
  };

  const nextQuestion = () => {
    if (guessResult === null) return;
    const next = idx + 1;
    if (next >= IMAGE_QUESTIONS.length) {
      setShowResults(true);
      return;
    }
    setGuessResult(null);
    setSelected(null);
    setFeedback({ show: false, ok: false, text: '' });
    setIdx(next);
  };

  const restart = () => {
    const o = shuffle([...Array(IMAGE_QUESTIONS.length).keys()]);
    setOrder(o);
    setIdx(0);
    setScore(0);
    setBitLevel(3);
    setShowResults(false);
    setGuessResult(null);
    setSelected(null);
    setFeedback({ show: false, ok: false, text: '' });
  };

  // ─── render ──────────────────────────────────────────────────────────────

  const pct = score / IMAGE_QUESTIONS.length;

  return (
    <div className="demo-page" data-demo-theme="quantization">
      <DemoTutorialOverlay
        storageKey="quantization"
        theme="quantization"
        title="Fewer bits, fuzzier pictures"
        stepLabels={['Drag the slider', 'Guess the image', 'Find where accuracy drops']}
      >
        <p>
          Quantization reduces how many bits store each model weight — like reducing image quality. Drag the slider
          down and try to identify each image before the details disappear. See what level of quantization starts to make
          the accuracy of your responses degrade.
        </p>
      </DemoTutorialOverlay>
      <DemoNav title="Quantization + Compression" badge="02 / 07" />
      <div className="hero">
        <div className="eyebrow"><div className="eyebrow-dot" />Pixel Quiz</div>
        <h1>Can you recognize it<br />with <strong>fewer bits?</strong></h1>
        <p className="hero-sub">
          Quantization reduces how many bits store each model weight — like reducing image quality.
          Drag the slider down and try to identify each image before the details disappear.
        </p>
      </div>

      <div className="arena">
        {!showResults ? (
          <>
            <div className="quiz-progress">
              <div className="q-dots">
                {order.map((_, i) => (
                  <div key={i} className={`q-dot${i === idx ? ' active' : ''}${i < idx ? ' done' : ''}`} />
                ))}
              </div>
              <div className="quiz-score-live">Score: <span>{score}</span> / <span>{IMAGE_QUESTIONS.length}</span></div>
            </div>

            <div className="quiz-card">
              <div className="quiz-meta">
                <div className="quiz-q-label">Question {idx + 1} of {IMAGE_QUESTIONS.length}</div>
                <div>
                  <div className="bits-row">
                    <div className="bits-badge">{b.name}</div>
                    <div className="bits-bar-wrap"><div className="bits-bar" style={{ width: `${b.bar}%` }} /></div>
                  </div>
                  <div className="bits-label">{b.desc}</div>
                </div>
              </div>

              <div className="slider-wrap">
                <label htmlFor="bit-slider">Bit depth</label>
                <input id="bit-slider" type="range" min={1} max={BIT_LEVELS.length} value={bitLevel} step={1}
                  onChange={e => setBitLevel(+e.target.value)} />
                <div className="slider-val">{b.name}</div>
              </div>

              {loadError ? (
                <div className="load-error">
                  <p>⚠️ Could not load this question&apos;s image.</p>
                  <p>
                    Put the file in <code>public/</code> and point to it with <code>publicUrl(&apos;…&apos;)</code> in{' '}
                    <code>src/data/quantizationQuiz.ts</code>.
                  </p>
                </div>
              ) : (
                <div className="canvas-row">
                  <div className="canvas-wrap">
                    <div className="canvas-label">Original (FP32)</div>
                    <canvas
                      ref={origRef}
                      width={200}
                      height={200}
                      className={guessResult === 'correct' ? 'canvas-fp32' : undefined}
                    />
                  </div>
                  <div className="canvas-wrap">
                    <div className="canvas-label">Quantized ({b.name})</div>
                    <canvas ref={quantRef} width={200} height={200} />
                  </div>
                </div>
              )}

              <div className="choices">
                {choices.map(c => {
                  const isCorrect = c === currentQ.name;
                  const wasPicked = selected === c;
                  let cls = 'choice';
                  if (guessResult !== null) {
                    if (isCorrect) cls += ' correct';
                    if (wasPicked && !isCorrect) cls += ' wrong';
                  }
                  return (
                    <button
                      key={c}
                      type="button"
                      className={cls}
                      disabled={guessResult !== null}
                      onClick={() => checkAnswer(c)}
                    >
                      <span className="choice-icon">
                        {guessResult !== null && isCorrect
                          ? '✓'
                          : guessResult !== null && wasPicked && !isCorrect
                            ? '✗'
                            : ''}
                      </span>
                      {c}
                    </button>
                  );
                })}
              </div>

              <div className={`feedback${feedback.show ? ' show ' + (feedback.ok ? 'correct' : 'wrong') : ''}`}>
                {feedback.text}
              </div>
              {guessResult !== null ? (
                <button type="button" className="next-btn show" onClick={nextQuestion}>
                  Next question →
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="results show">
            <div className="results-score">{score}/{IMAGE_QUESTIONS.length}</div>
            <div className="results-label">Your Score</div>
            <div className="results-msg">
              {pct >= 0.83
                ? 'Outstanding! You recognized most images even at heavily reduced precision — just like INT8 quantization.'
                : pct >= 0.5
                ? 'Good work! The tricky ones were the most aggressively pixelated.'
                : 'Quantization is tricky! INT8 and FP16 are common sweet spots for production models.'}
            </div>
            <div className="results-analogy">
              💡 A 70B model quantized to INT4 uses 87% less memory while scoring within 1–2% of full precision.
            </div>
            <button type="button" className="restart-btn" onClick={restart}>Play Again</button>
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-divider" />
        <h2>How Quantization Works</h2>
        <div className="explainer-grid">
          <div className="exp-card">
            <h3>From Floats to Integers</h3>
            <p>LLMs store weights as FP32 by default. Quantization maps these to INT8 or INT4 with calibrated lookup tables, slashing memory use.</p>
          </div>
          <div className="exp-card">
            <h3>The Memory Win</h3>
            <p>INT4 uses 87.5% less memory than FP32 — putting 70B parameter models within reach of a single consumer GPU.</p>
          </div>
          <div className="exp-card">
            <h3>Why Accuracy Holds</h3>
            <p>Neural networks are resilient to precision reduction. Mixed-precision schemes like GPTQ handle outlier weights carefully to preserve accuracy.</p>
          </div>
          <div className="exp-card">
            <h3>Production Formats</h3>
            <p>GPTQ, AWQ, GGUF, and FP8 on Hopper GPUs each target different deployment constraints and hardware capabilities.</p>
          </div>
        </div>

        <div className="rh-section">
          <h3><HatLogo size={20} />Red Hat&apos;s Contribution</h3>
          <p>Neural Magic and Red Hat ship llm-compressor and SparseML for quantization and compression at scale.</p>
          <div className="rh-links">
            <RhDocLink newTab href="https://huggingface.co/RedHatAI">
              Red Hat AI Hugging Face
            </RhDocLink>
            <RhDocLink
              newTab
              href="https://developers.redhat.com/articles/2026/02/04/accelerating-large-language-models-nvfp4-quantization"
            >
              NVFP4 Quantization Developer Blog
            </RhDocLink>
            <RhDocLink
              newTab
              href="https://developers.redhat.com/articles/2025/08/18/optimizing-generative-ai-models-quantization"
            >
              Quantization Developer Blog
            </RhDocLink>
            <RhDocLink
              newTab
              href="https://docs.redhat.com/en/documentation/red_hat_enterprise_linux_ai/3.0/html/getting_started/compressing-language-models-with-model-opt-container_getting-started"
            >
              Red Hat Model Optimization Toolkit
            </RhDocLink>
            <RhDocLink
              newTab
              href="https://www.redhat.com/en/blog/llm-compression-and-optimization-cheaper-inference-fewer-hardware-resources"
            >
              Compression and Optimization Developer Blog
            </RhDocLink>
            <RhDocLink
              newTab
              href="https://developers.redhat.com/videos/smarter-compression-tailoring-ai-llm-compressor-openshift-ai"
            >
              LLMCompressor Developer Video
            </RhDocLink>
          </div>
        </div>

        <div className="projects-label">Upstream Projects</div>
        <div className="projects-row">
          <a className="proj-card" href="https://github.com/vllm-project/llm-compressor" target="_blank" rel="noreferrer">
            <div className="proj-dot" /><div><div className="pname">llm-compressor</div><div className="pdesc">Quantization toolkit</div></div>
          </a>
          <a className="proj-card" href="https://github.com/AutoGPTQ/AutoGPTQ" target="_blank" rel="noreferrer">
            <div className="proj-dot" /><div><div className="pname">AutoGPTQ</div><div className="pdesc">GPTQ weight quantization</div></div>
          </a>
          <a className="proj-card" href="https://github.com/TimDettmers/bitsandbytes" target="_blank" rel="noreferrer">
            <div className="proj-dot" /><div><div className="pname">bitsandbytes</div><div className="pdesc">8-bit &amp; 4-bit optimizers</div></div>
          </a>
          <a className="proj-card" href="https://github.com/vllm-project/vllm" target="_blank" rel="noreferrer">
            <div className="proj-dot" /><div><div className="pname">vLLM</div><div className="pdesc">compressed-tensors inference</div></div>
          </a>
        </div>
      </div>
    </div>
  );
}