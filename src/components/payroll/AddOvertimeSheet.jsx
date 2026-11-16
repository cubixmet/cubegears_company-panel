import { recordLabel } from '../../utils/recordReferences.js';
import { useEffect, useMemo, useState } from "react";
import { ResponsiveModalSheet } from '../common/ResponsiveModalSheet';
import { staffService } from '../../services/staff.service';

const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const emptyForm = () => ({
  staffId: '',
  staffName: '',
  date: localDate(),
  payrollMonth: localDate().slice(0, 7),
  shift: '',
  clockIn: '',
  clockOut: '',
  overtimeHours: '',
  reason: '',
  notes: '',
});

export const AddOvertimeSheet = ({ isOpen, onClose, onSave, prefillStaff }) => {
  const [formData, setFormData] = useState(emptyForm);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    staffService.getStaff()
      .then((rows) => setStaff(Array.isArray(rows) ? rows : []))
      .catch(() => setStaff([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setFormData((current) => ({
      ...emptyForm(),
      staffId:
        prefillStaff?.staffId ||
        prefillStaff?.employeeId ||
        prefillStaff?.id ||
        current.staffId ||
        '',
      staffName:
        prefillStaff?.staffName ||
        prefillStaff?.name ||
        current.staffName ||
        '',
      shift: prefillStaff?.shift || current.shift || '',
    }));
    setError('');
  }, [isOpen, prefillStaff]);

  const staffOptions = useMemo(() => {
    const rows = [...staff];
    const prefillId =
      prefillStaff?.staffId ||
      prefillStaff?.employeeId ||
      prefillStaff?.id;

    if (
      prefillId &&
      !rows.some((row) =>
        [row.employeeId, row.id].map(String).includes(String(prefillId))
      )
    ) {
      rows.unshift({
        id: prefillStaff?.id || prefillId,
        employeeId: prefillId,
        name: prefillStaff?.staffName || prefillStaff?.name || 'Selected Staff',
        role: prefillStaff?.role || '',
        shift: prefillStaff?.shift || '',
      });
    }

    return rows;
  }, [staff, prefillStaff]);

  useEffect(() => {
    if (!formData.staffId && staffOptions[0]) {
      const row = staffOptions[0];
      setFormData((current) => ({
        ...current,
        staffId: row.employeeId || row.id,
        staffName: row.name || '',
        shift: row.shift || row.shiftName || '',
      }));
    }
  }, [staffOptions, formData.staffId]);

  const selectStaff = (staffId) => {
    const row = staffOptions.find((item) =>
      String(item.employeeId || item.id) === String(staffId)
    );

    setFormData((current) => ({
      ...current,
      staffId,
      staffName: row?.name || '',
      shift: row?.shift || row?.shiftName || current.shift,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const hours = Number(formData.overtimeHours);
    if (!formData.staffId) {
      setError('Please select a staff member.');
      return;
    }
    if (!hours || hours <= 0) {
      setError('Please enter valid overtime hours.');
      return;
    }

    try {
      await onSave({
        ...formData,
        overtimeHours: hours,
        rate: 0,
        amount: 0,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to record overtime.');
    }
  };

  return (
    <ResponsiveModalSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add Overtime Record"
      maxWidth="580px"
    >
      <form onSubmit={handleSubmit} className="overtime-entry-form">
        {error && <div className="overtime-entry-error">{error}</div>}

        <div className="overtime-entry-grid">
          <label>
            <span>Staff Member *</span>
            <select
              value={formData.staffId}
              onChange={(event) => selectStaff(event.target.value)}
              required
            >
              <option value="">Select staff</option>
              {staffOptions.map((row) => (
                <option key={row.id} value={row.employeeId || row.id}>
                  {row.name} ({recordLabel(row.employeeId || row.id)}{row.role ? ` · ${row.role}` : ''})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Date *</span>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(event) =>
                setFormData({ ...formData, date: event.target.value, payrollMonth: event.target.value.slice(0, 7) })
              }
            />
          </label>

          <label>
            <span>Payroll Month</span>
            <input
              type="month"
              value={formData.payrollMonth}
              onChange={(event) => setFormData({ ...formData, payrollMonth: event.target.value })}
            />
          </label>

          <label>
            <span>Shift</span>
            <input
              value={formData.shift}
              onChange={(event) => setFormData({ ...formData, shift: event.target.value })}
              placeholder="Assigned shift"
            />
          </label>

          <label>
            <span>Actual Clock In</span>
            <input
              type="time"
              value={formData.clockIn}
              onChange={(event) => setFormData({ ...formData, clockIn: event.target.value })}
            />
          </label>

          <label>
            <span>Actual Clock Out</span>
            <input
              type="time"
              value={formData.clockOut}
              onChange={(event) => setFormData({ ...formData, clockOut: event.target.value })}
            />
          </label>

          <label>
            <span>Overtime Hours *</span>
            <input
              type="number"
              min="0.25"
              step="0.25"
              required
              value={formData.overtimeHours}
              onChange={(event) => setFormData({ ...formData, overtimeHours: event.target.value })}
              placeholder="2.5"
            />
          </label>

        </div>

        <div className="overtime-rate-policy-note">
          Overtime price is set by the manager when this request is approved.
        </div>

        <label className="overtime-entry-wide">
          <span>Overtime Reason *</span>
          <input
            required
            value={formData.reason}
            onChange={(event) => setFormData({ ...formData, reason: event.target.value })}
            placeholder="Emergency repair, job delivery, customer support..."
          />
        </label>

        <label className="overtime-entry-wide">
          <span>Manager Notes</span>
          <textarea
            rows={3}
            value={formData.notes}
            onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
          />
        </label>

        <div className="overtime-entry-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="is-primary">Submit Overtime</button>
        </div>
      </form>
    </ResponsiveModalSheet>
  );
};
