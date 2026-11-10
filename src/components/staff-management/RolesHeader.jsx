import { Plus } from 'lucide-react';

export const RolesHeader = ({ onAdd, canManage = false }) => (
  <section className="roles-dashboard-header">
    <div><h2>Roles &amp; Permissions</h2></div>
    {canManage && (
      <div className="roles-dashboard-header-actions">
        <button type="button" className="roles-primary-button" onClick={onAdd}>
          <Plus size={16} aria-hidden="true" /> Add Role
        </button>
      </div>
    )}
  </section>
);
