import { describe, expect, it } from 'vitest';
import { bestSlots, CITIES, classify, evaluateMeeting, findCity, formatOffset, offsetMinutes, verdict, zonedMidnight } from './tz';

const city = (name: string) => CITIES.find((c) => c.name === name)!;
const H = { start: 9 * 60, end: 17 * 60 };

describe('offsets', () => {
  it('handles fixed, half-hour and DST zones', () => {
    expect(offsetMinutes('Asia/Kolkata', Date.UTC(2026, 0, 15))).toBe(330);
    expect(offsetMinutes('Asia/Kathmandu', Date.UTC(2026, 0, 15))).toBe(345);
    expect(offsetMinutes('Europe/London', Date.UTC(2026, 0, 15))).toBe(0);
    expect(offsetMinutes('Europe/London', Date.UTC(2026, 6, 15))).toBe(60);
    expect(offsetMinutes('America/New_York', Date.UTC(2026, 0, 15))).toBe(-300);
    expect(formatOffset(330)).toBe('UTC+5:30');
    expect(formatOffset(-300)).toBe('UTC−5');
  });
  it('finds local midnight as a UTC instant', () => {
    expect(zonedMidnight('2026-01-15', 'America/New_York')).toBe(Date.UTC(2026, 0, 15, 5));
    expect(zonedMidnight('2026-07-15', 'Europe/London')).toBe(Date.UTC(2026, 6, 14, 23));
  });
});

describe('meeting evaluation', () => {
  it('classifies local time ranges', () => {
    expect(classify(600, 660, H)).toBe('work');
    expect(classify(480, 540, H)).toBe('edge');
    expect(classify(1080, 1140, H)).toBe('edge');
    expect(classify(120, 180, H)).toBe('night');
  });
  it('converts a London 14:00 meeting for New York and Tokyo', () => {
    // Wed 14 Jan 2026
    const r = evaluateMeeting([city('London'), city('New York'), city('Tokyo')], '2026-01-14', 14 * 60, 60, H);
    expect(r.map((x) => x.startLabel)).toEqual(['14:00', '09:00', '23:00']);
    expect(r[2].dayShift).toBe(0);
    expect(r.map((x) => x.fit)).toEqual(['work', 'work', 'night']);
    expect(verdict(r).tone).toBe('err');
    expect(verdict(r).text).toContain('Tokyo');
  });
  it('flags the next day and weekends', () => {
    const r = evaluateMeeting([city('San Francisco'), city('Sydney')], '2026-01-16', 16 * 60, 30, H); // Fri in SF
    expect(r[1].dayShift).toBe(1);
    expect(r[1].weekend).toBe(true);
  });
  it('suggests slots that work for two European cities', () => {
    const best = bestSlots([city('London'), city('Berlin')], '2026-01-14', 60, H);
    const r = evaluateMeeting([city('London'), city('Berlin')], '2026-01-14', best[0].start, 60, H);
    expect(verdict(r).tone).toBe('ok');
  });
  it('looks up cities by name', () => {
    expect(findCity('tokyo')?.zone).toBe('Asia/Tokyo');
    expect(findCity('Atlantis')).toBeUndefined();
  });
});
