import { useEffect, useId, useState, type ReactNode } from 'react';

/* ---------- Hash routing ---------- */
function readHash(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h === '' ? '/' : h;
}

export function useRoute(): [string, (to: string) => void] {
  const [route, setRoute] = useState(readHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(readHash());
      window.scrollTo?.(0, 0);
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

export function Shell(props: {
  name: string;
  mark: string;
  nav: NavItem[];
  route: string;
  children: ReactNode;
  footerNote?: ReactNode;
}) {
  const { name, mark, nav, route, children, footerNote } = props;
  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <header className="shell-header">
        <div className="shell-header-inner">
          <a className="brand" href="#/">
            <span className="brand-mark" aria-hidden="true">{mark}</span>
            {name}
          </a>
          <nav className="shell-nav" aria-label="Main">
            {nav.map((item) => (
              <a key={item.to} href={`#${item.to}`} aria-current={isActive(route, item.to) ? 'page' : undefined}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" className="shell-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="shell-footer">
        <div className="shell-footer-inner">
          <span>{name} — runs entirely in your browser.</span>
          <span>{footerNote ?? 'Your data is stored locally on this device only.'}</span>
        </div>
      </footer>
    </>
  );
}

function isActive(route: string, to: string) {
  if (to === '/') return route === '/';
  return route === to || route.startsWith(to + '/');
}

export function Landing(props: {
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  actions: ReactNode;
  preview?: ReactNode;
  steps: { title: string; body: ReactNode }[];
  features: { title: string; body: ReactNode }[];
  note?: ReactNode;
}) {
  return (
    <div className="landing">
      <section className="landing-hero">
        <div>
          <p className="eyebrow">{props.eyebrow}</p>
          <h1>{props.title}</h1>
          <p className="lead">{props.lead}</p>
          <div className="landing-actions">{props.actions}</div>
        </div>
        {props.preview && <div className="landing-preview">{props.preview}</div>}
      </section>
      <section className="landing-section" aria-labelledby="how-title">
        <h2 id="how-title">How it works</h2>
        <ol className="steps">
          {props.steps.map((s) => (
            <li key={s.title}>
              <strong>{s.title}</strong>
              <div className="muted">{s.body}</div>
            </li>
          ))}
        </ol>
      </section>
      <section className="landing-section" aria-labelledby="features-title">
        <h2 id="features-title">What you can do</h2>
        <div className="features">
          {props.features.map((f) => (
            <div className="feature" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>
      {props.note && (
        <section className="landing-section">
          <div className="landing-note">{props.note}</div>
        </section>
      )}
    </div>
  );
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
