import { activeCustomerInvoices, customerProfileFinancials } from './customerProfile.utils.js';

const text = value => String(value ?? '').trim();
const key = value => text(value).toUpperCase().replace(/[\s-]+/g, '');
const id = value => text(value).toLowerCase();
const normalizedArray = rows => Array.isArray(rows) ? rows : [];

export const vehicleRegistration = vehicle => text(
  vehicle?.registration || vehicle?.regNo || vehicle?.licensePlate || vehicle?.vehicleReg,
);
export const vehicleMakeModel = vehicle =>
  [vehicle?.make, vehicle?.model].filter(Boolean).join(' ').trim() ||
  text(vehicle?.makeModel || vehicle?.vehicleInfo) || 'Vehicle details unavailable';

/** A record may link directly via FK, via the job FK, or via registration.
 * Never assign an invoice with ambiguous/no vehicle mapping to the first car.
 */
export const resolveCustomerVehicleId = (record, vehicles, jobs = []) => {
  const fleet = normalizedArray(vehicles);
  const direct = id(record?.vehicleId || record?.vehicle_id ||
    (typeof record?.vehicle === 'object' ? record.vehicle?.id : null));
  if (direct) {
    const matching = fleet.find(vehicle => id(vehicle.id) === direct);
    // An FK that does not match this customer's fleet is not a registration.
    return matching ? String(matching.id) : null;
  }
  const jobLink = id(record?.jobId || record?.job_id || record?.sourceJobId ||
    record?.source_job_id || (typeof record?.job === 'object' ? record.job?.id : record?.job));
  if (jobLink) {
    const match = normalizedArray(jobs).find(job => id(job.id) === jobLink);
    if (match) return resolveCustomerVehicleId(match, fleet, []);
  }
  const registration = key(record?.vehicleReg || record?.registration ||
    record?.licensePlate || (typeof record?.vehicle === 'string' ? record.vehicle
      : record?.vehicle?.registration));
  if (!registration) return null;
  const matches = fleet.filter(vehicle => key(vehicleRegistration(vehicle)) === registration);
  return matches.length === 1 ? String(matches[0].id) : null;
};

export const buildCustomerVehicleFinances = ({
  vehicles = [], jobs = [], invoices = [], invoicesAvailable = true,
} = {}) => {
  const fleet = normalizedArray(vehicles);
  const jobRows = normalizedArray(jobs);
  const validInvoices = activeCustomerInvoices(invoices);
  const buckets = fleet.map(vehicle => {
    const vehicleId = String(vehicle.id);
    const linkedInvoices = validInvoices.filter(
      invoice => resolveCustomerVehicleId(invoice, fleet, jobRows) === vehicleId);
    const linkedJobs = jobRows.filter(
      job => resolveCustomerVehicleId(job, fleet) === vehicleId);
    return {
      id: vehicleId,
      vehicle,
      jobs: linkedJobs,
      invoices: linkedInvoices,
      financials: customerProfileFinancials(linkedInvoices, invoicesAvailable),
    };
  });
  const unassignedInvoices = validInvoices.filter(invoice =>
    !resolveCustomerVehicleId(invoice, fleet, jobRows));
  return {
    vehicles: buckets,
    overall: customerProfileFinancials(invoices, invoicesAvailable),
    finalizedInvoices: validInvoices,
    unassignedInvoices,
    unmatchedJobs: jobRows.filter(job => !resolveCustomerVehicleId(job, fleet)),
  };
};

export const customerProfileDate = value => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? text(value) : parsed.toLocaleDateString('en-IN');
};
