import { useEffect, useState } from 'react';
import { appPrompt } from '../common/appDialogs';
import { expenseService } from '../../services/expense.service';
import { localDate } from '../../services/expense.mapper';

const currency = value => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(value) || 0);

export function ExpenseBudgetPanel({ categories, canEdit }) {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    name: '', category: 'Utilities', plannedAmount: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await expenseService.getExpenseBudgets(month));
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Unable to fetch budgets.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void reload(); }, [month]);

  const create = async event => {
    event.preventDefault();
    if (!canEdit || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await expenseService.createExpenseBudget({ ...form, month });
      setForm(current => ({ ...current, name: '', plannedAmount: '' }));
      setMessage('Budget item saved. It is available when recording an expense for this month.');
      await reload();
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.name || data?.category || data?.plannedAmount ||
        data?.detail || err?.message || 'Unable to save this budget.');
    } finally {
      setSaving(false);
    }
  };

  const changeLimit = async item => {
    if (!canEdit || saving) return;
    const entered = await appPrompt(
      `Monthly planned amount for "${item.name}" (₹)`, item.plannedAmount,
    );
    if (entered == null) return;
    if (!/^\d+(?:\.\d{1,2})?$/.test(entered.trim()) || Number(entered) <= 0) {
      setError('Enter a positive budget amount with up to two decimals.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await expenseService.updateExpenseBudget(item.id, { plannedAmount: entered });
      await reload();
    } catch (err) {
      setError(err?.response?.data?.plannedAmount || err?.message || 'Could not update budget.');
    } finally {
      setSaving(false);
    }
  };

  const planned = items.reduce((total, item) => total + Number(item.plannedAmount || 0), 0);
  const spent = items.reduce((total, item) => total + Number(item.spentAmount || 0), 0);

  return (
    <section className="expense-panel" aria-label="Monthly expense budgets">
      <div className="expense-section-header">
        <div>
          <h2>Monthly Budget Items</h2>
          <p>Plan operational expenses, then link each purchase or bill to its budget item when recording an Expense. Payments are not counted twice.</p>
        </div>
      </div>
      {error && <div className="expense-alert" role="alert">{String(error)}</div>}
      {message && <div className="expense-alert" role="status">{message}</div>}
      <div className="expense-form-grid">
        <label className="expense-field">
          <span>Budget Month</span>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            aria-label="Budget month" required />
        </label>
      </div>
      <div className="expense-detail-kpis">
        <div><span>Planned Budget</span><strong>{currency(planned)}</strong></div>
        <div><span>Used by Expenses</span><strong>{currency(spent)}</strong></div>
        <div><span>Remaining</span><strong>{currency(planned - spent)}</strong></div>
      </div>
      {canEdit && (
        <form className="expense-form" onSubmit={create}>
          <div className="expense-form-grid">
            <label className="expense-field">
              <span>Budget Item Name</span>
              <input required maxLength={120} placeholder="e.g. Workshop Cleaning"
                value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}/>
            </label>
            <label className="expense-field">
              <span>Expense Category</span>
              <select value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))}>
                {categories.filter(c => !['Staff Salary','Daily Wages','Overtime'].includes(c))
                  .map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="expense-field">
              <span>Monthly Planned Amount (₹)</span>
              <input required type="number" min="0.01" step="0.01" value={form.plannedAmount}
                onChange={e => setForm(v => ({ ...v, plannedAmount: e.target.value }))}/>
            </label>
          </div>
          <div className="expense-form-actions">
            <button className="is-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add Budget Item'}
            </button>
          </div>
        </form>
      )}
      {loading && <p role="status">Loading budget items…</p>}
      {!loading && !items.length && <p>No monthly budget items yet. Add one above or choose another month.</p>}
      {!loading && items.length > 0 && (
        <div className="expense-info-grid">
          {items.map(item => {
            const over = Number(item.remainingAmount) < 0;
            return (
              <article className="expense-panel" key={item.id}>
                <strong>{item.name}</strong>
                <p>{item.category} · {item.month} {!item.isActive ? '· Inactive' : ''}</p>
                <div className="expense-detail-kpis">
                  <div><span>Planned</span><strong>{currency(item.plannedAmount)}</strong></div>
                  <div><span>Used</span><strong>{currency(item.spentAmount)}</strong></div>
                  <div><span>{over ? 'Over Budget' : 'Remaining'}</span>
                    <strong>{currency(over ? Math.abs(Number(item.remainingAmount)) : item.remainingAmount)}</strong>
                  </div>
                </div>
                {canEdit && <button type="button" disabled={saving}
                  onClick={() => changeLimit(item)}>Edit Budget Amount</button>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
