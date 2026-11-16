import { recordLabel } from '../../utils/recordReferences.js';
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, X } from 'lucide-react';
import { LeaveApprovalSheet } from '../../components/attendance-manager/LeaveApprovalSheet';
import { attendanceManagerService } from '../../services/attendanceManager.service';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(String(value).length === 10 ? value + 'T00:00:00' : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const parseMockRange = (value = '') => {
  const parts = String(value).split(/\s+to\s+/i);
  return {
    startDate: parts[0] || '',
    endDate: parts[1] || parts[0] || '',
  };
};

const daysBetween = (startDate, endDate, halfDay = false) => {
  if (halfDay) return 0.5;
  if (!startDate || !endDate) return 1;

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;

  return Math.max(1, Math.floor((end - start) / 86400000) + 1);
};

const normalizeLeaveApproval = (item = {}) => {
  const fallback = parseMockRange(item.affectedDate || item.date || '');
  const startDate = item.startDate || item.start_date || item.date || fallback.startDate;
  const endDate = item.endDate || item.end_date || fallback.endDate || startDate;
  const halfDay = Boolean(item.halfDay ?? item.half_day ?? false);

  return {
    ...item,
    startDate,
    endDate,
    halfDay,
    totalDays: Number(
      item.totalDays ??
      item.total_days ??
      daysBetween(startDate, endDate, halfDay),
    ),
    managerNote: item.managerNote || item.manager_note || '',
  };
};

export const LeaveRequestsManager = () => {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await attendanceManagerService.getApprovals();
      const rows = Array.isArray(data) ? data : [];
      setRequests(
        rows
          .filter((item) => ['Leave', 'Leave Request'].includes(item.type))
          .map(normalizeLeaveApproval),
      );
    } catch (error) {
      setLoadError(error?.message || 'Unable to load leave requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visibleRequests = useMemo(() => statusFilter === 'All' ? requests : requests.filter(item => item.status === statusFilter), [requests, statusFilter]);

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === 'Pending').length,
    [requests],
  );

  const openDecision = (item, nextDecision) => {
    setSelected(item);
    setDecision(nextDecision);
    setNote(item.managerNote || '');
    setApprovalError('');
  };

  const closeDecision = () => {
    if (submitting) return;
    setSelected(null);
    setDecision('');
    setNote('');
    setApprovalError('');
  };

  const submitDecision = async (event) => {
    event.preventDefault();

    if (!selected || !decision) return;
    if (selected.canReview === false) {
      setApprovalError(selected.reviewBlockReason || 'Another authorized manager must review your own request.');
      return;
    }
    if (decision === 'reject' && !note.trim()) {
      setApprovalError('Rejection reason is required.');
      return;
    }

    setSubmitting(true);
    setApprovalError('');

    try {
      await attendanceManagerService.updateApprovalStatus(
        selected.id,
        decision,
        note.trim(),
      );
      setSelected(null);
      setDecision('');
      setNote('');
      await load();
    } catch (error) {
      setApprovalError(
        error?.data?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Unable to update this leave request.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="am-loading-state">Loading leave requests…</div>;
  }

  return (
    <div className="attendance-manager-module attendance-manager-leave">
      <section className="am-section-header">
        <div>
          <h2>Leave Requests</h2>
        </div>
        <span className="am-count-badge">{pendingCount} Pending</span>
      </section>

      <div className="am-leave-status-filters" role="group" aria-label="Filter leave requests">
        {['All', 'Pending', 'Approved', 'Rejected'].map((item) => (
          <button type="button" key={item} className={statusFilter === item ? 'is-active' : ''}
            aria-pressed={statusFilter === item} onClick={() => setStatusFilter(item)}>{item}</button>
        ))}
      </div>
      {loadError && <div className="am-empty-state" role="alert">{loadError} <button type="button" onClick={load}>Retry</button></div>}
      {!loadError && (visibleRequests.length === 0 ? (
        <div className="am-empty-state">No leave requests.</div>
      ) : (
        <div className="am-approval-grid">
          {visibleRequests.map((item) => (
            <article key={item.id} className="am-approval-card">
              <div className="am-approval-card__head">
                <div className="am-approval-person">
                  <div className="am-approval-avatar-fallback">
                    {(item.staffName || 'S').slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <strong>{item.staffName || 'Staff'}</strong>
                    <span>{recordLabel(item.staffId, 'Employee')}</span>
                  </div>
                </div>

                <span
                  className={
                    'am-status-badge am-status-badge--' +
                    String(item.status || '').toLowerCase()
                  }
                >
                  {item.status}
                </span>
              </div>

              <div className="am-approval-details am-leave-date-grid">
                <div className="am-leave-duration-cell">
                  <span><Clock3 size={11} />Duration</span>
                  <strong>
                    {item.halfDay
                      ? 'Half Day'
                      : item.totalDays + ' Day' + (item.totalDays === 1 ? '' : 's')}
                  </strong>
                </div>

                <div>
                  <span><CalendarDays size={11} />Start Date</span>
                  <strong>{formatDate(item.startDate)}</strong>
                </div>

                <div>
                  <span><CalendarDays size={11} />End Date</span>
                  <strong>{formatDate(item.endDate)}</strong>
                </div>

  
              </div>
              <details className="am-leave-request-details"><summary>View Details</summary>
                <p><strong>Leave Type:</strong> {item.leaveType || item.leave_type || item.type || 'Leave'}</p>
                <p><strong>Reason:</strong> {item.reason || 'No reason provided.'}</p>
              </details>

              {item.status === 'Pending' && item.canReview === false ? (
                <p className="am-approval-blocked-note" role="status">
                  {item.reviewBlockReason || 'Another authorized manager must review your request.'}
                </p>
              ) : item.status === 'Pending' ? (
                <div className="am-approval-actions">
                  <button
                    type="button"
                    onClick={() => openDecision(item, 'approve')}
                    className="am-approve-button"
                  >
                    <Check size={14} />
                    Approve
                  </button>

                  <button
                    type="button"
                    onClick={() => openDecision(item, 'reject')}
                    className="am-reject-button"
                  >
                    <X size={14} />
                    Reject
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ))}

      <LeaveApprovalSheet
        item={selected}
        decision={decision}
        note={note}
        setNote={setNote}
        submitting={submitting}
        error={approvalError}
        onClose={closeDecision}
        onSubmit={submitDecision}
      />
    </div>
  );
};
