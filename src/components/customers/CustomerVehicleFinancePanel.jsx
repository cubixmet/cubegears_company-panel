import { Car, ReceiptText, Wallet, CreditCard, ExternalLink, BriefcaseBusiness, AlertCircle } from 'lucide-react';
import { customerInvoiceLabel, profileMoney } from '../../pages/customers/customerProfile.utils';
import { invoiceMoney } from '../../pages/customers/customerDirectoryMoney.js';
import {
  customerProfileDate, vehicleRegistration, vehicleMakeModel, resolveCustomerVehicleId,
} from '../../pages/customers/customerVehicleFinancials';
import '../../styles/customer-vehicle-finance.css';

function MoneyStat({ label, value, icon: Icon, tone = '' }) {
  return <div className={'cg-cvf-stat ' + (tone ? 'is-' + tone : '')}>
    <span>{Icon && <Icon size={15} aria-hidden="true"/>}{label}</span>
    <strong>{profileMoney(value)}</strong>
  </div>;
}

function VehicleCard({ bucket, onFinance, onVehicle, invoicesAvailable, jobsAvailable }) {
  const { vehicle, financials } = bucket;
  return <article className="cg-cvf-vehicle">
    <header>
      <div className="cg-cvf-vehicle-icon"><Car size={20} aria-hidden="true"/></div>
      <div>
        <h4>{vehicleRegistration(vehicle) || 'Registration unavailable'}</h4>
        <span>{vehicleMakeModel(vehicle)}</span>
      </div>
    </header>
    <div className="cg-cvf-vehicle-meta">
      <span>{jobsAvailable ? bucket.jobs.length : '—'} job cards</span>
      <span>{invoicesAvailable ? bucket.invoices.length : '—'} finalized invoices</span>
    </div>
    <div className="cg-cvf-money-grid">
      <div><span>Invoiced</span><strong>{profileMoney(financials.billed)}</strong></div>
      <div><span>Received</span><strong>{profileMoney(financials.paid)}</strong></div>
      <div><span>Due</span><strong>{profileMoney(financials.outstanding)}</strong></div>
    </div>
    <div className="cg-cvf-vehicle-actions">
      <button type="button" onClick={() => onFinance(bucket.id)}>
        <ReceiptText size={15} aria-hidden="true"/> View Transactions
      </button>
      <button type="button" onClick={() => onVehicle(bucket.id)}>
        Vehicle <ExternalLink size={14} aria-hidden="true"/>
      </button>
    </div>
  </article>;
}

export function CustomerVehicleFinancePanel({
  model, mode = 'overview', invoicesAvailable = false, jobsAvailable = false,
  vehiclesAvailable = false, selectedVehicleId = '', onSelectVehicle,
  onViewVehicle, onViewInvoice, onOpenFinance,
}) {
  const displayBuckets = mode === 'finance' && selectedVehicleId
    ? model.vehicles.filter(bucket => bucket.id === selectedVehicleId) : model.vehicles;
  const selected = model.vehicles.find(bucket => bucket.id === selectedVehicleId);
  const shownInvoices = mode === 'finance' && selected
    ? selected.invoices : model.finalizedInvoices;
  const assigned = vehicleId => model.vehicles.find(bucket => bucket.id === vehicleId);
  return <section className="cg-cvf" aria-label="Customer financial and vehicle overview">
    <div className="cg-cvf-header">
      <div>
        <h3><Wallet size={19} aria-hidden="true"/> {mode === 'finance'
          ? 'Customer & Vehicle Financial Ledger'
          : mode === 'vehicles' ? 'Vehicles & Service Value' : 'Customer Financial Overview'}</h3>
        <p>Finalized customer invoices across every linked vehicle. Receipts are counted only through invoice paid balances.</p>
      </div>
      {mode === 'overview' && <button className="cg-cvf-secondary" type="button" onClick={onOpenFinance}>
        Open Finance <ExternalLink size={15} aria-hidden="true"/>
      </button>}
    </div>

    {mode !== 'vehicles' && <div className="cg-cvf-summary" aria-label="All-vehicle invoice totals">
      <MoneyStat label="Total Invoiced" value={model.overall.billed} icon={ReceiptText}/>
      <MoneyStat label="Payments Received" value={model.overall.paid} icon={CreditCard} tone="received"/>
      <MoneyStat label="Total Outstanding" value={model.overall.outstanding} icon={Wallet} tone="due"/>
    </div>}
    {!invoicesAvailable && <p className="cg-cvf-message" role="status">
      Invoice records could not be loaded or are not accessible. Financial figures are hidden rather than estimated.
    </p>}
    {invoicesAvailable && model.overall.billed === null && <p className="cg-cvf-message" role="status">
      Some invoice amounts are incomplete. Totals are hidden until the records are complete.
    </p>}

    {mode === 'finance' && <div className="cg-cvf-filter">
      <label htmlFor="cg-cvf-vehicle-filter">View vehicle</label>
      <select id="cg-cvf-vehicle-filter" value={selectedVehicleId}
        onChange={event => onSelectVehicle(event.target.value)}>
        <option value="">All customer vehicles</option>
        {model.vehicles.map(bucket => (
          <option value={bucket.id} key={bucket.id}>
            {vehicleRegistration(bucket.vehicle) || vehicleMakeModel(bucket.vehicle)}
          </option>
        ))}
      </select>
    </div>}

    {(mode === 'overview' || mode === 'vehicles' || mode === 'finance') && <>
      <div className="cg-cvf-subhead">
        <h4><Car size={17} aria-hidden="true"/> Vehicle Breakdown</h4>
        <span>{vehiclesAvailable ? model.vehicles.length + ' linked' : 'Unavailable'}</span>
      </div>
      {!vehiclesAvailable
        ? <p className="cg-cvf-empty">Vehicle records could not be loaded.</p>
        : !model.vehicles.length
          ? <p className="cg-cvf-empty">No vehicles are linked to this customer yet.</p>
          : <div className="cg-cvf-vehicles">
              {displayBuckets.map(bucket => <VehicleCard key={bucket.id}
                bucket={bucket} invoicesAvailable={invoicesAvailable}
                jobsAvailable={jobsAvailable} onFinance={onOpenFinance
                  ? id => onOpenFinance(id) : onSelectVehicle}
                onVehicle={onViewVehicle}/>)}
            </div>}
    </>}

    {mode === 'finance' && <>
      <div className="cg-cvf-subhead">
        <h4><BriefcaseBusiness size={17} aria-hidden="true"/> Finalized Invoice Records</h4>
        <span>{invoicesAvailable ? shownInvoices.length + ' invoices' : 'Unavailable'}</span>
      </div>
      {!invoicesAvailable
        ? <p className="cg-cvf-empty">Invoice records are not available.</p>
        : !shownInvoices.length
          ? <p className="cg-cvf-empty">No finalized invoices in this selection.</p>
          : <div className="cg-cvf-invoice-list">
              {shownInvoices.map((invoice, index) => {
                const vehicleId = resolveCustomerVehicleId(
                  invoice, model.vehicles.map(bucket => bucket.vehicle),
                  model.vehicles.flatMap(bucket => bucket.jobs).concat(model.unmatchedJobs),
                );
                const bucket = assigned(vehicleId);
                const amounts = invoiceMoney(invoice);
                return <article className="cg-cvf-invoice-row" key={invoice.id || index}>
                  <div>
                    <strong>{customerInvoiceLabel(invoice)}</strong>
                    <span>{customerProfileDate(invoice.date || invoice.created_at)}
                      {' · '}{bucket ? vehicleRegistration(bucket.vehicle) : 'Vehicle not linked'}
                      {' · '}{invoice.status || '—'}</span>
                  </div>
                  <div className="cg-cvf-invoice-numbers">
                    <span>Total <strong>{profileMoney(invoice.total ?? invoice.totalAmount)}</strong></span>
                    <span>Paid <strong>{profileMoney(amounts.paid)}</strong></span>
                    <span>Due <strong>{profileMoney(amounts.balance)}</strong></span>
                  </div>
                  {invoice.id && <button type="button" onClick={() => onViewInvoice(invoice.id)}
                    aria-label={'Open invoice ' + customerInvoiceLabel(invoice)}>
                    <ExternalLink size={15} aria-hidden="true"/>
                  </button>}
                </article>;
              })}
            </div>}
    </>}
    {invoicesAvailable && model.unassignedInvoices.length > 0 &&
      <p className="cg-cvf-warning"><AlertCircle size={16} aria-hidden="true"/>
        {model.unassignedInvoices.length} finalized invoice(s) have no verified vehicle link.
        They are included in the customer total, but not assigned to any vehicle.
      </p>}
    <p className="cg-cvf-disclaimer">
      Billed amounts are sales, not profit. Payments received are derived from invoice balances;
      separate payment records are not added again. Draft, cancelled and estimate documents are excluded.
    </p>
  </section>;
}
