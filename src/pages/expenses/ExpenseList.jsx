import { appConfirm, appPrompt } from '../../components/common/appDialogs';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { BarChart3, Calendar, CheckCircle2, CircleDollarSign, Edit3, FileText, IndianRupee, Layers3, Receipt, Trash2, Link2, WalletCards } from "lucide-react";
import { expenseService } from '../../services/expense.service';
import { ExpenseBudgetPanel } from '../../components/expenses/ExpenseBudgetPanel';
import { financeService } from '../../services/finance.service';
import { FINANCE_CHANNELS, financeAccountsForChannel, assertFinanceAccount } from '../../utils/financeCashBank';
import GstRateDropdown from '../../components/common/GstRateDropdown';
import { expenseIncludedGst } from '../../utils/expenseGst';
import { localDate } from '../../services/expense.mapper';
import {
  ExpenseListView,
  ExpenseOverview,
  ExpenseOverviewStats,
  ExpensesHeader,
  ExpenseTabs,
} from '../../components/expenses';
import '../../styles/expense-management.css';
import '../../styles/expense-ui-polish.css';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const expenseCategories = [
  'Workshop Rent',
  'Electricity',
  'Water',
  'Internet',
  'Fuel',
  'Utilities',
  'Equipment Maintenance',
  'Consumables & Tools',
  'Rent & Lease',
  'Staff Refreshments',
  'Marketing & Ads',
  'Transport & Fuel',
  'Office & Admin',
  'Cleaning & Waste',
  'Professional Fees',
  'Miscellaneous'
];

const paymentMethods = FINANCE_CHANNELS;

const today = () => localDate();

const emptyForm = {
  title: '',
  category: 'Utilities',
  amount: '',
  expenseDate: today(),
  vendor: '',
  paymentMethod: 'Cash',
  referenceNo: '',
  taxAmount: '',
  gstRate: '',
  status: 'approved',
  notes: '',
  receiptUrl: '',
  accountId: '',
  budgetItemId: '',
  requestKey: ''
};

const freshExpenseForm = () => ({
  ...emptyForm,
  expenseDate: today(),
  requestKey: globalThis.crypto?.randomUUID?.() || `expense-${Date.now()}-${Math.random()}`,
});

const Metric = ({ label, value, icon: Icon, tone = 'primary', note }) => (
  <article className="expense-metric-card">
    <div className="expense-metric-card__top">
      <span>{label}</span>
      <i className={`is-${tone}`}><Icon size={16}/></i>
    </div>
    <strong>{value}</strong>
    {note ? <small>{note}</small> : null}
  </article>
);

const Field = ({ label, children, wide = false }) => (
  <label className={wide ? 'expense-field is-wide' : 'expense-field'}>
    <span>{label}</span>
    {children}
  </label>
);

const ExpenseForm = ({
  title,
  values,
  setValues,
  onSubmit,
  onCancel,
  submitting,
  error,
  accounts = [],
  budgetItems = [],
  budgetError = ''
}) => (
  <div className="expense-form-page cg-expenses">
    <header className="expense-form-header">
      <div>
        <h1>{title}</h1>
        <p>Enter workshop running costs such as utilities, rent or maintenance. Record parts purchased from suppliers in the Supplier Purchase workflow instead.</p>
      </div>
    </header>

    <form className="expense-form" onSubmit={onSubmit}>
      {error ? <div className="expense-alert" role="alert">{error}</div> : null}
      <div className="expense-alert" role="note">
        Spare parts purchases and supplier payments belong on each Supplier Details page, not as duplicate expenses.
        A supplier bill must never be recorded again as an operational expense.
      </div>
      <section className="expense-form-section">
        <div className="expense-section-header">
          <div>
            <h2>Expense Information</h2>
            <p>Date, category, vendor and expense title.</p>
          </div>
        </div>

        <div className="expense-form-grid">
          <Field label="Expense Date">
            <input type="date" required value={values.expenseDate} onChange={(e)=>setValues({...values,expenseDate:e.target.value,budgetItemId:''})}/>
          </Field>

          <Field label="Category">
            <select value={values.category} onChange={(e)=>setValues({...values,category:e.target.value,budgetItemId:''})}>
              {expenseCategories.map((category)=><option key={category}>{category}</option>)}
            </select>
          </Field>

          <Field label="Monthly Budget Item (optional)">
            <select value={values.budgetItemId || ''}
              onChange={e => setValues({ ...values, budgetItemId: e.target.value })}>
              <option value="">Unbudgeted expense</option>
              {budgetItems.filter(item => item.isActive && item.category === values.category &&
                item.month === values.expenseDate.slice(0, 7)).map(item => (
                <option value={item.id} key={item.id}>
                  {item.name} (₹{Number(item.remainingAmount).toLocaleString('en-IN')} remaining)
                </option>
              ))}
            </select>
            <small>Budget use increases when the expense is approved. Paying it later only reduces the chosen Cash/Bank balance.</small>
            {budgetError && <small role="alert">{budgetError}</small>}
          </Field>

          <Field label="Expense Title" wide>
            <input required value={values.title} onChange={(e)=>setValues({...values,title:e.target.value})} placeholder="e.g. Monthly workshop electricity bill"/>
          </Field>

          <Field label="Vendor / Payable To">
            <input value={values.vendor} onChange={(e)=>setValues({...values,vendor:e.target.value})} placeholder="Supplier or payable party"/>
          </Field>

          <Field label="Status">
            <select value={values.status} onChange={(e)=>setValues({...values,status:e.target.value})}>
              <option value="draft">Draft</option>
              <option value="pending approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="expense-form-section">
        <div className="expense-section-header">
          <div>
            <h2>Amount &amp; Payment</h2>
            <p>Expense value, tax, payment method and bill reference.</p>
          </div>
        </div>

        <div className="expense-form-grid">
          <Field label="Expense Amount">
            <input type="number" min="0.01" step="0.01" required value={values.amount}
              onChange={(e)=>setValues({...values,amount:e.target.value,
                taxAmount: values.gstRate !== '' ? expenseIncludedGst(e.target.value, values.gstRate) : values.taxAmount})}/>
          </Field>

          <Field label="GST Rate (included in amount)">
            <GstRateDropdown selectLabel="Expense GST percentage" value={values.gstRate ?? ''}
              blankLabel="Previously saved / enter GST amount"
              onChange={rate => setValues({ ...values, gstRate: rate,
                taxAmount: rate === '' ? values.taxAmount :
                  expenseIncludedGst(values.amount, rate) })}/>
          </Field>
          <Field label="Tax / GST Amount (included)">
            <input type="number" min="0" step="0.01" value={values.taxAmount}
              readOnly={values.gstRate !== ''}
              onChange={(e)=>setValues({...values,taxAmount:e.target.value})}/>
            <small>The GST component is included, not charged twice. Input tax credit must follow the supplier tax invoice.</small>
          </Field>

          <Field label="Payment Method">
            <select value={values.paymentMethod} onChange={(e)=>setValues({...values,paymentMethod:e.target.value,accountId:''})}>
              {paymentMethods.map((method)=><option key={method}>{method}</option>)}
            </select>
          </Field>

          <Field label="Pay from Bank / Cash Account">
            <select value={values.accountId || ''} required={values.status === 'paid'}
              onChange={(e) => setValues({ ...values, accountId: e.target.value })}
              disabled={submitting}>
              <option value="">Select account {values.status === 'paid' ? '*' : '(optional until paid)'}</option>
              {financeAccountsForChannel(accounts, values.paymentMethod).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.kind}) — {money.format(Number(account.currentBalance || 0))}
                </option>
              ))}
            </select>
            <small>Unpaid or approved expenses will not debit this account.</small>
          </Field>

          <Field label="Reference / Bill Number">
            <input value={values.referenceNo} onChange={(e)=>setValues({...values,referenceNo:e.target.value})} placeholder="INV / UTR / Cheque reference"/>
          </Field>
        </div>
      </section>

      <section className="expense-form-section">
        <div className="expense-section-header">
          <div>
            <h2>Bill / Receipt &amp; Notes</h2>
            <p>Attach bill metadata and store additional accounting notes.</p>
          </div>
        </div>

        <div className="expense-form-grid">
          <Field label="Receipt / Bill URL" wide>
            <div className="expense-receipt-input">
              <Link2 size={18} aria-hidden="true" />
              <input
                type="url"
                value={values.receiptUrl}
                onChange={(e) => setValues({ ...values, receiptUrl: e.target.value })}
                placeholder="https://example.com/workshop-bill.pdf"
                aria-describedby="expense-receipt-help"
              />
            </div>
            <small id="expense-receipt-help" className="expense-field-help">
              Paste a secure link to an existing receipt. Direct file upload is not yet supported.
            </small>
          </Field>

          <Field label="Notes" wide>
            <textarea rows="4" value={values.notes} onChange={(e)=>setValues({...values,notes:e.target.value})} placeholder="Expense purpose, approval notes, recurring details..."/>
          </Field>
        </div>
      </section>

      <div className="expense-form-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="is-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Expense'}</button>
      </div>
    </form>
  </div>
);

export const ExpenseList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const canEdit = hasPermission(user, 'expenses.edit');
  const canDelete = hasPermission(user, 'expenses.delete');

  const isNew = location.pathname.endsWith('/new');
  const isEdit = Boolean(id && location.pathname.endsWith('/edit'));
  const isDetail = Boolean(id && !isEdit);

  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgetItems, setBudgetItems] = useState([]);
  const [budgetError, setBudgetError] = useState('');
  const [linkedSupplierTotals, setLinkedSupplierTotals] = useState(null);
  const [linkedSupplierError, setLinkedSupplierError] = useState('');
  const canViewSupplierAccounting = hasPermission(user, 'payments.view') && hasPermission(user, 'stock.view');

  useEffect(() => {
    if (!canViewSupplierAccounting || isNew || isEdit || isDetail) return undefined;
    let alive = true;
    financeService.getPaymentActivity({ page_size: 1 }).then(result => {
      if (alive) {
        setLinkedSupplierTotals(result);
        setLinkedSupplierError('');
      }
    }).catch(error => {
      if (alive) setLinkedSupplierError(error?.message || 'Linked supplier finance unavailable.');
    });
    return () => { alive = false; };
  }, [canViewSupplierAccounting, isNew, isEdit, isDetail]);
  const [settlement, setSettlement] = useState({
    amount: '', account: '', method: 'Cash', reference: '',
    idempotencyKey: globalThis.crypto?.randomUUID?.() || `settlement-${Date.now()}-${Math.random()}`,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeView, setActiveView] = useState('overview');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [form, setForm] = useState(freshExpenseForm);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows = await expenseService.getExpenses();
      setExpenses(rows);
    } catch (error) {
      setExpenses([]);
      setLoadError(error?.message || 'Unable to load expenses. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!canEdit) return;
    financeService.listAccounts()
      .then((list) => setAccounts(Array.isArray(list) ? list : []))
      .catch(() => setAccounts([]));
  }, [canEdit]);

  useEffect(() => {
    if (!isNew && !isEdit) return undefined;
    let alive = true;
    const month = String(form.expenseDate || today()).slice(0, 7);
    expenseService.getExpenseBudgets(month).then(rows => {
      if (alive) { setBudgetItems(rows); setBudgetError(''); }
    }).catch(err => {
      if (alive) {
        setBudgetItems([]);
        setBudgetError(err?.message || 'Unable to load monthly budget items.');
      }
    });
    return () => { alive = false; };
  }, [isNew, isEdit, form.expenseDate]);

  useEffect(() => {
    if (!isEdit || !id || !expenses.length) return;
    const expense = expenses.find((item)=>String(item.id)===String(id));
    if (!expense) return;
    setForm({
      title: expense.title || '',
      category: expense.category || 'Miscellaneous',
      amount: expense.amount || '',
      expenseDate: expense.expenseDate || today(),
      vendor: expense.vendor || '',
      paymentMethod: expense.paymentMethod === 'Cash' ? 'Cash' : 'Bank',
      referenceNo: expense.referenceNo || '',
      taxAmount: expense.taxAmount || '',
      gstRate: '',
      status: expense.status || 'approved',
      notes: expense.notes || '',
      receiptUrl: expense.receiptUrl || '',
      accountId: expense.accountId || '',
      budgetItemId: expense.budgetItemId || '',
      requestKey: ''
    });
  }, [isEdit, id, expenses]);

  const selectedExpense = useMemo(
    () => expenses.find((expense)=>String(expense.id)===String(id)) || null,
    [expenses, id]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter((expense) => {
      const queryMatch = !q || [
        expense.id,
        expense.title,
        expense.category,
        expense.vendor,
        expense.referenceNo,
        expense.paymentMethod
      ].some((value)=>String(value || '').toLowerCase().includes(q));
      const categoryMatch = categoryFilter === 'All' || expense.category === categoryFilter;
      const statusMatch = statusFilter === 'All' || expense.status === statusFilter.toLowerCase();
      return queryMatch && categoryMatch && statusMatch;
    });
  }, [expenses, query, categoryFilter, statusFilter]);

  const currentMonth = today().slice(0, 7);
  const currentMonthRows = expenses.filter((expense)=>String(expense.expenseDate).startsWith(currentMonth));
  const approvedRows = expenses.filter((expense)=>['approved', 'paid'].includes(expense.status));
  const pendingRows = expenses.filter((expense)=>expense.status==='pending approval');
  const todayRows = expenses.filter((expense)=>expense.expenseDate===today());

  const categoryTotals = useMemo(() => {
    const totals = {};
    expenses.forEach((expense) => {
      totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    });
    return Object.entries(totals)
      .map(([category,total])=>({category,total}))
      .sort((a,b)=>b.total-a.total);
  }, [expenses]);

  const paymentTotals = useMemo(() => {
    const totals = {};
    expenses.forEach((expense) => {
      totals[expense.paymentMethod] = (totals[expense.paymentMethod] || 0) + expense.amount;
    });
    return Object.entries(totals)
      .map(([method,total])=>({method,total}))
      .sort((a,b)=>b.total-a.total);
  }, [expenses]);

  const saveExpense = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setActionError('');
    try {
      if (form.status === 'paid') {
        assertFinanceAccount(accounts, form.accountId, form.paymentMethod);
      }
      const payload = { ...form };

      if (isEdit && id) {
        const updated = await expenseService.updateExpense(id, payload);
        if (updated) {
          setExpenses((current) => current.map((item) =>
            String(item.id) === String(id) ? updated : item
          ));
        }
        navigate(`/finance/expenses/${id}`);
      } else {
        const created = await expenseService.createExpense(payload);
        if (created?.id) setExpenses((current) => [created, ...current]);
        setForm(freshExpenseForm());
        navigate(created?.id ? `/finance/expenses/${created.id}` : '/finance/expenses');
      }
    } catch (error) {
      setActionError(error?.message || 'Could not save expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const settleExpense = async (event) => {
    event.preventDefault();
    if (!canEdit || !selectedExpense || submitting) return;
    setSubmitting(true);
    setActionError('');
    try {
      assertFinanceAccount(accounts, settlement.account, settlement.method);
      await expenseService.settleExpense(selectedExpense.id, settlement);
      await load();
      setSettlement({
        amount: '', account: '', method: 'Cash', reference: '',
        idempotencyKey: globalThis.crypto?.randomUUID?.() || `settlement-${Date.now()}-${Math.random()}`,
      });
    } catch (error) {
      setActionError(error?.message || 'Unable to settle expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const reverseExpenseSettlement = async (entry) => {
    if (!canEdit || !selectedExpense || submitting || entry.reversedAt) return;
    const reason = await appPrompt('Reason for reversing this expense payment:');
    if (!reason?.trim()) return;
    if (!await appConfirm('Reverse this payment and restore its bank/cash balance?', {
      title: 'Reverse Expense Payment', confirmLabel: 'Reverse Payment', tone: 'danger'
    })) return;
    setSubmitting(true);
    setActionError('');
    try {
      await expenseService.reverseSettlement(selectedExpense.id, entry.id, reason.trim());
      await load();
    } catch (err) {
      setActionError(err?.message || 'Unable to reverse this payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeExpense = async (expense) => {
    if (!canDelete || !await appConfirm(`Delete expense ${expense.id}?`)) return;
    setActionError('');
    try {
      await expenseService.deleteExpense(expense.id);
      if (isDetail) navigate('/finance/expenses');
      else await load();
    } catch (error) {
      setActionError(error?.message || 'Could not delete expense. Please retry.');
    }
  };

  if (loading) return <div className="expense-empty" role="status">Loading expenses...</div>;
  if (loadError) return (
    <div className="expense-alert" role="alert">
      <p>{loadError}</p>
      <button type="button" onClick={load}>Retry</button>
    </div>
  );

  if (isNew) {
    return (
      <ExpenseForm
        title="Add Expense"
        values={form}
        setValues={setForm}
        onSubmit={saveExpense}
        onCancel={()=>navigate('/finance/expenses')}
        submitting={submitting}
        error={actionError}
        accounts={accounts}
        budgetItems={budgetItems}
        budgetError={budgetError}
      />
    );
  }

  if (isEdit) {
    if (!selectedExpense) return <div className="expense-empty">Expense not found.</div>;
    return (
      <ExpenseForm
        title="Edit Expense"
        values={form}
        setValues={setForm}
        onSubmit={saveExpense}
        onCancel={()=>navigate(`/finance/expenses/${id}`)}
        submitting={submitting}
        error={actionError}
        accounts={accounts}
        budgetItems={budgetItems}
        budgetError={budgetError}
      />
    );
  }

  if (isDetail) {
    if (!selectedExpense) return <div className="expense-empty">Expense not found.</div>;

    return (
      <div className="expense-management-page expense-detail-page cg-expenses">
        {actionError ? <div className="expense-alert" role="alert">{actionError}</div> : null}
        <header className="expense-detail-header">
          <div>
            <span>{selectedExpense.id}</span>
            <h1>{selectedExpense.title}</h1>
            <p>{selectedExpense.category} · {selectedExpense.expenseDate}</p>
          </div>

          <div className="expense-detail-actions">
            {canEdit ? <button type="button" onClick={()=>navigate(`/finance/expenses/${selectedExpense.id}/edit`)}><Edit3 size={16}/> Edit</button> : null}
            {canDelete ? <button type="button" className="is-danger" onClick={()=>removeExpense(selectedExpense)}><Trash2 size={16}/> Delete</button> : null}
          </div>
        </header>

        <div className="expense-detail-kpis">
          <div><IndianRupee size={16}/><span>Amount</span><strong>{money.format(selectedExpense.amount)}</strong></div>
          <div><WalletCards size={16}/><span>Payment</span><strong>{selectedExpense.paymentMethod}</strong></div>
          <div><Calendar size={16}/><span>Date</span><strong>{selectedExpense.expenseDate}</strong></div>
          <div><CheckCircle2 size={16}/><span>Status</span><strong>{selectedExpense.status}</strong></div>
        </div>

        <section className="expense-panel">
          <div className="expense-section-header">
            <div>
              <h2>Pay This Expense</h2>
              <p>Posted settlements debit your internal Cash/Bank ledger; unpaid expenses do not.</p>
            </div>
          </div>
          <div className="expense-detail-kpis">
            <div><span>Paid through ledger</span><strong>{money.format(selectedExpense.paidAmount || 0)}</strong></div>
            <div><span>Outstanding</span><strong>{money.format(selectedExpense.balanceDue ?? selectedExpense.amount)}</strong></div>
          </div>
          {selectedExpense.status === 'paid' && !selectedExpense.paidAmount && (
            <p className="expense-alert">Historical paid expense: reconcile its existing payment before posting a new debit.</p>
          )}
          {canEdit && Number(selectedExpense.balanceDue) > 0 &&
            !['draft', 'rejected', 'cancelled', 'pending approval', 'paid'].includes(selectedExpense.status) && (
            <form className="expense-form" onSubmit={settleExpense}>
              <div className="expense-form-grid">
                <Field label="Settlement Amount (₹)">
                  <input type="number" step="0.01" min="0.01" required
                    max={selectedExpense.balanceDue} value={settlement.amount}
                    disabled={submitting}
                    onChange={(event) => setSettlement((prev) => ({ ...prev, amount: event.target.value }))} />
                </Field>
                <Field label="Debit Account">
                  <select required value={settlement.account} disabled={submitting}
                    onChange={(event) => setSettlement((prev) => ({ ...prev, account: event.target.value }))}>
                    <option value="">Choose account</option>
                    {financeAccountsForChannel(accounts, settlement.method).map((item) => (
                      <option value={item.id} key={item.id}>{item.name} — {money.format(Number(item.currentBalance || 0))}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Payment Method">
                  <select value={settlement.method} disabled={submitting}
                    onChange={(event) => setSettlement((prev) => ({ ...prev, method: event.target.value, account: '' }))}>
                    {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                  </select>
                </Field>
                <Field label="Reference">
                  <input value={settlement.reference} maxLength={120} disabled={submitting}
                    onChange={(event) => setSettlement((prev) => ({ ...prev, reference: event.target.value }))} />
                </Field>
              </div>
              <div className="expense-form-actions">
                <button className="finance-primary-btn" type="submit" disabled={submitting}>
                  {submitting ? 'Posting…' : 'Pay Expense & Debit Account'}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="expense-panel">
          <div className="expense-section-header">
            <div>
              <h2>Expense Payment History</h2>
              <p>Posted account movements, references and audited reversals.</p>
            </div>
          </div>
          {(selectedExpense.settlementHistory || []).length === 0 ? (
            <p>No account-linked expense settlements recorded yet.</p>
          ) : (
            <div className="expense-info-grid">
              {selectedExpense.settlementHistory.map((entry) => (
                <div key={entry.id} className="expense-settlement-record">
                  <span>{new Date(entry.postedAt).toLocaleDateString('en-IN')} · {entry.accountName}</span>
                  <strong>{money.format(Number(entry.amount))}</strong>
                  <small>{entry.method} · {entry.reference || 'No reference'}</small>
                  <small>{entry.reversedAt ? `Reversed: ${entry.reversalReason || 'Audited correction'}` : 'Posted'}</small>
                  {canEdit && !entry.reversedAt && (
                    <button type="button" disabled={submitting} className="is-danger"
                      onClick={() => reverseExpenseSettlement(entry)}>
                      Reverse Payment
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="expense-two-column">
          <section className="expense-panel">
            <div className="expense-section-header">
              <div>
                <h2>Expense Details</h2>
                <p>Vendor, amount, payment and accounting reference.</p>
              </div>
            </div>

            <div className="expense-info-grid">
              <div><span>Expense ID</span><strong>{selectedExpense.id}</strong></div>
              <div><span>Category</span><strong>{selectedExpense.category}</strong></div>
              <div><span>Vendor</span><strong>{selectedExpense.vendor}</strong></div>
              <div><span>Payment Method</span><strong>{selectedExpense.paymentMethod}</strong></div>
              <div><span>Amount</span><strong>{money.format(selectedExpense.amount)}</strong></div>
              <div><span>Tax / GST</span><strong>{money.format(selectedExpense.taxAmount)}</strong></div>
              <div><span>Reference</span><strong>{selectedExpense.referenceNo || '—'}</strong></div>
              <div><span>Status</span><strong>{selectedExpense.status}</strong></div>
            </div>
          </section>

          <section className="expense-panel">
            <div className="expense-section-header">
              <div>
                <h2>Receipt & Notes</h2>
                <p>Bill attachment metadata and expense notes.</p>
              </div>
              <Receipt size={18}/>
            </div>

            <div className="expense-receipt-box">
              <FileText size={20}/>
              <div>
                {selectedExpense.receiptUrl ? (
                  <a href={selectedExpense.receiptUrl} target="_blank" rel="noopener noreferrer">Open Receipt / Bill</a>
                ) : (
                  <strong>No receipt link provided</strong>
                )}
                <span>{selectedExpense.referenceNo || 'No bill reference'}</span>
              </div>
            </div>

            <div className="expense-notes-box">
              {selectedExpense.notes || 'No additional notes recorded.'}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="expense-management-page cg-expenses">
      {actionError ? <div className="expense-alert" role="alert">{actionError}</div> : null}
      <ExpensesHeader onAdd={()=>navigate('/finance/expenses/new')} />
      {canViewSupplierAccounting && (
        <section className="expense-panel" aria-label="Linked supplier purchase accounting">
          <div className="expense-section-header">
            <div>
              <h2>Supplier Purchases &amp; Pending Payments</h2>
              <p>Parts purchases are recorded against supplier bills and inventory;
                they are not counted again as operational expense payments.</p>
            </div>
          </div>
          {linkedSupplierError && <p className="expense-alert" role="alert">{linkedSupplierError}</p>}
          {!linkedSupplierTotals && !linkedSupplierError && <p>Loading linked supplier amounts…</p>}
          {linkedSupplierTotals && <div className="expense-detail-kpis">
            <div><span>Posted Supplier Purchases</span>
              <strong>{money.format(Number(linkedSupplierTotals.supplierPurchases))}</strong></div>
            <div><span>Supplier Payments Made</span>
              <strong>{money.format(Number(linkedSupplierTotals.supplierPayments))}</strong></div>
            <div><span>Credit Outstanding</span>
              <strong>{money.format(Number(linkedSupplierTotals.supplierOutstanding))}</strong></div>
          </div>}
          <p>To record a supplier transaction, open that supplier from the Suppliers directory.</p>
        </section>
      )}


      <ExpenseOverviewStats
        currentMonthTotal={currentMonthRows.reduce((sum,item)=>sum+item.amount,0)}
        approvedTotal={approvedRows.reduce((sum,item)=>sum+item.amount,0)}
        pendingCount={pendingRows.length}
        todayTotal={todayRows.reduce((sum,item)=>sum+Number(item.amount || 0),0)}
        paidTotal={expenses.reduce((sum,item)=>sum+Number(item.paidAmount || 0),0)}
        outstandingTotal={expenses.filter(item=>!['draft','rejected','cancelled'].includes(item.status))
          .reduce((sum,item)=>sum+Number(item.balanceDue ?? Math.max(0,Number(item.amount || 0)-Number(item.paidAmount || 0))),0)}
        formatMoney={(value)=>money.format(value || 0)}
      />

      <ExpenseTabs active={activeView} onChange={setActiveView} />

      {activeView === 'budgets' ? (
        <ExpenseBudgetPanel categories={expenseCategories} canEdit={canEdit} />
      ) : null}

      {activeView === 'overview' ? (
        <ExpenseOverview
          expenses={expenses}
          categoryTotals={categoryTotals}
          formatMoney={(value)=>money.format(value || 0)}
          onOpen={(expense)=>navigate(`/finance/expenses/${expense.id}`)}
        />
      ) : null}

      {activeView === 'expenses' ? (
        <ExpenseListView
          expenses={filtered}
          query={query}
          onQueryChange={setQuery}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          categories={expenseCategories}
          formatMoney={(value)=>money.format(value || 0)}
          onView={(expense)=>navigate(`/finance/expenses/${expense.id}`)}
          onEdit={(expense)=>navigate(`/finance/expenses/${expense.id}/edit`)}
          onDelete={removeExpense}
        />
      ) : null}

      {activeView === 'categories' ? (
        <section className="expense-panel">
          <div className="expense-section-header">
            <div>
              <h2>Expense Categories</h2>
              <p>Workshop operating-cost groups and current recorded spend.</p>
            </div>
          </div>

          <div className="expense-category-grid">
            {expenseCategories.map((category)=>{
              const rows=expenses.filter((expense)=>expense.category===category);
              const total=rows.reduce((sum,item)=>sum+item.amount,0);
              return (
                <article key={category} className="expense-category-card">
                  <div><Layers3 size={16}/><strong>{category}</strong></div>
                  <div><span>Records <b>{rows.length}</b></span><span>Total Spend <b>{money.format(total)}</b></span></div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeView === 'reports' ? (
        <div className="expense-management-view">
          <div className="expense-metric-grid is-four">
            <Metric label="Total Expenses" value={money.format(expenses.reduce((sum,item)=>sum+item.amount,0))} icon={CircleDollarSign}/>
            <Metric label="Tax / GST" value={money.format(expenses.reduce((sum,item)=>sum+item.taxAmount,0))} icon={FileText}/>
            <Metric label="Avg Expense" value={money.format(expenses.length ? expenses.reduce((sum,item)=>sum+item.amount,0)/expenses.length : 0)} icon={BarChart3}/>
            <Metric label="Vendors" value={new Set(expenses.map((item)=>item.vendor)).size} icon={WalletCards}/>
          </div>

          <div className="expense-two-column">
            <section className="expense-panel">
              <div className="expense-section-header"><div><h2>Category Report</h2><p>Spend distribution by expense category.</p></div></div>
              <div className="expense-row-list">
                {categoryTotals.map((row)=><div key={row.category} className="expense-data-row"><div><strong>{row.category}</strong><span>Category spend</span></div><b>{money.format(row.total)}</b></div>)}
              </div>
            </section>

            <section className="expense-panel">
              <div className="expense-section-header"><div><h2>Payment Method Report</h2><p>Expense spend by payment mode.</p></div></div>
              <div className="expense-row-list">
                {paymentTotals.map((row)=><div key={row.method} className="expense-data-row"><div><strong>{row.method}</strong><span>Payment channel</span></div><b>{money.format(row.total)}</b></div>)}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ExpenseList;
