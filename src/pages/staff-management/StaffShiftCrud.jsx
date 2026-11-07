import { appConfirm, appAlert } from '../../components/common/appDialogs';
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Clock3, Pencil, Plus, Save, Trash2, Users } from 'lucide-react';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';
import { BranchCreateSheet } from '../../components/staff-management/BranchCreateSheet';
import { staffManagementService } from '../../services/staffManagement.service';
import { branchService } from '../../services/branch.service';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { clearFieldValidation, showFormFieldError, showServerFormErrors } from '../../utils/formValidation';

const EMPTY_FORM = {
  name: '',
  startTime: '09:00 AM',
  endTime: '06:00 PM',
  weeklyOff: 'Sunday',
  branchId: '',
  assignedStaffIds: [],
};

const splitShiftTime = (value = '') => {
  const [startTime = '09:00 AM', endTime = '06:00 PM'] = value.split(' - ');
  return { startTime, endTime };
};

export const StaffShiftCrud = ({ staff = [] }) => {
  const { user } = useAuth();
  const canManageBranches = hasPermission(user, 'company.manage');
  const [shifts, setShifts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const formRef = useRef(null);

  const activeStaff = useMemo(
    () => staff.filter((item) =>
      ['Active', 'Probation', 'Notice Period'].includes(item.employmentStatus),
    ),
    [staff],
  );
  // A branch-scoped shift cannot select employees from another branch.
  const assignableStaff = useMemo(() => activeStaff.filter((item) =>
    !form.branchId || String(item.branchId || '') === String(form.branchId),
  ), [activeStaff, form.branchId]);

  const load = async () => {
    const [shiftRows, branchRows] = await Promise.all([
      staffManagementService.getShifts(),
      branchService.getBranches(),
    ]);
    setShifts(Array.isArray(shiftRows) ? shiftRows : []);
    setBranches(
      (Array.isArray(branchRows) ? branchRows : []).filter(
        (item) => item.is_active !== false,
      ),
    );
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      branchId: branches[0]?.id || '',
    });
    setError('');
    setOpen(true);
  };

  const openEdit = (shift) => {
    const { startTime, endTime } = splitShiftTime(shift.time);
    setEditing(shift);
    setForm({
      name: shift.name,
      startTime,
      endTime,
      weeklyOff: shift.weeklyOff || 'Sunday',
      branchId: shift.branchId || '',
      assignedStaffIds: shift.assignedStaffIds || [],
    });
    setError('');
    setOpen(true);
  };

  const toggleStaff = (id) => {
    setForm((current) => ({
      ...current,
      assignedStaffIds: current.assignedStaffIds.includes(id)
        ? current.assignedStaffIds.filter((staffId) => staffId !== id)
        : [...current.assignedStaffIds, id],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      showFormFieldError(formRef.current, 'name', 'Shift name is required.');
      return;
    }
    if (!/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/.test(form.startTime.trim())) {
      showFormFieldError(formRef.current, 'startTime', 'Use time such as 09:00 AM.');
      return;
    }
    if (!/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/.test(form.endTime.trim())) {
      showFormFieldError(formRef.current, 'endTime', 'Use time such as 06:00 PM.');
      return;
    }

    const hasInvalidStaff = form.assignedStaffIds.some((id) =>
      !assignableStaff.some((person) => String(person.id) === String(id))
    );
    if (hasInvalidStaff) {
      setError('Selected staff must belong to the chosen shift branch.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const branch = branches.find(
        (item) => String(item.id) === String(form.branchId),
      );
      const payload = {
        name: form.name,
        time: `${form.startTime.trim()} - ${form.endTime.trim()}`,
        weeklyOff: form.weeklyOff,
        branchId: form.branchId || null,
        branchName: branch?.name || 'All Branches',
        assignedStaffIds: form.assignedStaffIds,
      };

      if (editing) {
        await staffManagementService.updateShift(editing.id, payload);
      } else {
        await staffManagementService.createShift(payload);
      }

      await load();
      setSuccess(editing ? 'Shift updated successfully.' : 'Shift saved successfully.');
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      showServerFormErrors(formRef.current, err, {
        name: 'name', start_time: 'startTime', end_time: 'endTime', branchId: 'branchId',
      });
      setError(err?.message || 'Unable to save shift.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (shiftItem) => {
    if (!await appConfirm(`Delete "${shiftItem.name}"?`)) return;
    try {
      await staffManagementService.deleteShift(shiftItem.id);
      await load();
    } catch (err) {
      appAlert(err?.message || 'Unable to delete shift.');
    }
  };

  const assignedIds = new Set(
    shifts.flatMap((shiftItem) => shiftItem.assignedStaffIds || []),
  );

  return (
    <div className="staff-dashboard-subpage staff-crud-view">
      {success && <div className="staff-action-success" role="status">{success}</div>}
      <section className="staff-subpage-header">
        <div>
          <h2>Shift Assignment</h2>
          <p>Create workshop shifts, weekly offs, branch assignment and staff allocation.</p>
        </div>

        <div className="staff-subpage-actions">
          {canManageBranches && (
            <button
              type="button"
              className="staff-secondary-action"
              onClick={() => setBranchOpen(true)}
            >
              <Building2 size={14}/>
              Add Branch
            </button>
          )}
          <button
            type="button"
            className="staff-primary-action"
            onClick={openCreate}
          >
            <Plus size={14}/>
            Add Shift
          </button>
        </div>
      </section>

      <section className="staff-subpage-kpis">
        <article><Clock3 size={15}/><span>Total Shifts</span><strong>{shifts.length}</strong></article>
        <article><Users size={15}/><span>Assigned Staff</span><strong>{assignedIds.size}</strong></article>
        <article><Users size={15}/><span>Unassigned</span><strong>{Math.max(activeStaff.length - assignedIds.size, 0)}</strong></article>
        <article><Building2 size={15}/><span>Active Branches</span><strong>{branches.length}</strong></article>
      </section>

      <div className="staff-crud-card-grid">
        {shifts.map((shiftItem) => {
          const members = activeStaff.filter((person) =>
            shiftItem.assignedStaffIds?.includes(person.id),
          );
          return (
            <article key={shiftItem.id} className="staff-crud-card">
              <div className="staff-crud-card__head">
                <div className="staff-crud-card__icon"><Clock3 size={17}/></div>
                <div>
                  <h3>{shiftItem.name}</h3>
                  <p>{shiftItem.time}</p>
                </div>
                {shiftItem.id === 'SHIFT-GENERAL' ? (
                  <span className="staff-crud-protected">Default</span>
                ) : null}
              </div>

              <div className="staff-crud-detail-grid">
                <div><span>Weekly Off</span><strong>{shiftItem.weeklyOff}</strong></div>
                <div><span>Branch</span><strong>{shiftItem.branchName || shiftItem.branch || 'All Branches'}</strong></div>
                <div><span>Assigned Staff</span><strong>{members.length}</strong></div>
              </div>

              <div className="staff-crud-assignees">
                {members.length
                  ? members.map((person) => <span key={person.id}>{person.name}</span>)
                  : <span className="is-muted">No staff assigned</span>}
              </div>

              <div className="staff-crud-actions">
                <button type="button" onClick={() => openEdit(shiftItem)}><Pencil size={13}/> Edit</button>
                <button
                  type="button"
                  className="is-danger"
                  disabled={shiftItem.id === 'SHIFT-GENERAL'}
                  onClick={() => remove(shiftItem)}
                >
                  <Trash2 size={13}/> Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <ResponsiveModalSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Workshop Shift' : 'Add Workshop Shift'}
        maxWidth="640px"
      >
        <form ref={formRef} className="staff-crud-form" noValidate onSubmit={submit}
          onChange={event => clearFieldValidation(event.target)}>
          {error ? <div className="staff-crud-error">{error}</div> : null}

          <label>
            Shift Name *
            <input
              name="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Night Shift"
            />
          </label>

          <div className="staff-crud-form__grid">
            <label>
              Start Time
              <input
                name="startTime"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                placeholder="09:00 AM"
              />
            </label>
            <label>
              End Time
              <input
                name="endTime"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                placeholder="06:00 PM"
              />
            </label>
            <label>
              Weekly Off
              <select name="weeklyOff"
                value={form.weeklyOff}
                onChange={(e) => setForm({ ...form, weeklyOff: e.target.value })}
              >
                {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
                  .map((day) => <option key={day}>{day}</option>)}
              </select>
            </label>
            <label>
              Branch
              <div className="staff-branch-select-row">
                <select name="branchId"
                  value={form.branchId}
                  onChange={(e) => {
                    const branchId = e.target.value;
                    setForm((current) => ({
                      ...current,
                      branchId,
                      assignedStaffIds: current.assignedStaffIds.filter((id) => {
                        const person = activeStaff.find((item) => String(item.id) === String(id));
                        return person && (!branchId || String(person.branchId || '') === String(branchId));
                      }),
                    }));
                  }}
                >
                  <option value="">All Branches</option>
                  {branches.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                {canManageBranches && (
                  <button
                    type="button"
                    className="staff-inline-create-button"
                    onClick={() => setBranchOpen(true)}
                  >
                    + Branch
                  </button>
                )}
              </div>
            </label>
          </div>

          <fieldset className="staff-crud-assignment-fieldset">
            <legend>Assign Staff · {form.branchId ? 'Selected branch only' : 'All branches'}</legend>
            <div className="staff-crud-check-grid">
              {assignableStaff.map((person) => (
                <label key={person.id} className="staff-crud-check">
                  <input
                    type="checkbox"
                    checked={form.assignedStaffIds.includes(person.id)}
                    onChange={() => toggleStaff(person.id)}
                  />
                  <span>
                    <strong>{person.name}</strong>
                    <small>{person.role || 'No role'} · {person.branch || 'No branch'}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="staff-crud-form__actions">
            <button
              type="button"
              className="staff-crud-cancel-button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="staff-crud-save-button"
              disabled={saving}
            >
              <Save size={14}/>
              {saving ? 'Saving...' : editing ? 'Update Shift' : 'Create Shift'}
            </button>
          </div>
        </form>
      </ResponsiveModalSheet>

      <BranchCreateSheet
        isOpen={canManageBranches && branchOpen}
        onClose={() => setBranchOpen(false)}
        onCreate={async (data) => {
          const created = await branchService.createBranch(data);
          await load();
          if (created?.id) {
            setForm((current) => ({ ...current, branchId: created.id }));
          }
        }}
      />
    </div>
  );
};
