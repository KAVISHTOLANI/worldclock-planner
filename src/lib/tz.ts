export interface City {
  id: string;
  name: string;
  country: string;
  zone: string;
}

export const CITIES: City[] = [
  ['San Francisco', 'United States', 'America/Los_Angeles'],
  ['Vancouver', 'Canada', 'America/Vancouver'],
  ['Denver', 'United States', 'America/Denver'],
  ['Mexico City', 'Mexico', 'America/Mexico_City'],
  ['Chicago', 'United States', 'America/Chicago'],
  ['New York', 'United States', 'America/New_York'],
  ['Toronto', 'Canada', 'America/Toronto'],
  ['Bogotá', 'Colombia', 'America/Bogota'],
  ['São Paulo', 'Brazil', 'America/Sao_Paulo'],
  ['Buenos Aires', 'Argentina', 'America/Argentina/Buenos_Aires'],
  ['Reykjavík', 'Iceland', 'Atlantic/Reykjavik'],
  ['London', 'United Kingdom', 'Europe/London'],
  ['Dublin', 'Ireland', 'Europe/Dublin'],
  ['Lisbon', 'Portugal', 'Europe/Lisbon'],
  ['Paris', 'France', 'Europe/Paris'],
  ['Berlin', 'Germany', 'Europe/Berlin'],
  ['Madrid', 'Spain', 'Europe/Madrid'],
  ['Amsterdam', 'Netherlands', 'Europe/Amsterdam'],
  ['Stockholm', 'Sweden', 'Europe/Stockholm'],
  ['Lagos', 'Nigeria', 'Africa/Lagos'],
  ['Cairo', 'Egypt', 'Africa/Cairo'],
  ['Johannesburg', 'South Africa', 'Africa/Johannesburg'],
  ['Nairobi', 'Kenya', 'Africa/Nairobi'],
  ['Istanbul', 'Türkiye', 'Europe/Istanbul'],
  ['Moscow', 'Russia', 'Europe/Moscow'],
  ['Dubai', 'United Arab Emirates', 'Asia/Dubai'],
  ['Karachi', 'Pakistan', 'Asia/Karachi'],
  ['Mumbai', 'India', 'Asia/Kolkata'],
  ['Bengaluru', 'India', 'Asia/Kolkata'],
  ['Kathmandu', 'Nepal', 'Asia/Kathmandu'],
  ['Dhaka', 'Bangladesh', 'Asia/Dhaka'],
  ['Bangkok', 'Thailand', 'Asia/Bangkok'],
  ['Jakarta', 'Indonesia', 'Asia/Jakarta'],
  ['Singapore', 'Singapore', 'Asia/Singapore'],
  ['Hong Kong', 'China', 'Asia/Hong_Kong'],
  ['Shanghai', 'China', 'Asia/Shanghai'],
  ['Manila', 'Philippines', 'Asia/Manila'],
  ['Seoul', 'South Korea', 'Asia/Seoul'],
  ['Tokyo', 'Japan', 'Asia/Tokyo'],
  ['Sydney', 'Australia', 'Australia/Sydney'],
  ['Melbourne', 'Australia', 'Australia/Melbourne'],
  ['Auckland', 'New Zealand', 'Pacific/Auckland'],
  ['Honolulu', 'United States', 'Pacific/Honolulu'],
].map(([name, country, zone]) => ({ id: name.toLowerCase().replace(/[^a-z]+/g, '-'), name, country, zone }));

export function findCity(query: string): City | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return CITIES.find((c) => c.name.toLowerCase() === q || `${c.name}, ${c.country}`.toLowerCase() === q);
}

export function searchCities(query: string, exclude: string[] = []): City[] {
  const q = query.trim().toLowerCase();
  return CITIES.filter((c) => !exclude.includes(c.id) && (!q || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))).slice(0, 8);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(zone: string) {
  let f = fmtCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    fmtCache.set(zone, f);
  }
  return f;
}

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
  dateISO: string;
}

export function localParts(zone: string, utcMs: number): LocalParts {
  const parts = Object.fromEntries(fmt(zone).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
  return {
    year,
    month,
    day,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: parts.weekday,
    dateISO: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Offset from UTC in minutes for a zone at an instant (e.g. +330 for India). */
export function offsetMinutes(zone: string, utcMs: number): number {
  const p = localParts(zone, utcMs);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  return Math.round((asUTC - Math.floor(utcMs / 60_000) * 60_000) / 60_000);
}

export function formatOffset(mins: number): string {
  const sign = mins >= 0 ? '+' : '−';
  const a = Math.abs(mins);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''}`;
}

/** UTC instant of local midnight on `dateISO` in `zone`. */
export function zonedMidnight(dateISO: string, zone: string): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - offsetMinutes(zone, guess) * 60_000;
  t = guess - offsetMinutes(zone, t) * 60_000; // second pass handles DST changes
  return t;
}

export interface WorkHours {
  start: number; // minutes from midnight
  end: number;
}

export type Fit = 'work' | 'edge' | 'night';

/** Classifies a local time range. Edge = up to 2h before start or 4h after end. */
export function classify(startMin: number, endMin: number, hours: WorkHours): Fit {
  const s = ((startMin % 1440) + 1440) % 1440;
  const e = s + (endMin - startMin);
  if (s >= hours.start && e <= hours.end) return 'work';
  if (s >= hours.start - 120 && e <= hours.end + 240) return 'edge';
  return 'night';
}

export interface CityResult {
  city: City;
  startLabel: string;
  endLabel: string;
  weekday: string;
  dayShift: number; // relative to the reference city's date
  fit: Fit;
  weekend: boolean;
  offset: number;
}

const two = (n: number) => String(n).padStart(2, '0');

export function evaluateMeeting(cities: City[], dateISO: string, startMin: number, duration: number, hours: WorkHours): CityResult[] {
  if (cities.length === 0) return [];
  const base = zonedMidnight(dateISO, cities[0].zone);
  const startUtc = base + startMin * 60_000;
  const endUtc = startUtc + duration * 60_000;
  return cities.map((city) => {
    const s = localParts(city.zone, startUtc);
    const e = localParts(city.zone, endUtc);
    const localStart = s.hour * 60 + s.minute;
    const dayShift = Math.round((Date.UTC(s.year, s.month - 1, s.day) - Date.parse(dateISO + 'T00:00:00Z')) / 86_400_000);
    return {
      city,
      startLabel: `${two(s.hour)}:${two(s.minute)}`,
      endLabel: `${two(e.hour)}:${two(e.minute)}`,
      weekday: s.weekday,
      dayShift,
      fit: classify(localStart, localStart + duration, hours),
      weekend: s.weekday === 'Sat' || s.weekday === 'Sun',
      offset: offsetMinutes(city.zone, startUtc),
    };
  });
}

export function verdict(results: CityResult[]): { tone: 'ok' | 'warn' | 'err'; text: string } {
  if (results.length === 0) return { tone: 'warn', text: 'Add at least one city.' };
  const night = results.filter((r) => r.fit === 'night');
  const edge = results.filter((r) => r.fit === 'edge');
  const weekend = results.filter((r) => r.weekend);
  const names = (rs: CityResult[]) => rs.map((r) => r.city.name).join(', ');
  if (night.length) return { tone: 'err', text: `Unreasonable: outside sensible hours for ${names(night)}.` };
  if (edge.length || weekend.length) {
    const bits = [];
    if (edge.length) bits.push(`early or late for ${names(edge)}`);
    if (weekend.length) bits.push(`on the weekend for ${names(weekend)}`);
    return { tone: 'warn', text: `Workable, but ${bits.join(' and ')}.` };
  }
  return { tone: 'ok', text: 'Works for everyone: inside working hours in every city.' };
}

function score(results: CityResult[]): number {
  return results.reduce((n, r) => n + (r.fit === 'work' ? 0 : r.fit === 'edge' ? 1 : 10) + (r.weekend ? 3 : 0), 0);
}

/** Best start times (in 30-minute steps across the reference day), lowest penalty first. */
export function bestSlots(cities: City[], dateISO: string, duration: number, hours: WorkHours, count = 3) {
  const slots = [];
  for (let m = 0; m + duration <= 1440; m += 30) {
    const r = evaluateMeeting(cities, dateISO, m, duration, hours);
    slots.push({ start: m, score: score(r) });
  }
  slots.sort((a, b) => a.score - b.score || Math.abs(a.start - 660) - Math.abs(b.start - 660));
  return slots.slice(0, count);
}

export function minutesToLabel(m: number): string {
  return `${two(Math.floor(m / 60) % 24)}:${two(m % 60)}`;
}
