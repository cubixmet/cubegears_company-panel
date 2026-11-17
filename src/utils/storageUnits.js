// Binary storage units: 1 KB = 1024 bytes, 1 MB = 1024 KB, 1 GB = 1024 MB.
// Use the server's exact total whenever it is available.
export const BYTES_PER_KB = 1024;
export const BYTES_PER_MB = 1024 ** 2;
export const BYTES_PER_GB = 1024 ** 3;

function nonnegativeNumber(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function storageBytes(record, byteKey = 'usedBytes', gbKey = 'usedGb') {
  const exact = nonnegativeNumber(record?.[byteKey]);
  if (exact !== null) return Math.trunc(exact);

  // Storage responses can cap the file list, so only sum a verified complete list.
  const files = record?.files;
  if (Array.isArray(files) && files.length > 0 && nonnegativeNumber(record.fileCount) === files.length) {
    const sizes = files.map((file) => nonnegativeNumber(file?.sizeBytes));
    if (sizes.every(Number.isSafeInteger)) return sizes.reduce((total, size) => total + size, 0);
  }

  return Math.round((nonnegativeNumber(record?.[gbKey]) ?? 0) * BYTES_PER_GB);
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
  const showFixedGb = selectedUnit === 'GB' && (value === 0 || value >= 0.01);
  const digits = showFixedGb ? 2 : value > 0 && value < 0.001 ? 12
    : value < 0.01 ? 8
      : value < 1 ? 4 : 2;
  const amount = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: showFixedGb ? 2 : 0,
  }).format(value);
  return `${amount} ${unit}`;
}

export function formatStorageDelta(rawBytes) {
  const delta = Number(rawBytes) || 0;
  return `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatStorageBytes(Math.abs(delta))}`;
}
