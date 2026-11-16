
import { Car, ChevronRight, User, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { jobInvoiceFinance, jobInvoiceGST } from '../../utils/jobGstFinance';
import { jobDisplayLabel, statusClass } from './jobs.utils';
import { JobCustomerContactActions } from './JobCustomerContactActions';
import { formatJobDirectoryDate } from './jobDirectoryDate';

export const JobRecordsPanel = ({
  jobs,
  layout = 'auto',
  totalCount = jobs.length,
  loading,
  hasError = false,
  status,
  searchTerm = '',
  hasActiveFilters = false,
  invoiceByJob = new Map(),
  showBilling = false,
  invoicesLoading = false,
  invoicesError = false,
  canViewGST = false,
  canViewPayments = false,
  canCollectPayments = false,
  canViewCustomers = false,
  canViewVehicles = false,
  canViewStaff = false,
}) => (
  <section className={'jobs-records-panel' + (layout === 'cards' ? ' is-card-layout' : '')} aria-label="Workshop Job Card records">
    <header className="jobs-records-head">
      <div>
        <span>Workshop Jobs</span>
        <h2>{status === 'All' ? 'Job Cards' : status + ' Job Cards'}</h2>
      </div>
      <strong aria-live="polite">{totalCount} record{totalCount === 1 ? '' : 's'}</strong>
    </header>

    {loading ? (
      <div className="jobs-state" role="status">Loading Job Cards…</div>
    ) : hasError ? (
      <div className="jobs-state is-error" role="status">Job Cards are unavailable. Use Retry above to load your workshop jobs.</div>
    ) : jobs.length === 0 ? (
      <div className="jobs-state is-empty" role="status">
        {hasActiveFilters || searchTerm || status !== 'All' ? 'No jobs match these filters. Adjust a filter or reset to view all jobs.' : 'No Job Cards yet. Create your first Job Card to begin.'}
      </div>
    ) : (
      <>
        <div className="jobs-table-wrap">
          <table className="jobs-table" aria-label="Job Card directory">
            <thead>
              <tr>
                <th scope="col">Job Card</th>
                <th scope="col">Vehicle</th>
                <th scope="col">Customer</th>
                <th scope="col">Assigned Staff</th>
                <th scope="col">Status</th>
                {showBilling && <th scope="col">GST / Invoice</th>}
                {showBilling && <th scope="col">Customer Payment</th>}
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const invoice = invoiceByJob.get(String(job.id));
                const finance = jobInvoiceFinance(invoice);
                const gst = finance.posted ? jobInvoiceGST(invoice) : null;
                const jobHref = `/jobs/${encodeURIComponent(job.id)}`;
                const vehicleId = job.vehicleId || job.vehicle?.id || job.vehicle_id;
                const customerId = job.customerId || job.customer?.id || job.customer_id;
                const staffId = job.assignedEmployeeId || job.assignedEmployee?.id || job.assigned_employee_id;
                return <tr key={job.id}>
                  <td>
                    <Link className="jobs-table-job-link" to={jobHref} title={`Open ${jobDisplayLabel(job)}`}>{jobDisplayLabel(job)}</Link>
                    <span className="jobs-directory-created" title={job.createdDate || ''}>{formatJobDirectoryDate(job.createdDate) || job.serviceType || 'Workshop service'}</span>
                  </td>
                  <td>
                    {canViewVehicles && vehicleId
                      ? <Link className="jobs-directory-entity-link" to={`/vehicles/${encodeURIComponent(vehicleId)}`}>{job.vehicleReg || 'Vehicle details'}</Link>
                      : <strong>{job.vehicleReg || 'No registration'}</strong>}
                    <span className="jobs-directory-vehicle-info" title={job.vehicleInfo || ''}>{job.vehicleInfo || 'Vehicle'}</span>
                  </td>
                  <td>
                    {canViewCustomers && customerId
                      ? <Link className="jobs-directory-entity-link" to={`/customers/${encodeURIComponent(customerId)}`}>{job.customerName || 'Customer details'}</Link>
                      : <strong>{job.customerName || 'Walk-in customer'}</strong>}
                    <span className="jobs-directory-phone">{job.customerPhone || '—'}</span>
                    <JobCustomerContactActions job={job} />
                  </td>
                  <td>{canViewStaff && staffId
                    ? <Link className="jobs-directory-entity-link" to={`/staff-management/staff/${encodeURIComponent(staffId)}`}>{job.assignedEmployeeName || 'View staff'}</Link>
                    : <strong>{job.assignedEmployeeName || 'Unassigned'}</strong>}</td>
                  <td>
                    <Link className={`jobs-status-chip jobs-directory-status-link is-${statusClass(job.status)}`}
                      to={`/jobs/${encodeURIComponent(job.id)}/status`}
                      aria-label={`View ${jobDisplayLabel(job)} status: ${job.status || 'New'}`}>
                      {job.status || 'New'}
                    </Link>
                    {job.inspection?.status === 'Skipped' && (
                      <span className="jobs-inspection-skip-tag" title={job.inspection.skipReason || 'Vehicle inspection skipped'}>Inspection skipped</span>
                    )}
                  </td>
                  {showBilling && <td>
                    {invoicesLoading ? <span className="jobs-finance-muted">Loading invoice…</span> : invoice ? (
                      <div className="jobs-gst-finance-cell">
                        <Link to={'/invoices/' + encodeURIComponent(invoice.id)}>{invoice.number || 'Invoice'}</Link>
                        <small>{invoice.status || 'Draft'} · {invoice.invoiceType === 'gst'
                          ? gst ? 'GST ₹' + gst.tax.toFixed(2) : 'GST pending finalization'
                          : 'No GST'}</small>
                        {canViewGST && finance.gstrUrl &&
                          <Link to={finance.gstrUrl}>GSTR-1</Link>}
                      </div>
                    ) : <span className="jobs-finance-muted">{invoicesError ? 'Invoice unavailable' : 'Not invoiced'}</span>}
                  </td>}
                  {showBilling && <td>
                    {!invoice || invoicesLoading
                      ? <span className="jobs-finance-muted">{invoicesError ? 'Unavailable' : '—'}</span>
                      : <div className="jobs-gst-finance-cell">
                        <small>{!finance.posted ? 'Invoice not finalized'
                          : canViewPayments ? finance.outstanding > 0 ? 'Payment due' : 'Paid'
                            : 'Payment balance restricted'}</small>
                        {canViewPayments && finance.posted && <>
                          <span className="jobs-financial-amount-line">Paid
                            <strong>₹{Number(invoice.paid || 0).toFixed(2)}</strong>
                          </span>
                          <span className="jobs-financial-amount-line">Due
                            <strong>₹{finance.outstanding.toFixed(2)}</strong>
                          </span>
                        </>}
                        {canCollectPayments && finance.paymentUrl &&
                          <Link className="jobs-finance-receive" to={finance.paymentUrl}>Receive Payment</Link>}
                        {canViewPayments && finance.historyUrl &&
                          <Link to={finance.historyUrl}>Transactions</Link>}
                      </div>}
                  </td>}
                  <td><Link className="jobs-table-open" to={jobHref} aria-label={`Open ${jobDisplayLabel(job)}`} title="Open Job Card"><ChevronRight size={17} aria-hidden="true" /></Link></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        <div className="jobs-mobile-list">
          {jobs.map((job) => {
            const invoice = invoiceByJob.get(String(job.id));
            const finance = jobInvoiceFinance(invoice);
            const gst = finance.posted ? jobInvoiceGST(invoice) : null;
            const vehicleId = job.vehicleId || job.vehicle?.id || job.vehicle_id;
            const customerId = job.customerId || job.customer?.id || job.customer_id;
            const staffId = job.assignedEmployeeId || job.assignedEmployee?.id || job.assigned_employee_id;
            return <article key={job.id} className="jobs-mobile-card">
              <div className="jobs-mobile-card-head">
                <div>
                  <Link className="jobs-directory-entity-link jobs-mobile-job-link" to={`/jobs/${encodeURIComponent(job.id)}`}>{jobDisplayLabel(job)}</Link>
                  {canViewVehicles && vehicleId
                    ? <Link className="jobs-directory-entity-link" to={`/vehicles/${encodeURIComponent(vehicleId)}`}>{job.vehicleReg || 'Vehicle details'}</Link>
                    : <span>{job.vehicleReg || 'No registration'}</span>}
                </div>
                <Link className={`jobs-status-chip jobs-directory-status-link is-${statusClass(job.status)}`}
                  to={`/jobs/${encodeURIComponent(job.id)}/status`}
                  aria-label={`View ${jobDisplayLabel(job)} status: ${job.status || 'New'}`}>
                  {job.status || 'New'}
                </Link>
              </div>

              {job.inspection?.status === 'Skipped' && (
                <span className="jobs-inspection-skip-tag" title={job.inspection.skipReason || 'Vehicle inspection skipped'}>Inspection skipped</span>
              )}
              <div className="jobs-mobile-card-meta">
                <span><Car size={14} aria-hidden="true" />{job.vehicleInfo || 'Vehicle'}</span>
                <span><User size={14} aria-hidden="true" />{canViewCustomers && customerId
                  ? <Link className="jobs-directory-entity-link" to={`/customers/${encodeURIComponent(customerId)}`}>{job.customerName || 'Customer details'}</Link>
                  : job.customerName || 'Walk-in customer'}</span>
                <span><Wrench size={14} aria-hidden="true" />{canViewStaff && staffId
                  ? <Link className="jobs-directory-entity-link" to={`/staff-management/staff/${encodeURIComponent(staffId)}`}>{job.assignedEmployeeName || 'View staff'}</Link>
                  : job.assignedEmployeeName || 'Unassigned'}</span>
              </div>

              <JobCustomerContactActions job={job} />
              {showBilling && <div className="jobs-mobile-gst-finance">
                <div>
                  <span>Invoice / GST</span>
                  {invoice && !invoicesLoading
                    ? <><Link to={'/invoices/' + encodeURIComponent(invoice.id)}>{invoice.number || 'Invoice'}</Link>
                      <small>{finance.posted && gst ? 'GST ₹' + gst.tax.toFixed(2)
                        : invoice.invoiceType === 'gst' ? 'Draft / GST pending' : 'Non-GST invoice'}</small></>
                    : <strong>{invoicesLoading ? 'Loading…' : invoicesError ? 'Unavailable' : 'Not invoiced'}</strong>}
                </div>
                <div>
                  <span>Payment</span>
                  <strong>{invoicesError ? 'Unavailable' : !finance.posted ? 'Not finalized'
                    : !canViewPayments ? 'Restricted'
                      : finance.outstanding > 0 ? 'Due' : 'Paid'}</strong>
                  {canViewPayments && finance.posted && <>
                    <span className="jobs-financial-amount-line">Paid
                      <strong>₹{Number(invoice.paid || 0).toFixed(2)}</strong>
                    </span>
                    <span className="jobs-financial-amount-line">Due
                      <strong>₹{finance.outstanding.toFixed(2)}</strong>
                    </span>
                  </>}
                </div>
                <nav aria-label={'Financial links for ' + jobDisplayLabel(job)}>
                  {canViewGST && finance.gstrUrl && <Link to={finance.gstrUrl}>GSTR-1</Link>}
                  {canViewPayments && finance.historyUrl && <Link to={finance.historyUrl}>Transactions</Link>}
                  {canCollectPayments && finance.paymentUrl &&
                    <Link className="jobs-finance-receive" to={finance.paymentUrl}>Receive Payment</Link>}
                </nav>
              </div>}
              <div className="jobs-mobile-card-footer">
                <span title={job.createdDate || ''}>{formatJobDirectoryDate(job.createdDate) || '—'}</span>
                <Link className="jobs-mobile-view-job" to={`/jobs/${encodeURIComponent(job.id)}`}
                  aria-label={`Open ${jobDisplayLabel(job)}`}>View Job Card <ChevronRight size={16} aria-hidden="true"/></Link>
              </div>
            </article>;
          })}
        </div>
      </>
    )}
  </section>
);
