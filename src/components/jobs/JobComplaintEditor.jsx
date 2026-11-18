import { useState } from 'react';
import { ResponsiveModalSheet } from '../common/ResponsiveModalSheet';
import { jobService } from '../../services/job.service';
import { USE_MOCK_API } from '../../api/apiConfig';

const complaintText = entry => String(entry?.description || entry?.wording || '');

export function JobComplaintEditor({ job, selectedIndex, onClose, onSaved }) {
  const complaints = job.complaints || job.customerComplaints || [];
  const selectComplaint = (index) => {
    const entry = complaints[index];
    return { index, id: entry && (entry.id ?? 'row-' + index), original: complaintText(entry) };
  };
  const [selection, setSelection] = useState(() => selectComplaint(selectedIndex ?? 0));
  const [description, setDescription] = useState(selection.original);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!saving) onClose(); };
  const { index, id, original } = selection;
  const valid = Boolean(id != null && description.trim() && description.trim() !== original && !saving);

  const save = async (event) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError('');
    const wording = description.trim();
    try {
      const updated = USE_MOCK_API
        ? await jobService.updateJob(job.id, {
          complaints: complaints.map((item, i) => i === index ? { ...item, description: wording, wording } : item),
        })
        : await jobService.updateJobComplaintDetails(job.id, id, {
          description: wording, originalDescription: original,
        });
      onSaved(updated);
    } catch (cause) {
      setError(cause?.message || 'Could not update the complaint.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModalSheet isOpen onClose={close} title="Edit customer complaint" maxWidth="520px">
      <form className="grid gap-3" onSubmit={save}>
        {selectedIndex == null && complaints.length > 1 && (
          <label className="grid gap-1.5 text-sm font-semibold text-content">
            <span id="job-complaint-picker-label">Complaint</span>
            <select aria-labelledby="job-complaint-picker-label" value={index} disabled={saving}
              className="min-h-11 min-w-0 rounded-lg border border-line bg-surface px-3 text-base text-content"
              onChange={event => {
                const next = selectComplaint(Number(event.target.value));
                setSelection(next);
                setDescription(next.original);
                setError('');
              }}>
              {complaints.map((item, i) => (
                <option key={item?.id ?? i} value={i}>{i + 1}. {complaintText(item).slice(0, 60)}</option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1.5 text-sm font-semibold text-content">
          Complaint description
          <textarea value={description} required maxLength={1000} rows={4} disabled={saving}
            className="w-full rounded-lg border border-line bg-surface p-3 text-base text-content"
            onChange={event => setDescription(event.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={saving} className="min-h-11 rounded-lg border border-line px-4" onClick={close}>Cancel</button>
          <button type="submit" disabled={!valid} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Save complaint'}
          </button>
        </div>
      </form>
    </ResponsiveModalSheet>
  );
}
