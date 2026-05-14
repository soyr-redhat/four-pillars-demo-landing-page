import { Link } from 'react-router-dom';
import { HatLogo } from '../components/HatLogo';
import { RhDocLink } from '../components/RhDocLink';
import '../styles/demo-shell.css';
import '../styles/home.css';

const Arrow = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M2 7h10M7 2l5 5-5 5" />
  </svg>
);

export function HomePage() {
  return (
    <div className="home">
      <header>
        <div className="logo">
          <HatLogo className="hat-svg" size={36} alt="Red Hat" />
          <div className="logo-wordmark">
            <span className="co">Red Hat</span>
            <span className="sub">AI · Inference Optimization</span>
          </div>
        </div>
        <div className="header-pill">7 Techniques</div>
      </header>

      <section className="hero">
        <div className="hero-left">
          <div className="hero-tag">
            <div className="pulse-dot" />
            Interactive Demo Suite
          </div>
          <h1>
            Make your AI run
            <br />
            <strong>faster.</strong> Right now.
          </h1>
          <p className="hero-desc">
            Explore seven inference optimization techniques powering the next generation of open-source AI infrastructure.
            Click any tile to launch an interactive demo.
          </p>
        </div>
        <div className="stats">
          <div className="stat">
            <div className="num">6×</div>
            <div className="lbl">Throughput gains possible</div>
          </div>
          <div className="stat">
            <div className="num">−70%</div>
            <div className="lbl">Memory footprint reduction</div>
          </div>
          <div className="stat">
            <div className="num">100%</div>
            <div className="lbl">Open source upstream</div>
          </div>
        </div>
      </section>

      <div className="divider">
        <span>Techniques</span>
        <div className="divider-line" />
        <span>Hover for a summary · Click to explore</span>
      </div>

      <div className="grid-wrap">
        <div className="grid">
          <div className="tile-wrap">
            <Link to="/demos/speculative-decoding" className="tile t1">
              <div className="tile-body">
                <div className="tnum">01 / 07</div>
                <div className="icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#EE0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <h2>Speculative Decoding</h2>
                <div className="tagline">Draft · Verify · Accelerate</div>
                <div className="tile-footer">
                  <div className="tags">
                    <span className="tag">vLLM</span>
                    <span className="tag">llama.cpp</span>
                    <span className="tag">HF TGI</span>
                  </div>
                  <div className="arrow">
                    <Arrow />
                  </div>
                </div>
              </div>
              <div className="tile-hover t1">
                Use a small draft model to propose multiple tokens at once, then verify in parallel with the main model —
                dramatically cutting sequential forward passes.
              </div>
            </Link>
          </div>

          <div className="tile-wrap">
            <Link to="/demos/quantization" className="tile t2">
              <div className="tile-body">
                <div className="tnum">02 / 07</div>
                <div className="icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#0066CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 17.5h7M17.5 14v7" />
                  </svg>
                </div>
                <h2>Quantization + Compression</h2>
                <div className="tagline">INT4 · GPTQ · AWQ · GGUF</div>
                <div className="tile-footer">
                  <div className="tags">
                    <span className="tag">llm-compressor</span>
                    <span className="tag">AutoGPTQ</span>
                    <span className="tag">bitsandbytes</span>
                  </div>
                  <div className="arrow">
                    <Arrow />
                  </div>
                </div>
              </div>
              <div className="tile-hover t2">
                Reduce weight precision from FP32 to INT8 or INT4 — shrinking memory footprint by up to 4× while
                preserving accuracy and enabling larger models on smaller hardware.
              </div>
            </Link>
          </div>

          <div className="tile-wrap">
            <Link to="/demos/sparsification" className="tile t3">
              <div className="tile-body">
                <div className="tnum">03 / 07</div>
                <div className="icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#008F73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="5" cy="5" r="2" />
                    <circle cx="19" cy="5" r="2" />
                    <circle cx="5" cy="19" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <line x1="7" y1="5" x2="17" y2="5" />
                    <line x1="5" y1="7" x2="5" y2="17" />
                    <line x1="7" y1="7" x2="10" y2="10" />
                  </svg>
                </div>
                <h2>Sparsification</h2>
                <div className="tagline">Pruning · Sparse Compute</div>
                <div className="tile-footer">
                  <div className="tags">
                    <span className="tag">SparseML</span>
                    <span className="tag">llm-compressor</span>
                    <span className="tag">vLLM</span>
                  </div>
                  <div className="arrow">
                    <Arrow />
                  </div>
                </div>
              </div>
              <div className="tile-hover t3">
                Eliminate redundant weights and activations so compute skips zero-valued ops. Structured sparsity maps
                directly to hardware acceleration for real throughput gains.
              </div>
            </Link>
          </div>

          <div className="tile-wrap">
            <Link to="/demos/prefill-decode" className="tile t4">
              <div className="tile-body">
                <div className="tnum">04 / 07</div>
                <div className="icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#C47800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="9" height="16" rx="2" />
                    <rect x="13" y="4" width="9" height="16" rx="2" />
                    <path d="M11 12h2" />
                  </svg>
                </div>
                <h2>Prefill / Decode Disaggregation</h2>
                <div className="tagline">P/D Split · Heterogeneous HW</div>
                <div className="tile-footer">
                  <div className="tags">
                    <span className="tag">vLLM</span>
                    <span className="tag">LMCache</span>
                    <span className="tag">SGLang</span>
                  </div>
                  <div className="arrow">
                    <Arrow />
                  </div>
                </div>
              </div>
              <div className="tile-hover t4">
                Separate compute-heavy prefill from memory-bound decode onto different hardware pools — optimizing each
                phase independently for maximum cluster utilization.
              </div>
            </Link>
          </div>

          <div className="tile-wrap">
            <Link to="/demos/prefix-caching" className="tile t5">
              <div className="tile-body">
                <div className="tnum">05 / 07</div>
                <div className="icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#6B4EBB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M3 10h18M3 14h12M3 18h8" />
                    <circle cx="20" cy="16" r="3" />
                    <path d="M20 13.5v2.5l1.5 1" />
                  </svg>
                </div>
                <h2>Prefix Caching</h2>
                <div className="tagline">PagedAttn · KV Reuse</div>
                <div className="tile-footer">
                  <div className="tags">
                    <span className="tag">vLLM</span>
                    <span className="tag">SGLang</span>
                    <span className="tag">LMCache</span>
                  </div>
                  <div className="arrow">
                    <Arrow />
                  </div>
                </div>
              </div>
              <div className="tile-hover t5">
                Reuse cached KV tensors for shared prompt prefixes so repeat system prompts and templates skip
                redundant compute — multiplying effective throughput across concurrent users.
              </div>
            </Link>
          </div>

          <div className="tile-wrap">
            <Link to="/demos/continuous-batching" className="tile t5b">
              <div className="tile-body">
                <div className="tnum">06 / 07</div>
                <div className="icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#4FA8C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="7" height="14" rx="1.5" />
                    <rect x="14" y="5" width="7" height="14" rx="1.5" />
                    <path d="M10 12h4M12 9v6" strokeLinecap="round" />
                  </svg>
                </div>
                <h2>Continuous Batching</h2>
                <div className="tagline">Bakery sim · vLLM · SGLang · TGI</div>
                <div className="tile-footer">
                  <div className="tags">
                    <span className="tag">vLLM</span>
                    <span className="tag">SGLang</span>
                    <span className="tag">TGI</span>
                  </div>
                  <div className="arrow">
                    <Arrow />
                  </div>
                </div>
              </div>
              <div className="tile-hover t5b">
                Static vs continuous batching as a pastry shop: fill GPU slots the moment work finishes instead of
                waiting on stragglers — the throughput pattern behind modern open inference servers.
              </div>
            </Link>
          </div>

          <div className="tile-wrap">
            <Link to="/demos/paged-attention" className="tile t8">
              <div className="tile-body">
                <div className="tnum">07 / 07</div>
                <div className="icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
                <h2>PagedAttention</h2>
                <div className="tagline">Memory Tetris · vLLM KV cache</div>
                <div className="tile-footer">
                  <div className="tags">
                    <span className="tag">vLLM</span>
                    <span className="tag">PagedAttention</span>
                    <span className="tag">RH AI Inference</span>
                  </div>
                  <div className="arrow">
                    <Arrow />
                  </div>
                </div>
              </div>
              <div className="tile-hover t8">
                Place irregular KV-cache shapes on a fragmented GPU memory grid — non-paged placement strands free
                cells; PagedAttention lets you drop blocks anywhere they fit, like OS paging for tensors.
              </div>
            </Link>
          </div>
        </div>
      </div>

      <div className="general-links-wrap">
        <div className="rh-section">
          <h3>
            <HatLogo size={20} />
            General links
          </h3>
          <p>Starting points for Red Hat AI, vLLM, and inference optimization on the hybrid cloud.</p>
          <div className="rh-links">
            <RhDocLink newTab href="https://www.redhat.com/en/blog/ai-optimization-7-powerful-techniques-you-can-use-today">
              Inference Optimization Developer Blog
            </RhDocLink>
            <RhDocLink newTab href="https://www.redhat.com/en/products/ai">
              Red Hat AI
            </RhDocLink>
            <RhDocLink newTab href="https://www.redhat.com/en/products/ai/inference-server">
              Red Hat AI Inference Server
            </RhDocLink>
            <RhDocLink newTab href="https://www.redhat.com/en/topics/ai/what-is-vllm">
              Red Hat vLLM Topic
            </RhDocLink>
            <RhDocLink newTab href="https://vllm.ai">
              vLLM
            </RhDocLink>
          </div>
        </div>
      </div>

      <footer>
        <p>Red Hat AI · Inference Optimization Demo Suite · 2026</p>
        <div>
          Built on <strong>open source</strong> · All upstream, always
        </div>
      </footer>
    </div>
  );
}
