import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, CarFront, CheckCircle2, FileText, Pencil, UserRound } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { jobService } from '../../services/job.service';
import { JobBreadcrumbs } from '../../components/jobs/JobBreadcrumbs';
import { JobComplaintEditor } from '../../components/jobs/JobComplaintEditor';
import { jobDisplayLabel } from '../../components/jobs/jobs.utils';
import { statusForComplaint, complaintStatusClass, COMPLAINT_STATUSES } from '../../components/jobs/complaintStatus';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import '../../styles/job-complaint-manual.css';

const textValue = (value, fallback = 'Not added') => {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  return fallback;
};

const complaintList = (job) => {
  const data = job?.complaints || job?.customerComplaints;
  return Array.isArray(data) ? data : [];
};

const findComplaint = (complaints, complaintId) => {
  // Current entries have a real id. Older records can have no id; for those,
  // the detail link uses a deterministic position token.
  const match = complaints.findIndex((entry) => entry?.id != null && String(entry.id) === complaintId);
  if (match >= 0) return { entry: complaints[match], index: match };
  const missingId = /^row-(\d+)$/.exec(complaintId || '');
  if (!missingId) return null;
  const index = Number(missingId[1]);
  const entry = complaints[index];
  return entry && entry.id == null ? { entry, index } : null;
};

export function JobComplaintDetails() {
  const { id: jobId, complaintId } = useParams();
  const { can } = useFeatureAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editStatus, setEditStatus] = useState('Pending');
  const [notes, setNotes] = useState('');
  const [workReference, setWorkReference] = useState('');
  const backToComplaints = `/jobs/${encodeURIComponent(jobId)}/complaints${location.search}`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    jobService.getJobById(jobId)
      .then((data) => { if (active) setJob(data); })
      .catch((err) => {
        if (active) {
          setJob(null);
          setError(err?.response?.data?.detail || err?.message || 'Could not load complaint details.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobId]);

  const complaints = useMemo(() => complaintList(job), [job]);
  const found = useMemo(() => findComplaint(complaints, complaintId), [complaints, complaintId]);
  const complaint = found?.entry;
  const status = statusForComplaint(complaint);
  useEffect(() => {
    setEditStatus(status);
    setNotes(complaint?.resolutionNotes || '');
    setWorkReference(complaint?.workReference || '');
  }, [complaint?.id, complaint?.status, complaint?.resolutionNotes, complaint?.workReference]);

  const saveStatus = async (event) => {
    event.preventDefault();
    if (!found || !can('jobs.edit') || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await jobService.updateJobComplaintStatus(
        jobId, complaint?.id || 'row-' + found.index,
        { status: editStatus, notes: notes.trim(), workReference: workReference.trim() }
      );
      if (result.job) setJob(result.job);
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.notes || data?.status || data?.complaint || data?.detail ||
        err?.message || 'Unable to update complaint status.');
    } finally {
      setSaving(false);
    }
  };
  const description = textValue(complaint?.description || complaint?.wording, 'No description recorded');

  return (
    <div className="job-complaint-detail-page">
      <JobBreadcrumbs current="Complaint Details" jobLabel={job ? jobDisplayLabel(job) : undefined} jobId={jobId} />
      <header className="job-complaint-detail-header">
        <div className="job-complaint-detail-title">
          <span className="job-complaint-detail-icon"><FileText size={20} aria-hidden="true"/></span>
          <div>
            <h1>Complaint Details</h1>
            <p>Customer concern recorded against this Job Card.</p>
          </div>
        </div>
        <button type="button" className="job-complaint-detail-back" onClick={() => navigate(backToComplaints)}>
          <ArrowLeft size={16} aria-hidden="true"/> Back to Complaints
        </button>
      </header>

      {loading ? (
        <section className="job-complaint-detail-message" role="status">Loading complaint details…</section>
      ) : !job ? (
        <section className="job-complaint-detail-message" role="alert">
          {error || 'Job Card could not be found.'}
        </section>
      ) : !found ? (
        <section className="job-complaint-detail-message" role="status">
          <strong>Complaint not found.</strong>
          <p>This record may have been changed or removed. Return to Complaints to see the current list.</p>
        </section>
      ) : (
        <>
          {error && <p className="job-complaint-detail-error" role="alert">{error}</p>}
          <section className="job-complaint-detail-card">
            <div className="job-complaint-detail-section-heading">
              <div>
                <h2>Customer Complaint</h2>
                <p>What the customer reported about this vehicle.</p>
              </div>
              <span role="status" className={`job-complaint-detail-status ${complaintStatusClass(status)}`}>
                <CheckCircle2 size={15} aria-hidden="true"/> {status} · Staff
              </span>
            </div>
            <p className="job-complaint-detail-description">{description}</p>
            {can('jobs.edit') && job.status !== 'Delivered' && (
              <button type="button" onClick={() => setEditingDescription(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-content">
                <Pencil size={15} aria-hidden="true"/> Edit Complaint
              </button>
            )}
            {editingDescription && can('jobs.edit') && job.status !== 'Delivered' && (
              <JobComplaintEditor job={job} selectedIndex={found.index}
                onClose={() => setEditingDescription(false)}
                onSaved={updated => {
                  setJob(updated);
                  setEditingDescription(false);
                }}/>
            )}

            <div className="job-complaint-detail-fields">
              <div>
                <span>Related Work / Service</span>
                <strong>{textValue(complaint.relatedService, 'Not linked')}</strong>
              </div>
              <div>
                <span>Complaint Reference</span>
                <strong>{textValue(complaint.id, `Record ${found.index + 1}`)}</strong>
              </div>
              <div>
                <span><CalendarClock size={14} aria-hidden="true"/> Recorded</span>
                <strong>{complaint.createdAt || complaint.created_at
                  ? new Date(complaint.createdAt || complaint.created_at).toLocaleString('en-IN')
                  : 'Not recorded'}</strong>
              </div>
              <div>
                <span>Status (Staff-reviewed)</span>
                <strong className={`job-complaint-detail-auto-status ${complaintStatusClass(status)}`}>
                  {status}
                </strong>
                <small>Only an authorized staff update changes this status. QC never resolves complaints automatically.</small>
              </div>
            </div>
          </section>

          <section className="job-complaint-detail-card job-complaint-manual-review">
            <div className="job-complaint-detail-section-heading">
              <div><h2>Complaint Progress</h2><p>Update the status after reviewing the actual work.</p></div>
            </div>
            {can('jobs.edit') && job.status !== 'Delivered' ? (
              <form className="job-complaint-status-form" onSubmit={saveStatus}>
                <label>Status
                  <select value={editStatus} disabled={saving}
                    onChange={event => setEditStatus(event.target.value)}>
                    {COMPLAINT_STATUSES.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <label>Work / Service Reference (optional)
                  <input value={workReference} maxLength={120} disabled={saving}
                    onChange={event => setWorkReference(event.target.value)}
                    placeholder="Service, part, or job work reference"/>
                </label>
                <label>Resolution / Progress Notes {['Not Resolved','Not Applicable'].includes(editStatus) ? '*' : ''}
                  <textarea rows={3} maxLength={1000} value={notes} disabled={saving}
                    required={['Not Resolved','Not Applicable'].includes(editStatus)}
                    onChange={event => setNotes(event.target.value)}
                    placeholder="What was checked, repaired or left unresolved?"/>
                </label>
                <button type="submit" disabled={saving || (
                  ['Not Resolved','Not Applicable'].includes(editStatus) && notes.trim().length < 5
                )}>{saving ? 'Saving…' : 'Save Complaint Status'}</button>
              </form>
            ) : <p>Complaint history is read-only for this account.</p>}
            {Array.isArray(complaint?.statusHistory) && complaint.statusHistory.length > 0 && (
              <div className="job-complaint-progress-history">
                <h3>Status History</h3>
                {[...complaint.statusHistory].reverse().map((entry, index) =>
                  <div key={String(entry.at) + index}>
                    <strong>{entry.from} → {entry.to}</strong>
                    <small>{entry.at ? new Date(entry.at).toLocaleString('en-IN') : 'Date unavailable'} · {entry.by || 'Staff'}</small>
                    {entry.notes && <p>{entry.notes}</p>}
                    {entry.workReference && <p>Work: {entry.workReference}</p>}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="job-complaint-detail-card">
            <div className="job-complaint-detail-section-heading">
              <div>
                <h2>Customer & Vehicle</h2>
                <p>Details linked to the complaint's Job Card.</p>
              </div>
            </div>
            <div className="job-complaint-detail-fields">
              <div><span><UserRound size={14} aria-hidden="true"/> Customer</span><strong>{textValue(job.customerName)}</strong></div>
              <div><span>Phone</span><strong>{textValue(job.customerPhone)}</strong></div>
              <div><span><CarFront size={14} aria-hidden="true"/> Registration</span><strong>{textValue(job.vehicleReg)}</strong></div>
              <div><span>Make / Model</span><strong>{textValue(job.vehicleInfo)}</strong></div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default JobComplaintDetails;
