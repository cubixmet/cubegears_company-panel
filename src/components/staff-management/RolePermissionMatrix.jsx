import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { permissionActionLabel } from '../../config/rolePermissions';

export const RolePermissionMatrix = ({
  modules,
  permissions,
  protectedRole,
  onToggle,
  onToggleModule,
}) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => modules.filter(module =>
    module.label.toLowerCase().includes(search.toLowerCase().trim())), [modules, search]);

  return (
    <section className="role-permission-matrix">
      <label className="role-permission-search">
        <Search size={16} aria-hidden="true" />
        <input value={search} onChange={event => setSearch(event.target.value)}
          placeholder="Find a module…" aria-label="Search permission modules" />
      </label>
      <div className="role-permission-modules">
        {filtered.map(module => {
          const current = permissions[module.key] || {};
          const selected = module.actions.filter(action => Boolean(current[action])).length;
          const allChecked = selected === module.actions.length;
          return (
            <details key={module.key} className="role-permission-module">
              <summary>
                <strong>{module.label}</strong>
                <small>{selected} of {module.actions.length} selected</small>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className="role-permission-module-content">
                <button type="button" disabled={protectedRole}
                  aria-label={`${allChecked ? 'Clear all' : 'Select all'} ${module.label} permissions`}
                  onClick={() => onToggleModule(module.key, !allChecked)}>
                  {allChecked ? 'Clear all' : 'Select all'}
                </button>
                <div className="role-permission-actions">
                  {module.actions.map(action => {
                    const checked = Boolean(current[action]);
                    return (
                      <label key={action} className={checked ? 'is-checked' : ''}>
                        <input type="checkbox" checked={checked} disabled={protectedRole}
                          onChange={() => onToggle(module.key, action)} />
                        <span>{permissionActionLabel(action, module.key)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </details>
          );
        })}
        {!filtered.length && <p className="roles-dashboard-empty">No matching modules.</p>}
      </div>
    </section>
  );
};
