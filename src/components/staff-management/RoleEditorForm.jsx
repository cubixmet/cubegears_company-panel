import { useEffect, useState } from 'react';
import { Save, SlidersHorizontal } from 'lucide-react';
import { RolePermissionMatrix } from './RolePermissionMatrix';
import { clearFieldValidation } from '../../utils/formValidation';

export const RoleEditorForm = ({
  editingRole,
  formData,
  setFormData,
  modules,
  saving,
  onSubmit,
  onCancel,
  onPermissionToggle,
  onToggleModule,
  error,
}) => {
  const protectedRole = Boolean(editingRole?.isProtected);
  const [mode, setMode] = useState('custom');
  const [advanced, setAdvanced] = useState(Boolean(editingRole));

  useEffect(() => {
    // Never overwrite existing saved permissions merely by opening Edit.
    setMode('custom');
    setAdvanced(Boolean(editingRole));
  }, [editingRole?.id]);

  const selected = modules.reduce((sum, module) => sum +
    module.actions.filter(action => Boolean(formData.permissions?.[module.key]?.[action])).length, 0);

  const setPreset = (value) => {
    if (protectedRole) return;
    setMode(value);
    if (value === 'custom') {
      setAdvanced(true);
      return;
    }
    // Only actions the authenticated owner may assign are changed.
    // Read-only never gives payroll payment, approval or mutation access.
    setFormData(current => ({
      ...current,
      permissions: {
        ...current.permissions,
        ...Object.fromEntries(modules.map(module => [
          module.key,
          Object.fromEntries(module.actions.map(action => [
            action,
            value === 'viewer' && action === 'view'
              && ['dashboard', 'customers', 'vehicles', 'services', 'jobs', 'stock'].includes(module.key),
          ])),
        ])),
      },
    }));
    setAdvanced(false);
  };

  const customize = (moduleKey, actionKey) => {
    setMode('custom');
    onPermissionToggle(moduleKey, actionKey);
  };

  const customizeModule = (moduleKey, enable) => {
    setMode('custom');
    onToggleModule(moduleKey, enable);
  };

  return (
    <form className="role-editor-form role-editor-simple" noValidate onSubmit={onSubmit}
      onChange={event => clearFieldValidation(event.target)}>
      {error && <div className="staff-directory-message is-error" role="alert">{error}</div>}
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
      <fieldset className="role-quick-presets" disabled={protectedRole}>
        <legend>Access level</legend>
        <div className="role-preset-options">
          {[
            { id: 'viewer', label: 'View only', help: 'Basic workshop pages, no finance or payroll' },
            { id: 'none', label: 'No access', help: 'Keep permissions off' },
            { id: 'custom', label: 'Custom', help: 'Choose permissions yourself' },
          ].map(item => (
            <label key={item.id} className={mode === item.id ? 'is-selected' : ''}>
              <input type="radio" name="role-access-mode" checked={mode === item.id}
                onChange={() => setPreset(item.id)} />
              <span><strong>{item.label}</strong><small>{item.help}</small></span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="sr-only">Branch-specific restrictions are not available yet. Paid modules still require activation and permissions.</p>
      <section className="role-permission-choice">
        <button type="button" className="role-permission-expand" aria-expanded={advanced}
          aria-controls="role-permission-details" onClick={() => setAdvanced(value => !value)}>
          <span><SlidersHorizontal size={16} aria-hidden="true" /> Permissions
            <small>{selected} selected</small></span>
          <span>{advanced ? 'Hide' : 'Customize'}</span>
        </button>
        {advanced && (
          <div id="role-permission-details">
            <RolePermissionMatrix modules={modules} permissions={formData.permissions}
              protectedRole={protectedRole} onToggle={customize}
              onToggleModule={customizeModule} />
          </div>
        )}
      </section>
      <footer className="role-editor-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="is-primary" disabled={saving || protectedRole}>
          <Save size={15} aria-hidden="true" />
          {protectedRole ? 'Protected Role' : saving ? 'Saving…' : editingRole ? 'Save Changes' : 'Create Role'}
        </button>
      </footer>
    </form>
  );
};
