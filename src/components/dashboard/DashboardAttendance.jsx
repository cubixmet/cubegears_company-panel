import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AttendanceKpis } from '../my-attendance/AttendanceKpis';
import { AttendancePunchPanel } from '../my-attendance/AttendancePunchPanel';
import { attendanceService } from '../../services/attendance.service';
import '../../styles/attendance-calendar.css';
import '../../styles/attendance-punch-readable.css';
import '../../styles/dashboard-attendance.css';

export function DashboardAttendance() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(key => key + 1);

  useEffect(() => {
    let active = true;
    const today = new Date();

    attendanceService.getPersonalAttendanceLogs({
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    }).then(rows => {
      if (!active) return;
      setLogs(rows);
      setError('');
    }).catch(() => {
      if (active) setError('Could not load this month’s attendance.');
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [refreshKey]);

  return (
    <section className="dashboard-attendance my-attendance-pages" aria-labelledby="dashboard-attendance-heading">
      <header className="dashboard-attendance-header">
        <h2 id="dashboard-attendance-heading">My Attendance</h2>
        <Link to="/my-attendance/calendar">View attendance</Link>
      </header>
      <AttendancePunchPanel onChanged={refresh} />
      {loading ? <p role="status">Loading attendance totals…</p> : error ? (
        <div className="dashboard-attendance-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => { setLoading(true); refresh(); }}>Retry</button>
        </div>
      ) : <AttendanceKpis logs={logs} />}
    </section>
  );
}
