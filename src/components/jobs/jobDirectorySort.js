export const JOB_SORT_OPTIONS = [
  { value: 'recent', label: 'Newest jobs first' },
  { value: 'oldest', label: 'Oldest jobs first' },
  { value: 'customer', label: 'Customer name A–Z' },
  { value: 'vehicle', label: 'Vehicle number A–Z' },
];

const timestamp = (job) => {
  const raw = job?.createdAt || job?.created_at || job?.createdDate || job?.jobDateTime || '';
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : null;
};

export const sortJobsForDisplay = (jobs, mode = 'recent') => {
  const rows = Array.isArray(jobs) ? [...jobs] : [];
  if (mode === 'customer' || mode === 'vehicle') {
    const key = mode === 'customer' ? 'customerName' : 'vehicleReg';
    rows.sort((a, b) => String(a?.[key] || '').localeCompare(
      String(b?.[key] || ''), undefined, { numeric: true, sensitivity: 'base' }
    ));
  } else if (mode === 'recent' || mode === 'oldest') {
    const direction = mode === 'oldest' ? 1 : -1;
    rows.sort((a, b) => {
      const aTime = timestamp(a);
      const bTime = timestamp(b);
      // If either record has no reliable date, retain the server order.
      return aTime === null || bTime === null ? 0 : (aTime - bTime) * direction;
    });
  }
  return rows;
};
