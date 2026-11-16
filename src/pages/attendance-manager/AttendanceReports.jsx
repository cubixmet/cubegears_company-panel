import { useEffect, useMemo, useState } from "react";
import { Download, Printer } from 'lucide-react';
import { attendanceManagerService } from '../../services/attendanceManager.service';
import { formatAttendanceDateTimeParts } from '../../utils/attendanceTime';

const ReportPunch = ({ value, recordDate }) => {
  const { time, date } = formatAttendanceDateTimeParts(value, recordDate);
  return (
    <span className="am-report-punch">
      <strong className="am-report-punch-time">{time}</strong>
      {date && <small className="am-report-punch-date">{date}</small>}
    </span>
  );
};

export const AttendanceReports = () => {
  const [team, setTeam] = useState([]);
  const [reportType, setReportType] = useState('Daily Attendance');
  const [branch, setBranch] = useState('All');
  const [employee, setEmployee] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    attendanceManagerService.getTeamAttendance()
      .then(data => { if (mounted) setTeam(Array.isArray(data) ? data : []); })
      .catch(cause => { if (mounted) setError(cause?.message || 'Unable to load attendance reports.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const branches = useMemo(() => ['All', ...new Set(team.map(item => item.branch).filter(Boolean))], [team]);
  const employees = useMemo(() => ['All', ...new Set(team.map(item => item.staffId || item.employeeId || item.name).filter(Boolean))], [team]);
  const hasRecordDates = team.some(item => item.date || item.attendanceDate || item.createdDate);


  const rows = useMemo(() => team.filter(item => {
    if (reportType === 'Late Report' && Number(item.lateMinutes || 0) <= 0) return false;
    if (reportType === 'Absence Report' && item.status !== 'Absent') return false;
    if (['OT Report', 'Overtime Report'].includes(reportType) && Number(item.overtimeHours || 0) <= 0) return false;
    if (branch !== 'All' && item.branch !== branch) return false;
    if (employee !== 'All' && (item.staffId || item.employeeId || item.name) !== employee) return false;
    const date = String(item.date || item.attendanceDate || item.createdDate || '').slice(0, 10);
    return (!hasRecordDates || ((!from || date >= from) && (!to || date <= to)));
  }), [team, reportType, branch, employee, from, to, hasRecordDates]);

  const exportCsv = () => {
    const header = ['Employee','Role','Branch','Status','Check In','Check Out','Working Hours','OT Hours','Late Minutes'];
    const body = rows.map((item) => [
      item.name,item.designation,item.branch,item.status,item.clockIn || '',item.clockOut || '',
      item.worked || '',item.overtimeHours || 0,item.lateMinutes || 0
    ]);
    const csv = [header, ...body].map((row) => row.map((cell) => `"${String(cell).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${reportType.toLowerCase().replaceAll(' ','-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="attendance-manager-module attendance-manager-reports">
      <section className="am-section-header">
        <div>
          <h2>Attendance Reports</h2>
        </div>
        <div className="am-header-actions">
          <button type="button" onClick={exportCsv} disabled={loading || Boolean(error) || rows.length === 0} className="am-secondary-button"><Download size={14}/>Export CSV</button>
          <button type="button" onClick={() => window.print()} disabled={loading || Boolean(error) || rows.length === 0} className="am-secondary-button"><Printer size={14}/>Print</button>
        </div>
      </section>

      <section className="am-report-filter">
        <label>
          <span>Report Type</span>
          <select value={reportType} onChange={(e)=>setReportType(e.target.value)}>
            {['Daily Attendance','Monthly Attendance','Late Report','Absence Report','Overtime Report','Employee-wise Report'].map((type)=><option key={type}>{type}</option>)}
          </select>
        </label>
        <label><span>Branch</span><select aria-label="Filter report by branch" value={branch} onChange={e=>setBranch(e.target.value)}>
          {branches.map(value=><option key={value} value={value}>{value}</option>)}
        </select></label>
        <label><span>Employee</span><select aria-label="Filter report by employee" value={employee} onChange={e=>setEmployee(e.target.value)}>
          {employees.map(value=><option key={value} value={value}>{value}</option>)}
        </select></label>
        {hasRecordDates && <>
          <label><span>From</span><input type="date" value={from} max={to || undefined} onChange={e=>setFrom(e.target.value)}/></label>
          <label><span>To</span><input type="date" value={to} min={from || undefined} onChange={e=>setTo(e.target.value)}/></label>
        </>}
        <div className="am-report-count"><span>Records</span><strong>{loading || error ? '—' : rows.length}</strong></div>
      </section>

      {loading && <div className="am-loading-state" role="status">Loading reports…</div>}
      {error && <div className="am-empty-state" role="alert">{error}</div>}
      {!loading && !error && <div className="am-table-card am-report-table">
        <table>
          <thead>
            <tr>{['Employee','Role','Branch','Status','Check In','Check Out','Worked','OT','Late'].map((head)=><th key={head}>{head}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((item)=>(
              <tr key={item.id}>
                <td><strong>{item.name}</strong></td>
                <td>{item.designation}</td>
                <td>{item.branch}</td>
                <td><strong>{item.status}</strong></td>
                <td><ReportPunch value={item.clockIn} recordDate={item.date || item.attendanceDate || item.createdDate} /></td>
                <td><ReportPunch value={item.clockOut} recordDate={item.date || item.attendanceDate || item.createdDate} /></td>
                <td>{item.worked || '—'}</td>
                <td>{item.overtimeHours || 0}h</td>
                <td>{item.lateMinutes || 0}m</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="am-empty-state">No attendance records.</p>}
      </div>}
      {!loading && !error && rows.length > 0 && <div className="am-report-mobile-list">
        {rows.map(item => <article key={item.id || item.staffId || item.name} className="am-report-mobile-card">
          <div><strong>{item.name}</strong><span>{item.status || '—'}</span></div>
          <small>{[item.branch, item.designation].filter(Boolean).join(' · ')}</small>
          <dl>
            <div><dt>Check In</dt><dd><ReportPunch value={item.clockIn} recordDate={item.date || item.attendanceDate || item.createdDate} /></dd></div>
            <div><dt>Check Out</dt><dd><ReportPunch value={item.clockOut} recordDate={item.date || item.attendanceDate || item.createdDate} /></dd></div>
            <div><dt>Worked</dt><dd>{item.worked || '—'}</dd></div>
            <div><dt>OT</dt><dd>{item.overtimeHours || 0}h</dd></div>
          </dl>
        </article>)}
      </div>}
    </div>
  );
};
