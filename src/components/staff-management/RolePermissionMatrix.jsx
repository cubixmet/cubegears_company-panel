import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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
          const allChecked = module.actions.every(action => Boolean(current[action]));
          return (
            <article key={module.key} className="role-permission-module">
              <header>
                <div>
                  <strong>{module.label}</strong>
                  <span>{module.actions.filter(action => Boolean(current[action])).length} of {module.actions.length} selected</span>
                </div>
                <button type="button" disabled={protectedRole}
                  onClick={() => onToggleModule(module.key, !allChecked)}>
                  {allChecked ? 'Clear' : 'Select all'}
                </button>
              </header>
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
            </article>
          );
        })}
        {!filtered.length && <p className="roles-dashboard-empty">No matching modules.</p>}
      </div>
    </section>
  );
};
