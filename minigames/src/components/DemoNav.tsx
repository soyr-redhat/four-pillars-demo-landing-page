const Chevron = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M10 3L5 8l5 5" />
  </svg>
);

type Props = { title: string; badge: string };

export function DemoNav({ title, badge }: Props) {
  return (
    <nav>
      <a className="nav-back" href="/">
        <Chevron />
        Back to Dashboard
      </a>
      <div className="nav-title">{title}</div>
      <div className="nav-badge">{badge}</div>
    </nav>
  );
}
