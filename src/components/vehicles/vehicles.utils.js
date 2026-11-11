export const OPEN_JOB_STATUSES = new Set([
  'New',
  'Checked In',
  'Inspection',
  'Estimate Pending',
  'Awaiting Approval',
  'Approved',
  'In Progress',
  'Waiting for Parts',
  'QC',
  'Quality Check',
  'Ready for Delivery',
]);

export const dateDiff = (dateValue) => {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target - today) / 86400000);
};

export const getVehicleStatus = (vehicle) => {
  if (String(vehicle.status || '').toLowerCase() === 'archived') {
    return { label: 'Archived', tone: 'neutral' };
  }
  if (String(vehicle.customerStatus || '').toLowerCase() === 'archived') {
    return { label: 'Customer Archived', tone: 'neutral' };
  }
  const serviceDays = dateDiff(vehicle.nextServiceDue);
  const insuranceDays = dateDiff(vehicle.insuranceExpiry);

  if (insuranceDays !== null && insuranceDays < 0) {
    return { label: 'Insurance Expired', tone: 'danger' };
  }

  if (serviceDays !== null && serviceDays <= 30) {
    return {
      label: serviceDays < 0 ? 'Service Overdue' : 'Service Due',
      tone: 'warning',
    };
  }

  return {
    label: vehicle.status || 'Active',
    tone: vehicle.status === 'Inactive' ? 'neutral' : 'success',
  };
};
