import { recordLabel } from '../../utils/recordReferences.js';
import { appConfirm } from '../../components/common/appDialogs';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Home,
  ChevronRight,
  Image,
  CalendarClock,
  Car,
  ClipboardList,
  Edit3,
  FileText,
  Gauge,
  IndianRupee,
  Phone,
  ShieldCheck,
  Trash2,
  User,
  Wrench
} from 'lucide-react';
import { vehicleService } from '../../services/vehicle.service';
import { VehiclePhotoGallery } from '../../components/vehicles/VehiclePhotoGallery';
import { customerService } from '../../services/customer.service';
import { jobService } from '../../services/job.service';
import '../../styles/vehicle-management.css';
import '../../styles/vehicle-polish.css';
import '../../styles/vehicle-readable.css';
import '../../styles/vehicle-compact-cleanup.css';
import '../../styles/vehicle-profile-refresh.css';
import { knownVehicleMoney, vehicleInvoiceRows, vehicleTotalPaid, latestFirstVehicleJobs } from './vehicleProfileFinancials';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const OPEN_JOB_STATUSES = new Set([
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
  'Ready for Delivery'
]);

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'photos', label: 'Photos & Customer Sharing' },
  { id: 'service-history', label: 'Service History' },
  { id: 'parts', label: 'Parts Replaced' },
  { id: 'invoices', label: 'Invoices & Payments' },
  { id: 'reminders', label: 'Reminders' }
];

const Info = ({ label, value }) => (
  <div className="vehicle-info-card">
    <span>{label}</span>
    <strong>{value === null || value === undefined || value === '' ? '—' : value}</strong>
  </div>
);

export const VehicleDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = hasPermission(user, 'vehicles.edit');
  const canCreateJob = hasPermission(user, 'jobs.create');
  const canDelete = hasPermission(user, 'vehicles.delete');
  const [vehicle, setVehicle] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError('');
      setVehicle(null);
      setCustomer(null);
      setHistory([]);
      try {
        const nextVehicle = await vehicleService.getVehicleById(id);
        if (!nextVehicle) {
          if (alive) setVehicle(null);
          return;
        }

        const [nextCustomer, nextHistory] = await Promise.all([
          nextVehicle.customerId
            ? customerService.getCustomerById(nextVehicle.customerId)
            : Promise.resolve(null),
          jobService.getVehicleHistory(nextVehicle.registration)
        ]);

        if (alive) {
          setVehicle(nextVehicle);
          setCustomer(nextCustomer);
          setHistory(latestFirstVehicleJobs(Array.isArray(nextHistory) ? nextHistory : []));
        }
      } catch (loadError) {
        if (alive) setError(loadError?.message || 'Unable to load this vehicle.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => { alive = false; };
  }, [id, reloadKey]);

  const openJob = useMemo(
    () => history.find((job) => OPEN_JOB_STATUSES.has(job.status)) || null,
    [history]
  );

  const parts = useMemo(
    () => history.flatMap((job) =>
      (job.partsUsed || []).map((part, index) => ({
        ...part,
        key: `${job.id}-${part.id || index}`,
        jobId: job.id,
        jobNumber: recordLabel(job.jobNumber || job.id),
        date: job.createdDate
      }))
    ),
    [history]
  );

  const invoices = useMemo(() => vehicleInvoiceRows(history), [history]);
  const totalSpend = useMemo(() => vehicleTotalPaid(invoices), [invoices]);
  const displayMoney = (value) => value === null ? '—' : money.format(value);

  const latestJob = history[0] || null;

  const archived = String(vehicle?.status || '').toLowerCase() === 'archived';
  const removeVehicle = async () => {
    if (!canDelete || !vehicle || archived ||
      !await appConfirm(`Archive vehicle ${vehicle.registration}? Service and invoice records will be preserved.`)) return;
    try {
      await vehicleService.archiveVehicle(vehicle.id);
      setReloadKey((value) => value + 1);
    } catch (archiveError) {
      setError(archiveError?.message || 'Unable to archive this vehicle.');
    }
  };

  const restoreVehicle = async () => {
    if (!canEdit || !vehicle || !archived ||
      !await appConfirm(`Restore vehicle ${vehicle.registration} to active service?`)) return;
    try {
      await vehicleService.restoreVehicle(vehicle.id);
      setReloadKey((value) => value + 1);
    } catch (restoreError) {
      setError(restoreError?.message || 'Unable to restore this vehicle.');
    }
  };

  if (loading) return <div className="vehicle-empty" role="status">Loading vehicle profile...</div>;
  if (error && !vehicle) return (
    <div className="vehicle-dashboard-error" role="alert">
      <p>{error}</p>
      <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
      <Link to="/vehicles" className="vehicle-recovery-link">View Vehicle Directory</Link>
    </div>
  );
  if (!vehicle) return (
    <div className="vehicle-dashboard-error">
      <p>Vehicle not found.</p>
      <Link to="/vehicles" className="vehicle-recovery-link">View Vehicle Directory</Link>
    </div>
  );

  return (
    <div className="vehicle-management-page vehicle-profile-page cg-vehicles">
      <nav className="cg-vehicle-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/"><Home size={14} aria-hidden="true"/> Home</Link>
        <ChevronRight size={13} aria-hidden="true"/>
        <Link to="/vehicles">Vehicles</Link>
        <ChevronRight size={13} aria-hidden="true"/>
        <span aria-current="page">{vehicle.registration}</span>
      </nav>
      {error ? <div className="vehicle-dashboard-error" role="alert">{error}</div> : null}
      <header className="vehicle-profile-header">
        <div>
          <div className="cg-vehicle-profile-title">
            <h1>{vehicle.registration}</h1>
            <span className={'cg-vehicle-status ' + (archived ? 'is-archived' : 'is-active')}>
              <span aria-hidden="true"/> {archived ? 'Archived' : 'Active'}
            </span>
          </div>
          <p>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle'}
            {vehicle.variant ? ` · ${vehicle.variant}` : ''}
            {vehicle.year ? ` · ${vehicle.year}` : ''}</p>
        </div>

        <div className="vehicle-profile-actions">
          {canEdit ? <button type="button" onClick={() => navigate(`/vehicles/${vehicle.id}/edit`)}><Edit3 size={16}/> Edit</button> : null}
          {canCreateJob && !archived && String(customer?.status || vehicle.customerStatus || '').toLowerCase() !== 'archived' ? (
            <button
              type="button"
              className="is-primary"
              onClick={() => navigate(`/jobs/new?customerId=${vehicle.customerId || ''}&vehicle=${encodeURIComponent(vehicle.registration || '')}`)}
            >
              <ClipboardList size={16}/> New Job Card
            </button>
          ) : null}
        </div>
      </header>

      {openJob && hasPermission(user, 'jobs.view') ? (
        <button type="button" className="vehicle-current-job" onClick={() => navigate(`/jobs/${openJob.id}/overview`)}>
          <ClipboardList size={16}/>
          <div>
            <strong>{recordLabel(openJob.jobNumber || openJob.id)}</strong>
            <span>Current Job Card · {openJob.status}</span>
          </div>
          <b>Open Job</b>
        </button>
      ) : null}

      <div className="vehicle-profile-kpis">
        <div><Gauge size={15}/><span>Odometer</span><strong>{latestJob?.kilometre || vehicle.odometer || '—'}</strong></div>
        <div><Wrench size={15}/><span>Service Visits</span><strong>{history.length}</strong></div>
        <div><ClipboardList size={15}/><span>Current Job</span><strong>{openJob ? recordLabel(openJob.jobNumber || openJob.id) : '—'}</strong></div>
        <div><IndianRupee size={15}/><span>Total Paid</span><strong>{displayMoney(totalSpend)}</strong></div>
      </div>

      <nav className="vehicle-profile-tabs scroll-hidden" aria-label="Vehicle information sections"
        role="tablist">
        {tabs.map((tab, index) => (
          <button
            type="button"
            key={tab.id}
            id={'vehicle-tab-' + tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls="vehicle-profile-tab-content"
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 0
                : event.key === 'End' ? tabs.length - 1
                  : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
              setActiveTab(tabs[next].id);
              event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next]?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div id="vehicle-profile-tab-content" className="cg-vehicle-tab-content"
        role="tabpanel" aria-labelledby={'vehicle-tab-' + activeTab}>
      {activeTab === 'overview' ? (
        <div className="vehicle-two-column">
          <section className="vehicle-panel">
            <div className="vehicle-section-header">
              <div>
                <h2>Vehicle Technical Profile</h2>
              </div>
              <Car size={18}/>
            </div>

            <div className="vehicle-info-grid">
              <Info label="Registration Number" value={vehicle.registration}/>
              <Info label="Make / Model" value={`${vehicle.make} ${vehicle.model}`.trim()}/>
              <Info label="Variant" value={vehicle.variant}/>
              <Info label="Year" value={vehicle.year}/>
              <Info label="Fuel Type" value={vehicle.fuelType}/>
              <Info label="Transmission" value={vehicle.transmission}/>
              <Info label="Colour" value={vehicle.color}/>
              <Info label="VIN / Chassis" value={vehicle.vin}/>
              <Info label="Engine Number" value={vehicle.engineNo}/>
              <Info label="Current KM" value={latestJob?.kilometre || vehicle.odometer}/>
            </div>
          </section>

          <section className="vehicle-panel">
            <div className="vehicle-section-header">
              <div>
                <h2>Owner & Service</h2>
              </div>
              <User size={18}/>
            </div>

            <button
              type="button"
              className="vehicle-owner-profile"
              onClick={() => vehicle.customerId && navigate(`/customers/${vehicle.customerId}`)}
              disabled={!vehicle.customerId}
            >
              <User size={16}/>
              <div>
                <strong>{customer?.name || vehicle.customerName || 'Unknown Customer'}</strong>
                <span>{customer?.phone || vehicle.customerPhone || 'No contact number'}</span>
              </div>
            </button>

            <div className="vehicle-info-grid">
              <Info label="Last Service" value={vehicle.lastServiceDate}/>
              <Info label="Next Service Due" value={vehicle.nextServiceDue}/>
              <Info label="Insurance Expiry" value={vehicle.insuranceExpiry}/>
              <Info label="Vehicle Status" value={vehicle.status}/>
            </div>

            {(customer?.phone || vehicle.customerPhone) ? (
              <a className="vehicle-contact-button" href={`tel:${customer?.phone || vehicle.customerPhone}`}>
                <Phone size={14}/> Call Customer
              </a>
            ) : null}
          </section>

          {vehicle.notes ? (
            <section className="vehicle-panel vehicle-wide-panel">
              <div className="vehicle-section-header">
                <div>
                  <h2>Vehicle Notes</h2>
                </div>
              </div>
              <div className="vehicle-note-box">{vehicle.notes}</div>
            </section>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'overview' && (
        <section className="cg-vehicle-share-navigation">
          <div>
            <Image size={19} aria-hidden="true"/>
            <div>
              <h2>Vehicle Photos & Customer Sharing</h2>
              <p>Manage inspection photos and choose which images customers can view.</p>
            </div>
          </div>
          <button type="button" onClick={() => setActiveTab('photos')}>
            Manage Photos <ChevronRight size={16} aria-hidden="true"/>
          </button>
        </section>
      )}

      {activeTab === 'photos' && (
        <VehiclePhotoGallery vehicleId={vehicle.id} canEdit={canEdit} canPublish={canEdit}/>
      )}

      {activeTab === 'service-history' ? (
        <section className="vehicle-panel">
          <div className="vehicle-section-header">
            <div>
              <h2>Service & Job Card History</h2>
            </div>
          </div>

          <div className="vehicle-history-list">
            {history.map((job) => (
              <button type="button" key={job.id} className="vehicle-history-card" onClick={() => navigate(`/jobs/${job.id}/overview`)}>
                <div className="vehicle-history-card__head">
                  <div>
                    <strong>{recordLabel(job.jobNumber || job.id)}</strong>
                    <span>{job.createdDate} · {job.status}</span>
                  </div>
                  <b>{job.kilometre || 'KM —'}</b>
                </div>

                <div className="vehicle-history-card__meta">
                  <span>{(job.complaints || []).length} complaint(s)</span>
                  <span>{(job.labourRecords || job.services || []).length} labour item(s)</span>
                  <span>{(job.partsUsed || []).length} part(s)</span>
                  {job.billing?.invoiceNumber && <span>Invoice: {displayMoney(knownVehicleMoney(job.billing.invoiceTotal))}</span>}
                </div>
              </button>
            ))}
            {!history.length ? <div className="vehicle-empty">No Job Card history for this registration.</div> : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'parts' ? (
        <section className="vehicle-panel">
          <div className="vehicle-section-header">
            <div>
              <h2>Parts Replaced</h2>
            </div>
          </div>

          <div className="vehicle-parts-grid">
            {parts.map((part) => (
              <article key={part.key} className="vehicle-part-card">
                <div>
                  <strong>{part.name || part.partName || 'Part'}</strong>
                  <span>{part.sku || 'No SKU'} · {part.date}</span>
                </div>
                <div className="vehicle-part-card__meta">
                  {hasPermission(user, 'jobs.view') ? <button type="button" className="vehicle-part-job-link" onClick={() => navigate(`/jobs/${part.jobId}/overview`)}>Job {part.jobNumber}</button> : <span>Job {part.jobNumber}</span>}
                  <span>Qty <b>{part.qty ?? part.quantity ?? '—'}</b></span>
                  <span>Price <b>{displayMoney(knownVehicleMoney(part.total ?? part.unitPrice))}</b></span>
                </div>
              </article>
            ))}
            {!parts.length ? <div className="vehicle-empty">No replacement parts recorded.</div> : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'invoices' ? (
        <section className="vehicle-panel">
          <div className="vehicle-section-header">
            <div>
              <h2>Invoices & Payment Ledger</h2>
            </div>
            <FileText size={18}/>
          </div>

          <div className="vehicle-invoice-list">
            {invoices.map((invoice) => (
              <button type="button" key={invoice.jobId} className="vehicle-invoice-row" onClick={() => navigate(`/jobs/${invoice.jobId}/invoice`)}>
                <div>
                  <strong>{invoice.invoiceNo}</strong>
                  <span>{invoice.jobNumber} · {invoice.date}</span>
                </div>
                <div><span>Total</span><b>{displayMoney(invoice.total)}</b></div>
                <div><span>Paid</span><b>{displayMoney(invoice.paid)}</b></div>
                <div><span>Balance</span><b>{displayMoney(invoice.balance)}</b></div>
                <em>{invoice.status}</em>
              </button>
            ))}
            {!invoices.length ? <div className="vehicle-empty">No vehicle invoices recorded.</div> : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'reminders' ? (
        <div className="vehicle-reminder-grid">
          <article className="vehicle-reminder-card">
            <CalendarClock size={18}/>
            <div>
              <strong>Next Service</strong>
              <span>{vehicle.nextServiceDue || 'Not scheduled'}</span>
              <small>Current KM: {latestJob?.kilometre || vehicle.odometer || '—'}</small>
            </div>
          </article>

          <article className="vehicle-reminder-card">
            <ShieldCheck size={18}/>
            <div>
              <strong>Insurance Expiry</strong>
              <span>{vehicle.insuranceExpiry || 'Not recorded'}</span>
            </div>
          </article>


        </div>
      ) : null}

      </div>

      {canDelete && !archived ? (
        <button type="button" className="vehicle-delete-button" onClick={removeVehicle}>
          <Trash2 size={16}/> Archive Vehicle
        </button>
      ) : null}
      {archived && canEdit ? (
        <button type="button" className="vehicle-delete-button" onClick={restoreVehicle}>
          Restore Vehicle
        </button>
      ) : null}
    </div>
  );
};

export default VehicleDetails;
