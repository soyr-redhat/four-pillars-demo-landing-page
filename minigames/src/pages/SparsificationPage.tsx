import { useCallback, useEffect, useRef, useState } from 'react';
import { DemoNav } from '../components/DemoNav';
import { DemoTutorialOverlay } from '../components/DemoTutorialOverlay';
import { HatLogo } from '../components/HatLogo';
import { RhDocLink } from '../components/RhDocLink';
import '../styles/demo-shell.css';
import '../styles/demo-widgets.css';

// ─── network layout ───────────────────────────────────────────────────────────

const LAYERS = [5, 8, 8, 5];   // nodes per layer

// Each edge connects layer[l][from] → layer[l+1][to]
// weight = activation strength (0–1). High weight = heavily used = important.
type Edge = {
  layer: number;  // source layer index (0, 1, 2)
  from: number;
  to: number;
  weight: number; // 0–1, fixed at init
  pruned: boolean;
};

function initEdges(): Edge[] {
  const edges: Edge[] = [];
  for (let l = 0; l < LAYERS.length - 1; l++) {
    for (let f = 0; f < LAYERS[l]; f++) {
      for (let t = 0; t < LAYERS[l + 1]; t++) {
        // Skew distribution: most edges are weak, a few are strong
        const r = Math.random();
        const weight = r < 0.55 ? r * 0.4 : r < 0.8 ? 0.22 + r * 0.4 : 0.55 + r * 0.45;
        edges.push({ layer: l, from: f, to: t, weight: Math.min(1, weight), pruned: false });
      }
    }
  }
  return edges;
}

// ─── quality model ────────────────────────────────────────────────────────────

// Quality = weighted contribution of surviving edges, normalized to 100.
// Pruning a high-weight edge hurts much more than a low-weight one.
function computeQuality(edges: Edge[]): number {
  const total = edges.reduce((s, e) => s + e.weight, 0);
  const remaining = edges.filter(e => !e.pruned).reduce((s, e) => s + e.weight, 0);
  if (total === 0) return 0;
  return Math.round((remaining / total) * 100);
}

// ─── canvas geometry ─────────────────────────────────────────────────────────

const CANVAS_H = 320;
const NODE_R = 13;

function getNodePositions(width: number) {
  return LAYERS.map((n, li) => {
    const x = 60 + ((width - 120) * li) / (LAYERS.length - 1);
    return Array.from({ length: n }, (_, ni) => ({
      x,
      y: CANVAS_H / 2 + (ni - (n - 1) / 2) * 34,
    }));
  });
}

// ─── component ────────────────────────────────────────────────────────────────

export function SparsificationPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [edges, setEdges] = useState<Edge[]>(() => initEdges());
  const [quality, setQuality] = useState(100);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [prunedCount, setPrunedCount] = useState(0);

  const totalEdges = edges.length;
  const sparsityPct = Math.round((prunedCount / totalEdges) * 100);

  // ─── draw ──────────────────────────────────────────────────────────────

  const draw = useCallback((edgeList: Edge[], hovered: number | null) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const W = wrap.getBoundingClientRect().width || 600;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== W * dpr) {
      canvas.width = W * dpr;
      canvas.height = CANVAS_H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = CANVAS_H + 'px';
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, CANVAS_H);

    const pos = getNodePositions(W);

    // ── draw edges ────────────────────────────────────────────────────────
    edgeList.forEach((e, i) => {
      const src = pos[e.layer][e.from];
      const dst = pos[e.layer + 1][e.to];

      if (e.pruned) {
        // Pruned: very faint dashed line
        ctx.beginPath();
        ctx.setLineDash([3, 6]);
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(dst.x, dst.y);
        ctx.strokeStyle = 'rgba(180,170,160,0.2)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }

      const isHovered = i === hovered;

      const brightness = e.weight * 0.85;

      // Color: strong edges are green/teal, weak are muted amber
      const r = Math.round(e.weight > 0.5 ? 0 + (1 - e.weight) * 80 : 160 + e.weight * 40);
      const g = Math.round(e.weight > 0.5 ? 130 + e.weight * 80 : 120 - e.weight * 40);
      const b2 = Math.round(e.weight > 0.5 ? 100 + e.weight * 60 : 30);
      const alpha = isHovered ? 0.95 : 0.3 + brightness * 0.6;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(dst.x, dst.y);
      ctx.strokeStyle = `rgba(${r},${g},${b2},${alpha})`;
      ctx.lineWidth = isHovered ? e.weight * 5 + 2 : e.weight * 4 + 0.5;

      if (isHovered) {
        ctx.shadowColor = e.weight > 0.6 ? '#00c896' : '#f0a030';
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // ── draw nodes ────────────────────────────────────────────────────────
    pos.forEach((layer, li) => {
      layer.forEach((p, ni) => {
        // A node is "dead" if ALL incoming edges are pruned (for hidden layers)
        let isDead = false;
        if (li > 0) {
          const incoming = edgeList.filter(e => e.layer === li - 1 && e.to === ni);
          isDead = incoming.length > 0 && incoming.every(e => e.pruned);
        }

        const nodeGlow = 0.72;
        ctx.beginPath();
        ctx.arc(p.x, p.y, NODE_R, 0, Math.PI * 2);

        if (isDead) {
          ctx.fillStyle = '#E8E6DF';
          ctx.strokeStyle = '#CCC8C0';
        } else {
          const g2 = Math.round(130 + nodeGlow * 30);
          ctx.fillStyle = `rgb(0,${g2},100)`;
          ctx.strokeStyle = '#005C47';
          ctx.shadowColor = 'rgba(0,180,120,0.4)';
          ctx.shadowBlur = 6 + nodeGlow * 8;
        }
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Layer labels below first node
        if (ni === 0) {
          const labels = ['Input', 'Hidden 1', 'Hidden 2', 'Output'];
          ctx.fillStyle = '#999';
          ctx.font = '10px "Red Hat Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(labels[li], p.x, CANVAS_H - 8);
        }
      });
    });
  }, []);

  useEffect(() => {
    draw(edges, hoveredEdge);
  }, [edges, hoveredEdge, draw]);

  // ─── mouse interaction ─────────────────────────────────────────────────

  function findEdgeAtPoint(ex: number, ey: number): number | null {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return null;
    const W = wrap.getBoundingClientRect().width;
    const pos = getNodePositions(W);
    const rect = canvas.getBoundingClientRect();
    const mx = ex - rect.left;
    const my = ey - rect.top;

    // Find closest edge midpoint within hit radius
    let closest: number | null = null;
    let bestDist = 18;
    edges.forEach((e, i) => {
      const src = pos[e.layer][e.from];
      const dst = pos[e.layer + 1][e.to];
      // Distance from point to line segment
      const dx = dst.x - src.x, dy = dst.y - src.y;
      const len2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((mx - src.x) * dx + (my - src.y) * dy) / len2));
      const px = src.x + t * dx - mx, py = src.y + t * dy - my;
      const dist = Math.sqrt(px * px + py * py);
      if (dist < bestDist) { bestDist = dist; closest = i; }
    });
    return closest;
  }

  const handleMouseMove = useCallback((ev: React.MouseEvent) => {
    const i = findEdgeAtPoint(ev.clientX, ev.clientY);
    setHoveredEdge(i);
  }, [edges]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseLeave = useCallback(() => setHoveredEdge(null), []);

  const handleClick = useCallback((ev: React.MouseEvent) => {
    const i = findEdgeAtPoint(ev.clientX, ev.clientY);
    if (i === null) return;
    setEdges(prev => {
      const next = prev.map((e, idx) => idx === i ? { ...e, pruned: !e.pruned } : e);
      setQuality(computeQuality(next));
      setPrunedCount(next.filter(e => e.pruned).length);
      return next;
    });
  }, [edges]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ─── derived display values ────────────────────────────────────────────

  const qualityColor = quality >= 90 ? 'var(--green)' : quality >= 70 ? 'var(--amber)' : 'var(--red)';
  const qualityNote =
    quality >= 95 ? 'Excellent — barely any degradation. You pruned weak, redundant connections.' :
    quality >= 85 ? 'Good — minor degradation. Smart pruning of low-activation edges.' :
    quality >= 70 ? 'Noticeable loss — you may have pruned some important connections.' :
    quality >= 50 ? 'Significant degradation — critical pathways are missing.' :
    'Severe degradation — the network can barely function.';

  const speedup = (1 + (sparsityPct / 100) * 1.8).toFixed(2) + '×';

  const reset = () => {
    const e = initEdges();
    setEdges(e);
    setQuality(100);
    setPrunedCount(0);
    setHoveredEdge(null);
  };

  return (
    <div className="demo-page" data-demo-theme="sparsification">
      <DemoTutorialOverlay
        storageKey="sparsification"
        theme="sparsification"
        title="Prune wires, watch quality"
        stepLabels={['Inspect weights', 'Click to prune', 'Balance speed vs accuracy']}
      >
        <p>
          Each wire is a weight connection — brighter and thicker means more active. Click any connection to prune it.
          Cutting weak wires barely hurts. Cutting bright ones tanks quality. Experiment to see how to best prune the
          network to achieve the best speed/quality ratio.
        </p>
      </DemoTutorialOverlay>
      <DemoNav title="Sparsification" badge="03 / 07" />
      <div className="hero">
        <div className="eyebrow"><div className="eyebrow-dot" />Interactive Neural Network</div>
        <h1>
          Prune the connections.<br />
          <strong>Watch quality drop.</strong>
        </h1>
        <p className="hero-sub">
          Each wire is a weight connection — brighter and thicker means more active. Click any connection to prune it.
          Cutting weak wires barely hurts. Cutting bright ones tanks quality.
        </p>
      </div>

      <div className="arena">
        <div className="sparse-controls">
          <div className="sparse-metrics">
            <div className="sparse-metric">
              <div className="sparse-val" style={{ color: qualityColor }}>{quality}%</div>
              <div className="sparse-lbl">Output quality</div>
            </div>
            <div className="sparse-metric">
              <div className="sparse-val">{sparsityPct}%</div>
              <div className="sparse-lbl">Sparsity</div>
            </div>
            <div className="sparse-metric">
              <div className="sparse-val" style={{ color: 'var(--green)' }}>{speedup}</div>
              <div className="sparse-lbl">Speedup</div>
            </div>
            <div className="sparse-metric">
              <div className="sparse-val">{totalEdges - prunedCount}<span style={{ fontSize: 13, color: 'var(--ink-light)', fontWeight: 400 }}>/{totalEdges}</span></div>
              <div className="sparse-lbl">Active weights</div>
            </div>
          </div>
          <div className="sparse-btn-row">
            <button type="button" className="btn-secondary" onClick={reset}>Reset network</button>
          </div>
        </div>

        <div className="quality-bar-wrap">
          <div className="quality-bar-track">
            <div className="quality-bar-fill" style={{ width: `${quality}%`, background: qualityColor }} />
          </div>
          <div className="quality-note">{qualityNote}</div>
        </div>

        <div className="net-canvas-wrap" ref={wrapRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          style={{ cursor: hoveredEdge !== null ? 'pointer' : 'default' }}
        >
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: CANVAS_H }} />
          {hoveredEdge !== null && (() => {
            const e = edges[hoveredEdge];
            const label = e.pruned
              ? 'Click to restore'
              : e.weight > 0.7
              ? `⚠ High-activation edge (${(e.weight * 100).toFixed(0)}%) — pruning will hurt quality`
              : e.weight > 0.4
              ? `Moderate edge (${(e.weight * 100).toFixed(0)}%) — some quality loss`
              : `Weak edge (${(e.weight * 100).toFixed(0)}%) — safe to prune`;
            return (
              <div className="edge-tooltip"
                style={{ borderColor: e.weight > 0.7 ? 'var(--red)' : e.weight > 0.4 ? 'var(--amber)' : 'var(--green)' }}>
                {label}
              </div>
            );
          })()}
        </div>

        <div className="sparse-legend">
          <div className="legend-item"><div className="legend-swatch" style={{ background: 'linear-gradient(90deg,#00c896,#00a070)', opacity: 0.9 }} />High activation — important</div>
          <div className="legend-item"><div className="legend-swatch" style={{ background: 'linear-gradient(90deg,#d4a030,#b07020)', opacity: 0.8 }} />Low activation — safe to prune</div>
          <div className="legend-item"><div className="legend-swatch" style={{ background: '#ddd', opacity: 0.5 }} />Pruned (zeroed out)</div>
        </div>
      </div>

      <div className="section">
        <div className="section-divider" />
        <h2>How Sparsification Works</h2>
        <div className="explainer-grid">
          <div className="exp-card">
            <h3>The Redundancy Hypothesis</h3>
            <p>Large neural networks are massively over-parameterized. A small winning subnetwork can achieve near-identical accuracy — if you can find it.</p>
          </div>
          <div className="exp-card">
            <h3>Magnitude Pruning</h3>
            <p>Zero out all weights below a threshold. Small-magnitude weights contribute little to the output — exactly the dim wires you just pruned.</p>
          </div>
          <div className="exp-card">
            <h3>Structured vs Unstructured</h3>
            <p>Unstructured sparsity zeros individual weights. Structured sparsity removes entire neurons or attention heads — mapping directly to hardware acceleration.</p>
          </div>
          <div className="exp-card">
            <h3>Sparsity + Quantization</h3>
            <p>These two techniques stack: 50% sparse INT4 models can run at near-identical accuracy with 4–8× hardware throughput on NVIDIA Ampere/Hopper.</p>
          </div>
        </div>

        <div className="rh-section">
          <h3><HatLogo size={20} />Red Hat&apos;s Contribution</h3>
          <p>Red Hat&apos;s Neural Magic team pioneered open-source LLM sparsification with SparseML and llm-compressor, integrating with vLLM&apos;s compressed-tensors backend.</p>
          <div className="rh-links">
            <RhDocLink
              newTab
              href="https://developers.redhat.com/articles/2025/05/20/optimize-llms-llm-compressor-openshift-ai"
            >
              LLMCompressor Developer Blog
            </RhDocLink>
          </div>
        </div>

        <div className="projects-label">Upstream Projects</div>
        <div className="projects-row">
          <a className="proj-card" href="https://github.com/vllm-project/llm-compressor" target="_blank" rel="noreferrer">
            <div className="proj-dot" /><div><div className="pname">llm-compressor</div><div className="pdesc">SparseGPT + magnitude pruning for LLMs</div></div>
          </a>
          <a className="proj-card" href="https://github.com/neuralmagic/sparseml" target="_blank" rel="noreferrer">
            <div className="proj-dot" /><div><div className="pname">SparseML</div><div className="pdesc">Neural Magic&apos;s sparsification toolkit</div></div>
          </a>
          <a className="proj-card" href="https://github.com/vllm-project/vllm" target="_blank" rel="noreferrer">
            <div className="proj-dot" /><div><div className="pname">vLLM</div><div className="pdesc">compressed-tensors sparse inference backend</div></div>
          </a>
        </div>
      </div>
    </div>
  );
}