import { useEffect, useRef, useState } from "react";
import { Save } from 'lucide-react';
import '../../styles/staff-branch-access.css';
import { branchService } from '../../services/branch.service';
import { ResponsiveModalSheet } from '../common/ResponsiveModalSheet';
import { clearFieldValidation, showFormFieldError, showServerFormErrors } from '../../utils/formValidation';

export const StaffProfileEditSheet = ({
  open,
  onClose,
  staff,
  roles,
  teams,
  shifts,
  skills,
  onSave,
  canAssignRole = false,
}) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef(null);
  const [form, setForm] = useState({});
  const [skillIds, setSkillIds] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchError, setBranchError] = useState('');

  useEffect(() => {
    if (!open || !staff) return;
    setError('');
    setForm({
      name: staff.name || '',
      phone: staff.phone || '',
      role: staff.role || '',
      branchId: staff.branchId || '',
      allowedBranchIds: Array.isArray(staff.assignedBranchIds) && staff.assignedBranchIds.length
        ? staff.assignedBranchIds.map(String)
        : staff.branchId ? [String(staff.branchId)] : [],
      roleId: staff.roleId || (roles.filter(role => role.name === staff.role).length === 1 ? roles.find(role => role.name === staff.role).id : ''),
      teamId: staff.teamId || '',
      shiftId: staff.shiftId || '',
      employmentStatus: staff.employmentStatus || 'Active',
      whatsappConsent: Boolean(staff.whatsappConsent),
      whatsappConsentSource: staff.whatsappConsentSource || '',
    });

    const currentNames = new Set(staff.skills || []);
    setSkillIds(
      skills
        .filter((skill) => currentNames.has(skill.name))
        .map((skill) => String(skill.id)),
    );
  }, [open, staff, skills, roles]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setBranchError('');
    branchService.getBranches()
      .then((rows) => { if (active) setBranches((Array.isArray(rows) ? rows : []).filter((branch) => branch.is_active !== false)); })
      .catch((cause) => { if (active) setBranchError(cause?.message || 'Unable to load branches.'); });
    return () => { active = false; };
  }, [open]);

  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const toggleSkill = (skill) => {
    const id = String(skill.id);
    setSkillIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      showFormFieldError(formRef.current, 'name', 'Full name is required.');
      return;
    }
    if (form.phone?.trim() && !/^\+[1-9]\d{7,14}$/.test(form.phone.replace(/[\s().-]/g, ''))) {
      showFormFieldError(formRef.current, 'phone', 'Enter a valid international mobile number.');
      return;
    }
    if (form.branchId && !branches.some((branch) => String(branch.id) === String(form.branchId))) {
      showFormFieldError(formRef.current, 'branchId', 'Select an active workshop branch.');
      return;
    }
    if (canAssignRole && (!form.roleId || !roles.some(role => String(role.id) === String(form.roleId)))) {
      showFormFieldError(formRef.current, 'role', 'Choose an active company role.');
      return;
    }
    if (canAssignRole && staff?.user && form.branchId &&
      (!form.allowedBranchIds.includes(String(form.branchId)) || form.allowedBranchIds.length > 3)) {
      showFormFieldError(formRef.current, 'branchId', 'Include the primary branch and choose at most three.');
      return;
    }
    if (canAssignRole && form.whatsappConsent && !form.whatsappConsentSource?.trim()) {
      showFormFieldError(formRef.current, 'whatsappConsentSource', 'Select how WhatsApp consent was recorded.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...Object.fromEntries(Object.entries(form).filter(([key]) =>
          (canAssignRole || !['role', 'roleId', 'allowedBranchIds', 'whatsappConsent', 'whatsappConsentSource'].includes(key))
          && !['email', 'designation', 'emergencyContact', 'address', 'notes'].includes(key)
        )),
        branchId: form.branchId || null,
        teamId: form.teamId || null,
        shiftId: form.shiftId || null,
        skillIds: skills
          .filter((skill) => skillIds.includes(String(skill.id)))
          .map((skill) => skill.id),
        skills: skills
          .filter((skill) => skillIds.includes(String(skill.id)))
          .map((skill) => skill.name),
      });
      onClose();
    } catch (cause) {
      showServerFormErrors(formRef.current, cause, {
        roleId: 'role', role: 'role', phone: 'phone', name: 'name',
        employmentStatus: 'employmentStatus', branchId: 'branchId',
        teamId: 'teamId', shiftId: 'shiftId',
        whatsappConsentSource: 'whatsappConsentSource',
      });
      setError(cause?.message || 'Unable to update staff.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModalSheet
      isOpen={open}
      onClose={onClose}
      title="Edit Staff Profile"
      maxWidth="680px"
    >
      <form ref={formRef} className="staff-profile-edit-form" noValidate onSubmit={submit}
        onChange={event => clearFieldValidation(event.target)}>
        {(error || branchError) && <div className="staff-directory-message is-error" role="alert">{error || branchError}</div>}
        <div className="staff-profile-edit-grid">
          <label>Full Name *<input name="name" required value={form.name || ''} onChange={(e) => set('name', e.target.value)} /></label>
          <label>Mobile Number<input name="phone" type="tel" disabled={!canAssignRole && Boolean(staff?.user)}
            value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></label>
          <label>
            Company Role
            <select name="role" disabled={!canAssignRole} value={form.roleId || ''} onChange={(e) => { const role = roles.find(item => String(item.id) === e.target.value); setForm(current => ({...current,roleId:role?.id || '',role:role?.name || ''})); }}>
              <option value="">Choose role</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </label>

          <label>
            Branch
            <select name="branchId" value={form.branchId || ''} onChange={(e) => {
              const branchId = e.target.value;
              setForm((current) => ({
                ...current,
                branchId,
                allowedBranchIds: branchId
                  ? [branchId, ...(current.allowedBranchIds || []).filter(
                      id => id !== current.branchId && id !== branchId)].slice(0, 3)
                  : [],
                teamId: teams.some((team) => String(team.id) === String(current.teamId) &&
                  (!team.branchId || String(team.branchId) === String(branchId))) ? current.teamId : '',
                shiftId: shifts.some((shift) => String(shift.id) === String(current.shiftId) &&
                  (!shift.branchId || String(shift.branchId) === String(branchId))) ? current.shiftId : '',
              }));
            }}>
              <option value="">Unassigned</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          {canAssignRole && staff?.user && form.branchId && branches.length > 1 &&
            <fieldset className="staff-branch-access is-wide">
              <legend>Staff Branch Access (up to 3)</legend>
              <p>Only these branches are available when creating or editing customers.</p>
              <div>
                {branches.map(branch => {
                  const current = (form.allowedBranchIds || []).includes(String(branch.id));
                  const primary = String(form.branchId) === String(branch.id);
                  return <label key={branch.id}>
                    <input type="checkbox" checked={current}
                      disabled={primary || (!current && form.allowedBranchIds.length >= 3)}
                      onChange={event => setForm(previous => ({
                        ...previous, allowedBranchIds: event.target.checked
                          ? [...previous.allowedBranchIds, String(branch.id)]
                          : previous.allowedBranchIds.filter(item => item !== String(branch.id)),
                      }))}/>
                    {branch.name}{primary ? ' (Primary)' : ''}
                  </label>;
                })}
              </div>
            </fieldset>}
          <label>
            Team
            <select name="teamId" value={form.teamId || ''} onChange={(e) => set('teamId', e.target.value)}>
              <option value="">Unassigned</option>
              {teams.filter((team) => !team.branchId || String(team.branchId) === String(form.branchId)).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>

          <label>
            Shift
            <select name="shiftId" value={form.shiftId || ''} onChange={(e) => set('shiftId', e.target.value)}>
              <option value="">Unassigned</option>
              {shifts.filter((shift) => !shift.branchId || String(shift.branchId) === String(form.branchId)).map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
            </select>
          </label>

          <label>
            Status
            <select name="employmentStatus" value={form.employmentStatus || 'Active'} onChange={(e) => set('employmentStatus', e.target.value)}>
              {['Active','Probation','Notice Period','Suspended','Resigned','Terminated','Inactive'].map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

        </div>

        {canAssignRole && (
          <div className="staff-profile-edit-grid" style={{ marginTop: 12 }}>
            <label className="is-wide" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={Boolean(form.whatsappConsent)}
                onChange={(event) => set('whatsappConsent', event.target.checked)} />
              WhatsApp Consent
            </label>
            {form.whatsappConsent && (
              <label className="is-wide">Consent Source *
                <select name="whatsappConsentSource" value={form.whatsappConsentSource || ''}
                  onChange={(event) => set('whatsappConsentSource', event.target.value)}>
                  <option value="">Choose source</option>
                  <option value="Staff consented in person during onboarding">In person</option>
                  <option value="Signed staff WhatsApp consent form">Signed consent form</option>
                  <option value="Staff consented through approved digital form">Approved digital form</option>
                </select>
              </label>
            )}
          </div>
        )}


        <div className="staff-profile-edit-skills">
          <span>Skills</span>
          <div>
            {skills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                className={skillIds.includes(String(skill.id)) ? 'is-selected' : ''}
                onClick={() => toggleSkill(skill)}
              >
                {skill.name}
              </button>
            ))}
          </div>
        </div>

        <div className="staff-profile-edit-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="is-primary" disabled={saving}>
            <Save size={13} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </ResponsiveModalSheet>
  );
};
