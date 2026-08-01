/**
 * Time helpers: parsing "1d 2h 30m" strings and formatting milliseconds.
 */

const UNITS = [
  ['w', 7 * 24 * 60 * 60 * 1000],
  ['d', 24 * 60 * 60 * 1000],
  ['h', 60 * 60 * 1000],
  ['m', 60 * 1000],
  ['s', 1000],
];

const UNIT_MAP = {
  w: 'weeks',
  wk: 'weeks',
  week: 'weeks',
  weeks: 'weeks',
  d: 'days',
  day: 'days',
  days: 'days',
  h: 'hours',
  hr: 'hours',
  hrs: 'hours',
  hour: 'hours',
  hours: 'hours',
  m: 'minutes',
  min: 'minutes',
  mins: 'minutes',
  minute: 'minutes',
  minutes: 'minutes',
  s: 'seconds',
  sec: 'seconds',
  secs: 'seconds',
  second: 'seconds',
  seconds: 'seconds',
};

/**
 * Parse a human duration like "2d 5h 30m" into milliseconds.
 * Returns null when nothing parseable is found.
 * @param {string} input
 * @returns {number|null}
 */
function parseDuration(input) {
  if (!input) return null;
  const regex = /(\d+)\s*(w|wk|week|weeks|d|day|days|h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/gi;
  let total = 0;
  let matched = false;
  let match;
  while ((match = regex.exec(input)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = UNIT_MAP[match[2].toLowerCase()];
    if (!unit || !isFinite(value) || value < 0) continue;
    total += value * UNIT_MS(unit);
    matched = true;
  }
  return matched ? total : null;
}

function UNIT_MS(unit) {
  return UNITS.find(([k]) => k === unit[0])?.[1] ?? 1000;
}

/** Format a millisecond duration into "1d 2h 30m 5s". */
function formatDuration(ms) {
  if (!isFinite(ms) || ms < 0) return '0s';
  let rest = Math.floor(ms);
  const parts = [];
  for (const [unit, value] of UNITS) {
    const count = Math.floor(rest / value);
    if (count > 0) {
      parts.push(`${count}${unit}`);
      rest -= count * value;
    }
  }
  return parts.length ? parts.join(' ') : '0s';
}

/** Format a Date into a Discord-friendly string. */
function formatDate(date, withTime = true) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return withTime
    ? d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : d.toLocaleDateString('en-US', { dateStyle: 'medium' });
}

/** Relative Discord timestamp (<t:1234567890:R>). */
function relativeTimestamp(date) {
  const d = new Date(date);
  return isNaN(d.getTime()) ? 'N/A' : `<t:${Math.floor(d.getTime() / 1000)}:R>`;
}

function timestamp(date, style = 'F') {
  const d = new Date(date);
  return isNaN(d.getTime()) ? 'N/A' : `<t:${Math.floor(d.getTime() / 1000)}:${style}>`;
}

module.exports = { parseDuration, formatDuration, formatDate, relativeTimestamp, timestamp };
