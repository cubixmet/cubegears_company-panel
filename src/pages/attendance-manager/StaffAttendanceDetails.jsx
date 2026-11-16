import { recordLabel } from '../../utils/recordReferences.js';
import { useState, useEffect } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Plus, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { attendanceManagerService } from '../../services/attendanceManager.service';
import { overtimeService } from '../../services/overtime.service';
import { AddOvertimeSheet } from '../../components/payroll/AddOvertimeSheet';
import '../../styles/staff-attendance-details.css';

export const StaffAttendanceDetails = () => {
  const { staffId, date } = useParams();
  const navigate = useNavigate();

  const [details, setDetails] = useState(null);
  const [overtimeRecord, setOvertimeRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAddOtOpen, setIsAddOtOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const selectedDateStr = date || new Date().toISOString().split('T')[0];
  const selectedDateObj = new Date(`${selectedDateStr}T00:00:00`);
  const selectedYear = selectedDateObj.getFullYear();
  const selectedMonth = selectedDateObj.getMonth();
  const selectedDay = selectedDateObj.getDate();
  const monthLabel = selectedDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDayOffset = new Date(selectedYear, selectedMonth, 1).getDay();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const calendarCells = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const navigateToDate = (day) => {
    if (!day) return;
    const monthValue = String(selectedMonth + 1).padStart(2, '0');
    const dayValue = String(day).padStart(2, '0');
    navigate(`/attendance-manager/team-review/${staffId}/${selectedYear}-${monthValue}-${dayValue}`);
  };

  const moveMonth = (offset) => {
    const next = new Date(selectedYear, selectedMonth + offset, 1);
    const monthValue = String(next.getMonth() + 1).padStart(2, '0');
    navigate(`/attendance-manager/team-review/${staffId}/${next.getFullYear()}-${monthValue}-01`);
  };

  useEffect(() => {
    loadStaffDetails();
  }, [staffId, selectedDateStr]);

  const loadStaffDetails = async () => {
    setLoading(true);
    try {
      const data = await attendanceManagerService.getStaffAttendanceDetails(staffId || 'EMP-0012', selectedDateStr);
      const otList = await overtimeService.getOvertime({ staffId: staffId || 'EMP-0012' });
      const foundOt = otList.find((ot) => ot.date === selectedDateStr);

      setDetails(data);
      setOvertimeRecord(foundOt || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleAddOtSave = async (otData) => {
    await overtimeService.createOvertime(otData);
    showToast('Overtime request submitted. Awaiting manager approval.');
    loadStaffDetails();
  };

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
  };

  if (loading) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Loading staff attendance details...
      </div>
    );
  }

  if (!details) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Attendance record not found for {recordLabel(staffId)} on {selectedDateStr}.
      </div>
    );
  }

  const { staffInfo, attendanceSummary, sessions, correctionInfo, leaveInfo, auditHistory } = details;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Toast Banner */}
      {toastMsg && (
        <div style={{ backgroundColor: 'var(--success)', color: '#ffffff', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600' }}>
          {toastMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <button
          type="button"
          onClick={() => setIsAddOtOpen(true)}
          style={{
            height: '42px',
            padding: '0 16px',
            borderRadius: '10px',
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            border: 'none',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Plus size={16} /> Add Overtime
        </button>
      </div>

      <section className="staff-history-calendar">
        <div className="staff-history-calendar__header">
          <div>
            <h3>Attendance Calendar</h3>
            <p>Select a date to view that day's attendance history.</p>
          </div>
          <div className="staff-history-calendar__controls">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={15}/></button>
            <strong>{monthLabel}</strong>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={15}/></button>
          </div>
        </div>

        <div className="staff-history-calendar__weekdays">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label) => <span key={label}>{label}</span>)}
        </div>

        <div className="staff-history-calendar__grid">
          {calendarCells.map((day, index) => {
            if (!day) return <span key={`empty-${index}`} className="staff-history-calendar__empty" />;
            const dayDate = new Date(selectedYear, selectedMonth, day);
            const isSunday = dayDate.getDay() === 0;
            const isSelected = day === selectedDay;
            return (
              <button
                key={day}
                type="button"
                className={`staff-history-calendar__day ${isSelected ? 'is-selected' : ''} ${isSunday ? 'is-off' : ''}`}
                onClick={() => navigateToDate(day)}
              >
                <span>{day}</span>
                <i className={isSunday ? 'is-off' : 'is-present'} />
              </button>
            );
          })}
        </div>

        <div className="staff-history-calendar__legend">
          <span><i className="is-present" /> Present / Record</span>
          <span><i className="is-off" /> Weekly Off</span>
          <span><i className="is-selected" /> Selected Date</span>
        </div>
      </section>

      {/* Section 1: Staff Summary Header Card */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              {staffInfo.name}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {recordLabel(staffInfo.id)} • {staffInfo.designation} • {staffInfo.branch}
            </div>
          </div>
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            padding: '4px 12px',
            borderRadius: '8px',
            backgroundColor: attendanceSummary.status === 'Present' ? 'var(--success-soft)' : (attendanceSummary.status === 'On Leave' ? 'var(--primary-soft)' : 'var(--danger-soft)'),
            color: attendanceSummary.status === 'Present' ? 'var(--success)' : (attendanceSummary.status === 'On Leave' ? 'var(--primary)' : 'var(--danger)')
          }}>
            {attendanceSummary.status}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', backgroundColor: 'var(--surface-2)', padding: '12px', borderRadius: '12px', marginTop: '4px', fontSize: '13px' }}>
          <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Selected Date</span><strong>{selectedDateStr}</strong></div>
          <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Shift</span><strong>{staffInfo.shift}</strong></div>
          <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Weekly Off</span><strong>{staffInfo.weeklyOff}</strong></div>
          <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Total Worked</span><strong style={{ color: 'var(--primary)' }}>{attendanceSummary.workedHours}</strong></div>
        </div>
      </div>

      {/* Section 2: Attendance Clock In / Clock Out Sessions */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={16} style={{ color: 'var(--primary)' }} /> Attendance Sessions ({sessions?.length || 0})
        </h3>

        {sessions?.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No clock sessions recorded for this date.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sessions.map((sess, idx) => (
              <div key={idx} style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', fontSize: '13px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Session {idx + 1} Clock In</span>
                  <strong style={{ color: 'var(--success)' }}>{sess.clockIn}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Clock Out</span>
                  <strong style={{ color: sess.clockOut === 'Missing' ? 'var(--danger)' : 'var(--text-primary)' }}>{sess.clockOut}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Worked</span>
                  <strong style={{ color: 'var(--primary)' }}>{sess.duration}</strong>
                </div>
                {details.locationEnabled && (
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    <MapPin size={12} />
                    <span>
                      In: {sess.clockInLocation?.latitude != null
                        ? `${Number(sess.clockInLocation.latitude).toFixed(5)}, ${Number(sess.clockInLocation.longitude).toFixed(5)}`
                        : 'No location'}
                      {sess.clockOutLocation?.latitude != null
                        ? ` · Out: ${Number(sess.clockOutLocation.latitude).toFixed(5)}, ${Number(sess.clockOutLocation.longitude).toFixed(5)}`
                        : ''}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Attendance Summary Status */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
          Attendance Status Summary
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '13px' }}>
          <div style={{ backgroundColor: 'var(--surface-2)', padding: '10px 12px', borderRadius: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Worked Hours</span>
            <div style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '15px' }}>{attendanceSummary.workedHours}</div>
          </div>

          <div style={{ backgroundColor: 'var(--surface-2)', padding: '10px 12px', borderRadius: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Late Arrival</span>
            <div style={{ fontWeight: '700', color: attendanceSummary.lateMinutes > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
              {attendanceSummary.lateMinutes > 0 ? `${attendanceSummary.lateMinutes} mins` : 'On Time'}
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--surface-2)', padding: '10px 12px', borderRadius: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Early Exit</span>
            <div style={{ fontWeight: '700', color: attendanceSummary.earlyExitMinutes > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
              {attendanceSummary.earlyExitMinutes > 0 ? `${attendanceSummary.earlyExitMinutes} mins` : 'None'}
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--surface-2)', padding: '10px 12px', borderRadius: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Missing Clock Out</span>
            <div style={{ fontWeight: '700', color: attendanceSummary.missingClockOut ? 'var(--danger)' : 'var(--success)' }}>
              {attendanceSummary.missingClockOut ? 'Yes (Action Required)' : 'No'}
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Corrections */}
      {correctionInfo && (
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            Punch Correction Record
          </h3>
          <div style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Original Clock Out: <strong style={{ color: 'var(--danger)' }}>{correctionInfo.originalClockOut}</strong></span>
              <span style={{ color: 'var(--success)', fontWeight: '700' }}>{correctionInfo.status}</span>
            </div>
            <div>Corrected Clock Out: <strong style={{ color: 'var(--success)' }}>{correctionInfo.correctedClockOut}</strong></div>
            <div>Reason: <em>{correctionInfo.reason}</em></div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Approved By: {correctionInfo.approvedBy} on {correctionInfo.approvedAt}
            </div>
          </div>
        </div>
      )}

      {/* Section 5: Leave Information */}
      {leaveInfo && (
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            Leave Record
          </h3>
          <div style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', fontSize: '13px' }}>
            <div>Leave Type: <strong>{leaveInfo.leaveType}</strong></div>
            <div>Duration: <strong>{leaveInfo.duration}</strong></div>
            <div>Approval Status: <strong style={{ color: 'var(--success)' }}>{leaveInfo.status}</strong></div>
          </div>
        </div>
      )}

      {/* Section 6: Overtime */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            Overtime Record
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Only approved overtime enters payroll calculations.
          </span>
        </div>

        {overtimeRecord ? (
          <div style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--primary)' }}>
                {overtimeRecord.overtimeHours}h ({overtimeRecord.calculationMethod})
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: overtimeRecord.status === 'Approved' ? 'var(--success-soft)' : (overtimeRecord.status === 'Rejected' ? 'var(--danger-soft)' : 'var(--warning-soft)'),
                color: overtimeRecord.status === 'Approved' ? 'var(--success)' : (overtimeRecord.status === 'Rejected' ? 'var(--danger)' : 'var(--warning)')
              }}>
                {overtimeRecord.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', fontSize: '13px' }}>
              <div>Rate: <strong>₹{overtimeRecord.rate}/hr</strong></div>
              <div>Calculated Amount: <strong style={{ color: 'var(--primary)' }}>{formatINR(overtimeRecord.amount)}</strong></div>
              <div>Reason: <strong>{overtimeRecord.reason}</strong></div>
            </div>

            {overtimeRecord.approvedBy && (
              <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '600', marginTop: '4px' }}>
                ✓ Approved By: {overtimeRecord.approvedBy} ({overtimeRecord.approvedAt})
              </div>
            )}
          </div>
        ) : (
          <div style={{ backgroundColor: 'var(--surface-2)', padding: '16px', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No overtime recorded for this date.
          </div>
        )}
      </div>

      {/* Section 7: Audit History */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
          Audit History
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {auditHistory?.map((audit, idx) => (
            <div key={idx} style={{ backgroundColor: 'var(--surface-2)', padding: '10px 12px', borderRadius: '10px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>{audit.action}</strong> by {audit.actor}
                {audit.reason && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reason: {audit.reason}</div>}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{audit.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add Overtime Bottom Sheet / Modal */}
      <AddOvertimeSheet
        isOpen={isAddOtOpen}
        onClose={() => setIsAddOtOpen(false)}
        onSave={handleAddOtSave}
        prefillStaff={{
          staffId: staffInfo.id,
          staffName: staffInfo.name
        }}
      />
    </div>
  );
};
