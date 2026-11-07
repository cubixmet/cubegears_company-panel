import { appAlert } from '../../components/common/appDialogs';
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, History, Eye, RotateCcw, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jobService } from '../../services/job.service';
import { vehiclePhotoService } from '../../services/vehiclePhoto.service';
import { VehicleCameraQueue } from '../../components/vehicles/VehicleCameraQueue';
import { staffService } from '../../services/staff.service';
import { payrollService } from '../../services/payroll.service';
import { JobBreadcrumbs } from '../../components/jobs/JobBreadcrumbs';
import { JobCustomerPicker } from '../../components/jobs/JobCustomerPicker';
import { PhoneInput } from '../../components/common/PhoneInput';
import { customerService } from '../../services/customer.service';
import { branchService } from '../../services/branch.service';
import { JobComplaintEntries } from '../../components/jobs/JobComplaintEntries';
import { JobCardReview } from '../../components/jobs/JobCardReview';
import { JOB_COUNTRY_CODES, splitInternationalPhone, joinInternationalPhone, validInternationalPhone, splitVehicleMakeModel, newComplaint, buildJobComplaints } from '../../utils/jobCreateAdapters';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import '../../styles/job-create-professional.css';
import { showFormFieldError, showServerFormErrors, findFormField, clearFieldValidation } from '../../utils/formValidation';

const nowLocal = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

// The stepper and section headings share one ordered definition.
const JOB_CREATE_STEPS = [
  { id: 'customer', label: 'Customer' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'assignment', label: 'Assignment' },
  { id: 'photos', label: 'Photos' },
  { id: 'review', label: 'Review' },
];
const stepNumber = (id) => String(JOB_CREATE_STEPS.findIndex((step) => step.id === id) + 1).padStart(2, '0');

export const JobCreatePage = () => {
  const navigate = useNavigate();
  // Reuse the same key for retries after a lost response: Django returns the
  // original Job Card instead of creating duplicate jobs/customers/vehicles.
  const createRequestId = useRef(
    globalThis.crypto?.randomUUID?.() ||
      `job-create-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
  );
  const { can } = useFeatureAccess();
  const maySelectBranch = can('company.manage') || can('branches.manage');
  const formRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [createdJob, setCreatedJob] = useState(null);
  const [review, setReview] = useState(false);
  const [advancedVehicleOpen, setAdvancedVehicleOpen] = useState(false);
  const [jobMode, setJobMode] = useState('simple');
  const [complaints, setComplaints] = useState(() => [newComplaint()]);
  const [complaintErrors, setComplaintErrors] = useState({});
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [savedJobId, setSavedJobId] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingPhotoId, setUploadingPhotoId] = useState(null);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadedPhotosCount, setUploadedPhotosCount] = useState(0);
  const [staff, setStaff] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [form, setForm] = useState({
    jobDateTime: nowLocal(),
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    vehicleReg: '',
    vehicleInfo: '',
    vehicleMake: '',
    vehicleModel: '',
    fuelType: '',
    vehicleDetailsUpdate: false,
    vin: '',
    kilometre: '',
    fuelLevel: '50%',
    serviceType: 'General Service',
    complaint: '',
    assignedEmployeeId: '',
    assignedEmployeeName: '',
    serviceAdvisor: '',
    priority: 'Medium',
    status: 'New',
    branch: '',
    branchId: '',
    serviceAdvisorEmployeeId: '',
    notes: ''
  });

  const chooseCustomer = (customer) => {
    setSelectedCustomer(customer);
    setSelectedVehicleId('');
    setCustomerVehicles([]);
    setHistory([]);
    setError('');
    setForm((old) => ({
      ...old,
      customerName: customer?.name || '',
      customerPhone: customer?.phone ? joinInternationalPhone(splitInternationalPhone(customer.phone).country, splitInternationalPhone(customer.phone).national) : '',
      customerEmail: customer?.email || '',
      customerAddress: customer?.address || '',
      vehicleReg: '', vehicleInfo: '', vehicleMake: '', vehicleModel: '',
      fuelType: '', vin: '', kilometre: '', vehicleDetailsUpdate: false
    }));
  };

  useEffect(() => {
    if (!selectedCustomer?.id) {
      setCustomerVehicles([]);
      setSelectedVehicleId('');
      return;
    }
    let active = true;
    setVehiclesLoading(true);
    customerService.getCustomerVehicles(selectedCustomer.id)
      .then((response) => {
        if (!active) return;
        const vehicles = Array.isArray(response) ? response : response?.results || [];
        setCustomerVehicles(vehicles);
      })
      .catch(() => {
        if (active) {
          setCustomerVehicles([]);
          setError('Customer selected, but vehicle list could not be loaded. You can enter registration manually.');
        }
      })
      .finally(() => { if (active) setVehiclesLoading(false); });
    return () => { active = false; };
  }, [selectedCustomer?.id]);

  const chooseVehicle = (vehicleId) => {
    setSelectedVehicleId(vehicleId);
    const found = customerVehicles.find((item) => String(item.id) === String(vehicleId));
    if (!found) {
      setForm((old) => ({ ...old, vehicleReg: '', vehicleInfo: '', vehicleMake: '',
        vehicleModel: '', fuelType: '', vin: '', kilometre: '', vehicleDetailsUpdate: false }));
      return;
    }
    const names = splitVehicleMakeModel(found);
    setForm((old) => ({
      ...old,
      vehicleReg: (found.regNo || found.registration || found.licensePlate || '').toUpperCase(),
      vehicleMake: names.make,
      vehicleModel: names.model,
      vehicleInfo: [names.make, names.model].filter(Boolean).join(' '),
      fuelType: found.fuelType || found.fuel_type || '',
      fuelLevel: found.fuelLevel || old.fuelLevel,
      vin: found.vin || '',
      kilometre: String(found.kilometres ?? found.odometer ?? ''),
      vehicleDetailsUpdate: false
    }));
  };

  useEffect(() => {
    if (!maySelectBranch) return undefined;
    let mounted = true;
    branchService.getBranches()
      .then((rows) => { if (mounted) setBranches((Array.isArray(rows) ? rows : rows?.results || [])
        .filter((item) => item.is_active !== false)); })
      .catch(() => { if (mounted) setBranches([]); });
    return () => { mounted = false; };
  }, [maySelectBranch]);

  useEffect(() => {
    let mounted = true;
    staffService.getStaff()
      .then((data) => {
        if (mounted) setStaff((Array.isArray(data) ? data : data?.results || []).filter((item) => item.employmentStatus === 'Active'));
      })
      .catch(() => { if (mounted) setStaff([]); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (form.vehicleReg.trim().length < 5) {
        setHistory([]);
        return;
      }

      setHistoryLoading(true);
      try {
        const rows = await jobService.getVehicleHistory(form.vehicleReg);
        const matched = selectedCustomer?.id
          ? rows.filter((row) => String(row.customerId || '') === String(selectedCustomer.id))
          : rows;
        setHistory(matched);

        if (matched.length) {
          const latest = matched[0];
          setForm((old) => ({
            ...old,
            customerName: selectedCustomer ? old.customerName : old.customerName || latest.customerName || '',
            customerPhone: selectedCustomer ? old.customerPhone : old.customerPhone || (latest.customerPhone ? joinInternationalPhone(splitInternationalPhone(latest.customerPhone).country, splitInternationalPhone(latest.customerPhone).national) : '') ,
            customerEmail: selectedCustomer ? old.customerEmail : old.customerEmail || latest.customerEmail || '',
            vehicleInfo: old.vehicleInfo || latest.vehicleInfo || '',
            vehicleMake: old.vehicleMake || splitVehicleMakeModel(latest).make,
            vehicleModel: old.vehicleModel || splitVehicleMakeModel(latest).model,
            fuelType: old.fuelType || latest.fuelType || latest.vehicle?.fuelType || '',
            kilometre: old.kilometre || String(latest.kilometre || latest.odometer || ''),
            vin: old.vin || latest.vin || latest.vehicle?.vin || ''
          }));
        }
      } catch (historyError) {
        console.error('Vehicle history lookup unavailable', historyError);
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [form.vehicleReg, selectedCustomer?.id]);

  const set = (key, value) => {
    setError('');
    clearFieldValidation(findFormField(formRef.current, key));
    setReview(false);
    if (key === 'vehicleMake' || key === 'vehicleModel') {
      setForm((old) => {
        const next = { ...old, [key]: value };
        next.vehicleInfo = [next.vehicleMake, next.vehicleModel].filter(Boolean).join(' ');
        return next;
      });
      return;
    }
    if (key === 'vehicleReg') {
      const normalized = (number) => String(number || '').replace(/\s+/g, '').toUpperCase();
      const matched = customerVehicles.find((vehicle) =>
        normalized(vehicle.regNo || vehicle.registration || vehicle.licensePlate) === normalized(value)
      );
      setSelectedVehicleId(matched?.id || '');
      setForm((old) => {
        const names = matched ? splitVehicleMakeModel(matched) : null;
        return {
          ...old, vehicleReg: value,
          vehicleInfo: matched ? [names.make, names.model].filter(Boolean).join(' ') : old.vehicleInfo,
          vehicleMake: matched ? names.make : old.vehicleMake,
          vehicleModel: matched ? names.model : old.vehicleModel,
          fuelType: matched ? matched.fuelType || matched.fuel_type || '' : old.fuelType,
          kilometre: matched ? String(matched.kilometres ?? matched.odometer ?? '') : old.kilometre,
          vin: matched ? matched.vin || '' : old.vin,
          vehicleDetailsUpdate: false,
        };
      });
      return;
    }
    setForm((old) => ({ ...old, [key]: value }));
  };

  const assignStaff = (id) => {
    const selected = staff.find((item) => item.id === id);
    setReview(false);
    setForm((old) => ({
      ...old,
      assignedEmployeeId: id,
      assignedEmployeeName: selected?.name || ''
    }));
  };

  const validateBeforeReview = () => {
    const required = [
      ['jobDateTime', form.jobDateTime?.trim(), 'Select the Job Card date and time.'],
      ['customerName', form.customerName.trim(), 'Enter the customer name.'],
      ['customerPhone', validInternationalPhone(form.customerPhone), 'Enter a valid international phone number with country code.'],
      ['vehicleReg', form.vehicleReg.trim(), 'Enter the registration number.'],
    ];
    const missing = required.find(([, value]) => !value);
    if (missing) {
      const shownInline = showFormFieldError(formRef.current, missing[0], missing[2]);
      setError(shownInline ? '' : missing[2]);
      return false;
    }
    if (form.kilometre && (!/^\d+$/.test(form.kilometre) || Number(form.kilometre) > 999999999)) {
      showFormFieldError(formRef.current, 'kilometre', 'Enter a valid non-negative KM reading.');
      return false;
    }
    // An untouched empty row is optional. Once the user adds a category or
    // inspection notes, however, require a description before review.
    const errors = Object.fromEntries(complaints.filter((item) =>
      !item.description.trim() && (item.category || item.inspectionNotes.trim())
    ).map((item) => [item.id, 'Describe this complaint or remove the incomplete row.']));
    setComplaintErrors(errors);
    if (Object.keys(errors).length) {
      const first = complaints.findIndex((item) => errors[item.id]);
      showFormFieldError(formRef.current, 'complaint-' + first, errors[complaints[first].id]);
      return false;
    }
    return true;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!savedJobId && !validateBeforeReview()) return;
    if (!review && !savedJobId) {
      setReview(true);
      setError('');
      window.requestAnimationFrame(() => formRef.current?.querySelector('#job-card-review')?.scrollIntoView({
        behavior: 'smooth', block: 'start'
      }));
      return;
    }

    setSaving(true);
    setError('');
    let createdId = savedJobId;
    try {
      const normalizedComplaints = buildJobComplaints(complaints);
      const created = createdId ? { id: createdId, ...(createdJob || {}) } : await jobService.createJob({
        ...form,
        clientRequestId: createRequestId.current,
        ...(selectedCustomer?.id ? { customer: selectedCustomer.id } : {}),
        checkInTime: form.jobDateTime,
        vehicleInfo: [form.vehicleMake, form.vehicleModel].filter(Boolean).join(' '),
        customerComplaints: normalizedComplaints,
        complaints: normalizedComplaints,
        vehicle: selectedVehicleId || {
          registration: form.vehicleReg,
          make: form.vehicleMake,
          model: form.vehicleModel,
          fuelType: form.fuelType,
          makeModel: [form.vehicleMake, form.vehicleModel].filter(Boolean).join(' '),
          vin: form.vin,
        },
        services: [],
        partsUsed: [],
        outsidePurchases: [],
        labourRecords: [],
        estimates: [],
        workUpdates: [],
        photos: [],
        additionalApprovals: [],
        billing: { advancePaid: 0, paidAmount: 0, outstandingBalance: 0 }
      });

      if (!created?.id) throw new Error('Job Card could not be saved.');
      createdId = created.id;
      setSavedJobId(created.id);
      setCreatedJob(created);
      if (!savedJobId && form.assignedEmployeeId) {
        try {
          await payrollService.createJobTimerAssignment(created.id, form.assignedEmployeeId);
        } catch (assignmentError) {
          console.warn('Job created; worker assignment needs confirmation.', assignmentError);
          appAlert('Job Card created. Please verify worker assignment in Work & Labour.');
        }
      }

      setUploadTotal(pendingPhotos.length);
      for (let i = 0; i < pendingPhotos.length; i += 1) {
        const photo = pendingPhotos[i];
        setUploadProgress(i + 1);
        setUploadingPhotoId(photo.id);
        await vehiclePhotoService.upload({ jobId: created.id, ...photo });
        setPendingPhotos((items) => items.filter((entry) => entry.id !== photo.id));
        setUploadedPhotosCount((count) => count + 1);
      }
      setUploadProgress(0);
      setReview(true);
    } catch (err) {
      const shownInline = showServerFormErrors(formRef.current, createdId ? null : err, {
        customer_name: 'customerName', customer_phone: 'customerPhone',
        registration: 'vehicleReg', vehicle_registration: 'vehicleReg',
        fuelType: 'fuelType', vehicleInfo: 'vehicleMake', branchId: 'branchId',
        kilometre: 'kilometre', serviceAdvisorEmployeeId: 'serviceAdvisorEmployeeId',
        assignedEmployeeId: 'assignedEmployeeId',
      });
      const message = createdId
        ? 'Job Card was saved, but some photos could not be uploaded. Retry remaining photos; no duplicate Job Card will be created.'
        : err?.message || 'Unable to create Job Card.';
      setError(shownInline ? '' : message);
    } finally {
      setSaving(false);
      setUploadProgress(0);
      setUploadingPhotoId(null);
    }
  };

  const inputClass = 'mt-1 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm font-normal text-content outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10';
  const labelClass = 'text-xs font-semibold text-secondary';
  const phoneParts = splitInternationalPhone(form.customerPhone);

  if (createdJob && pendingPhotos.length === 0) {
    return <div className="job-management-page job-create-page" data-job-creation-success>
      <JobBreadcrumbs current="Job Card Created" />
      <div className="job-create-success-banner"><CheckCircle2 size={22}/>
        Job Card {createdJob.jobNumber || createdJob.job_number || createdJob.number || ''} saved successfully.
      </div>
      <JobCardReview form={form} complaints={buildJobComplaints(complaints)}
        photos={pendingPhotos} uploadedPhotosCount={uploadedPhotosCount} jobNumber={createdJob.jobNumber || createdJob.job_number || createdJob.number || ''}
        created onPrint={() => window.print()}/>
      <div className="job-create-actions no-print">
        <button type="button" onClick={() => navigate('/jobs')}>Back to Jobs</button>
        <button type="button" onClick={() => navigate('/jobs/' + createdJob.id)}>Open Job Card</button>
      </div>
    </div>;
  }

  return (
    <div className="job-management-page job-create-page flex w-full min-w-0 flex-col gap-4">
      <JobBreadcrumbs current="New Job Card" />
      <header className="job-create-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-content">Create Job Card</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Add customer and vehicle details, then create a Job Card to start inspection.</p>
          <div className="job-create-steps" aria-label="Job setup steps">
            {JOB_CREATE_STEPS.map((step) => (
              <span key={step.id} className={step.id === 'review' && review ? 'is-current' : undefined}>
                <b>{stepNumber(step.id)}</b> {step.label}
              </span>
            ))}
          </div>
          <div className="job-create-mode-switch" role="group" aria-label="Job Card mode">
            <button type="button" aria-pressed={jobMode === 'simple'} className={jobMode === 'simple' ? 'is-active' : ''} onClick={() => setJobMode('simple')}>Simple</button>
            <button type="button" aria-pressed={jobMode === 'advanced'} className={jobMode === 'advanced' ? 'is-active' : ''} onClick={() => setJobMode('advanced')}>Advanced</button>
          </div>
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-600">{error}</div> : null}

      <form ref={formRef} onSubmit={submit} className="job-create-form flex flex-col gap-4">
        <section className="job-create-section rounded-2xl border border-line bg-surface p-4 md:p-5">
          <div className="job-create-section-heading">
            <div>
              <h2 className="text-base font-extrabold text-content"><span className="job-create-title-step">{stepNumber('customer')}</span> Customer & Job Details</h2>
              <p>Select an existing customer or add a new one. Contact details fill automatically.</p>
            </div>
          </div>
          <JobCustomerPicker selectedCustomer={selectedCustomer} onSelect={chooseCustomer}
            disabled={saving} />
          <div className="job-create-fields-grid mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className={labelClass}>Date / Time *
              <input name="jobDateTime" type="datetime-local" required value={form.jobDateTime} onChange={(e) => set('jobDateTime', e.target.value)} className={inputClass}/>
            </label>
            <label className={labelClass}>Customer Name *
              <input name="customerName" required readOnly={Boolean(selectedCustomer)} autoComplete="name" value={form.customerName} onChange={(e) => set('customerName', e.target.value)} placeholder="Customer name" className={inputClass}/>
            </label>
            <PhoneInput label="Phone *" name="customerPhone" required
              value={phoneParts.national} countryCode={phoneParts.country} countries={JOB_COUNTRY_CODES.map(([code, label]) => ({code, label, flag:''}))}
              readOnly={Boolean(selectedCustomer)} disabled={saving || Boolean(selectedCustomer)}
              onCountryCodeChange={(code) => set('customerPhone', joinInternationalPhone(code, phoneParts.national))}
              onChange={(e) => set('customerPhone', joinInternationalPhone(phoneParts.country, e.target.value))}
              placeholder="9876543210" className="job-create-phone"/>
            <label className={labelClass}>Email
              <input name="customerEmail" readOnly={Boolean(selectedCustomer)} type="email" autoComplete="email" value={form.customerEmail} onChange={(e) => set('customerEmail', e.target.value)} placeholder="Optional" className={inputClass}/>
            </label>
            <label className={labelClass}>Customer Address
              <input name="customerAddress" readOnly={Boolean(selectedCustomer)} value={form.customerAddress}
                onChange={(e) => set('customerAddress', e.target.value)} placeholder="Optional" className={inputClass}/>
            </label>
            <label className={labelClass}>Branch
              <select name="branchId" value={form.branchId} disabled={!maySelectBranch}
                onChange={(e) => set('branchId', e.target.value)} className={inputClass}>
                <option value="">My assigned workshop branch</option>
                {branches.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className={labelClass}>Service Type
              <select value={form.serviceType} onChange={(e) => set('serviceType', e.target.value)} className={inputClass}>
                {['General Service','Running Repair','Breakdown','Insurance Repair','Body Shop','AC Service','Electrical','Engine Work','Periodic Maintenance'].map((item)=><option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="job-create-section rounded-2xl border border-line bg-surface p-4 md:p-5" id="job-step-complaints">
          <div className="job-create-section-heading">
            <div>
              <h2 className="text-base font-extrabold text-content"><span className="job-create-title-step">{stepNumber('complaints')}</span> Customer Complaints</h2>
              <p>Record each concern independently and keep the original customer wording.</p>
            </div>
          </div>
          <JobComplaintEntries complaints={complaints} errors={complaintErrors} disabled={saving}
            onChange={(updater) => {
              setComplaints(updater);
              setComplaintErrors({});
              if (!savedJobId) setReview(false);
            }}/>
        </section>

        <section className="job-create-section rounded-2xl border border-line bg-surface p-4 md:p-5">
          <div className="job-create-section-heading">
            <div>
              <h2 className="text-base font-extrabold text-content"><span className="job-create-title-step">{stepNumber('vehicle')}</span> Vehicle Details</h2>
              <p>Choose a saved vehicle or enter registration and vehicle information.</p>
            </div>
          </div>

          {selectedCustomer && (
            <div className="job-customer-vehicles">
              <label className={labelClass} htmlFor="job-new-vehicle-select">Select Customer Vehicle</label>
              <select id="job-new-vehicle-select" value={selectedVehicleId} disabled={vehiclesLoading || saving}
                className={inputClass} onChange={(event) => chooseVehicle(event.target.value)}>
                <option value="">{vehiclesLoading ? 'Loading vehicles…' : 'New vehicle / Enter registration below'}</option>
                {customerVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.regNo || vehicle.registration || vehicle.licensePlate} — {vehicle.makeModel || [vehicle.make, vehicle.model].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
              <p>{customerVehicles.length ? customerVehicles.length + ' vehicle(s) linked to this customer.' : 'No saved vehicles. Enter a new registration below.'}</p>
            </div>
          )}
          <div className="job-create-fields-grid job-create-vehicle-grid mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className={labelClass}>Registration Number *
              <input name="vehicleReg" required autoCapitalize="characters" autoComplete="off"
                value={form.vehicleReg} onChange={(e) => set('vehicleReg', e.target.value.toUpperCase())}
                placeholder="KL 07 AB 1234" className={inputClass}/>
            </label>
            <label className={labelClass}>Make
              <input name="vehicleMake" list="job-vehicle-makes" value={form.vehicleMake}
                maxLength={80} onChange={(e) => set('vehicleMake', e.target.value)}
                placeholder="e.g. Toyota" className={inputClass}/>
              <datalist id="job-vehicle-makes">
                {[...new Set(['Toyota', 'Maruti Suzuki', 'Hyundai', 'Tata', 'Honda',
                  ...customerVehicles.map((vehicle) => splitVehicleMakeModel(vehicle).make).filter(Boolean)])]
                  .map((make) => <option key={make} value={make}/>)}
              </datalist>
            </label>
            <label className={labelClass}>Model
              <input name="vehicleModel" list="job-vehicle-models" value={form.vehicleModel}
                maxLength={80} onChange={(e) => set('vehicleModel', e.target.value)}
                placeholder="e.g. Innova" className={inputClass}/>
              <datalist id="job-vehicle-models">
                {[...new Set(customerVehicles
                  .filter((vehicle) => !form.vehicleMake ||
                    splitVehicleMakeModel(vehicle).make.toLowerCase() === form.vehicleMake.toLowerCase())
                  .map((vehicle) => splitVehicleMakeModel(vehicle).model).filter(Boolean))]
                  .map((model) => <option key={model} value={model}/>)}
              </datalist>
            </label>
            <label className={labelClass}>Fuel Type
              <select name="fuelType" value={form.fuelType} onChange={(e) => set('fuelType',e.target.value)} className={inputClass}>
                <option value="">Select fuel type</option>
                {['Petrol','Diesel','CNG','LPG','Electric','Hybrid','Other'].map((fuel) => <option key={fuel}>{fuel}</option>)}
                {form.fuelType && !['Petrol','Diesel','CNG','LPG','Electric','Hybrid','Other'].includes(form.fuelType)
                  && <option value={form.fuelType}>{form.fuelType} (existing)</option>}
              </select>
            </label>
            <label className={labelClass}>KM Reading
              <input name="kilometre" type="number" min="0" max="999999999" step="1"
                value={form.kilometre} onChange={(e) => set('kilometre', e.target.value)}
                placeholder="52400" className={inputClass}/>
            </label>
            <label className={labelClass}>Fuel Level
              <select name="fuelLevel" value={form.fuelLevel} onChange={(e) => set('fuelLevel', e.target.value)} className={inputClass}>
                {['Empty','10%','25%','50%','75%','Full'].map((item)=><option key={item}>{item}</option>)}
                {form.fuelLevel && !['Empty','10%','25%','50%','75%','Full'].includes(form.fuelLevel)
                  && <option value={form.fuelLevel}>{form.fuelLevel} (existing)</option>}
              </select>
            </label>
          </div>
          <div className="job-create-vehicle-advanced">
            <button type="button" className="job-create-vehicle-advanced-toggle"
              aria-expanded={advancedVehicleOpen} aria-controls="job-create-vehicle-advanced-content"
              onClick={() => setAdvancedVehicleOpen((open) => !open)}>
              <span>Advanced Vehicle Details · VIN / Chassis (optional)</span>
              <ChevronDown size={18} aria-hidden="true" className={advancedVehicleOpen ? 'is-open' : ''}/>
            </button>
            {advancedVehicleOpen && <div id="job-create-vehicle-advanced-content" className="job-create-vehicle-advanced-content">
              <label className={labelClass}>VIN / Chassis
                <input name="vin" value={form.vin} maxLength={64}
                  onChange={(e) => set('vin', e.target.value.toUpperCase())}
                  placeholder="VIN / chassis number" className={inputClass}/>
              </label>
            </div>}
          </div>
          {selectedVehicleId && can('vehicles.edit') && <label className="job-create-vehicle-update">
            <input type="checkbox" checked={form.vehicleDetailsUpdate}
              onChange={(e) => set('vehicleDetailsUpdate',e.target.checked)}/>
            Update saved vehicle make, model, fuel type and KM reading with these values
          </label>}

          {historyLoading ? <div className="mt-3 text-xs text-muted">Checking vehicle history…</div> : history.length ? (
            <div className="job-create-history mt-4 rounded-xl border border-primary/20 bg-primary-soft p-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-primary"><History size={15}/>{history.length} previous job card{history.length > 1 ? 's' : ''} found</div>
              <div className="mt-2 text-[11px] text-secondary">
                Last visit: <strong className="text-content">{history[0].createdDate}</strong> · {history[0].status} · {history[0].customerName}
              </div>
            </div>
          ) : null}
        </section>

        <section className="job-create-section rounded-2xl border border-line bg-surface p-4 md:p-5" id="job-step-assignment">
          <div className="job-create-section-heading">
            <div>
              <h2 className="text-base font-extrabold text-content"><span className="job-create-title-step">{stepNumber('assignment')}</span> Technician & Service Assignment</h2>
              <p>Assign a workshop technician and choose the initial priority.</p>
            </div>
          </div>
          <div className="job-create-fields-grid job-create-assignment-grid mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={labelClass}>Assigned Technician
              <select name="assignedEmployeeId" value={form.assignedEmployeeId}
                onChange={(e) => assignStaff(e.target.value)} className={inputClass}>
                <option value="">Unassigned</option>
                {staff.map((item)=><option key={item.id} value={item.id}>{item.name} · {item.designation}</option>)}
              </select>
            </label>
            {jobMode === 'advanced' && <label className={labelClass}>Service Advisor
              <select name="serviceAdvisorEmployeeId" value={form.serviceAdvisorEmployeeId}
                onChange={(event) => {
                  const selected = staff.find((row) => row.id === event.target.value);
                  setForm((old) => ({
                    ...old,
                    serviceAdvisorEmployeeId: event.target.value,
                    serviceAdvisor: selected?.name || '',
                  }));
                  setReview(false);
                }} className={inputClass}>
                <option value="">Current logged-in advisor</option>
                {staff.map((item)=><option key={item.id} value={item.id}>{item.name} · {item.designation}</option>)}
              </select>
            </label>}
            <label className={labelClass}>Priority
              <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className={inputClass}>
                <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
              </select>
            </label>
            {jobMode === 'advanced' && <label className={labelClass}>Initial Status
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
                <option>New</option><option>Inspection</option>
              </select>
            </label>}
            {jobMode === 'advanced' && <label className={labelClass + ' md:col-span-2'}>Internal Notes
              <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)}
                className="mt-1 min-h-24 w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-content outline-none focus:border-primary"/>
            </label>}
          </div>
          {jobMode === 'advanced' && <p className="job-create-advanced-notice" role="note">
            Additional fault codes, inspection, parts, work & labour, labour hours, estimates and invoices
            are managed in the existing Job Card workspace after creation. All information entered here stays saved while switching modes.
          </p>}
        </section>

        <section className="job-create-section rounded-2xl border border-line bg-surface p-4 md:p-5" id="job-step-photos">
          <div className="job-create-section-heading">
            <div>
              <h2 className="text-base font-extrabold text-content"><span className="job-create-title-step">{stepNumber('photos')}</span> Vehicle Photos / Inspection</h2>
              <p>Capture on mobile or upload gallery photos. Photos are optional and stay private until published.</p>
            </div>
          </div>
          <VehicleCameraQueue photos={pendingPhotos}
            onChange={(updater) => { setPendingPhotos(updater); if (!savedJobId) setReview(false); }}
            disabled={saving} uploading={uploadProgress} uploadingPhotoId={uploadingPhotoId} uploadTotal={uploadTotal}/>
        </section>

        {review && <div id="job-card-review" className="job-create-review-wrap">
          <div className="job-create-review-label"><span className="job-create-title-step">{stepNumber('review')}</span> Review & Create</div>
          <JobCardReview form={form} complaints={buildJobComplaints(complaints)}
            photos={pendingPhotos} uploadedPhotosCount={uploadedPhotosCount}
            jobNumber={createdJob?.jobNumber || createdJob?.job_number || ''}
            created={Boolean(savedJobId)} onPrint={() => window.print()}/>
        </div>}

        <div className="job-create-actions sticky bottom-0 z-20 flex gap-2 border-t border-line bg-surface/95 p-3 backdrop-blur md:static md:justify-end md:border-0 md:bg-transparent md:p-0" aria-label="Job Card form actions">
          <button type="button" className="h-11 flex-1 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-content md:flex-none" onClick={() => navigate('/jobs')}>Cancel</button>
          {review && !savedJobId && <button type="button"
            className="job-create-edit-again" onClick={() => setReview(false)}><RotateCcw size={17}/> Edit Details</button>}
          <button type="submit" disabled={saving || Boolean(savedJobId && !pendingPhotos.length)} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-0 bg-primary px-5 text-sm font-bold text-white md:flex-none">
            {review ? <CheckCircle2 size={17}/> : <Eye size={17}/>}
            {saving ? (savedJobId ? 'Uploading photos…' : 'Creating…')
              : savedJobId ? (pendingPhotos.length ? 'Retry Remaining Photos' : 'Job Card Created') : review ? 'Confirm & Create Job Card' : 'Review Job Card'}
          </button>
        </div>
      </form>
    </div>
  );
};
