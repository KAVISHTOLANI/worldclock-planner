import { useEffect, useMemo, useRef, useState } from 'react';
import { copyText, DemoTag, EmptyState, Field, Landing, NotFound, Notice, Shell, uid, useFlash, usePersistentState, useRoute } from './shared/ui';
import {
  bestSlots,
  CITIES,
  evaluateMeeting,
  findCity,
  formatOffset,
  localParts,
  minutesToLabel,
  searchCities,
  verdict,
  zonedMidnight,
  type City,
  type CityResult,
  type WorkHours,
} from './lib/tz';

const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/planner', label: 'Planner' },
  { to: '/saved', label: 'Saved meetings' },
];
const MAX_CITIES = 8;
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface SavedMeeting {
  id: string;
  title: string;
  date: string;
  start: number;
  duration: number;
  cityIds: string[];
}

export default function App() {
  const [route] = useRoute();
  const [cityIds, setCityIds] = usePersistentState<string[]>('worldclock:cities', ['london', 'new-york', 'bengaluru', 'singapore']);
  const [date, setDate] = usePersistentState('worldclock:date', todayISO());
  const [start, setStart] = usePersistentState('worldclock:start', 14 * 60);
  const [duration, setDuration] = usePersistentState('worldclock:duration', 60);
  const [hours, setHours] = usePersistentState<WorkHours>('worldclock:hours', { start: 9 * 60, end: 17 * 60 });
  const [saved, setSaved] = usePersistentState<SavedMeeting[]>('worldclock:saved', () => [
    { id: 'demo-m1', title: 'Demo: Weekly product sync', date: todayISO(), start: 12 * 60, duration: 60, cityIds: ['london', 'new-york', 'bengaluru', 'singapore'] },
    { id: 'demo-m2', title: 'Demo: Design review (Europe only)', date: todayISO(), start: 10 * 60, duration: 45, cityIds: ['london', 'berlin', 'lisbon'] },
    { id: 'demo-m3', title: 'Demo: All-hands — Auckland to San Francisco', date: todayISO(), start: 20 * 60, duration: 90, cityIds: ['san-francisco', 'new-york', 'london', 'auckland'] },
  ]);
  const cities = cityIds.map((id) => CITIES.find((c) => c.id === id)).filter((c): c is City => !!c);

  let page;
  if (route === '/') page = <Home />;
  else if (route === '/planner')
    page = (
      <Planner
        {...{ cities, setCityIds, date, setDate, start, setStart, duration, setDuration, hours, setHours }}
        onSave={(title) => setSaved([{ id: uid('m'), title, date, start, duration, cityIds }, ...saved])}
      />
    );
  else if (route === '/saved')
    page = (
      <Saved
        saved={saved}
        hours={hours}
        onDelete={(id) => setSaved(saved.filter((m) => m.id !== id))}
        onOpen={(m) => {
          setCityIds(m.cityIds);
          setDate(m.date);
          setStart(m.start);
          setDuration(m.duration);
          window.location.hash = '/planner';
        }}
      />
    );
  else page = <NotFound />;
  return (
    <Shell name="WorldClock Planner" wordmark={['WorldClock', 'Planner']} nav={NAV} route={route} cta={{ to: '/planner', label: 'Plan a meeting' }} footerNote="Time zone rules come from your browser’s built-in database.">
      {page}
    </Shell>
  );
}

function HeroBands() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const ids = ['london', 'new-york', 'bengaluru', 'singapore', 'auckland'];
  const cities = ids.map((id) => CITIES.find((c) => c.id === id)!);
  const hours = { start: 9 * 60, end: 17 * 60 };
  const ref = cities[0];
  const refParts = localParts(ref.zone, now);
  const base = zonedMidnight(refParts.dateISO, ref.zone);
  const nowPct = ((now - base) / 86_400_000) * 100;
  return (
    <div className="hero-bands">
      <div className="hb-scale" aria-hidden="true">
        {[0, 6, 12, 18, 24].map((h) => <span key={h} style={{ left: `${(h / 24) * 100}%` }}>{String(h % 24).padStart(2, '0')}</span>)}
      </div>
      {cities.map((c, row) => {
        const p = localParts(c.zone, now);
        return (
          <div key={c.id} className="hb-row" style={{ ['--i' as string]: row }}>
            <div className="hb-label">
              <strong>{c.name}</strong>
              <span>{String(p.hour).padStart(2, '0')}:{String(p.minute).padStart(2, '0')} · {formatOffset(offsetMinutesAt(c.zone, now))}</span>
            </div>
            <div className="hb-track">
              {Array.from({ length: 24 }, (_, h) => {
                const lp = localParts(c.zone, base + h * 3_600_000);
                const m = lp.hour * 60 + lp.minute;
                const cls = m >= hours.start && m < hours.end ? 'work' : m >= hours.start - 120 && m < hours.end + 240 ? 'edge' : 'night';
                return <i key={h} className={cls} />;
              })}
            </div>
          </div>
        );
      })}
      <div className="hb-now" style={{ left: `calc(var(--label-w) + (100% - var(--label-w)) * ${nowPct / 100})` }} aria-hidden="true"><span>Now</span></div>
      <div className="legend small hb-legend">
        <span><i className="work" />Working hours</span>
        <span><i className="edge" />Early / late</span>
        <span><i className="night" />Night</span>
      </div>
    </div>
  );
}

function Home() {
  return (
    <Landing
      eyebrow="Meeting planner · time zones"
      title={<>Find the hour that’s <em>fair to everyone.</em></>}
      lead="Add the cities your team works from, drag the proposed meeting along a 24-hour timeline, and see instantly whether it lands in working hours, early or late, or in the middle of someone’s night."
      primary={{ href: '#/planner', label: 'Plan a meeting' }}
      secondary={{ href: '#/saved', label: 'View saved meetings' }}
      previewLabel={`Right now, in ${'London'} time`}
      preview={<HeroBands />}
      steps={[
        { title: 'Add cities', body: 'Search 43 cities. The first city is the reference for the timeline.' },
        { title: 'Drag the meeting', body: 'Move the block along the timeline, or use the arrow keys for 15-minute steps.' },
        { title: 'Check the verdict', body: 'Every city shows its local time and whether it is in hours, early/late or overnight.' },
      ]}
      stepsIntro="The planner opens with a four-city demo team, so the timeline is populated from the first visit."
      features={[
        { title: 'Correct daylight saving', body: 'Uses the browser’s time zone database, so offsets match the chosen date.' },
        { title: 'Best-time suggestions', body: 'Finds the three start times with the fewest out-of-hours attendees.' },
        { title: 'Weekend and next-day flags', body: 'Shows when the meeting falls on another calendar day or a weekend locally.' },
        { title: 'Copyable summary', body: 'One click copies the meeting time in every city for an invite.' },
      ]}
      note="Working hours apply to all cities (default 09:00–17:00). Public holidays are not considered."
      closing={{ title: <>Plan your next <em>cross-time-zone call.</em></>, action: { href: '#/planner', label: 'Open the planner' } }}
    />
  );
}

function offsetMinutesAt(zone: string, at: number) {
  const p = localParts(zone, at);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(at / 60_000) * 60_000) / 60_000);
}

function Planner(props: {
  cities: City[];
  setCityIds: (ids: string[]) => void;
  date: string;
  setDate: (d: string) => void;
  start: number;
  setStart: (m: number) => void;
  duration: number;
  setDuration: (m: number) => void;
  hours: WorkHours;
  setHours: (h: WorkHours) => void;
  onSave: (title: string) => void;
}) {
  const { cities, setCityIds, date, setDate, start, setStart, duration, setDuration, hours, setHours } = props;
  const [query, setQuery] = useState('');
  const [cityError, setCityError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const ids = cities.map((c) => c.id);
  const suggestions = query ? searchCities(query, ids) : [];
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const results = useMemo(() => (dateValid ? evaluateMeeting(cities, date, start, duration, hours) : []), [cities, date, start, duration, hours, dateValid]);
  const v = verdict(results);
  const best = useMemo(() => (cities.length && dateValid ? bestSlots(cities, date, duration, hours) : []), [cities, date, duration, hours, dateValid]);

  function addCity(c: City | undefined) {
    if (!c) return setCityError(`No city called “${query.trim()}” in the list. Try a nearby major city.`);
    if (ids.includes(c.id)) return setCityError(`${c.name} is already on the timeline.`);
    if (ids.length >= MAX_CITIES) return setCityError(`Up to ${MAX_CITIES} cities keeps the timeline readable.`);
    setCityIds([...ids, c.id]);
    setQuery('');
    setCityError(null);
  }
  const loadDemo = () => setCityIds(['london', 'new-york', 'bengaluru', 'singapore']);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setTitleError('Give the meeting a name.');
    props.onSave(title.trim());
    setTitle('');
    setTitleError(null);
    setFlash({ kind: 'success', text: `Saved “${title.trim()}”.` });
  }
  async function copy() {
    const text = results.map((r) => `${r.city.name}: ${r.weekday} ${r.startLabel}–${r.endLabel}${r.dayShift ? ` (${r.dayShift > 0 ? '+' : ''}${r.dayShift} day)` : ''}`).join('\n');
    setFlash((await copyText(text)) ? { kind: 'success', text: 'Meeting times copied to the clipboard.' } : { kind: 'error', text: 'Your browser blocked clipboard access.' });
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="eyebrow">Workspace · Planner</p>
          <h1>Meeting <em>planner</em></h1>
          <p>{cities.length ? `Timeline in ${cities[0].name} time (${formatOffset(results[0]?.offset ?? 0)}).` : 'Add the cities attending.'}</p>
        </div>
      </div>
      <div className="card controls">
        <div className="city-add">
          <Field label="Add a city" error={cityError} hint={`${cities.length}/${MAX_CITIES} cities`}>
            {(c) => (
              <input
                type="search"
                {...c}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCityError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCity(findCity(query) ?? (suggestions.length === 1 ? suggestions[0] : undefined));
                  }
                }}
                placeholder="e.g. Tokyo"
                autoComplete="off"
              />
            )}
          </Field>
          {suggestions.length > 0 && (
            <ul className="suggest" aria-label="Matching cities">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => addCity(s)}>
                    {s.name} <span className="muted">{s.country}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Field label="Date" error={dateValid ? null : 'Choose a date.'}>{(c) => <input type="date" {...c} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Duration">
          {(c) => (
            <select {...c} value={duration} onChange={(e) => setDuration(Math.min(Number(e.target.value), 1440 - start) || Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} h`}</option>)}
            </select>
          )}
        </Field>
        <HoursEditor hours={hours} setHours={setHours} />
      </div>

      {cities.length === 0 ? (
        <EmptyState title="No cities yet" actions={<button type="button" className="btn btn-primary" onClick={loadDemo}>Load demo team (4 cities)</button>}>
          Search for a city above. The first one you add becomes the reference for the timeline.
        </EmptyState>
      ) : (
        <>
          <Notice kind={v.tone === 'ok' ? 'success' : v.tone === 'warn' ? 'warn' : 'error'}>
            <strong data-testid="verdict">{v.text}</strong>
          </Notice>
          <Timeline cities={cities} results={results} date={date} start={start} setStart={setStart} duration={duration} hours={hours} onRemove={(id) => setCityIds(ids.filter((x) => x !== id))} onMakeRef={(id) => setCityIds([id, ...ids.filter((x) => x !== id)])} />
          <div className="grid-2">
            <div className="card stack">
              <h2>Suggested start times</h2>
              <p className="hint">Ranked by fewest people outside working hours, in {cities[0].name} time.</p>
              <div className="row">
                {best.map((b) => (
                  <button key={b.start} type="button" className={`btn ${b.start === start ? 'btn-primary' : ''}`} onClick={() => setStart(b.start)}>
                    {minutesToLabel(b.start)}
                  </button>
                ))}
              </div>
            </div>
            <form className="card stack" onSubmit={save} noValidate>
              <h2>Save or share</h2>
              <Field label="Meeting name" error={titleError}>{(c) => <input type="text" {...c} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly product sync" />}</Field>
              <div className="row">
                <button type="submit" className="btn btn-primary">Save meeting</button>
                <button type="button" className="btn" onClick={copy}>Copy times</button>
              </div>
              {flash && <Notice kind={flash.kind}>{flash.text}</Notice>}
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function HoursEditor({ hours, setHours }: { hours: WorkHours; setHours: (h: WorkHours) => void }) {
  const [s, setS] = useState(minutesToLabel(hours.start));
  const [e, setE] = useState(minutesToLabel(hours.end));
  const toMin = (v: string) => {
    const m = /^(\d{2}):(\d{2})$/.exec(v);
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  };
  const error = !(toMin(s) < toMin(e)) ? 'Working day must end after it starts.' : null;
  const apply = (ns: string, ne: string) => {
    if (toMin(ns) < toMin(ne)) setHours({ start: toMin(ns), end: toMin(ne) });
  };
  return (
    <fieldset className="hours">
      <legend className="label">Working hours (all cities)</legend>
      <div className="row">
        <input type="time" aria-label="Working day starts" value={s} onChange={(ev) => { setS(ev.target.value); apply(ev.target.value, e); }} aria-invalid={!!error || undefined} />
        <span>to</span>
        <input type="time" aria-label="Working day ends" value={e} onChange={(ev) => { setE(ev.target.value); apply(s, ev.target.value); }} aria-invalid={!!error || undefined} />
      </div>
      {error && <span className="error-text">{error}</span>}
    </fieldset>
  );
}

function Timeline(props: {
  cities: City[];
  results: CityResult[];
  date: string;
  start: number;
  setStart: (m: number) => void;
  duration: number;
  hours: WorkHours;
  onRemove: (id: string) => void;
  onMakeRef: (id: string) => void;
}) {
  const { cities, results, date, start, setStart, duration, hours } = props;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const base = zonedMidnight(date, cities[0].zone);
  const maxStart = 1440 - duration;
  const clamp = (m: number) => Math.max(0, Math.min(maxStart, Math.round(m / 15) * 15));

  const fromPointer = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return clamp(((clientX - r.left) / r.width) * 1440 - duration / 2);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 60 : 15;
    const map: Record<string, number> = { ArrowLeft: start - step, ArrowRight: start + step, Home: 0, End: maxStart, PageUp: start - 60, PageDown: start + 60 };
    if (e.key in map) {
      e.preventDefault();
      setStart(clamp(map[e.key]));
    }
  };

  return (
    <div className="card timeline-card">
      <div className="timeline">
        <div className="tl-labels">
          {results.map((r, i) => (
            <div key={r.city.id} className="tl-label">
              <div>
                <strong>{r.city.name}</strong> {i === 0 && <span className="badge badge-accent">Reference</span>}
              </div>
              <div className="hint">
                {formatOffset(r.offset)} · {r.weekday} {r.startLabel}–{r.endLabel}
                {r.dayShift !== 0 && <> ({r.dayShift > 0 ? 'next day' : 'previous day'})</>}
              </div>
              <div className="row tl-actions">
                <span className={`badge ${r.fit === 'work' ? 'badge-ok' : r.fit === 'edge' ? 'badge-warn' : 'badge-err'}`}>
                  {r.fit === 'work' ? 'In hours' : r.fit === 'edge' ? 'Early/late' : 'Overnight'}
                </span>
                {r.weekend && <span className="badge badge-warn">Weekend</span>}
                {i !== 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => props.onMakeRef(r.city.id)} aria-label={`Use ${r.city.name} as reference`}>Set as reference</button>}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => props.onRemove(r.city.id)} aria-label={`Remove ${r.city.name}`}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        <div className="tl-scroll">
          <div
            className="tl-tracks"
            ref={trackRef}
            onPointerDown={(e) => {
              dragging.current = true;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              setStart(fromPointer(e.clientX));
            }}
            onPointerMove={(e) => dragging.current && setStart(fromPointer(e.clientX))}
            onPointerUp={() => (dragging.current = false)}
            onPointerCancel={() => (dragging.current = false)}
          >
            {cities.map((c) => (
              <div key={c.id} className="tl-row" aria-hidden="true">
                <span className="tl-row-name">{c.name}</span>
                {Array.from({ length: 24 }, (_, h) => {
                  const p = localParts(c.zone, base + h * 3_600_000);
                  const m = p.hour * 60 + p.minute;
                  const cls = m >= hours.start && m < hours.end ? 'work' : m >= hours.start - 120 && m < hours.end + 240 ? 'edge' : 'night';
                  return (
                    <div key={h} className={`tl-cell ${cls}`} title={`${c.name} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`}>
                      {p.minute === 0 ? p.hour : `${p.hour}½`}
                    </div>
                  );
                })}
              </div>
            ))}
            <div
              className="tl-meeting"
              role="slider"
              tabIndex={0}
              aria-label="Proposed meeting start time"
              aria-valuemin={0}
              aria-valuemax={maxStart}
              aria-valuenow={start}
              aria-valuetext={`${minutesToLabel(start)} in ${cities[0].name}`}
              onKeyDown={onKey}
              style={{ left: `${(start / 1440) * 100}%`, width: `${(duration / 1440) * 100}%` }}
            >
              <span>{minutesToLabel(start)}</span>
            </div>
          </div>
        </div>
      </div>
      <ul className="list tl-mobile-list" aria-label="Local times">
        {results.map((r) => (
          <li key={r.city.id} className="row row-between">
            <span>
              <strong>{r.city.name}</strong> {r.weekday} {r.startLabel}–{r.endLabel}
            </span>
            <span className="row">
              <span className={`badge ${r.fit === 'work' ? 'badge-ok' : r.fit === 'edge' ? 'badge-warn' : 'badge-err'}`}>{r.fit === 'work' ? 'In hours' : r.fit === 'edge' ? 'Early/late' : 'Overnight'}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => props.onRemove(r.city.id)} aria-label={`Remove ${r.city.name} (mobile)`}>✕</button>
            </span>
          </li>
        ))}
      </ul>
      <div className="legend small">
        <span><i className="work" /> Working hours</span>
        <span><i className="edge" /> Early / late</span>
        <span><i className="night" /> Night</span>
        <span className="muted">Drag the blue block, or focus it and use ← → (Shift for 1 h).</span>
      </div>
    </div>
  );
}

function Saved({ saved, hours, onDelete, onOpen }: { saved: SavedMeeting[]; hours: WorkHours; onDelete: (id: string) => void; onOpen: (m: SavedMeeting) => void }) {
  if (saved.length === 0)
    return (
      <EmptyState title="No saved meetings" actions={<a className="btn btn-primary" href="#/planner">Plan a meeting</a>}>
        Save a meeting from the planner to keep its cities and time here.
      </EmptyState>
    );
  return (
    <div className="stack">
      <div className="page-head"><div><p className="eyebrow">Workspace · Saved</p><h1>Saved <em>meetings</em></h1><p>Reopen a meeting to adjust it. Verdicts use today’s working-hours setting.</p></div></div>
      <div className="saved-grid">
        {saved.map((m) => {
          const cs = m.cityIds.map((id) => CITIES.find((c) => c.id === id)!).filter(Boolean);
          const r = evaluateMeeting(cs, m.date, m.start, m.duration, hours);
          const v = verdict(r);
          return (
            <article key={m.id} className="card stack">
              <div className="row row-between">
                <h3>{m.title.replace('Demo: ', '')} {m.id.startsWith('demo') && <DemoTag />}</h3>
                <span className={`badge ${v.tone === 'ok' ? 'badge-ok' : v.tone === 'warn' ? 'badge-warn' : 'badge-err'}`}>{v.tone === 'ok' ? 'Fair' : v.tone === 'warn' ? 'Workable' : 'Unreasonable'}</span>
              </div>
              <ul className="list small">
                {r.map((x) => <li key={x.city.id}><strong>{x.city.name}</strong> — {x.weekday} {x.startLabel}–{x.endLabel}</li>)}
              </ul>
              <div className="row">
                <button type="button" className="btn btn-sm" onClick={() => onOpen(m)}>Open in planner</button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(m.id)} aria-label={`Delete ${m.title.replace('Demo: ', '')}`}>Delete</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
