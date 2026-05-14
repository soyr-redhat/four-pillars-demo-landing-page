type Props = { href: string; children: React.ReactNode; newTab?: boolean };

export function RhDocLink({ href, children, newTab }: Props) {
  return (
    <a
      className="rh-link"
      href={href}
      {...(newTab ? { target: '_blank', rel: 'noreferrer' as const } : {})}
    >
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
        <path d="M7 1L13 7 7 13M1 7h12" />
      </svg>
      {children}
    </a>
  );
}
