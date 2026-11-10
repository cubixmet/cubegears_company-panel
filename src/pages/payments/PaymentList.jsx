import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { resourceConfigs } from '../operations/resourceConfigs';
import { billingService, calculateDocumentTotals } from '../../services/billing.service';
import { customerService } from '../../services/customer.service';
import { USE_MOCK_API } from '../../api/apiConfig';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { appConfirm, appPrompt } from '../../components/common/appDialogs';
import apiClient from '../../api/apiClient';
import { financeService } from '../../services/finance.service';
import PaymentFinanceOverview from '../../components/payments/PaymentFinanceOverview';
import {
  PaymentFilterToolbar, PaymentOverviewStats, PaymentRecordsPanel, PaymentsHeader
} from '../../components/payments';
import {
  formatPaymentDate, invoiceOutstanding, makePaymentPayload,
  normalizePaymentRow, payableInvoices, paymentStatusClass
} from '../../components/payments/payments.utils';
import '../../styles/payments.css';
import '../../styles/payments-unified.css';
import '../../styles/payments-borderless-forms.css';

const paymentService = resourceConfigs.payments.service;
const money = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
});
const dateLocal = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
const freshPayment = () => ({
  date: dateLocal(), invoiceId: '', customerId: '', receiptKind: 'invoice',
  method: 'Cash', amount: '', reference: '',
  direction: 'IN', accountId: '', category: 'Other', notes: '',
  requestKey: globalThis.crypto?.randomUUID?.() || `receipt-${Date.now()}-${Math.random()}`
});
const friendlyError = (error, fallback) => {
  const details = error?.response?.data || error?.data;
  if (typeof details?.detail === 'string') return details.detail;
  if (details && typeof details === 'object') {
    const first = Object.entries(details).find(([, value]) => value);
    if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1].join(', ') : String(first[1])}`;
  }
  return error?.message || fallback;
};
const invoiceCustomer = (invoice) =>
  invoice?.customerName || invoice?.customer?.name || 'Customer';

export function PaymentList() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { can } = useFeatureAccess();
  const isNew = location.pathname.endsWith('/new');
  const isView = Boolean(id) && !isNew;
  const canCreate = can('payments.create');
  const canReverse = can('payments.reverse') && !USE_MOCK_API;
  const canViewInvoices = can('invoices.view');
  const canViewCustomers = can('customers.view');
  const canViewPayments = can('payments.view');
  const canManageAccounts = can('payments.edit') && !USE_MOCK_API;

  const [payments, setPayments] = useState([]);
  const [supplierSummary, setSupplierSummary] = useState(null);
  const [financePeriod, setFinancePeriod] = useState('all');
  const [financeSummary, setFinanceSummary] = useState(null);
  const [financeLedger, setFinanceLedger] = useState([]);
  const [ledgerCount, setLedgerCount] = useState(0);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerAccount, setLedgerAccount] = useState('');
  const [ledgerQuery, setLedgerQuery] = useState('');
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const prefilledCustomerQuery = useRef('');
  const prefilledInvoiceQuery = useRef('');
  const [accounts, setAccounts] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState(freshPayment);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Reading payment history does not imply permission to read invoices.
      const useUnified = canViewPayments && !USE_MOCK_API && !isNew && !isView;
      const [paymentRows, invoiceRows, customerRows] = await Promise.all([
        !canViewPayments ? Promise.resolve([]) :
          useUnified ? financeService.getPaymentActivity({ page_size: 1000 }) : paymentService.list(),
        isNew && canCreate && canViewInvoices ? billingService.list() : Promise.resolve([]),
        isNew && canCreate && canViewCustomers && !USE_MOCK_API
          ? customerService.getCustomers({ status: 'active' }).catch(() => [])
          : Promise.resolve([]),
      ]);
      const history = useUnified ? paymentRows?.results : paymentRows;
      setPayments((Array.isArray(history) ? history : []).map(normalizePaymentRow));
      setSupplierSummary(useUnified ? paymentRows : null);
      setInvoices(Array.isArray(invoiceRows) ? invoiceRows : invoiceRows?.results || []);
      setCustomers(Array.isArray(customerRows) ? customerRows : customerRows?.results || []);
    } catch (e) {
      setError(friendlyError(e, 'Unable to load payments.'));
    } finally {
      setLoading(false);
    }
  }, [isNew, canCreate, canViewInvoices, canViewCustomers, canViewPayments]);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    if (isNew || isView || !canViewPayments || USE_MOCK_API) return undefined;
    let active = true;
    setFinanceLoading(true);
    setFinanceError('');
    const filters = {
      page_size: 20, page: ledgerPage,
      ...(ledgerAccount ? { account: ledgerAccount } : {}),
      ...(ledgerQuery.trim() ? { q: ledgerQuery.trim() } : {}),
      ...(financePeriod === 'today' ? { from: dateLocal(), to: dateLocal() } :
        financePeriod === 'month' ? { from: dateLocal().slice(0, 8) + '01' } : {}),
    };
    Promise.all([
      financeService.getDashboard({ period: financePeriod }),
      financeService.getLedger(filters),
    ]).then(([dashboard, ledger]) => {
      if (!active) return;
      setFinanceSummary(dashboard);
      setFinanceLedger(Array.isArray(ledger?.results) ? ledger.results : []);
      setLedgerCount(Number(ledger?.count) || 0);
      setLedgerTotalPages(Number(ledger?.totalPages) || 1);
    }).catch(err => {
      if (active) {
        setFinanceError(friendlyError(err, 'Unable to load live bank, revenue or expense totals.'));
        setFinanceSummary(null);
        setFinanceLedger([]);
      }
    }).finally(() => {
      if (active) setFinanceLoading(false);
    });
    return () => { active = false; };
  }, [financePeriod, ledgerAccount, ledgerQuery, ledgerPage, refreshKey, isNew, isView, canViewPayments]);

  const refreshFinance = () => setRefreshKey(value => value + 1);

  useEffect(() => {
    if (!isNew || !canCreate || USE_MOCK_API) return;
    financeService.listAccounts()
      .then((rows) => setAccounts(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(err?.message || 'Unable to load financial accounts.'));
  }, [isNew, canCreate]);

  const statuses = useMemo(
    () => [...new Set(payments.map((row) => row.status).filter(Boolean))].sort(),
    [payments]
  );
  const methods = useMemo(
    () => [...new Set(payments.map((row) => row.method).filter(Boolean))].sort(),
    [payments]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromDate = financePeriod === 'today' ? dateLocal() :
      financePeriod === 'month' ? dateLocal().slice(0, 8) + '01' : '';
    return payments.filter((row) =>
      (!fromDate || String(row.date || '').slice(0, 10) >= fromDate) &&
      (!q || [row.receiptNo, row.customer, row.invoice, row.method, row.reference, row.status, row.category, row.account]
        .some((value) => String(value || '').toLowerCase().includes(q))) &&
      (statusFilter === 'All' || row.status === statusFilter) &&
      (methodFilter === 'All' || row.method === methodFilter)
    );
  }, [payments, query, statusFilter, methodFilter, financePeriod]);

  const eligibleInvoices = useMemo(
    () => payableInvoices(invoices, calculateDocumentTotals), [invoices]
  );
  // Deep links from a finalized invoice preselect only a payable document;
  // the operator still chooses the actual bank/cash account and confirms
  // the receipt. This never creates an automatic payment.
  useEffect(() => {
    if (!isNew || loading || !canCreate || !canViewInvoices) return;
    const requestedId = new URLSearchParams(location.search).get('invoiceId');
    if (!requestedId || prefilledInvoiceQuery.current === requestedId) return;
    const linked = eligibleInvoices.find((row) => String(row.id) === requestedId);
    if (linked) {
      prefilledInvoiceQuery.current = requestedId;
      setForm((previous) => ({
        ...previous, receiptKind: 'invoice', customerId: '',
        invoiceId: requestedId,
        amount: invoiceOutstanding(linked, calculateDocumentTotals).toFixed(2),
      }));
    }
  }, [isNew, loading, canCreate, canViewInvoices, location.search, eligibleInvoices]);

  useEffect(() => {
    if (!isNew || loading || !canCreate || !canViewCustomers || USE_MOCK_API) return;
    const requestedId = new URLSearchParams(location.search).get('customerId');
    if (!requestedId || prefilledCustomerQuery.current === requestedId) return;
    if (!customers.some((row) => String(row.id) === requestedId)) return;
    prefilledCustomerQuery.current = requestedId;
    setForm((previous) => ({
      ...previous, receiptKind: 'advance', customerId: requestedId,
      invoiceId: '', amount: '',
    }));
  }, [isNew, loading, canCreate, canViewCustomers, location.search, customers]);

  const selectedInvoice = eligibleInvoices.find((row) => String(row.id) === form.invoiceId);
  const outstanding = selectedInvoice ? invoiceOutstanding(selectedInvoice, calculateDocumentTotals) : 0;

  const changeInvoice = (invoiceId) => {
    const invoice = eligibleInvoices.find((row) => String(row.id) === invoiceId);
    setForm((previous) => ({
      ...previous,
      invoiceId, amount: invoice ? invoiceOutstanding(invoice, calculateDocumentTotals).toFixed(2) : ''
    }));
    setError('');
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving || !canCreate) return;
    let payload;
    try {
      payload = makePaymentPayload(form, selectedInvoice, outstanding, USE_MOCK_API);
    } catch (e) {
      setError(e.message);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await paymentService.create(payload);
      if (!saved?.id) throw new Error('Payment was recorded but no record ID was returned. Refresh payments before retrying.');
      navigate(`/payments/${saved.id}`, { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'Unable to record payment.'));
    } finally {
      setSaving(false);
    }
  };

  const reversePayment = async () => {
    if (!isView || !canReverse || saving) return;
    const record = payments.find((row) => String(row.id) === String(id));
    if (record?.status !== 'Completed') return;
    const reason = await appPrompt('Reason for reversing this customer payment:');
    if (!reason?.trim()) return;
    if (!await appConfirm('Reverse this payment and reopen its invoice balance?', {
      title: 'Reverse customer payment', confirmLabel: 'Reverse Payment', tone: 'danger',
    })) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post(`/payments/${id}/reverse`, { reason: reason.trim() });
      setRefreshKey((value) => value + 1);
    } catch (e) {
      setError(friendlyError(e, 'Unable to reverse payment.'));
    } finally {
      setSaving(false);
    }
  };

  if (isNew) {
    return (
      <div className="payments-page payments-entry-page">
        <header className="payments-head">
          <div>
            <span className="payments-kicker">FINANCIAL PAYMENTS</span>
            <h1>Record Customer Payment</h1>
            <p>Receive a partial invoice payment or a customer advance into a real Cash, UPI or Bank account. Adjust unused advances on the customer's ledger.</p>
            <div className="payment-form-actions">
              <button type="button" className="payments-secondary-btn" onClick={() => navigate('/expenses')}>
                Pay Workshop Expense
              </button>
              <button type="button" className="payments-secondary-btn" onClick={() => navigate('/payroll/daily-wages')}>
                Pay Staff Daily Wages
              </button>
            </div>
          </div>

        </header>

        {error && <div className="payments-error" role="alert">{error}</div>}
        {loading ? <p className="payments-empty" role="status">Loading invoices…</p> : (
          !canCreate ? <p className="payments-empty">You do not have permission to record payments.</p> :
          <form className="payment-form-card" onSubmit={save}>
            <div className="payment-form-intro">
              <h2>Payment Details</h2>
              <p>Invoice receipts reduce the unpaid balance. Advances remain customer credit until explicitly applied or refunded. Outgoing payments debit the selected account.</p>
            </div>
            <div className="payment-form-grid">
              <label className="payment-wide">
                <span>Payment Direction *</span>
                <select value={form.direction} disabled={saving} onChange={(e) => setForm({
                  ...form, direction: e.target.value, receiptKind: 'invoice',
                  customerId: '', invoiceId: '', amount: ''
                })}>
                  <option value="IN">Receive Customer Payment</option>
                  {!USE_MOCK_API && <option value="OUT">Make Outgoing Payment</option>}
                </select>
              </label>
              {form.direction === 'IN' && !USE_MOCK_API && (
                <label className="payment-wide">
                  <span>Customer Receipt Type *</span>
                  <select value={form.receiptKind} disabled={saving}
                    onChange={(event) => setForm((old) => ({
                      ...old, receiptKind: event.target.value, invoiceId: '',
                      customerId: '', amount: '',
                    }))}>
                    <option value="invoice">Invoice Payment / Partial Settlement</option>
                    <option value="advance">Customer Advance / Unapplied Credit</option>
                  </select>
                </label>
              )}
              {form.direction === 'IN' && form.receiptKind === 'advance' && (
                <label className="payment-wide">
                  <span>Advance Customer *</span>
                  <select required value={form.customerId} disabled={saving}
                    onChange={(event) => setForm((old) => ({
                      ...old, customerId: event.target.value, amount: '',
                    }))}>
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} · {customer.phone || 'No phone'}
                      </option>
                    ))}
                  </select>
                  {!canViewCustomers && <small>Customer view permission is required to select an advance customer.</small>}
                  {canViewCustomers && customers.length === 0 && <small>No active customers found. Add a customer before recording an advance.</small>}
                </label>
              )}
              <label className="payment-wide" style={{ display: form.direction === 'IN' && form.receiptKind === 'invoice' ? undefined : 'none' }}>
                <span>Invoice with Outstanding Balance *</span>
                <select required={form.direction === 'IN' && form.receiptKind === 'invoice'} value={form.invoiceId}
                  onChange={(e) => changeInvoice(e.target.value)} disabled={saving || form.receiptKind !== 'invoice'}>
                  <option value="">Select invoice</option>
                  {eligibleInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.number || invoice.id} · {invoiceCustomer(invoice)} · Due {money.format(invoiceOutstanding(invoice, calculateDocumentTotals))}
                    </option>
                  ))}
                </select>
                {eligibleInvoices.length === 0 && <small>No unpaid finalized invoices found.</small>}
              </label>

              <label style={{ display: form.direction === 'IN' && form.receiptKind === 'invoice' ? undefined : 'none' }}>
                <span>Customer</span>
                <input value={invoiceCustomer(selectedInvoice)} readOnly placeholder="Select invoice" />
              </label>
              <label style={{ display: form.direction === 'IN' && form.receiptKind === 'invoice' ? undefined : 'none' }}>
                <span>Outstanding Balance</span>
                <input value={selectedInvoice ? money.format(outstanding) : '—'} readOnly />
              </label>
              <label>
                <span>Payment Date *</span>
                <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} disabled={saving} />
              </label>
              <label>
                <span>Payment Amount (₹) *</span>
                <input type="number" required min="0.01" max={form.direction === "IN" && form.receiptKind === 'invoice' && selectedInvoice ? outstanding : undefined} step="0.01"
                  inputMode="decimal" value={form.amount} disabled={saving || (form.direction === "IN" && (form.receiptKind === 'advance' ? !form.customerId : !selectedInvoice))}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </label>
              <label>
                <span>Payment Method *</span>
                <select value={form.method} disabled={saving} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'].map((method) => <option key={method}>{method}</option>)}
                </select>
              </label>
              <label className="payment-wide">
                <span>Bank / Cash Account {!USE_MOCK_API && '*'}</span>
                <select value={form.accountId} disabled={saving || USE_MOCK_API}
                  required={!USE_MOCK_API} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                  <option value="">Select account</option>
                  {accounts.filter((account) => account.isActive).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.kind})
                    </option>
                  ))}
                </select>
                {!USE_MOCK_API && accounts.length === 0 && <small>Create an account in Finance → Accounts first.</small>}
              </label>
              {form.direction === 'OUT' && (
                <>
                  <label><span>Other Payment Category * (use Supplier Payments for supplier credit)</span>
                    <input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  </label>
                  <label><span>Other Payee / Details (not supplier, stock or payroll)</span>
                    <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Supplier, staff or other payee" />
                  </label>
                </>
              )}
              <label>
                <span>Transaction Reference</span>
                <input value={form.reference} disabled={saving} maxLength={120}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="UPI ID / Cheque No. / Bank Reference" />
              </label>
              <div className="payment-form-confirmation payment-wide">
                <ShieldCheck size={17} aria-hidden="true" />
                <span>Payment status: <strong>Completed</strong>. {form.direction === "OUT" ? "The chosen account will be debited." : form.receiptKind === 'advance' ? "The selected account receives funds; customer credit remains unapplied until allocated." : "The selected account receives funds and invoice due decreases."} Posted payments must be reversed through the authorized workflow.</span>
              </div>
            </div>
            <div className="payment-form-actions">
              <button type="button" className="payments-secondary-btn" onClick={() => navigate('/payments')} disabled={saving}>Cancel</button>
              <button type="submit" className="payments-primary-btn" disabled={saving || (form.direction === "IN" && (form.receiptKind === 'advance' ? !form.customerId : !selectedInvoice)) || (!USE_MOCK_API && !form.accountId)}>
                <CheckCircle2 size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  if (isView) {
    const record = payments.find((row) => String(row.id) === String(id));
    return (
      <div className="payments-page payments-detail-page">
        <header className="payments-head">
          <div>
            <span className="payments-kicker">PAYMENT DETAILS</span>
            <h1>{record?.receiptNo || 'Payment Details'}</h1>
            <p>Saved payment information and invoice reference.</p>
          </div>

        </header>
        {error && <div className="payments-error" role="alert">{error}</div>}
        {loading ? <div className="payments-empty">Loading payment…</div> : record ? (
          <>
          <section className="payment-detail-card">
            {[
              ['Payment Reference', record.receiptNo], ['Payment Date', formatPaymentDate(record.date)],
              ['Customer', record.customer], ['Invoice', record.invoice],
              ['Payment Method', record.method], ['Amount', money.format(record.amount || 0)],
              ['Transaction Reference', record.reference || '—'], ['Status', record.status]
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong className={label === 'Status' ? 'payment-detail-status ' + paymentStatusClass(record.status) : ''}>{value || '—'}</strong>
              </div>
            ))}
          </section>
          {record.status === 'Reversed' && record.reversal_reason && (
            <p className="payments-empty" role="status">Reversal reason: {record.reversal_reason}</p>
          )}
          {record.status === 'Completed' && canReverse && (
            <div className="payment-form-actions">
              <button className="payments-secondary-btn" type="button" onClick={reversePayment} disabled={saving}>
                {saving ? 'Reversing…' : 'Reverse Payment'}
              </button>
            </div>
          )}
          </>
        ) : <div className="payments-empty">Payment not found. Check the reference or return to Payments.</div>}
      </div>
    );
  }

  return (
    <div className="payments-page payments-dashboard">
      <PaymentsHeader onRecordPayment={() => navigate('/payments/new')} />
      {!USE_MOCK_API ? (
        <PaymentFinanceOverview
          summary={financeSummary}
          ledger={financeLedger}
          loading={financeLoading}
          error={financeError}
          period={financePeriod}
          onPeriodChange={value => { setFinancePeriod(value); setLedgerPage(1); }}
          onRefresh={refreshFinance}
          ledgerPage={ledgerPage}
          ledgerCount={ledgerCount}
          ledgerTotalPages={ledgerTotalPages}
          ledgerAccount={ledgerAccount}
          ledgerQuery={ledgerQuery}
          onLedgerPageChange={setLedgerPage}
          onLedgerAccountChange={value => { setLedgerAccount(value); setLedgerPage(1); }}
          onLedgerQueryChange={value => { setLedgerQuery(value); setLedgerPage(1); }}
          canManage={canManageAccounts}
          onRecord={() => navigate('/payments/new')}
          onExpense={() => navigate('/expenses/new')}
        />
      ) : (
        <PaymentOverviewStats payments={payments} formatMoney={(value) => money.format(value || 0)} />
      )}
      {payments.some(row => row.source === 'payment' && row.direction === 'IN' && row.ledgerPosted === false) && (
        <div className="payments-error" role="note">
          Some historical customer receipts updated invoice balances but have no linked bank/cash ledger posting.
          They are shown in payment history and require authorized account reconciliation.
          Do not manually record the same customer payment twice.
          <button type="button" className="payments-secondary-btn" onClick={() => navigate('/accounts')}>
            Review Accounts & Ledger
          </button>
        </div>
      )}
      {supplierSummary && can('stock.view') && (
        <section className="payments-dashboard-records" aria-label="Supplier purchase accounting">
          <header className="payments-dashboard-section-title">
            <div>
              <h2>Spare Parts Purchase & Supplier Credit</h2>
              <p>Confirmed purchases create a supplier payable. Only money actually paid appears as an outgoing payment.</p>
            </div>
          </header>
          <div className="payments-dashboard-stats">
            <article className="payments-dashboard-stat-card"><div className="payments-dashboard-stat-top">
              <div><span>Total Parts Purchased</span><strong>{money.format(Number(supplierSummary.supplierPurchases || 0))}</strong></div>
            </div></article>
            <article className="payments-dashboard-stat-card"><div className="payments-dashboard-stat-top">
              <div><span>Supplier Payments Made</span><strong>{money.format(Number(supplierSummary.supplierPayments || 0))}</strong></div>
            </div></article>
            <article className="payments-dashboard-stat-card"><div className="payments-dashboard-stat-top">
              <div><span>Supplier Credit Outstanding</span><strong>{money.format(Number(supplierSummary.supplierOutstanding || 0))}</strong></div>
            </div></article>
          </div>
          <p>Purchase stock and settle Supplier Credit from the supplier’s own detail page under Suppliers.</p>
        </section>
      )}
      <PaymentFilterToolbar
        query={query} onQueryChange={setQuery}
        status={statusFilter} onStatusChange={setStatusFilter}
        method={methodFilter} onMethodChange={setMethodFilter}
        statuses={statuses} methods={methods}
        resultCount={filtered.length}
        onClear={() => { setQuery(''); setStatusFilter('All'); setMethodFilter('All'); }}
        onRefresh={() => setRefreshKey((count) => count + 1)}
        loading={loading}
      />
      {error && <div className="payments-error" role="alert">{error}</div>}
      <PaymentRecordsPanel payments={filtered} loading={loading}
        formatMoney={(value) => money.format(value || 0)}
        onView={(row) => navigate(row.detailPath || `/payments/${row.id}`)} />
    </div>
  );
}

export default PaymentList;
