import { useEffect, useMemo, useState } from "react";
import {
  RoleCardGrid,
  RoleEditorForm,
  RolesHeader,
} from '../../components/staff-management';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';
import {
  companyPermissionModules,
  createPermissionMatrix,
} from '../../config/rolePermissions';
import { roleService } from '../../services/role.service';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { appConfirm } from '../../components/common/appDialogs';
import { showFormFieldError, showServerFormErrors } from '../../utils/formValidation';

const createInitialForm = () => ({
  name: '',
  status: 'Active',
  permissions: createPermissionMatrix(false),
});

export const UserRoles = () => {
  const featureAccess = useFeatureAccess();
  const { isCompanyOwner } = featureAccess;
  const availableModules = useMemo(() => companyPermissionModules(featureAccess.can), [featureAccess.can]);
  const [roles, setRoles] = useState([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [legacyPresetRoles, setLegacyPresetRoles] = useState([]);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupError, setCleanupError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(createInitialForm());

  const loadRoles = async () => {
    setLoading(true);
    setError('');
    setRoles([]);

    try {
      const data = await roleService.getRoles();
      setRoles(Array.isArray(data) ? data : []);
      setLegacyPresetRoles([]);
      setCleanupError('');
      if (isCompanyOwner) {
        try {
          const preview = await roleService.previewLegacyRoles();
          setLegacyPresetRoles(Array.isArray(preview?.roles) ? preview.roles : []);
        } catch (previewError) {
          setCleanupError(previewError?.message || 'Could not review historical signup roles.');
        }
      }
    } catch (err) {
      setError(err?.message || 'Unable to load roles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleOpenAdd = () => {
    if (!isCompanyOwner) return;
    setEditingRole(null);
    setFormData(createInitialForm());
    setError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role) => {
    if (!isCompanyOwner) return;
    setEditingRole(role);
    setError('');
    setFormData({
      name: role.name || '',
      code: role.code,
      status: role.status || 'Active',
      permissions: role.permissions || createPermissionMatrix(false),
    });
    setIsModalOpen(true);
  };

  const handlePermissionToggle = (moduleKey, actionKey) => {
    setFormData((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [moduleKey]: {
          ...current.permissions[moduleKey],
          [actionKey]: !current.permissions[moduleKey]?.[actionKey],
        },
      },
    }));
  };

  const handleSelectAllModule = (moduleKey, enableAll) => {
    const module = availableModules.find((item) => item.key === moduleKey);
    const nextPermissions = Object.fromEntries(
      (module?.actions || []).map((action) => [action, enableAll]),
    );

    setFormData((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [moduleKey]: nextPermissions,
      },
    }));
  };

  const handleSaveRole = async (event) => {
    event.preventDefault();
    if (!isCompanyOwner || saving || editingRole?.isProtected) return;

    if (!formData.name.trim()) {
      showFormFieldError(event.currentTarget, 'name', 'Role Name is required.');
      setError('Role Name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (editingRole) {
        await roleService.updateRole(editingRole.id, {
          ...formData,
          isProtected: editingRole.isProtected,
        });
        setToastMsg('Role updated successfully.');
      } else {
        await roleService.createRole(formData);
        setToastMsg('Role created successfully.');
      }

      setIsModalOpen(false);
      setEditingRole(null);
      setFormData(createInitialForm());
      await loadRoles();

      window.setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      showServerFormErrors(event.currentTarget, err, { name: 'name', status: 'status' });
      setError(err?.message || 'Unable to save role.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (!isCompanyOwner || saving || role.isProtected || Number(role.usersCount) > 0) return;
    const confirmed = await appConfirm(`Delete role "${role.name}"? This cannot be undone.`, {
      title: 'Delete Staff Role', confirmLabel: 'Delete Role', tone: 'danger',
    });
    if (!confirmed) return;
    setSaving(true);
    setError('');
    try {
      await roleService.deleteRole(role.id);
      await loadRoles();
      setToastMsg('Role deleted successfully.');
    } catch (err) {
      setError(err?.message || 'Unable to delete this role.');
    } finally {
      setSaving(false);
    }
  };

  const handleCleanupOldRoles = async () => {
    if (!isCompanyOwner || cleanupBusy || !legacyPresetRoles.length) return;
    const confirmed = await appConfirm(
      `Remove these ${legacyPresetRoles.length} old signup roles?\n\n${legacyPresetRoles.map(role => role.name).join('\n')}\n\nOnly unchanged, unassigned presets are eligible. This cannot be undone.`,
      { title: 'Review old signup roles', confirmLabel: 'Remove Old Roles', tone: 'danger' },
    );
    if (!confirmed) return;
    setCleanupBusy(true);
    setCleanupError('');
    try {
      const result = await roleService.removeLegacyRoles(legacyPresetRoles.map(role => role.id));
      await loadRoles();
      setToastMsg(`Removed ${result?.count || 0} unused default roles. Custom and assigned roles were kept.`);
    } catch (requestError) {
      setCleanupError(requestError?.message || 'Cleanup failed. No roles were deleted; refresh the preview.');
    } finally {
      setCleanupBusy(false);
    }
  };

  const visibleRoles = useMemo(() => roles.filter(role => (
    [role.name, role.code, role.status].some(value => String(value || '')
      .toLowerCase().includes(roleSearch.trim().toLowerCase()))
  )), [roles, roleSearch]);

  const countEnabledPermissions = (permissions) => {
    if (!permissions || typeof permissions !== 'object') return 0;

    return Object.values(permissions).reduce((total, modulePermissions) => {
      if (!modulePermissions || typeof modulePermissions !== 'object') return total;
      return total + Object.values(modulePermissions).filter(Boolean).length;
    }, 0);
  };

  return (
    <div className="staff-roles roles-dashboard">
      {toastMsg && <div className="roles-dashboard-toast">{toastMsg}</div>}
      {error && <div className="roles-dashboard-error">{error}</div>}
      {cleanupError && <div className="roles-dashboard-error" role="alert">{cleanupError}</div>}

      <RolesHeader onAdd={handleOpenAdd} canManage={isCompanyOwner} />
      {!isCompanyOwner && (
        <p role="note" className="roles-dashboard-info">
          Only the company owner can create, edit or delete Roles & Permissions.
        </p>
      )}
      {isCompanyOwner && legacyPresetRoles.length > 0 && (
        <section className="roles-legacy-review" aria-label="Review old signup roles">
          <div>
            <h3>Old automatically created roles</h3>
            <p>{legacyPresetRoles.length} unused signup presets. Assigned and custom roles are protected.</p>
            <ul>
              {legacyPresetRoles.map(role => <li key={role.id}>{role.name}</li>)}
            </ul>
          </div>
          <button type="button" disabled={cleanupBusy || saving}
            onClick={handleCleanupOldRoles}>
            {cleanupBusy ? 'Removing…' : `Remove ${legacyPresetRoles.length} old default roles`}
          </button>
        </section>
      )}

      {loading ? (
        <div className="roles-dashboard-loading">Loading company roles…</div>
      ) : (
        <>
          <div className="roles-search-row">
            <label className="roles-search-box">
              <span className="sr-only">Search roles</span>
              <input value={roleSearch} onChange={event => setRoleSearch(event.target.value)}
                placeholder="Search roles…" aria-label="Search roles" />
            </label>
            <span>{visibleRoles.length} of {roles.length} roles</span>
          </div>
          <RoleCardGrid
            roles={visibleRoles}
            countPermissions={countEnabledPermissions}
            onOpen={handleOpenEdit}
            onDelete={handleDeleteRole}
            canManage={isCompanyOwner}
          />
        </>
      )}

      <ResponsiveModalSheet
        isOpen={isCompanyOwner && isModalOpen}
        onClose={() => {
          if (saving) return;
          setIsModalOpen(false);
          setError('');
        }}
        title={editingRole ? `Role: ${editingRole.name}` : 'Add New Role'}
        maxWidth="640px"
      >
        <RoleEditorForm
          editingRole={editingRole}
          formData={formData}
          setFormData={setFormData}
          modules={availableModules}
          saving={saving}
          error={error}
          onSubmit={handleSaveRole}
          onCancel={() => {
            setIsModalOpen(false);
            setError('');
          }}
          onPermissionToggle={handlePermissionToggle}
          onToggleModule={handleSelectAllModule}
        />
      </ResponsiveModalSheet>
    </div>
  );
};
