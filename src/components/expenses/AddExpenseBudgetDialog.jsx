import { useState } from 'react';
import { expenseService } from '../../services/expense.service';
import { ResponsiveModalSheet } from '../common/ResponsiveModalSheet';

export function AddExpenseBudgetDialog({ month, category, onSave, onClose }) {
  const [name, setName] = useState('');
  const [plannedAmount, setPlannedAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (!saving) onClose();
  };

  const save = async event => {
    event.preventDefault();
    if (saving) return;
    if (name.trim().length < 2) {
      setError('Enter a budget item name with at least 2 characters.');
      event.currentTarget.elements.name.focus();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const item = await expenseService.createExpenseBudget({
        name: name.trim(), month, category, plannedAmount,
      });
      onSave(item);
    } catch (err) {
      setError(err?.message || 'Unable to save this budget item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModalSheet isOpen onClose={close} title="Add Budget Item" maxWidth="480px">
      <form className="expense-form" onSubmit={save}>
        <p>{category} · {month}</p>
        {error && <div className="expense-alert" role="alert">{error}</div>}
        <label className="expense-field">
          <span>Budget Item Name</span>
          <input name="name" required minLength={2} maxLength={120} value={name}
            disabled={saving} onChange={event => { setName(event.target.value); setError(''); }} />
        </label>
        <label className="expense-field">
          <span>Monthly Planned Amount (₹)</span>
          <input type="number" inputMode="decimal" required min="0.01" step="0.01"
            max="9999999999.99" value={plannedAmount} disabled={saving}
            onChange={event => { setPlannedAmount(event.target.value); setError(''); }} />
        </label>
        <div className="expense-form-actions">
          <button type="button" onClick={close} disabled={saving}>Cancel</button>
          <button type="submit" className="is-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Budget Item'}
          </button>
        </div>
      </form>
    </ResponsiveModalSheet>
  );
}
