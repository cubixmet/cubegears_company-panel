import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { RolePermissionMatrix } from './RolePermissionMatrix';
import { clearFieldValidation } from '../../utils/formValidation';
import { buildRolePresetPermissions, WORKSHOP_ROLE_PRESETS } from '../../config/rolePermissions';

export const RoleEditorForm = ({
  id,
  editingRole,
  formData,
  setFormData,
  modules,
  onSubmit,
  onPermissionToggle,
  onToggleModule,
  error,
}) => {
  const protectedRole = Boolean(editingRole?.isProtected);
  const [presetName, setPresetName] = useState('');
  const [advanced, setAdvanced] = useState(Boolean(editingRole));
  const preset = WORKSHOP_ROLE_PRESETS.find(role => role.name === presetName);

  const selected = modules.reduce((sum, module) => sum +
    module.actions.filter(action => Boolean(formData.permissions?.[module.key]?.[action])).length, 0);

  const selectPreset = (event) => {
    const select = event.currentTarget;
    const name = select.value;
    const nextPreset = WORKSHOP_ROLE_PRESETS.find(role => role.name === name);
    setPresetName(name);
    clearFieldValidation(select.form?.elements.namedItem('name'));
    setFormData(current => ({
      ...current,
      name,
      permissions: buildRolePresetPermissions(modules, nextPreset),
    }));
    setAdvanced(!nextPreset);
  };

  return (
    <form id={id} className="role-editor-form role-editor-simple" noValidate onSubmit={onSubmit}
      onChange={event => clearFieldValidation(event.target)}>
      {error && <div className="staff-directory-message is-error" role="alert">{error}</div>}
      {!editingRole && (
        <label className="role-editor-field">
          <span id={`${id}-preset-label`}>Role</span>
          <select value={presetName} onChange={selectPreset}
            aria-labelledby={`${id}-preset-label`}
            aria-describedby={preset ? `${id}-preset-hint` : undefined}>
            <option value="">Custom role</option>
            {WORKSHOP_ROLE_PRESETS.map(role => <option key={role.name}>{role.name}</option>)}
          </select>
          {preset && (
            <small id={`${id}-preset-hint`} className="role-access-hint">{preset.description}</small>
          )}
        </label>
      )}
      <section className="role-editor-card">
        <div className="role-editor-grid">
          <label className="role-editor-field">
            <span>Role name *</span>
            <input type="text" name="name" required disabled={protectedRole}
              value={formData.name}
              onChange={event => setFormData(current => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Service Advisor" />
          </label>
          <label className="role-editor-field">
            <span>Status</span>
            <select name="status" value={formData.status} disabled={protectedRole}
              onChange={event => setFormData(current => ({ ...current, status: event.target.value }))}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
        </div>
      </section>
      <section className="role-permission-choice">
        <button type="button" className="role-permission-expand" aria-expanded={advanced}
          aria-controls="role-permission-details" onClick={() => setAdvanced(value => !value)}>
          <span>{advanced ? 'Hide permissions' : 'Show permissions'}</span>
          <span><small>{selected} selected</small><ChevronDown size={16} aria-hidden="true" /></span>
        </button>
        {advanced && (
          <div id="role-permission-details">
            <RolePermissionMatrix modules={modules} permissions={formData.permissions}
              protectedRole={protectedRole} onToggle={onPermissionToggle}
              onToggleModule={onToggleModule} />
          </div>
        )}
      </section>
    </form>
  );
};
