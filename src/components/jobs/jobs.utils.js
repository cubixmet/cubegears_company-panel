export const STATUS_OPTIONS = [
  'All',
  'Active',
  'New',
  'Inspection',
  'Estimate Pending',
  'Approved',
  'In Progress',
  'Waiting for Parts',
  'QC',
  'Ready for Delivery',
  'Delivered',
  'Cancelled',
];

export const statusClass = (status) =>
  String(status || 'New').toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const normalizeRegistration = (value) =>
  String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

export const jobMoney = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});


/** Prefer the workshop's Job Card number in visible labels. */
export const jobDisplayLabel = (job) => {
  const candidate = String(job?.jobNumber || job?.job_number || '').trim();
  if (candidate && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)) {
    return candidate;
  }
  return job?.vehicleReg ? `Job · ${job.vehicleReg}` : 'Job Card';
};
