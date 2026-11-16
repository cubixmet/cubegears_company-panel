import { recordLabel } from '../../utils/recordReferences.js';
import { useEffect, useMemo, useState } from "react";
import { Edit3, MapPin, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { attendanceManagerService } from '../../services/attendanceManager.service';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';

const STATUSES = [
  'Present',
  'Absent',
  'Half Day',
  'On Leave',
  'Weekly Off',
  'Holiday',
  'Missing Clock Out',
];

const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const formatTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return String(value);
};

const toTimeInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  return match ? `${String(match[1]).padStart(2, '0')}:${match[2]}` : '';
};

const minutesLabel = (minutes) => {
  const total = Number(minutes || 0);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
};

const locationText = (location = {}) => {
  if (location.latitude == null || location.longitude == null) return '—';
  return `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`;
};

export const DailyAttendance = () => {
  const navigate = useNavigate();
  const [team, setTeam] = useState([]);
  const [selectedDate, setSelectedDate] = useState(localDate);
  const [statusFilter, setStatusFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    status: 'Present',
    clockIn: '',
    clockOut: '',
    notes: '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await attendanceManagerService.getTeamAttendance({
        date: selectedDate,
      });
      setTeam(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedDate]);

  const branches = useMemo(
    () => ['All', ...new Set(team.map((item) => item.branch).filter(Boolean))],
    [team],
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    return team.filter((item) => {
      const matchesStatus =
        statusFilter === 'All' || item.status === statusFilter;
      const matchesBranch =
        branchFilter === 'All' || item.branch === branchFilter;
      const text = [
        item.name,
        item.staffId,
        item.employeeCode,
        item.designation,
        item.branch,
        item.team,
        item.phone,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return matchesStatus && matchesBranch && (!search || text.includes(search));
    });
  }, [team, query, statusFilter, branchFilter]);

  const quickMark = async (item, status) => {
    if (item.attendanceId) {
      await attendanceManagerService.updateTeamAttendance(
        item.attendanceId,
        { status },
        `Quick marked as ${status}`,
      );
    } else {
      await attendanceManagerService.createTeamAttendance({
        employeeId: item.employeeId,
        date: selectedDate,
        status,
        auditReason: `Quick marked as ${status}`,
      });
    }
    await load();
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      status: item.status || 'Present',
      clockIn: toTimeInput(item.clockIn),
      clockOut: toTimeInput(item.clockOut),
      notes: item.notes || '',
      reason: '',
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!form.reason.trim()) return;

    setSaving(true);
    try {
      const payload = {
        status: form.status,
        clockIn: form.clockIn || null,
        clockOut: form.clockOut || null,
        notes: form.notes,
      };

      if (editItem.attendanceId) {
        await attendanceManagerService.updateTeamAttendance(
          editItem.attendanceId,
          payload,
          form.reason,
        );
      } else {
        await attendanceManagerService.createTeamAttendance({
          employeeId: editItem.employeeId,
          date: selectedDate,
          ...payload,
          auditReason: form.reason,
        });
      }

      setEditItem(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="attendance-manager-module attendance-manager-daily">
      <section className="am-daily-heading">
        <div>
          <h2>Daily Attendance</h2>
        </div>

      </section>

      <section className="am-filter-card">
        <label className="am-daily-date">
          <input
            type="date"
            aria-label="Attendance date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
        <label className="am-search-field">
          <Search size={15} />
          <input
            type="search"
            aria-label="Search daily attendance employees"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, employee ID, role, team, phone..."
          />
        </label>

        <select aria-label="Filter by branch" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
          {branches.map((branch) => <option key={branch}>{branch}</option>)}
        </select>

        <select aria-label="Filter by attendance status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option>All</option>
          {STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
      </section>

      {loading ? (
        <div className="am-loading-state">Loading daily attendance…</div>
      ) : (
        <>
          <div className="am-daily-mobile-list">
            {filtered.map((item) => {
              const first = item.sessions?.[0];
              const last = item.sessions?.[item.sessions.length - 1];
              return (
                <article key={item.id} className="am-staff-card">
                  <div className="am-staff-card__head">
                    <button
                      type="button"
                      className="am-employee-name-button"
                      onClick={() =>
                        navigate(`/attendance-manager/team-review/${recordLabel(item.staffId)}/${selectedDate}`)
                      }
                    >
                      <strong>{item.name}</strong>
                      <span>
                        {recordLabel(item.staffId)} · {item.designation || 'Staff'}
                        {item.team ? ` · ${item.team}` : ''}
                      </span>
                    </button>

                    <select value={item.status} onChange={(event) => quickMark(item, event.target.value)}>
                      {!STATUSES.includes(item.status) && <option>{item.status}</option>}
                      {STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </div>

                  <div className="am-staff-card__grid">
                    <div><span>Branch</span><strong>{item.branch || '—'}</strong></div>
                    <div><span>Check In</span><strong>{formatTime(item.clockIn)}</strong></div>
                    <div><span>Check Out</span><strong>{formatTime(item.clockOut)}</strong></div>
                    <div><span>Worked</span><strong>{minutesLabel(item.liveWorkedMinutes ?? item.workedMinutes)}</strong></div>
                    <div><span>Sessions</span><strong>{item.sessionCount || 0}</strong></div>
                    <div><span>OT</span><strong>{minutesLabel(item.overtimeMinutes)}</strong></div>
                  </div>

                  {item.sessionCount > 1 && (
                    <div className="am-session-mini-list">
                      {item.sessions.map((session, index) => (
                        <div key={session.id || index}>
                          <span>S{index + 1}</span>
                          <strong>{formatTime(session.clock_in)} → {formatTime(session.clock_out)}</strong>
                          <b>{minutesLabel(session.worked_minutes)}</b>
                        </div>
                      ))}
                    </div>
                  )}

                  {item.locationEnabled && (
                    <div className="am-location-row">
                      <MapPin size={12} />
                      <span>
                        In: {locationText(first?.clock_in_location)}
                        {last?.clock_out_location?.latitude != null
                          ? ` · Out: ${locationText(last.clock_out_location)}`
                          : ''}
                      </span>
                    </div>
                  )}

                  <button type="button" className="am-edit-button" onClick={() => openEdit(item)}>
                    <Edit3 size={14}/> Edit Attendance
                  </button>
                </article>
              );
            })}
          </div>

          <div className="am-table-card am-daily-table">
            <table>
              <thead>
                <tr>
                  {[
                    'Employee',
                    'Role / Team',
                    'Check In',
                    'Check Out',
                    'Sessions',
                    'Worked',
                    'OT',
                    'Status',
                    'Location',
                    'Actions',
                  ].map((head) => <th key={head}>{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const first = item.sessions?.[0];
                  const last = item.sessions?.[item.sessions.length - 1];
                  return (
                    <tr key={item.id}>
                      <td>
                        <button
                          type="button"
                          className="am-employee-table-link"
                          onClick={() =>
                            navigate(`/attendance-manager/team-review/${recordLabel(item.staffId)}/${selectedDate}`)
                          }
                        >
                          <strong>{item.name}</strong>
                          <span className="am-table-subtext">{recordLabel(item.staffId)}</span>
                        </button>
                      </td>
                      <td>
                        {item.designation || '—'}
                        <span className="am-table-subtext">{item.team || item.branch || '—'}</span>
                      </td>
                      <td>{formatTime(item.clockIn)}</td>
                      <td>{formatTime(item.clockOut)}</td>
                      <td><strong>{item.sessionCount || 0}</strong></td>
                      <td><strong>{minutesLabel(item.liveWorkedMinutes ?? item.workedMinutes)}</strong></td>
                      <td>{minutesLabel(item.overtimeMinutes)}</td>
                      <td>
                        <select value={item.status} onChange={(event) => quickMark(item, event.target.value)}>
                          {!STATUSES.includes(item.status) && <option>{item.status}</option>}
                          {STATUSES.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </td>
                      <td className="am-location-cell">
                        {item.locationEnabled
                          ? locationText(first?.clock_in_location)
                          : 'Off'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="am-edit-button am-edit-button--compact"
                          onClick={() => openEdit(item)}
                        >
                          <Edit3 size={13}/> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!filtered.length && (
            <div className="am-empty-state">No staff matched the selected date and filters.</div>
          )}
        </>
      )}

      <ResponsiveModalSheet
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        title="Edit Attendance"
        maxWidth="520px"
      >
        {editItem && (
          <form onSubmit={saveEdit} className="am-edit-form">
            <div className="am-edit-summary">
              <strong>{editItem.name}</strong> · {recordLabel(editItem.staffId)}<br/>
              Date: {selectedDate} · Shift: {editItem.shift || 'Company Default'}
            </div>

            <label>Status
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                {STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>

            <div className="am-form-grid">
              <label>Check In
                <input
                  type="time"
                  value={form.clockIn}
                  onChange={(event) => setForm({ ...form, clockIn: event.target.value })}
                />
              </label>
              <label>Check Out
                <input
                  type="time"
                  value={form.clockOut}
                  onChange={(event) => setForm({ ...form, clockOut: event.target.value })}
                />
              </label>
            </div>

            <label>Notes
              <input
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>

            <label>Edit Reason *
              <textarea
                required
                rows={3}
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                placeholder="Why is this attendance being corrected?"
              />
            </label>

            <button disabled={saving} className="am-save-button">
              {saving ? 'Saving...' : 'Save Attendance Correction'}
            </button>
          </form>
        )}
      </ResponsiveModalSheet>
    </div>
  );
};
