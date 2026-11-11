// Catalogue service charges are customer-facing amounts, not direct job costs.
// Only billable saved Work service entries are included; timers and wages are not.
export const isJobBillableService = item =>
  Boolean(item && item.billable === true && item.serviceId && item.id);

export const savedJobServices = job =>
  (Array.isArray(job?.work) ? job.work : []).filter(isJobBillableService);

export const serviceLineCharge = item => {
  const saved = Number(item?.customerCharge);
  if (item?.customerCharge != null && Number.isFinite(saved)) return saved;
  const quantity = Number(item?.quantity);
  const rate = Number(item?.customerRate);
  return Number.isFinite(quantity) && Number.isFinite(rate) ? quantity * rate : 0;
};

export const totalCustomerServiceCharges = job =>
  savedJobServices(job).reduce((sum, item) => sum + serviceLineCharge(item), 0);
