// Binary storage units: 1 KB = 1024 bytes, 1 MB = 1024 KB, 1 GB = 1024 MB.
// Always start with the server's unrounded byte count. Historical responses
// without byte totals can still use the legacy rounded GB fallback.
export const BYTES_PER_KB = 1024;
export const BYTES_PER_MB = 1024 ** 2;
export const BYTES_PER_GB = 1024 ** 3;

export function storageBytes(record, byteKey = 'usedBytes', gbKey = 'usedGb') {
  const exact = Number(record?.[byteKey]);
  if (record?.[byteKey] != null && Number.isFinite(exact) && exact >= 0) return Math.trunc(exact);
  const legacyGb = Number(record?.[gbKey]);
  return Number.isFinite(legacyGb) && legacyGb > 0
    ? Math.round(legacyGb * BYTES_PER_GB) : 0;
}

export function formatStorageBytes(rawBytes, selectedUnit = 'auto') {
  const bytes = Math.max(0, Number(rawBytes) || 0);
  let unit = selectedUnit;
  if (!['B', 'KB', 'MB', 'GB', 'auto'].includes(unit)) unit = 'auto';
  if (unit === 'auto') {
    unit = bytes >= BYTES_PER_GB ? 'GB'
      : bytes >= BYTES_PER_MB ? 'MB'
        : bytes >= BYTES_PER_KB ? 'KB' : 'B';
  }
  const factor = unit === 'GB' ? BYTES_PER_GB
    : unit === 'MB' ? BYTES_PER_MB : unit === 'KB' ? BYTES_PER_KB : 1;
  const value = bytes / factor;
  const digits = value > 0 && value < 0.001 ? 12
    : value < 0.01 ? 8
      : value < 1 ? 4 : 2;
  const amount = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
  return `${amount} ${unit}`;
}

export function formatStorageDelta(rawBytes) {
  const delta = Number(rawBytes) || 0;
  return `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatStorageBytes(Math.abs(delta))}`;
}
