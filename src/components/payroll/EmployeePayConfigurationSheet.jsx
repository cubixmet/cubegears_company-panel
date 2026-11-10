import '../../styles/staff-payment-settings.css';
import { useEffect, useState } from "react";
import { Save, WalletCards } from 'lucide-react';
import { ResponsiveModalSheet } from '../common/ResponsiveModalSheet';
import { dailyWageService } from '../../services/dailyWage.service';

const localDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/**
 * Daily Wage ONLY. Kept as a small compatibility component for older callers;
 * no legacy salary, pay type, payment frequency or commission inputs.
 */
export const EmployeePayConfigurationSheet = ({ isOpen, onClose, structure, onSaved }) => {
  const employeeId = structure?.employee?.id || structure?.staffId || structure?.employee;
  const [rate, setRate] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(localDate());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setRate(structure?.dailyRate ?? structure?.dailyWageRate ?? '');
      setEffectiveFrom(localDate());
      setReason('');
      setError('');
      setFieldErrors({});
    }
  }, [isOpen, employeeId]);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const invalid = {
      rate: !(Number(rate) > 0 && Number.isFinite(Number(rate))) ? 'Enter a positive daily wage rate.' : '',
      effectiveFrom: !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom || '') ? 'Choose an effective date.' : '',
      reason: !reason.trim() ? 'Please explain the rate change.' : '',
    };
    setFieldErrors(invalid);
    if (Object.values(invalid).some(Boolean)) {
      setError('Correct the highlighted fields before saving.');
      return;
    }
    if (!employeeId) {
      setError('Select a staff member first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await dailyWageService.addRate(employeeId, {
        rate,
        effectiveFrom,
        reason: reason.trim(),
      });
      // Never dispatch the obsolete legacy compensation-plan save callback.
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      const fields = err?.response?.data || {};
      setFieldErrors((previous) => ({
        ...previous,
        rate: fields.rate?.[0] || fields.rate || previous.rate || '',
        effectiveFrom: fields.effectiveFrom?.[0] || fields.effectiveFrom || previous.effectiveFrom || '',
        reason: fields.reason?.[0] || fields.reason || previous.reason || '',
      }));
      setError(err?.message || 'Could not save daily wage rate.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModalSheet
      isOpen={isOpen}
      title={`Daily Wage Rate · ${structure?.staffName || structure?.employee?.name || 'Staff'}`}
      onClose={onClose}
      maxWidth="520px"
    >
      <form className="employee-pay-config-form" onSubmit={submit}>
        <div className="pay-config-revision-note">
          <WalletCards size={16} aria-hidden="true"/>
          Set the daily rate here. Cash/Bank payments are recorded separately in the Wage Account.
        </div>
        <label className={`pay-config-field is-wide ${fieldErrors.rate ? 'has-error' : ''}`}>
          <span>Daily Wage Rate (₹) *</span>
          <input name="dailyWageRate" type="number" min="0.01" step="0.01"
            aria-invalid={Boolean(fieldErrors.rate)} required value={rate}
            onChange={(e) => { setRate(e.target.value); setFieldErrors((p) => ({ ...p, rate: '' })); }}/>
          {fieldErrors.rate && <small role="alert">{String(fieldErrors.rate)}</small>}
        </label>
        <label className={`pay-config-field is-wide ${fieldErrors.effectiveFrom ? 'has-error' : ''}`}>
          <span>Effective From *</span>
          <input type="date" required aria-invalid={Boolean(fieldErrors.effectiveFrom)}
            value={effectiveFrom}
            onChange={(e) => { setEffectiveFrom(e.target.value); setFieldErrors((p) => ({ ...p, effectiveFrom: '' })); }}/>
          {fieldErrors.effectiveFrom && <small role="alert">{String(fieldErrors.effectiveFrom)}</small>}
        </label>
        <label className={`pay-config-field is-wide ${fieldErrors.reason ? 'has-error' : ''}`}>
          <span>Reason *</span>
          <textarea required rows={2} value={reason}
            aria-invalid={Boolean(fieldErrors.reason)}
            onChange={(e) => { setReason(e.target.value); setFieldErrors((p) => ({ ...p, reason: '' })); }}
            placeholder="e.g. New agreed wage rate"/>
          {fieldErrors.reason && <small role="alert">{String(fieldErrors.reason)}</small>}
        </label>
        {error && <div className="staff-directory-message is-error" role="alert">{error}</div>}
        <div className="pay-config-actions">
          <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="is-primary" disabled={saving}>
            <Save size={15}/>{saving ? 'Saving…' : 'Save Daily Wage Rate'}
          </button>
        </div>
      </form>
    </ResponsiveModalSheet>
  );
};
