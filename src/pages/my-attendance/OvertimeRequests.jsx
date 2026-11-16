import { useEffect, useMemo, useState } from "react";
import { Clock3, Plus, X } from 'lucide-react';
import { attendanceService } from '../../services/attendance.service';
import { formatAttendanceTime } from '../../utils/attendanceTime';
import { formatOvertimeDuration, splitOvertimeMinutes, toOvertimeMinutes } from '../../utils/overtimeDuration';

const formatMoney = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const OvertimeRequests = () => {
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    overtimeHours: '',
    overtimeMinutes: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [detectedMinutes, setDetectedMinutes] = useState(null);
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [message, setMessage] = useState('');

  const load = async () => {
    const rows = await attendanceService.getMyOvertimeRequests();
    setRequests(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let active = true;

    const loadDetectedOvertime = async () => {
      if (!form.date) return;

      const [year, month] = form.date.split('-').map(Number);
      try {
        const logs = await attendanceService.getPersonalAttendanceLogs({
          month,
          year,
        });
        if (!active) return;

        const record = (logs || []).find((row) => row.date === form.date);
        setAttendanceSessions(Array.isArray(record?.sessions) ? record.sessions : []);
        const minutes = Number(record?.overtimeMinutes || 0);
        const wholeMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;

        setDetectedMinutes(wholeMinutes || null);
        if (wholeMinutes > 0) {
          const duration = splitOvertimeMinutes(wholeMinutes);
          setForm((current) => ({
            ...current,
            overtimeHours: duration.hours,
            overtimeMinutes: duration.minutes,
          }));
        }
      } catch {
        if (active) {
          setDetectedMinutes(null);
          setAttendanceSessions([]);
        }
      }
    };

    loadDetectedOvertime();
    return () => {
      active = false;
    };
  }, [form.date]);

  const pending = useMemo(
    () => requests.filter((row) => row.status === 'Pending').length,
    [requests],
  );

  const submit = async (event) => {
    event.preventDefault();
    const minutes = toOvertimeMinutes(form.overtimeHours, form.overtimeMinutes);
    if (minutes === null) {
      setMessage('Enter valid overtime Hours and Minutes (maximum 24:00).');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      await attendanceService.submitOvertimeRequest({
        date: form.date,
        minutes,
        overtimeHours: Number((minutes / 60).toFixed(4)),
        reason: form.reason.trim(),
      });
      setForm((current) => ({ ...current, reason: '' }));
      setMessage('Overtime request submitted.');
      await load();
    } catch (error) {
      setMessage(error?.message || 'Unable to submit overtime request.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id) => {
    await attendanceService.cancelOvertimeRequest(id);
    await load();
  };

  return (
    <div className="my-overtime-page">
      <section className="my-overtime-header">
        <div>
          <h2>Overtime Requests</h2>
          <p>Submit overtime worked and track manager approval.</p>
        </div>
        <span>{pending} Pending</span>
      </section>

      {message && <div className="my-overtime-message">{message}</div>}

      <section className="my-overtime-layout">
        <form className="my-overtime-form" onSubmit={submit}>
          <header>
            <Clock3 size={15} />
            <div>
              <h3>Request Overtime</h3>
              <p>Enter the date, overtime duration and reason.</p>
            </div>
          </header>

          <div className="my-overtime-grid">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => {
                  setDetectedMinutes(null);
                  setAttendanceSessions([]);
                  setForm((current) => ({ ...current, date: event.target.value, overtimeHours: '', overtimeMinutes: '' }));
                }}
                required
              />
            </label>

            <div className="my-overtime-duration-field">
              <span id="overtime-duration-label">Overtime Duration</span>
              <div className="my-overtime-duration-inputs" role="group" aria-labelledby="overtime-duration-label">
                <label className="my-overtime-duration-unit">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{1,2}"
                    maxLength={2}
                    autoComplete="off"
                    aria-label="Overtime hours"
                    value={form.overtimeHours}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (/^\d{0,2}$/.test(value)) {
                        setForm((current) => ({ ...current, overtimeHours: value }));
                      }
                    }}
                    onBlur={() => setForm((current) => ({
                      ...current,
                      overtimeHours: current.overtimeHours ? current.overtimeHours.padStart(2, '0') : '',
                    }))}
                    placeholder="00"
                    readOnly={detectedMinutes > 0}
                  />
                  <span>Hours</span>
                </label>
                <span className="my-overtime-duration-separator" aria-hidden="true">:</span>
                <label className="my-overtime-duration-unit">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{1,2}"
                    maxLength={2}
                    autoComplete="off"
                    aria-label="Overtime minutes"
                    value={form.overtimeMinutes}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (/^\d{0,2}$/.test(value)) {
                        setForm((current) => ({ ...current, overtimeMinutes: value }));
                      }
                    }}
                    onBlur={() => setForm((current) => ({
                      ...current,
                      overtimeMinutes: current.overtimeMinutes ? current.overtimeMinutes.padStart(2, '0') : '',
                    }))}
                    placeholder="00"
                    readOnly={detectedMinutes > 0}
                  />
                  <span>Minutes</span>
                </label>
              </div>
              {detectedMinutes > 0 && (
                <small className="my-overtime-auto-note">
                  Auto-loaded from attendance: {formatOvertimeDuration(detectedMinutes)}
                </small>
              )}
            </div>
          </div>

          {attendanceSessions.length > 0 && (
            <section className="my-overtime-sessions" aria-label="Attendance sessions" style={{ display: 'grid', gap: '8px', minWidth: 0 }}>
              <strong style={{ fontSize: '13px' }}>Attendance Sessions</strong>
              {attendanceSessions.map((session, index) => (
                <div key={session.id || index} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface-2)', fontSize: '12px' }}>
                  <span style={{ fontWeight: 600 }}>Session {session.sessionNumber || index + 1}</span>
                  <span>{formatAttendanceTime(session.clockIn)} → {session.clockOut ? formatAttendanceTime(session.clockOut) : 'Missing clock out'}</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {session.clockOut ? `Worked: ${Math.floor(Math.max(0, Number(session.workedMinutes) || 0) / 60)}h ${Math.max(0, Number(session.workedMinutes) || 0) % 60}m` : 'Incomplete'}
                  </span>
                </div>
              ))}
            </section>
          )}

          <label>
            <span>Reason</span>
            <textarea
              rows={4}
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({ ...current, reason: event.target.value }))
              }
              placeholder="Job completion, emergency work, delivery support..."
            />
          </label>

          <button type="submit" disabled={submitting}>
            <Plus size={13} />
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>

        <section className="my-overtime-records">
          <header>
            <div>
              <h3>Request History</h3>
              <p>Your overtime approval records.</p>
            </div>
            <span>{requests.length}</span>
          </header>

          <div className="my-overtime-list">
            {requests.map((row) => (
              <article key={row.id}>
                <div className="my-overtime-list-head">
                  <div>
                    <strong>{formatDate(row.date)}</strong>
                    <span>{formatOvertimeDuration(row.minutes ?? Math.round(Number(row.overtimeHours || 0) * 60))}</span>
                  </div>
                  <b className={`is-${String(row.status || '').toLowerCase()}`}>
                    {row.status}
                  </b>
                </div>

                <p>{row.reason || 'No reason provided.'}</p>

                {row.status === 'Approved' && (
                  <div className="my-overtime-approved-pay">
                    <span>Approved Rate</span>
                    <strong>₹{Number(row.rate || 0).toFixed(2)}/hr</strong>
                    <span>Payroll Amount</span>
                    <strong>{formatMoney(row.amount)}</strong>
                  </div>
                )}

                <footer>
                  <span>{row.rejectionReason || row.approvedBy || 'Awaiting manager review'}</span>
                  {row.status === 'Pending' && (
                    <button type="button" onClick={() => cancel(row.id)}>
                      <X size={12} />
                      Cancel
                    </button>
                  )}
                </footer>
              </article>
            ))}

            {!requests.length && (
              <div className="my-overtime-empty">No overtime requests yet.</div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
};
