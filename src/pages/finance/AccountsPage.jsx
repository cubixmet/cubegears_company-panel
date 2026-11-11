import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Building2, Wallet, Plus, Power
} from 'lucide-react';
import { financeService } from '../../services/finance.service';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import '../../styles/finance-accounts.css';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
});
const fmt = (v) => v === undefined || v === null ? 'Restricted' : money.format(parseFloat(v || 0));

const KINDS = ['Cash', 'Bank'];

const emptyForm = {
  name: '', kind: 'Cash', bankName: '', accountNumber: '',
  ifsc: '', branchName: '', openingBalance: '0',
  openingDate: new Date().toISOString().slice(0, 10), description: ''
};

function AccountForm({ initial, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(initial || emptyForm);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form className="finance-account-form" onSubmit={handleSubmit}>
      {error && <div className="finance-form-error" role="alert">{error}</div>}
      <div className="finance-form-grid">
        <label className="finance-field finance-field-wide">
          <span>Account Name *</span>
          <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. SBI Current Account" />
        </label>
        <label className="finance-field">
          <span>Account Type *</span>
          <select value={form.kind} onChange={e => set('kind', e.target.value)}>
            {KINDS.map(k => <option key={k}>{k}</option>)}
          </select>
        </label>
        <label className="finance-field">
          <span>Starting Balance (₹)</span>
          <input type="number" step="0.01" min="0" value={form.openingBalance} onChange={e => set('openingBalance', e.target.value)} />
        </label>
        <label className="finance-field">
          <span>Starting Date</span>
          <input type="date" value={form.openingDate} onChange={e => set('openingDate', e.target.value)} />
        </label>
        {form.kind === 'Bank' && (
          <>
            <label className="finance-field">
              <span>Bank Name</span>
              <input value={form.bankName} onChange={e => set('bankName', e.target.value)} placeholder="State Bank of India" />
            </label>
            <label className="finance-field">
              <span>Account Number</span>
              <input value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} placeholder="XXXX XXXX XXXX" />
            </label>
            <label className="finance-field">
              <span>IFSC Code</span>
              <input value={form.ifsc} onChange={e => set('ifsc', e.target.value.toUpperCase())} placeholder="SBIN0001234" />
            </label>
            <label className="finance-field">
              <span>Branch</span>
              <input value={form.branchName} onChange={e => set('branchName', e.target.value)} placeholder="Main Branch" />
            </label>
          </>
        )}
        <label className="finance-field finance-field-wide">
          <span>Description</span>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Optional notes about this account" />
        </label>
      </div>
      <div className="finance-form-actions">
        <button type="button" className="finance-secondary-btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="finance-primary-btn" disabled={saving}>
          {saving ? 'Saving…' : 'Save Account'}
        </button>
      </div>
    </form>
  );
}

export function AccountsPage() {
  const navigate = useNavigate();
  const { can } = useFeatureAccess();
  const canManage = can('payments.edit');
  const { id } = useParams();
  const location = useLocation();
  const isNew = location.pathname.endsWith('/new');

  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ direction: 'credit', amount: '', reason: '' });
  const [adjusting, setAdjusting] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await financeService.listAccounts({ include_inactive: '1' });
      setAccounts(Array.isArray(result) ? result : []);
    } catch {
      setError('Unable to load accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccount = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const result = await financeService.getAccount(id);
      setAccount(result);
    } catch {
      setError('Unable to load account details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id && !isNew) loadAccount();
    else if (!id) loadAccounts();
    else setLoading(false);
  }, [id, isNew, loadAccount, loadAccounts]);

  const handleCreate = async (form) => {
    if (!canManage) { setFormError('Account management permission required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      await financeService.createAccount(form);
      navigate('/finance/accounts');
    } catch (e) {
      const details = e?.data;
      setFormError(typeof details?.detail === 'string' ? details.detail :
        Object.values(details || {}).flat().join(', ') || e?.message || 'Failed to create account.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form) => {
    setSaving(true);
    setFormError('');
    try {
      await financeService.updateAccount(id, form);
      loadAccount();
    } catch (e) {
      const details = e?.data;
      setFormError(typeof details?.detail === 'string' ? details.detail :
        Object.values(details || {}).flat().join(', ') || e?.message || 'Failed to update account.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    setAdjusting(true);
    try {
      await financeService.adjustBalance(id, adjustForm);
      setShowAdjust(false);
      setAdjustForm({ direction: 'credit', amount: '', reason: '' });
      loadAccount();
    } catch (err) {
      const details = err?.data;
      setError(typeof details?.detail === 'string' ? details.detail :
        Object.values(details || {}).flat().join(', ') || err?.message || 'Adjustment failed.');
    } finally {
      setAdjusting(false);
    }
  };

  const toggleActive = async () => {
    if (!account || !canManage) return;
    try {
      await financeService.updateAccount(id, { isActive: !account.isActive });
      loadAccount();
    } catch {
      setError('Could not update account status.');
    }
  };

  if (isNew && !canManage) return <div className="finance-form-error" role="alert">Account management permission required.</div>;
  if (isNew) {
    return (
      <div className="finance-page">
        <header className="finance-page-header">
          <button className="finance-back-btn" onClick={() => navigate('/finance/accounts')}>
            <ArrowLeft size={16} /> Accounts
          </button>
          <h1>Add Cash or Bank Account</h1>
          <p>Set up a new bank or cash account for financial tracking.</p>
        </header>
        <AccountForm onSave={handleCreate} onCancel={() => navigate('/finance/accounts')} saving={saving} error={formError} />
      </div>
    );
  }

  if (id && account) {
    return (
      <div className="finance-page">
        <header className="finance-page-header">
          <button className="finance-back-btn" onClick={() => navigate('/finance/accounts')}>
            <ArrowLeft size={16} /> Accounts
          </button>
          <div className="finance-account-title-row">
            <h1>{account.name}</h1>
            <div className="finance-account-badges">
              <span className={`finance-kind-badge finance-kind-${String(account.kind || 'Other').toLowerCase()}`}>{account.kind || 'Other'}</span>
              <span className={`finance-status-badge ${account.isActive ? 'is-active' : 'is-inactive'}`}>
                {account.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          {canManage && <div className="finance-account-actions">
            <button className="finance-secondary-btn" onClick={() => setShowAdjust(!showAdjust)}>
              Adjust Balance
            </button>
            <button className="finance-secondary-btn" onClick={toggleActive}>
              <Power size={15} /> {account.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>}
        </header>

        {error && <div className="finance-error" role="alert">{error}</div>}

        <div className="finance-account-stats">
          <article className="finance-balance-card">
            <span>Current Balance</span>
            <strong className="finance-big-balance">{fmt(account.currentBalance)}</strong>
          </article>
          <article className="finance-balance-card">
            <span>Opening Balance</span>
            <strong>{fmt(account.openingBalance)}</strong>
          </article>
          {account.bankName && (
            <article className="finance-balance-card">
              <span>Bank</span>
              <strong>{account.bankName}</strong>
            </article>
          )}
          {account.accountNumber && (
            <article className="finance-balance-card">
              <span>Account No.</span>
              <strong>{account.accountNumber}</strong>
            </article>
          )}
          {account.ifsc && (
            <article className="finance-balance-card">
              <span>IFSC</span>
              <strong>{account.ifsc}</strong>
            </article>
          )}
        </div>

        {showAdjust && (
          <section className="finance-adjust-panel">
            <h3>Correct Account Balance</h3>
            <form onSubmit={handleAdjust} className="finance-adjust-form">
              <label className="finance-field">
                <span>Direction</span>
                <select value={adjustForm.direction} onChange={e => setAdjustForm({ ...adjustForm, direction: e.target.value })}>
                  <option value="credit">Credit (Add money)</option>
                  <option value="debit">Debit (Remove money)</option>
                </select>
              </label>
              <label className="finance-field">
                <span>Amount (₹) *</span>
                <input type="number" required min="0.01" step="0.01" value={adjustForm.amount}
                  onChange={e => setAdjustForm({ ...adjustForm, amount: e.target.value })} />
              </label>
              <label className="finance-field finance-field-wide">
                <span>Reason / Audit Note *</span>
                <input required value={adjustForm.reason}
                  onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="Reason for balance adjustment" />
              </label>
              <div className="finance-form-actions">
                <button type="button" className="finance-secondary-btn" onClick={() => setShowAdjust(false)}>Cancel</button>
                <button type="submit" className="finance-primary-btn" disabled={adjusting}>
                  {adjusting ? 'Adjusting…' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="finance-ledger-section">
          <h3>Account Transaction History</h3>
          {!account.ledger || account.ledger.length === 0 ? (
            <div className="finance-empty-ledger">No transactions recorded yet.</div>
          ) : (
            <div className="finance-ledger-table-wrap">
              <table className="finance-ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th className="is-num">Credit</th>
                    <th className="is-num">Debit</th>
                    <th className="is-num">Balance</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {account.ledger.map(row => (
                    <tr key={row.id}>
                      <td>{row.date?.slice(0, 10)}</td>
                      <td><span className="finance-entry-type">{row.type.replace(/_/g, ' ')}</span></td>
                      <td className="finance-ref-cell">{row.reference || '—'}</td>
                      <td className="is-num is-credit">{parseFloat(row.credit) > 0 ? fmt(row.credit) : '—'}</td>
                      <td className="is-num is-debit">{parseFloat(row.debit) > 0 ? fmt(row.debit) : '—'}</td>
                      <td className="is-num"><strong>{fmt(row.runningBalance)}</strong></td>
                      <td className="finance-by-cell">{row.createdBy || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="finance-page">
      <header className="finance-page-header">
        <div>
          <span className="finance-dash-kicker">FINANCE</span>
          <h1>Cash &amp; Bank Accounts</h1>
          <p>Choose where workshop money is held or paid from. You can track each account separately.</p>
        </div>
        {canManage && <button className="finance-primary-btn" onClick={() => navigate('/finance/accounts/new')}>
          <Plus size={16} /> Add Account
        </button>}
      </header>

      {error && <div className="finance-error" role="alert">{error}</div>}

      {loading ? (
        <div className="finance-loading" role="status">Loading accounts…</div>
      ) : error ? null : accounts.length === 0 ? (
        <div className="finance-empty">
          <Building2 size={40} />
          <h3>No cash or bank accounts yet</h3>
          <p>Create an account to receive customer payments, pay expenses, or transfer money.</p>
          {canManage && <button className="finance-primary-btn" onClick={() => navigate('/finance/accounts/new')}>
            Add First Account
          </button>}
        </div>
      ) : (
        <div className="finance-accounts-list">
          {accounts.map(acc => (
            <article
              key={acc.id}
              className={`finance-account-row ${!acc.isActive ? 'is-inactive' : ''}`}
              onClick={() => navigate(`/finance/accounts/${acc.id}`)}
              role="button"
              tabIndex={0}
              aria-label={`View account ${acc.name}`}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/finance/accounts/${acc.id}`);
                }
              }}
            >
              <div className="finance-account-row-left">
                {acc.kind === 'Bank' ? <Building2 size={20} /> : <Wallet size={20} />}
                <div>
                  <strong>{acc.name}</strong>
                  {acc.bankName && <span>{acc.bankName}{acc.accountNumber ? ` · ${acc.accountNumber}` : ''}</span>}
                </div>
              </div>
              <div className="finance-account-row-right">
                <span className={`finance-kind-badge finance-kind-${String(acc.kind || 'Other').toLowerCase()}`}>{acc.kind || 'Other'}</span>
                {!acc.isActive && <span className="finance-status-badge is-inactive">Inactive</span>}
                <strong className="finance-row-balance">{fmt(acc.currentBalance)}</strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default AccountsPage;

