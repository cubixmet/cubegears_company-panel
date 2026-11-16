/** Display attendance punch times without exposing raw ISO timestamps.
 * Full ISO strings use the viewer's local timezone (from the timestamp offset);
 * legacy time-only strings are rendered as their recorded workshop wall time.
 * This is display-only: never rewrite the original value sent to correction APIs.
 */
const localTime = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const formatClock = (hour, minute) => {
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isInteger(h) || h < 0 || h > 23 ||
      !Number.isInteger(m) || m < 0 || m > 59) return null;
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export const formatAttendanceTime = (value) => {
  if (value == null || value === '') return '—';
  const raw = String(value).trim();
  if (!raw) return '—';

  // Existing formatted times need no conversion.
  const amPm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (amPm) return `${amPm[1].padStart(2, '0')}:${amPm[2]} ${amPm[3].toUpperCase()}`;

  // The API returns e.g. 2026-11-13T14:07:25.442313+05:30.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : localTime.format(parsed);
  }

  // Legacy API values can be time-only: 14:07 or 14:07:25.
  const onlyTime = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (onlyTime) return formatClock(onlyTime[1], onlyTime[2]) || raw;

  return raw;
};


/** Report-only display model for a punch: local clock plus local calendar date.
 * ISO timestamps are converted together, so overnight punches never show an
 * incorrect date. Legacy time-only values use the report row's date unchanged.
 * Persisted values and CSV exports are not modified.
 */
const attendanceDate = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const formatAttendanceDateTimeParts = (value, fallbackDate = '') => {
  const time = formatAttendanceTime(value);
  if (time === '—' || time === 'Missing') return { time, date: '' };

  const raw = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return { time, date: attendanceDate.format(parsed) };
    }
  }

  const dayText = String(fallbackDate ?? '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayText)) {
    const [year, month, day] = dayText.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day) {
      return { time, date: attendanceDate.format(parsed) };
    }
  }

  return { time, date: '' };
};
