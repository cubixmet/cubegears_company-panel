import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, Plus } from 'lucide-react';
import { financeService } from '../../services/finance.service';
import { isFinanceAccount, assertFinanceAccount, accountChannel } from '../../utils/financeCashBank';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import '../../styles/finance-transfers.css';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
});
const fmt = (v) => v === undefined || v === null ? 'Restricted' : money.format(parseFloat(v || 0));

export function TransfersPage() {
  const navigate = useNavigate();
  const { can } = useFeatureAccess();
  const canManage = can('payments.edit');
  const location = useLocation();
  const isNew = location.pathname.endsWith('/new');

  const [transfers, setTransfers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fromAccountId: '', toAccountId: '', amount: '',
    date: new Date().toISOString().slice(0, 10), reference: '', notes: ''
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [t, a] = await Promise.all([
        financeService.listTransfers(),
        financeService.listAccounts(),
      ]);
      setTransfers(Array.isArray(t) ? t : []);
      setAccounts((Array.isArray(a) ? a : []).filter(isFinanceAccount));
    } catch {
      setError('Unable to load transfer data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    try {
      assertFinanceAccount(accounts, form.fromAccountId,
        accountChannel(accounts.find(x => x.id === form.fromAccountId)?.kind));
      assertFinanceAccount(accounts, form.toAccountId,
        accountChannel(accounts.find(x => x.id === form.toAccountId)?.kind));
    } catch (cause) { setError(cause.message); return; }
    if (!form.fromAccountId || !form.toAccountId) {
      setError('Please select both accounts.');
      return;
    }
    if (form.fromAccountId === form.toAccountId) {
      setError('Cannot transfer to the same account.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await financeService.createTransfer({ ...form, idempotencyKey: `${Date.now()}_${Math.random()}` });
      navigate('/finance/transfers');
    } catch (err) {
      const details = err?.data;
      setError(typeof details?.detail === 'string' ? details.detail :
        Object.values(details || {}).flat().join(', ') || err?.message || 'Transfer failed.');
    } finally {
      setSaving(false);
    }
  };

  if (isNew && !canManage) return <div role="alert">Transfer permission required.</div>;
  if (isNew) {
    return (
      <div className="finance-page">
        <header className="finance-page-header">
          <button className="finance-back-btn" onClick={() => navigate('/finance/transfers')}>
            <ArrowLeft size={16} /> Transfers
          </button>
          <h1>Move Money Between Accounts</h1>
          <p>Choose the source and destination accounts. A transfer moves money; it is not an income or expense.</p>
        </header>
        {error && <div className="finance-error" role="alert">{error}</div>}
        <form className="finance-transfer-form" onSubmit={handleSubmit}>
          <div className="finance-form-grid">
            <label className="finance-field">
              <span>Take Money From *</span>
              <select required value={form.fromAccountId} onChange={e => setForm({ ...form, fromAccountId: e.target.value })}>
                <option value="">Select source account</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.kind}) — {fmt(a.currentBalance)}</option>
                ))}
              </select>
            </label>
            <label className="finance-field">
              <span>Send Money To *</span>
              <select required value={form.toAccountId} onChange={e => setForm({ ...form, toAccountId: e.target.value })}>
                <option value="">Select destination account</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.kind}) — {fmt(a.currentBalance)}</option>
                ))}
              </select>
            </label>
            <label className="finance-field">
              <span>Amount (₹) *</span>
              <input type="number" required min="0.01" step="0.01" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </label>
            <label className="finance-field">
              <span>Transfer Date</span>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </label>
            <label className="finance-field">
              <span>Reference</span>
              <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })}
                placeholder="Optional reference number" maxLength={120} />
            </label>
            <label className="finance-field finance-field-wide">
              <span>Reason / Notes</span>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </label>
          </div>
          <div className="finance-form-actions">
            <button type="button" className="finance-secondary-btn" onClick={() => navigate('/finance/transfers')} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="finance-primary-btn" disabled={saving}>
              <ArrowLeftRight size={16} /> {saving ? 'Transferring…' : 'Transfer Funds'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="finance-page">
      <header className="finance-page-header">
        <div>
          <span className="finance-dash-kicker">FINANCE</span>
          <h1>Account Transfers</h1>
          <p>See money moved between the workshop's cash and bank accounts. These movements are not sales or expenses.</p>
        </div>
        {canManage && <button className="finance-primary-btn" onClick={() => navigate('/finance/transfers/new')}>
          <Plus size={16} /> New Transfer
        </button>}
      </header>
      {error && <div className="finance-error" role="alert">{error}</div>}
      {loading ? (
        <div className="finance-loading">Loading transfers…</div>
      ) : error ? null : (
        transfers.length === 0 ? (
          <div className="finance-empty">
            <ArrowLeftRight size={40} />
            <h3>No account transfers yet</h3>
            <p>Use New Transfer to move money from one workshop account to another.</p>
          </div>
        ) : (
          <div className="finance-transfers-list">
            {transfers.map(t => (
              <div key={t.id} className="finance-transfer-row">
                <div className="finance-transfer-flow">
                  <span className="finance-transfer-from">{t.fromAccount}</span>
                  <ArrowLeftRight size={16} className="finance-transfer-arrow" />
                  <span className="finance-transfer-to">{t.toAccount}</span>
                </div>
                <div className="finance-transfer-meta">
                  {t.reference && <span>{t.reference}</span>}
                  <span>{t.date}</span>
                  <span className="finance-transfer-by">by {t.createdBy || 'System'}</span>
                </div>
                <strong className="finance-transfer-amount">{fmt(t.amount)}</strong>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default TransfersPage;

