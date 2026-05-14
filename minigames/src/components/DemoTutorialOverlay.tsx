import { useCallback, useState, type ReactNode } from 'react';
import '../styles/tutorial-overlay.css';

export type TutorialTheme =
  | 'speculative'
  | 'quantization'
  | 'sparsification'
  | 'prefill-decode'
  | 'prefix-caching'
  | 'continuous-batching'
  | 'paged-attention';

type Props = {
  /** Unique key for sessionStorage (per demo) */
  storageKey: string;
  theme: TutorialTheme;
  title: string;
  /** Short labels shown as numbered steps above the main copy */
  stepLabels?: string[];
  children: ReactNode;
};

const SESSION_PREFIX = 'io-demo-tutorial-';

export function DemoTutorialOverlay({ storageKey, theme, title, stepLabels, children }: Props) {
  const key = SESSION_PREFIX + storageKey;
  const [visible, setVisible] = useState(() =>
    typeof sessionStorage !== 'undefined' ? !sessionStorage.getItem(key) : true,
  );

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      /* ignore quota / private mode */
    }
    setVisible(false);
  }, [key]);

  if (!visible) return null;

  return (
    <div
      className="tutorial-overlay-backdrop"
      data-tutorial-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-tutorial-title"
    >
      <div className="tutorial-overlay-card">
        <div className="tutorial-overlay-accent-bar" aria-hidden />
        <h2 id="demo-tutorial-title">{title}</h2>
        {stepLabels && stepLabels.length > 0 && (
          <ol className="tutorial-overlay-steps">
            {stepLabels.map((label, i) => (
              <li key={i}>
                <span className="tutorial-step-ring">{i + 1}</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="tutorial-overlay-body">{children}</div>
        <button type="button" className="tutorial-overlay-continue" onClick={dismiss}>
          Continue
        </button>
      </div>
    </div>
  );
}
