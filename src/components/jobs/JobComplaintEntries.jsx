import { Plus, Trash2 } from 'lucide-react';
import { newComplaint } from '../../utils/jobCreateAdapters';

const priorities = ['Low', 'Medium', 'High', 'Urgent'];
const categories = ['General', 'Engine', 'Brakes', 'AC', 'Electrical', 'Transmission',
  'Suspension', 'Body', 'Tyres', 'Other'];

export function JobComplaintEntries({ complaints, onChange, disabled = false, errors = {}, savedCount = 0 }) {
  const patch = (id, key, value) => onChange((current) =>
    current.map((row) => row.id === id ? { ...row, [key]: value } : row)
  );
  return (
    <div className="job-complaint-editor" aria-label="Customer complaints">
      <div className="job-complaint-header">
        <p className="job-complaint-guidance">Add each complaint separately so none are overwritten.</p>
        <button type="button" disabled={disabled} className="job-complaint-add"
          onClick={() => onChange((rows) => [...rows, newComplaint()])}>
          <Plus size={17} aria-hidden="true"/> Add Complaint
        </button>
      </div>
      {complaints.length === 0 && <p className="job-create-empty">No complaints recorded. Add one if the customer reports a problem.</p>}
      {complaints.map((row, index) => (
        <article className="job-complaint-row" key={row.id}>
          <div className="job-complaint-row-head">
            <strong>Complaint {String(index + 1).padStart(2, '0')}</strong>
            {index >= savedCount && <button type="button" disabled={disabled} onClick={() => onChange((rows) => rows.filter((item) => item.id !== row.id))}
              aria-label={`Remove complaint ${index + 1}`}><Trash2 size={16}/> Remove</button>}
          </div>
          <label>Description
            <textarea name={`complaint-${index}`} rows={2} maxLength={2000} disabled={disabled}
              value={row.description} onChange={(event) => patch(row.id, 'description', event.target.value)}
              aria-invalid={Boolean(errors[row.id])} placeholder="e.g. AC not cooling, brake noise or engine vibration"/>
            {errors[row.id] && <small role="alert" className="job-create-field-error">{errors[row.id]}</small>}
          </label>
          <div className="job-complaint-options">
            <label>Category
              <select value={row.category} disabled={disabled} onChange={(event) => patch(row.id, 'category', event.target.value)}>
                <option value="">Select category (optional)</option>
                {categories.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>Priority
              <select value={row.priority} disabled={disabled} onChange={(event) => patch(row.id, 'priority', event.target.value)}>
                {priorities.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <label>Inspection Notes (optional)
            <input value={row.inspectionNotes} disabled={disabled}
              onChange={(event) => patch(row.id, 'inspectionNotes', event.target.value)} placeholder="Notes for the technician"/>
          </label>
        </article>
      ))}
    </div>
  );
}
