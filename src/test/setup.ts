import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Newer Node versions ship their own (disabled) localStorage global that hides jsdom's.
// Provide a small in-memory Storage so tests behave like a browser.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}
for (const name of ['localStorage', 'sessionStorage'] as const) {
  let ok = false;
  try {
    ok = typeof window[name]?.getItem === 'function';
  } catch {
    ok = false;
  }
  if (!ok) Object.defineProperty(window, name, { value: new MemoryStorage(), configurable: true });
}

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
});
afterEach(() => cleanup());
