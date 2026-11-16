import { recordLabel } from '../../utils/recordReferences.js';
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Save, UsersRound } from 'lucide-react';
import { attendanceManagerService } from '../../services/attendanceManager.service';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const emptyShift = {
  shiftId: '',
  name: 'General Shift',
  startTime: '09:00',
  endTime: '18:00',
  breakMinutes: 60,
  weeklyOff: ['Sunday'],
  isActive: true,
};

export const ShiftSettings = () => {
  const [setup, setSetup] = useState({ shifts: [], teams: [], employees: [] });
  const [shiftForm, setShiftForm] = useState(emptyShift);
  const [assignMode, setAssignMode] = useState('team');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedStaff, setSelectedStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    const data = await attendanceManagerService.getShiftSetup();
    const next = {
      shifts: Array.isArray(data?.shifts) ? data.shifts : [],
      teams: Array.isArray(data?.teams) ? data.teams : [],
      employees: Array.isArray(data?.employees) ? data.employees : [],
    };
    setSetup(next);

    if (!selectedShift && next.shifts[0]?.id) {
      setSelectedShift(next.shifts[0].id);
    }
    if (!selectedTeam && next.teams[0]?.id) {
      setSelectedTeam(next.teams[0].id);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const editShift = (shift) => {
    setShiftForm({
      shiftId: shift.id,
      name: shift.name,
      startTime: String(shift.startTime || '09:00').slice(0, 5),
      endTime: String(shift.endTime || '18:00').slice(0, 5),
      breakMinutes: Number(shift.breakMinutes || 0),
      weeklyOff: Array.isArray(shift.weeklyOff) ? shift.weeklyOff : [],
      isActive: shift.isActive !== false,
    });
  };

  const saveShift = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await attendanceManagerService.saveShift(shiftForm);
      setMessage('Shift saved.');
      setShiftForm(emptyShift);
      await load();
    } catch (error) {
      setMessage(error?.message || 'Unable to save shift.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStaff = (id) => {
    setSelectedStaff((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const assign = async () => {
    if (!selectedShift) return;
    if (assignMode === 'team' && !selectedTeam) return;
    if (assignMode === 'staff' && !selectedStaff.length) return;

    setSaving(true);
    setMessage('');
    try {
      const result = await attendanceManagerService.assignShift({
        shiftId: selectedShift,
        teamId: assignMode === 'team' ? selectedTeam : undefined,
        staffIds: assignMode === 'staff' ? selectedStaff : undefined,
      });
      setMessage(`${result?.assigned || 0} staff assigned to shift.`);
      setSelectedStaff([]);
      await load();
    } catch (error) {
      setMessage(error?.message || 'Unable to assign shift.');
    } finally {
      setSaving(false);
    }
  };

  const selectedShiftData = useMemo(
    () => setup.shifts.find((item) => item.id === selectedShift),
    [setup.shifts, selectedShift],
  );

  const activeShifts = setup.shifts.filter((shift) => shift.isActive !== false).length;
  const canAssign = !saving && selectedShift && (assignMode === 'team' ? selectedTeam : selectedStaff.length);
  const toggleWeeklyOff = (day) => {
    setShiftForm((current) => ({
      ...current,
      weeklyOff: current.weeklyOff.includes(day)
        ? current.weeklyOff.filter((value) => value !== day)
        : weekdays.filter((value) => [...current.weeklyOff, day].includes(value)),
    }));
  };

  return (
    <div className="attendance-manager-module attendance-manager-shifts">
      <section className="am-section-header am-shifts-heading">
        <div>
          <h2><Clock3 size={19}/> Shift Management</h2>
          <p>Create shifts, configure weekly offs and assign staff schedules.</p>
        </div>
        <div className="am-shift-summary">
          <span><strong>{setup.shifts.length}</strong> Total</span>
          <span><strong>{activeShifts}</strong> Active</span>
          <span><strong>{setup.employees.length}</strong> Staff</span>
        </div>
      </section>

      {message && <div className="attendance-rules-message" role="status">{message}</div>}

      <div className="am-shift-layout">
        <section className="am-panel">
          <div className="am-panel__header">
            <div>
              <h2>{shiftForm.shiftId ? 'Edit Shift' : 'Create Shift'}</h2>
              <p>{shiftForm.shiftId ? 'Update this schedule.' : 'Set working hours and days off.'}</p>
            </div>
          </div>

          <form className="am-shift-form" onSubmit={saveShift}>
            <label>
              <span>Shift Name</span>
              <input
                value={shiftForm.name}
                onChange={(event) =>
                  setShiftForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </label>

            <div className="am-form-grid am-form-grid--2">
              <label>
                <span>Start Time</span>
                <input
                  type="time"
                  value={shiftForm.startTime}
                  onChange={(event) =>
                    setShiftForm((current) => ({ ...current, startTime: event.target.value }))
                  }
                />
              </label>

              <label>
                <span>End Time</span>
                <input
                  type="time"
                  value={shiftForm.endTime}
                  onChange={(event) =>
                    setShiftForm((current) => ({ ...current, endTime: event.target.value }))
                  }
                />
              </label>
            </div>

            <label>
              <span>Break Minutes</span>
              <input
                type="number"
                min="0"
                value={shiftForm.breakMinutes}
                onChange={(event) =>
                  setShiftForm((current) => ({
                    ...current,
                    breakMinutes: Number(event.target.value),
                  }))
                }
              />
            </label>

            <div className="am-shift-weekly-off">
              <div className="am-shift-weekly-off-heading">
                <strong><CalendarDays size={16} aria-hidden="true"/> Weekly Off</strong>
                <small>Select non-working days</small>
              </div>
              <div className="am-shift-weekdays" role="group" aria-label="Weekly off days">
                {weekdays.map((day) => (
                  <button key={day} type="button"
                    className={shiftForm.weeklyOff.includes(day) ? 'is-selected' : ''}
                    aria-pressed={shiftForm.weeklyOff.includes(day)}
                    aria-label={day}
                    onClick={() => toggleWeeklyOff(day)}>
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <label className="am-rule-toggle-row">
              <span>
                <strong>Active Shift</strong>
                <small>Available for staff assignment</small>
              </span>
              <input
                type="checkbox"
                checked={shiftForm.isActive}
                onChange={(event) =>
                  setShiftForm((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
            </label>

            <div className="am-shift-form-actions">
              {shiftForm.shiftId && (
                <button
                  type="button"
                  onClick={() => setShiftForm(emptyShift)}
                >
                  New Shift
                </button>
              )}
              <button type="submit" className="am-primary-button" disabled={saving}>
                <Save size={14}/>
                {saving ? 'Saving…' : (shiftForm.shiftId ? 'Update Shift' : 'Save Shift')}
              </button>
            </div>
          </form>
        </section>

        <section className="am-panel">
          <div className="am-panel__header">
            <div>
              <h2>Available Shifts</h2>
              <p>Select a shift to edit its working hours.</p>
            </div>
          </div>

          <div className="am-shift-list">
            {setup.shifts.map((shift) => (
              <button key={shift.id} type="button" onClick={() => editShift(shift)}
                aria-pressed={shiftForm.shiftId === shift.id}
                className={shiftForm.shiftId === shift.id ? 'is-editing' : ''}>
                <div>
                  <strong>{shift.name}</strong>
                  <small className={shift.isActive === false ? 'am-shift-status is-inactive' : 'am-shift-status'}>
                    {shift.isActive === false ? 'Inactive' : 'Active'}
                  </small>
                  <span>
                    {String(shift.startTime || '').slice(0, 5)} – {String(shift.endTime || '').slice(0, 5)}
                    {' · '}{shift.breakMinutes || 0}m break
                  </span>
                </div>
                <b>{shift.staffCount || 0} staff</b>
              </button>
            ))}

            {!setup.shifts.length && (
              <div className="am-empty-state">No shifts configured yet.</div>
            )}
          </div>
        </section>
      </div>

      <section className="am-panel am-shift-assignment-panel">
        <div className="am-panel__header">
          <div>
            <h2><UsersRound size={17}/> Assign Shift</h2>
            <p>Choose a team or select individual staff members.</p>
          </div>
        </div>

        <div className="am-shift-assignment-controls">
          <label>
            <span>Shift</span>
            <select value={selectedShift} onChange={(event) => setSelectedShift(event.target.value)}>
              <option value="">Select shift</option>
              {setup.shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>{shift.name}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Assign By</span>
            <select value={assignMode} onChange={(event) => setAssignMode(event.target.value)}>
              <option value="team">Team</option>
              <option value="staff">Individual Staff</option>
            </select>
          </label>

          {assignMode === 'team' && (
            <label>
              <span>Team</span>
              <select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
                <option value="">Select team</option>
                {setup.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.staffCount || 0})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {assignMode === 'staff' && (
          <div className="am-shift-staff-grid" aria-label={`${selectedStaff.length} staff selected`}>
            {setup.employees.map((employee) => (
              <label key={employee.id}>
                <input
                  type="checkbox"
                  checked={selectedStaff.includes(employee.id)}
                  onChange={() => toggleStaff(employee.id)}
                />
                <span>
                  <strong>{employee.name}</strong>
                  <small>{recordLabel(employee.staffId)} · {employee.team || 'No team'} · {employee.shift || 'No shift'}</small>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="am-shift-assignment-footer">
          <span>
            {selectedShiftData
              ? `Assigning: ${selectedShiftData.name}`
              : 'Select a shift'}
          </span>
          <button type="button" className="am-primary-button" onClick={assign} disabled={!canAssign}>
            {saving ? 'Assigning…' : 'Assign Shift'}
          </button>
        </div>
      </section>
    </div>
  );
};
