import { useState, useEffect, useRef } from "react";
import { Clock, Eye, Filter } from 'lucide-react';
import { attendanceService } from '../../services/attendance.service';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';
import { formatAttendanceTime } from '../../utils/attendanceTime';

export const HistoryLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateRangeFilter, setDateRangeFilter] = useState('This Month');
  const [selectedCorrectionLog, setSelectedCorrectionLog] = useState(null);
  const [viewDetailsLog, setViewDetailsLog] = useState(null);
  const [showMoreFiltersSheet, setShowMoreFiltersSheet] = useState(false);

  // Correction Form state
  const [proposedTime, setProposedTime] = useState('06:00 PM');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter chips auto-scroll
  const activeChipRef = useRef(null);

  useEffect(() => {
    fetchLogs();
  }, [statusFilter, dateRangeFilter]);

  useEffect(() => {
    if (activeChipRef.current) {
      activeChipRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [statusFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await attendanceService.getPersonalAttendanceLogs({ status: statusFilter });
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCorrectionModal = (log) => {
    setSelectedCorrectionLog(log);
    setProposedTime('06:00 PM');
    setReason('');
  };

  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setSubmitting(true);
    try {
      await attendanceService.submitPunchCorrection({
        attendanceId: selectedCorrectionLog.id,
        originalClockOut: selectedCorrectionLog.sessions[0]?.clockOut || 'Missing',
        proposedClockOut: proposedTime,
        reason
      });
      setSelectedCorrectionLog(null);
      fetchLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Present':
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', backgroundColor: 'var(--success-soft)', color: 'var(--success)', border: '1px solid var(--success)' }}>PRESENT</span>;
      case 'Missing Clock Out':
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', backgroundColor: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>MISSING CLOCK OUT</span>;
      case 'On Leave':
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', border: '1px solid var(--primary)' }}>ON LEAVE</span>;
      case 'Holiday':
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', backgroundColor: 'var(--warning-soft)', color: 'var(--warning)', border: '1px solid var(--warning)' }}>HOLIDAY</span>;
      case 'Weekly Off':
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', backgroundColor: 'var(--surface-3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>WEEKLY OFF</span>;
      default:
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', backgroundColor: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{status}</span>;
    }
  };

  const filterOptions = ['All', 'Present', 'Missing Clock Out', 'On Leave', 'Late'];

  return (
    <div className="attendance-module attendance-history-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* 1. Page Header */}
      <div className="attendance-section-heading">
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
          Attendance History & Logs
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
          View your daily attendance sessions, worked hours, late/early status and correction history.
        </p>
      </div>

      {/* Horizontally Scrollable Pill Filter Row */}
      <div className="attendance-filter-scroll scroll-hidden">
        {filterOptions.map((option) => {
          const isActive = statusFilter === option;
          return (
            <button
              key={option}
              ref={isActive ? activeChipRef : null}
              onClick={() => setStatusFilter(option)}
              style={{
                height: '38px',
                padding: '0 16px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: isActive ? '700' : '500',
                backgroundColor: isActive ? 'var(--primary)' : 'var(--surface-2)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* Date Filter Toolbar */}
      <div className="attendance-toolbar-card history-filter-toolbar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '10px 12px'
      }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['This Week', 'This Month', 'Custom'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRangeFilter(range)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: dateRangeFilter === range ? '700' : '500',
                backgroundColor: dateRangeFilter === range ? 'var(--surface-3)' : 'transparent',
                color: dateRangeFilter === range ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {range}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowMoreFiltersSheet(true)}
          style={{
            padding: '5px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Filter size={13} /> Filters
        </button>
      </div>

      {/* MOBILE CARD VIEW (< 768px) */}
      <div className="mobile-card-view" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        {logs.map((log) => (
          <div
            key={log.id}
            className="attendance-record-card history-record-card"
            style={{
              backgroundColor: 'var(--surface)',
              border: log.status === 'Missing Clock Out' ? '1px solid var(--danger)' : '1px solid var(--border)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {log.date}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                  ({log.dayOfWeek})
                </span>
              </div>
              {getStatusBadge(log.status)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span>{log.shiftName || 'General Shift'}</span>
            </div>

            {log.sessions && log.sessions.length > 0 ? (
              <div style={{
                backgroundColor: 'var(--surface-2)',
                borderRadius: '10px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                {log.sessions.map((ses, idx) => (
                  <div key={ses.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} style={{ color: 'var(--primary)' }} />
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {formatAttendanceTime(ses.clockIn)} → {ses.clockOut ? formatAttendanceTime(ses.clockOut) : <span style={{ color: 'var(--danger)', fontWeight: '700' }}>Missing</span>}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                      {ses.duration}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', backgroundColor: 'var(--surface-2)', padding: '8px 10px', borderRadius: '8px' }}>
                {log.holidayName || (log.leaveType ? `${log.leaveType} (Full Day Approved)` : 'No clock records')}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid var(--border)', fontSize: '12px' }}>
              <div>
                {log.totalWorkedMinutes > 0 ? (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>Worked: </span>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                      {Math.floor(log.totalWorkedMinutes / 60)}h {log.totalWorkedMinutes % 60}m
                    </span>
                    {log.lateMinutes > 0 && (
                      <span style={{ color: 'var(--warning)', marginLeft: '6px', fontWeight: '600' }}>
                        (Late {log.lateMinutes}m)
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Worked: Incomplete</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setViewDetailsLog(log)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--surface-2)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Eye size={12} /> Details
                </button>

                {log.status === 'Missing Clock Out' && !log.correction && (
                  <button
                    onClick={() => handleOpenCorrectionModal(log)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--danger-soft)',
                      color: 'var(--danger)',
                      border: '1px solid var(--danger)',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Request Correction
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP HISTORY TABLE (>= 768px) */}
      <div className="desktop-table-view attendance-table-card" style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        overflow: 'hidden',
        width: '100%'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 16px', fontWeight: '700' }}>Date</th>
              <th style={{ padding: '12px 16px', fontWeight: '700' }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: '700' }}>Sessions (In → Out)</th>
              <th style={{ padding: '12px 16px', fontWeight: '700' }}>Worked Hours</th>
              <th style={{ padding: '12px 16px', fontWeight: '700' }}>Correction Audit</th>
              <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <td style={{ padding: '14px 16px', fontWeight: '600' }}>
                  {log.date} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({log.dayOfWeek})</span>
                </td>
                <td style={{ padding: '14px 16px' }}>{getStatusBadge(log.status)}</td>
                <td style={{ padding: '14px 16px' }}>
                  {log.sessions && log.sessions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {log.sessions.map((s, i) => (
                        <div key={i} style={{ fontSize: '12px' }}>
                          <span style={{ fontWeight: '600' }}>{formatAttendanceTime(s.clockIn)} → {s.clockOut ? formatAttendanceTime(s.clockOut) : <span style={{ color: 'var(--danger)' }}>Missing</span>}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>{log.holidayName || log.leaveType || '—'}</span>
                  )}
                </td>
                <td style={{ padding: '14px 16px', fontWeight: '600' }}>
                  {log.totalWorkedMinutes > 0 ? `${Math.floor(log.totalWorkedMinutes / 60)}h ${log.totalWorkedMinutes % 60}m` : '—'}
                  {log.lateMinutes > 0 && <div style={{ fontSize: '11px', color: 'var(--warning)' }}>Late {log.lateMinutes}m</div>}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  {log.correction ? (
                    <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: '700', color: log.correction.status === 'Approved' ? 'var(--success)' : 'var(--warning)' }}>
                        Correction: {log.correction.status}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>Req Out: {formatAttendanceTime(log.correction.proposedClockOut)}</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No Correction</span>
                  )}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setViewDetailsLog(log)}
                      style={{ padding: '5px 10px', borderRadius: '6px', backgroundColor: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Details
                    </button>
                    {log.status === 'Missing Clock Out' && !log.correction && (
                      <button
                        onClick={() => handleOpenCorrectionModal(log)}
                        style={{ padding: '5px 10px', borderRadius: '6px', backgroundColor: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid var(--danger)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Fix Punch
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Attendance Details Responsive Modal Sheet */}
      <ResponsiveModalSheet
        isOpen={Boolean(viewDetailsLog)}
        onClose={() => setViewDetailsLog(null)}
        title={viewDetailsLog ? `${viewDetailsLog.date} Attendance Details` : 'Attendance Details'}
      >
        {viewDetailsLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: 'var(--surface-2)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                {getStatusBadge(viewDetailsLog.status)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Shift Rule:</span>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{viewDetailsLog.shiftName || 'General Shift'}</span>
              </div>
            </div>

            {viewDetailsLog.correction && (
              <div style={{ backgroundColor: 'var(--surface-2)', borderRadius: '12px', padding: '12px', border: '1px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <span style={{ fontWeight: '700', color: 'var(--primary)' }}>Punch Correction Audit History</span>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Original Clock Out:</span>
                  <span style={{ fontWeight: '600' }}>{formatAttendanceTime(viewDetailsLog.correction.originalClockOut)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Corrected Time:</span>
                  <span style={{ fontWeight: '600', color: 'var(--success)' }}>{formatAttendanceTime(viewDetailsLog.correction.proposedClockOut)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Reason:</span>
                  <span>{viewDetailsLog.correction.reason}</span>
                </div>
              </div>
            )}

            <div style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={() => setViewDetailsLog(null)}
                style={{ width: '100%', height: '46px', borderRadius: '10px', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer' }}
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </ResponsiveModalSheet>

      {/* Request Punch Correction Responsive Modal Sheet */}
      <ResponsiveModalSheet
        isOpen={Boolean(selectedCorrectionLog)}
        onClose={() => setSelectedCorrectionLog(null)}
        title="Request Punch Correction"
      >
        {selectedCorrectionLog && (
          <form onSubmit={handleSubmitCorrection} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-2)', padding: '10px 12px', borderRadius: '10px' }}>
              Date: <strong>{selectedCorrectionLog.date}</strong> | Session: <strong>{formatAttendanceTime(selectedCorrectionLog.sessions[0]?.clockIn)} → Missing</strong>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Proposed Clock Out Time *
              </label>
              <input
                type="text"
                value={proposedTime}
                onChange={(e) => setProposedTime(e.target.value)}
                placeholder="e.g. 06:00 PM"
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Reason for Correction *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why punch was missed..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '6px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={() => setSelectedCorrectionLog(null)}
                style={{
                  flex: 1,
                  height: '46px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface-2)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  flex: 1,
                  height: '46px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </ResponsiveModalSheet>

      {/* More Filters Responsive Modal Sheet */}
      <ResponsiveModalSheet
        isOpen={showMoreFiltersSheet}
        onClose={() => setShowMoreFiltersSheet(false)}
        title="Attendance Filters"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setShowMoreFiltersSheet(false); }}
              style={{ width: '100%', height: '44px', padding: '0 12px', borderRadius: '10px', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
            >
              <option value="All">All Records</option>
              <option value="Present">Present Only</option>
              <option value="Missing Clock Out">Missing Clock Out</option>
              <option value="On Leave">On Leave</option>
              <option value="Late">Late Arrivals</option>
            </select>
          </div>

          <div style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
            <button
              onClick={() => setShowMoreFiltersSheet(false)}
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary)',
                border: 'none',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </ResponsiveModalSheet>
    </div>
  );
};
