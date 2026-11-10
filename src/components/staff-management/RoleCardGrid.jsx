import { Pencil, ShieldCheck, Trash2, Users } from 'lucide-react';

export const RoleCardGrid = ({ roles, countPermissions, onOpen, canManage = false, onDelete }) => (
  <section className="roles-dashboard-grid roles-simple-list" aria-label="Company roles">
    <div className="roles-simple-list-head" aria-hidden="true">
      <span>Role</span><span>Staff</span><span>Permissions</span><span>Status</span><span>Actions</span>
    </div>
    {roles.map(role => (
      <article key={role.id} className="roles-dashboard-card roles-simple-row">
        <div className="roles-simple-title">
          <span className="roles-simple-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
          <div>
            <strong>{role.name}</strong>
            <small>{role.isProtected ? 'Owner · protected' : role.code}</small>
          </div>
        </div>
        <span className="roles-simple-count" data-label="Staff">
          <Users size={15} aria-hidden="true" /> {Number(role.usersCount || 0)}
        </span>
        <span className="roles-simple-count" data-label="Permissions">
          {countPermissions(role.permissions)} allowed
        </span>
        <span className="roles-simple-state" data-label="Status">
          <b className={(role.status || 'Active') === 'Active' ? 'is-active' : 'is-inactive'}>
            {role.status || 'Active'}
          </b>
        </span>
        {canManage && <div className="roles-dashboard-card-actions roles-simple-actions">
          {(
            <>
              <button type="button" onClick={() => onOpen(role)}>
                <Pencil size={14} aria-hidden="true" /> {role.isProtected ? 'View' : 'Edit'}
              </button>
              {!role.isProtected && (
                <button type="button" disabled={Number(role.usersCount) > 0}
                  title={Number(role.usersCount) > 0 ? 'Reassign staff before deleting' : 'Delete role'}
                  onClick={() => onDelete(role)}>
                  <Trash2 size={14} aria-hidden="true" /> Delete
                </button>
              )}
            </>
          )}
        </div>}
      </article>
    ))}
    {!roles.length && <div className="roles-dashboard-empty">No roles match this search.</div>}
  </section>
);
