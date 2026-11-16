import { recordLabel } from '../../utils/recordReferences.js';
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Repeat2, Car, IndianRupee, Phone, MessageSquare, Wrench, FileText, AlertTriangle, CalendarClock, ChevronRight, Building2, Gauge, PackageCheck, TrendingUp, UserX } from "lucide-react";
import { CustomerOverview } from '../../components/customers/CustomerOverview';
import { customerService } from '../../services/customer.service';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

const OPEN_JOB_STATUSES = new Set([
  'New', 'Checked In', 'Inspection', 'Estimate Pending', 'Awaiting Approval',
  'Approved', 'In Progress', 'Waiting for Parts', 'QC', 'Quality Check', 'Ready for Delivery'
]);

const parseKm = (value) => Number(String(value || '').replace(/[^0-9]/g, '')) || 0;

const addMonths = (dateValue, months) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
};

const Metric = ({ label, value, icon: Icon, tone = 'primary', note }) => (
  <article className="customer-metric-card">
    <div className="customer-metric-card__top">
      <span>{label}</span>
      <i className={`is-${tone}`}><Icon size={16}/></i>
    </div>
    <strong>{value}</strong>
    {note ? <small>{note}</small> : null}
  </article>
);

const SectionHeader = ({ title, description, action }) => (
  <div className="customer-section-header">
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
    {action || null}
  </div>
);

const Empty = ({ text }) => <div className="customer-empty">{text}</div>;

export const CustomerManagementSection = ({ section }) => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lookup, setLookup] = useState('');

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        const customers = await customerService.getCustomers();
        const enriched = await Promise.all(
          customers.map(async (customer) => {
            const [vehicles, jobs, invoices, payments, activity] = await Promise.all([
              customerService.getCustomerVehicles(customer.id),
              customerService.getCustomerJobs(customer.id),
              customerService.getCustomerInvoices(customer.id),
              customerService.getCustomerPayments(customer.id),
              customerService.getCustomerActivity(customer.id)
            ]);

            const totalBilled = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);
            const totalPaid = invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0);
            const outstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0);

            return {
              customer,
              vehicles,
              jobs,
              invoices,
              payments,
              activity,
              totalBilled,
              totalPaid,
              outstanding
            };
          })
        );

        if (alive) setRecords(enriched);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => { alive = false; };
  }, []);

  const flattenedVehicles = useMemo(
    () => records.flatMap((record) =>
      record.vehicles.map((vehicle) => ({ ...vehicle, customer: record.customer, record }))
    ),
    [records]
  );

  const flattenedJobs = useMemo(
    () => records.flatMap((record) =>
      record.jobs.map((job) => ({ ...job, customer: record.customer, record }))
    ),
    [records]
  );

  const outstandingInvoices = useMemo(
    () => records.flatMap((record) =>
      record.invoices
        .filter((invoice) => Number(invoice.balanceDue || 0) > 0)
        .map((invoice) => ({ ...invoice, customer: record.customer, record }))
    ),
    [records]
  );

  const lookupResult = useMemo(() => {
    const q = lookup.trim().toLowerCase();
    if (!q) return null;

    for (const record of records) {
      const customer = record.customer;
      const vehicle = record.vehicles.find((item) =>
        String(item.regNo || '').toLowerCase().includes(q) ||
        String(item.vin || '').toLowerCase().includes(q)
      );

      const job = record.jobs.find((item) =>
        String(item.vehicleReg || '').toLowerCase().includes(q) ||
        String(item.jobNumber || item.id || '').toLowerCase().includes(q)
      );

      const customerMatch =
        String(customer.name || '').toLowerCase().includes(q) ||
        String(customer.phone || '').toLowerCase().includes(q);

      if (vehicle || job || customerMatch) {
        const targetReg = vehicle?.regNo || job?.vehicleReg || record.vehicles[0]?.regNo || '';
        const vehicleJobs = record.jobs
          .filter((item) => !targetReg || item.vehicleReg === targetReg)
          .sort((a, b) => String(b.createdDate || '').localeCompare(String(a.createdDate || '')));
        const latestJob = vehicleJobs[0] || null;
        const openJob = vehicleJobs.find((item) => OPEN_JOB_STATUSES.has(item.status)) || null;
        const replacedParts = [...new Set(
          vehicleJobs.flatMap((item) => (item.partsUsed || []).map((part) => part.name || part.partName))
        )].filter(Boolean).slice(0, 5);

        return {
          record,
          vehicle: vehicle || record.vehicles.find((item) => item.regNo === targetReg) || record.vehicles[0] || null,
          latestJob,
          openJob,
          replacedParts
        };
      }
    }

    return { notFound: true };
  }, [lookup, records]);

  const metrics = useMemo(() => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return {
      total: records.length,
      newCustomers: records.filter(({ customer }) => String(customer.createdAt || '').startsWith(yearMonth)).length,
      returning: records.filter(({ jobs }) => jobs.length > 1).length,
      activeVehicles: flattenedVehicles.length,
      outstanding: records.reduce((sum, record) => sum + record.outstanding, 0)
    };
  }, [records, flattenedVehicles.length]);

  if (loading) return <div className="customer-empty">Loading customer management data...</div>;

  if (section === 'overview') {
    return (
      <CustomerOverview
        metrics={metrics}
        records={records}
        outstandingInvoices={outstandingInvoices}
        lookup={lookup}
        setLookup={setLookup}
        lookupResult={lookupResult}
        formatMoney={(value) => money.format(value || 0)}
        onNavigate={navigate}
      />
    );
  }

  if (section === 'vehicles') {
    return (
      <div className="customer-management-view">
        <SectionHeader title="Customer Vehicles" description="All vehicles linked to customer profiles with service and job access."/>
        <div className="customer-vehicle-grid">
          {flattenedVehicles.map((vehicle) => {
            const jobs = vehicle.record.jobs.filter((job) => job.vehicleReg === vehicle.regNo);
            const openJob = jobs.find((job) => OPEN_JOB_STATUSES.has(job.status));
            return (
              <article key={vehicle.id} className="customer-vehicle-card">
                <div className="customer-vehicle-card__head">
                  <div><strong>{vehicle.regNo}</strong><span>{vehicle.makeModel || 'Vehicle'}</span></div>
                  <Car size={17}/>
                </div>
                <div className="customer-detail-grid">
                  <div><span>Customer</span><b>{vehicle.customer.name}</b></div>
                  <div><span>Year</span><b>{vehicle.year || '—'}</b></div>
                  <div><span>Fuel</span><b>{vehicle.fuelType || '—'}</b></div>
                  <div><span>KM</span><b>{vehicle.kilometres || '—'}</b></div>
                  <div><span>VIN</span><b>{vehicle.vin || '—'}</b></div>
                  <div><span>Last Service</span><b>{vehicle.lastService || '—'}</b></div>
                </div>
                <div className="customer-card-actions">
                  <button onClick={() => navigate(`/customers/${vehicle.customer.id}`)}>Customer Profile</button>
                  <button className="is-primary" onClick={() => navigate(`/jobs/new?customerId=${vehicle.customer.id}&vehicle=${encodeURIComponent(vehicle.regNo)}`)}>
                    {openJob ? 'New Job Card' : 'Create Job Card'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  if (section === 'service-history') {
    return (
      <div className="customer-management-view">
        <SectionHeader title="Service History" description="Previous Job Cards, repairs, replaced parts, labour and mileage across customer vehicles."/>
        <div className="customer-history-list">
          {flattenedJobs
            .slice()
            .sort((a,b)=>String(b.createdDate||'').localeCompare(String(a.createdDate||'')))
            .map((job) => (
              <article key={job.id} className="customer-history-card" onClick={() => navigate(`/jobs/${job.id}/overview`)}>
                <div className="customer-history-card__head">
                  <div><strong>{recordLabel(job.jobNumber || job.id)}</strong><span>{job.createdDate} · {job.status}</span></div>
                  <ChevronRight size={15}/>
                </div>
                <div className="customer-history-card__vehicle">{job.vehicleReg} · {job.vehicleInfo || 'Vehicle'} · {job.customer.name}</div>
                <div className="customer-history-meta">
                  <span><Gauge size={12}/>{job.kilometre || 'KM —'}</span>
                  <span><Wrench size={12}/>{(job.services || job.labourRecords || []).length} work item(s)</span>
                  <span><PackageCheck size={12}/>{(job.partsUsed || []).length} part(s)</span>
                  <span><IndianRupee size={12}/>{money.format(job.billing?.invoiceTotal || job.estimates?.at(-1)?.grandTotal || 0)}</span>
                </div>
                {(job.partsUsed || []).length ? (
                  <div className="customer-history-parts">
                    {(job.partsUsed || []).slice(0,4).map((part) => <b key={part.id}>{part.name || part.partName}</b>)}
                  </div>
                ) : null}
              </article>
            ))}
        </div>
      </div>
    );
  }

  if (section === 'outstanding') {
    const totalOutstanding = outstandingInvoices.reduce((sum, item) => sum + Number(item.balanceDue || 0), 0);
    return (
      <div className="customer-management-view">
        <div className="customer-metric-grid is-three">
          <Metric label="Outstanding Customers" value={new Set(outstandingInvoices.map((item)=>item.customer.id)).size} icon={Users} tone="warning"/>
          <Metric label="Pending Invoices" value={outstandingInvoices.length} icon={FileText} tone="warning"/>
          <Metric label="Total Due" value={money.format(totalOutstanding)} icon={IndianRupee} tone="warning"/>
        </div>

        <SectionHeader title="Outstanding Payments" description="Pending invoices, partial payments, due amount and latest payment context."/>
        <div className="customer-outstanding-list">
          {outstandingInvoices.map((invoice) => (
            <article key={`${invoice.customer.id}-${invoice.invoiceNo}`} className="customer-outstanding-card">
              <div>
                <strong>{invoice.customer.name}</strong>
                <span>{invoice.invoiceNo} · {invoice.vehicle} · {invoice.date}</span>
              </div>
              <div className="customer-outstanding-values">
                <span>Total <b>{money.format(invoice.totalAmount)}</b></span>
                <span>Paid <b>{money.format(invoice.paidAmount)}</b></span>
                <span>Due <b>{money.format(invoice.balanceDue)}</b></span>
              </div>
              <div className="customer-card-actions">
                <a href={`tel:${invoice.customer.phone}`}><Phone size={13}/> Call</a>
                <button onClick={() => navigate(`/customers/${invoice.customer.id}`)}><MessageSquare size={13}/> Payment Reminder</button>
              </div>
            </article>
          ))}
          {!outstandingInvoices.length ? <Empty text="No outstanding payments."/> : null}
        </div>
      </div>
    );
  }

  if (section === 'reminders') {
    const reminders = flattenedVehicles.map((vehicle, index) => {
      const latestJob = vehicle.record.jobs
        .filter((job)=>job.vehicleReg === vehicle.regNo)
        .sort((a,b)=>String(b.createdDate||'').localeCompare(String(a.createdDate||'')))[0];

      const lastDate = latestJob?.createdDate || vehicle.lastService || '';
      const currentKm = parseKm(latestJob?.kilometre || vehicle.kilometres);
      const nextKm = currentKm ? currentKm + 10000 : 10000;

      return {
        id: `REM-${vehicle.id}`,
        customer: vehicle.customer,
        vehicle,
        lastDate,
        nextServiceDate: addMonths(lastDate, 6) || 'Not scheduled',
        nextKm,
        type: index % 3 === 0 ? 'Oil Change / Service' : index % 3 === 1 ? 'Insurance / Registration' : 'General Service'
      };
    });

    return (
      <div className="customer-management-view">
        <SectionHeader title="Service Reminders" description="Next service date / KM, oil change and vehicle document reminder queue."/>
        <div className="customer-reminder-grid">
          {reminders.map((reminder) => (
            <article key={reminder.id} className="customer-reminder-card">
              <div className="customer-reminder-card__icon"><CalendarClock size={17}/></div>
              <div className="customer-reminder-card__body">
                <strong>{reminder.vehicle.regNo} · {reminder.type}</strong>
                <span>{reminder.customer.name} · {reminder.customer.phone}</span>
                <div>
                  <b>Next: {reminder.nextServiceDate}</b>
                  <b>{reminder.nextKm.toLocaleString('en-IN')} km</b>
                </div>
              </div>
              <button onClick={() => navigate(`/customers/${reminder.customer.id}`)}>Open</button>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'reports') {
    const returning = records.filter((record)=>record.jobs.length > 1);
    const inactive = records.filter((record)=>record.customer.status !== 'Active');
    const fleet = records.filter((record)=>['Business / Company','Company/Fleet','Fleet'].includes(record.customer.customerType));
    const topRevenue = records.slice().sort((a,b)=>b.totalBilled-a.totalBilled);

    return (
      <div className="customer-management-view">
        <div className="customer-metric-grid is-four">
          <Metric label="New" value={metrics.newCustomers} icon={UserPlus}/>
          <Metric label="Returning" value={returning.length} icon={Repeat2}/>
          <Metric label="Inactive" value={inactive.length} icon={UserX} tone="danger"/>
          <Metric label="Fleet / Company" value={fleet.length} icon={Building2}/>
        </div>

        <div className="customer-two-column">
          <section className="customer-panel">
            <SectionHeader title="Top Customers by Revenue" description="Billed value from linked workshop jobs."/>
            <div className="customer-row-list">
              {topRevenue.slice(0,6).map((record,index)=>(
                <div key={record.customer.id} className="customer-data-row">
                  <div><strong>#{index+1} {record.customer.name}</strong><span>{record.jobs.length} job(s) · {record.vehicles.length} vehicle(s)</span></div>
                  <b>{money.format(record.totalBilled)}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="customer-panel">
            <SectionHeader title="Outstanding Customers" description="Current unpaid / partially paid customer balances."/>
            <div className="customer-row-list">
              {records.filter((record)=>record.outstanding>0).sort((a,b)=>b.outstanding-a.outstanding).map((record)=>(
                <div key={record.customer.id} className="customer-data-row">
                  <div><strong>{record.customer.name}</strong><span>{record.customer.customerType} · {record.customer.phone}</span></div>
                  <b className="is-warning">{money.format(record.outstanding)}</b>
                </div>
              ))}
              {!records.some((record)=>record.outstanding>0) ? <Empty text="No outstanding customers."/> : null}
            </div>
          </section>
        </div>

        <section className="customer-panel">
          <SectionHeader title="Customer Mix" description="New vs returning, inactive and fleet account summary."/>
          <div className="customer-report-grid">
            <div><TrendingUp size={16}/><span>Returning Customers</span><strong>{returning.length}</strong></div>
            <div><UserPlus size={16}/><span>New This Month</span><strong>{metrics.newCustomers}</strong></div>
            <div><UserX size={16}/><span>Inactive Customers</span><strong>{inactive.length}</strong></div>
            <div><Building2 size={16}/><span>Fleet Accounts</span><strong>{fleet.length}</strong></div>
            <div><IndianRupee size={16}/><span>Total Revenue</span><strong>{money.format(records.reduce((sum,r)=>sum+r.totalBilled,0))}</strong></div>
            <div><AlertTriangle size={16}/><span>Total Outstanding</span><strong>{money.format(metrics.outstanding)}</strong></div>
          </div>
        </section>
      </div>
    );
  }

  return <Empty text="Customer management section is not available."/>;
};

export default CustomerManagementSection;
