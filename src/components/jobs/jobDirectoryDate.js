// Display-only date formatting for the Job Card directory.
// Do not change API values, sorting or filtering, which use original timestamps.
const dateOnlyFormat = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

const dateTimeFormat = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
});

export const formatJobDirectoryDate = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  // Date-only records should not move by a day in another local timezone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00+05:30`);
    return Number.isNaN(date.getTime()) ? raw : dateOnlyFormat.format(date);
  }
  // UTC and explicitly offset ISO timestamps use the workshop's India timezone.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)
      ? raw : `${raw}Z`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? raw : dateTimeFormat.format(parsed);
  }
  return raw;
};
