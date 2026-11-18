import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { JobBreadcrumbs } from '../../components/jobs/JobBreadcrumbs';
import { JobComplaintEntries } from '../../components/jobs/JobComplaintEntries';
import { jobDisplayLabel } from '../../components/jobs/jobs.utils';
import { JOB_FUEL_LEVELS, JOB_SERVICE_TYPES } from '../../components/jobs/jobOverviewOptions';
import { CountryPhoneField } from '../../components/common/CountryPhoneField';
import { VehiclePhotoGallery } from '../../components/vehicles/VehiclePhotoGallery';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { jobService } from '../../services/job.service';
import { staffService } from '../../services/staff.service';
import '../../styles/job-create-professional.css';
import '../../styles/job-create-alignment.css';
import '../../styles/jobs-unified-ui.css';

const inputClass = 'min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-base text-content';
const labelClass = 'grid min-w-0 gap-1.5 text-sm font-semibold text-content';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-content';
const priorities = ['Low', 'Medium', 'Normal', 'High', 'Urgent'];
const fuelTypes = ['Petrol', 'Diesel', 'CNG', 'LPG', 'Electric', 'Hybrid', 'Other'];

function EditSection({ number, title, id, children }) {
  return (
    <section id={id} className="job-create-section rounded-2xl border border-line bg-surface p-4 md:p-5">
      <div className="job-create-section-heading">
        <h2 className="text-base font-extrabold text-content"><span className="job-create-title-step">{number}</span> {title}</h2>
      </div>
      {children}
    </section>
  );
}

function TextField({ label, ...props }) {
  return <label className={labelClass}>{label}<input className={inputClass} {...props}/></label>;
}

function SelectField({ label, options, value, empty, ...props }) {
  return <label className={labelClass}>
    <span>{label}</span>
    <select className={inputClass} aria-label={label} value={value} {...props}>
      {empty && <option value="">{empty}</option>}
      {value && !options.includes(value) && <option>{value}</option>}
      {options.map(option => <option key={option}>{option}</option>)}
    </select>
  </label>;
}

function initialComplaints(items = []) {
  return items.map((row, index) => ({
    id: `saved-${index}`, savedId: row.id, description: row.description || row.wording || '',
    category: row.category || '', priority: row.priority || 'Medium', inspectionNotes: row.inspectionNotes || '',
  }));
}

const changedFields = (initial, current) =>
  Object.fromEntries(Object.entries(current).filter(([key, value]) => initial[key] !== value));

function JobEditorForm({ data, staff, overview }) {
  const navigate = useNavigate();
  const { job, access } = data;
  const [originalJob] = useState(() => ({
    serviceType: job.serviceType || 'General Service',
    odometer: String(job.kilometre ?? job.odometer ?? 0), fuel_level: job.fuelLevel ?? job.fuel_level ?? '',
    priority: job.priority || 'Normal', notes: job.notes || '', technician: job.technician || '',
  }));
  const [originalComplaints] = useState(() => initialComplaints(job.complaints));
  const [details, setDetails] = useState(originalJob);
  const [customer, setCustomer] = useState(data.customer);
  const [vehicle, setVehicle] = useState(data.vehicle);
  const [complaints, setComplaints] = useState(originalComplaints);
  const [complaintErrors, setComplaintErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const change = (setter, key) => event => setter(values => ({ ...values, [key]: event.target.value }));
  const grid = 'job-create-fields-grid mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3';

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const jobPatch = changedFields(originalJob, details);
    if ('technician' in jobPatch && jobPatch.technician === '') jobPatch.technician = null;
    const customerPatch = access.customer ? changedFields(data.customer, customer) : {};
    const vehiclePatch = access.vehicle ? changedFields(data.vehicle, vehicle) : {};
    if (JSON.stringify(originalComplaints) !== JSON.stringify(complaints)) {
      const errors = {};
      for (const [index, row] of complaints.entries()) {
        const existing = originalComplaints[index];
        if (!row.description.trim() && (existing?.description || row.category || row.inspectionNotes)) {
          errors[row.id] = 'Enter a complaint description.';
        }
      }
      setComplaintErrors(errors);
      if (Object.keys(errors).length) {
        const first = complaints.findIndex(row => errors[row.id]);
        const input = event.currentTarget.elements.namedItem(`complaint-${first}`);
        input?.scrollIntoView({ block: 'center' });
        input?.focus();
        return;
      }
      jobPatch.complaints = complaints.filter((row, index) => index < originalComplaints.length || row.description.trim())
        .map((row, index) => {
          const original = originalComplaints[index];
          const values = { description: row.description.trim(), category: row.category,
                           priority: row.priority, inspectionNotes: row.inspectionNotes };
          return { id: row.savedId, ...changedFields(original || {}, values) };
        });
    }
    if (![jobPatch, customerPatch, vehiclePatch].some(patch => Object.keys(patch).length)) {
      navigate(overview);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await jobService.saveJobEditor(job.id, {
        versions: data.versions, job: jobPatch, customer: customerPatch, vehicle: vehiclePatch,
      });
      navigate(overview, { replace: true });
    } catch (cause) {
      setError(cause?.message || 'Could not save the Job Card.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="job-create-form flex flex-col gap-4">
        <EditSection number="01" title="Customer & Job Details" id="job-step-customer">
          <div className={grid}>
            <TextField label="Customer Name" value={customer.name} disabled={saving || !access.customer}
              required onChange={change(setCustomer, 'name')}/>
            <CountryPhoneField label="Phone Number" value={customer.phone} disabled={saving || !access.customer}
              required onChange={phone => setCustomer(values => ({ ...values, phone }))}/>
            <SelectField label="Service Type" options={JOB_SERVICE_TYPES} value={details.serviceType}
              disabled={saving} onChange={change(setDetails, 'serviceType')}/>
            {access.customer && <>
              <TextField label="Email" type="email" value={customer.email} disabled={saving} onChange={change(setCustomer, 'email')}/>
              <TextField label="Customer Address" value={customer.address} disabled={saving} onChange={change(setCustomer, 'address')}/>
            </>}
            <TextField label="Branch" value={job.branchName || ''} readOnly/>
          </div>
        </EditSection>
        <EditSection number="02" title="Customer Complaints" id="job-step-complaints">
          <JobComplaintEntries complaints={complaints} onChange={setComplaints} disabled={saving}
            errors={complaintErrors} savedCount={originalComplaints.length}/>
        </EditSection>
        <EditSection number="03" title="Vehicle Details" id="job-step-vehicle">
          <div className={grid}>
            <TextField label="Registration Number" value={vehicle.registration} disabled={saving || !access.vehicle}
              required onChange={change(setVehicle, 'registration')}/>
            <TextField label="Make / Manufacturer" value={vehicle.make} disabled={saving || !access.vehicle} onChange={change(setVehicle, 'make')}/>
            <TextField label="Model" value={vehicle.model} disabled={saving || !access.vehicle} onChange={change(setVehicle, 'model')}/>
            <SelectField label="Fuel Type" options={fuelTypes} value={vehicle.fuelType} empty="Not recorded"
              disabled={saving || !access.vehicle} onChange={change(setVehicle, 'fuelType')}/>
            <TextField label="KM Reading" value={details.odometer} type="number" inputMode="numeric" min="0" max="2147483647" step="1"
              required disabled={saving} onChange={change(setDetails, 'odometer')}/>
            <SelectField label="Fuel Level" options={JOB_FUEL_LEVELS} value={details.fuel_level} empty="Not recorded"
              disabled={saving} onChange={change(setDetails, 'fuel_level')}/>
            <TextField label="VIN / Chassis" value={vehicle.vin} maxLength={64} disabled={saving || !access.vehicle}
              onChange={change(setVehicle, 'vin')}/>
          </div>
        </EditSection>
        <EditSection number="04" title="Technician & Service Assignment" id="job-step-assignment">
          <div className={grid}>
            {staff ? <label className={labelClass}>Assigned Technician
              <select aria-label="Assigned Technician" className={inputClass} value={details.technician}
                disabled={saving} onChange={change(setDetails, 'technician')}>
                <option value="">Unassigned</option>
                {details.technician && !staff.some(item => item.user === details.technician) &&
                  <option value={details.technician}>{job.assignedEmployeeName || 'Current technician'}</option>}
                {staff.map(item => <option key={item.user} value={item.user}>{item.name}</option>)}
              </select>
            </label> : <TextField label="Assigned Technician" value={job.assignedEmployeeName || 'Unassigned'} readOnly/>}
            <SelectField label="Priority" options={priorities} value={details.priority} disabled={saving} onChange={change(setDetails, 'priority')}/>
            <TextField label="Status" value={job.status} readOnly/>
          </div>
          <label className={`mt-4 ${labelClass}`}>Job Notes
            <textarea className={`${inputClass} py-2`} rows={3} value={details.notes} disabled={saving} onChange={change(setDetails, 'notes')}/>
          </label>
        </EditSection>
        <div className="job-create-actions flex flex-wrap justify-end gap-2 border-t border-line bg-surface/95 p-3" aria-label="Job Card form actions">
          {error && <p role="alert" className="w-full text-sm font-semibold text-danger">{error}</p>}
          <Link className={buttonClass} to={overview}>Cancel</Link>
          <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white">
            <CheckCircle2 size={17} aria-hidden="true"/> {saving ? 'Saving…' : 'Save Job Card'}
          </button>
        </div>
      </form>
      <VehiclePhotoGallery jobId={job.id} canEdit/>
    </>
  );
}

export function JobEditPage() {
  const { id } = useParams();
  const { can } = useFeatureAccess();
  const [data, setData] = useState(null);
  const [staff, setStaff] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const canViewStaff = can('staff.view');
  const overview = `/jobs/${encodeURIComponent(id)}/overview`;
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    jobService.getJobEditor(id).then(result => {
      if (!result?.job?.id || !result.customer || !result.vehicle || !result.access || !result.versions) {
        throw new Error('Could not load the Job Card editor.');
      }
      if (active) setData(result);
    }).catch(cause => {
      if (active) setError(cause?.message || 'Could not load the Job Card.');
    });
    return () => { active = false; };
  }, [id, retry]);
  useEffect(() => {
    let active = true;
    setStaff(null);
    if (canViewStaff) staffService.getStaff().then(result => {
      if (active) setStaff(result.filter(item => item.user && item.employmentStatus === 'Active'));
    }).catch(() => {});
    return () => { active = false; };
  }, [canViewStaff]);
  if (!data) return error ? <div role="alert" className="grid gap-3 p-4 text-content">
    <p>{error}</p><button type="button" className={buttonClass} onClick={() => setRetry(count => count + 1)}>Retry</button>
  </div> : <p role="status" className="p-4">Loading Job Card…</p>;
  return (
    <div className="job-management-page job-create-page jobs-ui-polished flex w-full min-w-0 flex-col gap-4">
      <JobBreadcrumbs current="Edit Job Card" jobId={data.job.id} jobLabel={jobDisplayLabel(data.job)}/>
      <header className="job-create-header">
        <h1 className="text-2xl font-bold text-content">Edit Job Card</h1>
        <p className="mt-1 text-sm text-muted">{jobDisplayLabel(data.job)} · {data.vehicle.registration}</p>
        {(data.access.customer || data.access.vehicle) && data.job.status !== 'Delivered' &&
          <p className="mt-1 text-sm text-muted">Customer and vehicle changes update their linked profiles.</p>}
      </header>
      {data.job.status === 'Delivered' ? <p role="status" className="p-4">Delivered Job Cards are locked.</p>
        : <JobEditorForm key={data.job.id} data={data} staff={staff} overview={overview}/>}
    </div>
  );
}
