/** Overtime duration uses exact integer minutes to avoid decimal-hour rounding. */
export const splitOvertimeMinutes = (value) => {
  const total = Math.max(0, Math.round(Number(value) || 0));
  return {
    hours: String(Math.floor(total / 60)).padStart(2, '0'),
    minutes: String(total % 60).padStart(2, '0'),
  };
};

export const toOvertimeMinutes = (hoursInput, minutesInput) => {
  const hoursText = String(hoursInput ?? '').trim();
  const minutesText = String(minutesInput ?? '').trim();
  if (!hoursText && !minutesText) return null;
  if (!/^\d{1,2}$/.test(hoursText || '0') || !/^\d{1,2}$/.test(minutesText || '0')) {
    return null;
  }
  const hours = Number(hoursText || 0);
  const minutes = Number(minutesText || 0);
  // Overtime is entered for a single attendance date.
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) return null;
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
};

export const formatOvertimeDuration = (value) => {
  const { hours, minutes } = splitOvertimeMinutes(value);
  return `${hours} hr ${minutes} min`;
};
