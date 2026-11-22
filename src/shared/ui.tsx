import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

/* ---------- Hash routing (with View Transitions where supported) ---------- */
function readHash(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h === '' ? '/' : h;
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useRoute(): [string, (to: string) => void] {
  const [route, setRoute] = useState(readHash);
  useEffect(() => {
    const onChange = () => {
      const next = readHash();
      const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
      const apply = () => {
        flushSync(() => setRoute(next));
        if (!next.includes('#')) window.scrollTo?.({ top: 0, behavior: 'instant' as ScrollBehavior });
      };
      if (doc.startViewTransition && !prefersReducedMotion()) doc.startViewTransition(apply);
      else apply();
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = (to: string) => {
    window.location.hash = to;
  };
  return [route, navigate];
}

/* ---------- Local persistence ---------- */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** useState that mirrors itself to localStorage. Falls back to memory if storage is unavailable. */
export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() =>
    loadJSON<T>(key, typeof initial === 'function' ? (initial as () => T)() : initial),
  );
  useEffect(() => {
    saveJSON(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

/* ---------- File helpers ---------- */
export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsText(file);
  });
}

/* ---------- Layout ---------- */
export interface NavItem {
  to: string;
  label: string;
}

/** Text-only wordmark: first part roman, second part italic in the display face. */
export function Wordmark({ parts }: { parts: [string, string] }) {
  return (
    <>
      {parts[0]}
      <em>{parts[1]}</em>
    </>
  );
}

/** Adds .is-visible to [data-reveal] elements as they scroll into view (including ones added later). */
function useReveal(route: string) {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return;
    const root = document.documentElement;
    root.classList.add('reveal-ready');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    const scan = () => document.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [route]);
}

export function Shell(props: {
  name: string;
  wordmark: [string, string];
  nav: NavItem[];
  route: string;
  cta?: NavItem;
  children: ReactNode;
  footerNote?: ReactNode;
}) {
  const { name, wordmark, nav, route, cta, children, footerNote } = props;
  const isHome = route === '/';
  const [overHero, setOverHero] = useState(isHome);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useReveal(route);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      const hero = document.querySelector('.hero');
      setOverHero(!!hero && hero.getBoundingClientRect().bottom > 64);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [route]);
  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector('a')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const links = nav;
  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <header className="shell-header" data-over-hero={overHero && !open ? 'true' : 'false'} data-scrolled={scrolled ? 'true' : 'false'}>
        <div className="shell-header-inner">
          <a className="wordmark" href="#/" aria-label={`${name} home`}>
            <Wordmark parts={wordmark} />
          </a>
          <nav className="shell-nav" aria-label="Main">
            {links.map((item) => (
              <a key={item.to} href={`#${item.to}`} aria-current={isActive(route, item.to) ? 'page' : undefined}>
                {item.label}
              </a>
            ))}
          </nav>
          {cta && (
            <a className={`btn btn-sm shell-cta ${overHero ? 'btn-light' : 'btn-primary'}`} href={`#${cta.to}`}>
              {cta.label}
            </a>
          )}
          <button type="button" className="menu-btn" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>
            Menu <span className="bars" aria-hidden="true" />
          </button>
        </div>
      </header>
      <div id="mobile-menu" className="mobile-menu" data-open={open ? 'true' : 'false'} ref={menuRef} aria-hidden={!open} inert={!open}>
        <nav aria-label="Mobile">
          {nav.map((item, i) => (
            <a key={item.to} href={`#${item.to}`} aria-current={isActive(route, item.to) ? 'page' : undefined}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
      <main id="main" className={`shell-main ${isHome ? 'is-home' : ''}`} tabIndex={-1}>
        {children}
      </main>
      <footer className="shell-footer">
        <div className="shell-footer-inner">
          <span className="wordmark"><Wordmark parts={wordmark} /></span>
          <span>{footerNote ?? 'Runs entirely in your browser. Your data stays on this device.'}</span>
        </div>
      </footer>
    </>
  );
}

function isActive(route: string, to: string) {
  if (to === '/') return route === '/';
  return route === to || route.startsWith(to + '/');
}

export interface Action {
  href: string;
  label: string;
}

export function Landing(props: {
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  primary: Action;
  secondary: Action;
  preview: ReactNode;
  previewLabel?: string;
  meta?: string[];
  compact?: boolean;
  steps: { title: string; body: ReactNode }[];
  features: { title: string; body: ReactNode }[];
  stepsIntro?: ReactNode;
  featuresIntro?: ReactNode;
  note?: ReactNode;
  closing?: { title: ReactNode; action: Action };
}) {
  const meta = props.meta ?? ['Runs in your browser', 'No account', 'Demo data included'];
  return (
    <div className="landing">
      <section className={`hero ${props.compact ? 'is-compact' : ''}`} aria-labelledby="hero-title">
        <div className="hero-inner">
          <div className="stagger">
            <p className="eyebrow" style={{ ['--i' as string]: 0 }}>{props.eyebrow}</p>
            <h1 id="hero-title" style={{ ['--i' as string]: 1 }}>{props.title}</h1>
            <p className="lead" style={{ ['--i' as string]: 2 }}>{props.lead}</p>
            <div className="hero-actions" style={{ ['--i' as string]: 3 }}>
              <a className="btn btn-light btn-lg" href={props.primary.href}>
                {props.primary.label} <span className="arrow" aria-hidden="true">→</span>
              </a>
              <a className="btn btn-outline-light btn-lg" href={props.secondary.href}>{props.secondary.label}</a>
            </div>
            <div className="hero-meta" style={{ ['--i' as string]: 4 }}>
              {meta.map((m) => <span key={m}>{m}</span>)}
            </div>
          </div>
          <div className="hero-preview">
            <div className="preview-frame">
              <div className="preview-bar">
                <span className="live">{props.previewLabel ?? 'Live preview'}</span>
                <span>Demo data</span>
              </div>
              <div className="preview-body">{props.preview}</div>
            </div>
          </div>
        </div>
        <a className="scroll-cue" href="#how" aria-label="Scroll to how it works">
          Scroll <i aria-hidden="true" />
        </a>
      </section>
      <section className="section" id="how" aria-labelledby="how-title">
        <div className="section-inner">
          <div className="section-head" data-reveal>
            <div>
              <p className="eyebrow">01 — How it works</p>
              <h2 id="how-title">Three steps, <em>no setup.</em></h2>
            </div>
            {props.stepsIntro && <p>{props.stepsIntro}</p>}
          </div>
          <ol className="steps">
            {props.steps.map((s, i) => (
              <li key={s.title} data-reveal style={{ ['--i' as string]: i }}>
                <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
                <strong>{s.title}</strong>
                <div className="muted">{s.body}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="section" aria-labelledby="features-title">
        <div className="section-inner">
          <div className="section-head" data-reveal>
            <div>
              <p className="eyebrow">02 — What you can do</p>
              <h2 id="features-title">Built for the <em>real task.</em></h2>
            </div>
            {props.featuresIntro && <p>{props.featuresIntro}</p>}
          </div>
          <div className="features">
            {props.features.map((f, i) => (
              <div className="feature" key={f.title} data-reveal style={{ ['--i' as string]: i }}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
          {props.note && <p className="landing-note" data-reveal>{props.note}</p>}
        </div>
      </section>
      <section className="cta-band" aria-label="Get started">
        <div className="section-inner" data-reveal>
          <h2>{props.closing?.title ?? <>Ready when <em>you are.</em></>}</h2>
          <a className="btn btn-light btn-lg" href={(props.closing?.action ?? props.primary).href}>
            {(props.closing?.action ?? props.primary).label} <span className="arrow" aria-hidden="true">→</span>
          </a>
        </div>
      </section>
    </div>
  );
}

/** Title block for application views. */
export function PageHead(props: { eyebrow: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{props.eyebrow}</p>
        <h1>{props.title}</h1>
        {props.description && <p>{props.description}</p>}
      </div>
      {props.actions && <div className="row">{props.actions}</div>}
    </div>
  );
}

export function DemoTag() {
  return <span className="demo-tag">Demo data</span>;
}

/* ---------- Form field ---------- */
export interface FieldControlProps {
  id: string;
  'aria-invalid': boolean | undefined;
  'aria-describedby': string | undefined;
}

export function Field(props: {
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = props.hint ? `${id}-hint` : undefined;
  const errId = props.error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${props.className ?? ''}`}>
      <label htmlFor={id}>{props.label}</label>
      {props.children({ id, 'aria-invalid': props.error ? true : undefined, 'aria-describedby': describedBy })}
      {props.hint && (
        <span className="hint" id={hintId}>
          {props.hint}
        </span>
      )}
      {props.error && (
        <span className="error-text" id={errId}>
          {props.error}
        </span>
      )}
    </div>
  );
}

/* ---------- Notices ---------- */
export type NoticeKind = 'success' | 'error' | 'info' | 'warn';

export function Notice(props: { kind: NoticeKind; children: ReactNode; onDismiss?: () => void }) {
  return (
    <div className={`notice notice-${props.kind}`} role={props.kind === 'error' ? 'alert' : 'status'}>
      <div>{props.children}</div>
      {props.onDismiss && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={props.onDismiss} aria-label="Dismiss message">
          ✕
        </button>
      )}
    </div>
  );
}

/** A transient message that clears itself after a few seconds. */
export function useFlash(timeout = 4000) {
  const [flash, setFlash] = useState<{ kind: NoticeKind; text: string } | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), timeout);
    return () => clearTimeout(t);
  }, [flash, timeout]);
  return [flash, setFlash] as const;
}

export function EmptyState(props: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{props.title}</h3>
      {props.children && <p>{props.children}</p>}
      {props.actions && <div className="row">{props.actions}</div>}
    </div>
  );
}

export function NotFound() {
  return (
    <EmptyState title="Page not found" actions={<a className="btn btn-primary" href="#/">Go to the start page</a>}>
      That address does not match any page in this app.
    </EmptyState>
  );
}
