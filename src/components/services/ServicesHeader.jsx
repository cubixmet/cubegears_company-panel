
import { FolderPlus, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';

export const ServicesHeader = ({ onAdd, onAddCategory }) => {
  const { user } = useAuth();
  return (
    <header className="service-dashboard-header">
      <div className="cg-service-heading">
        <span className="cg-service-eyebrow">WORKSHOP CATALOG</span>
        <h1>Services</h1>
        <p>Service rates, labour charges, categories and checklists.</p>
      </div>
      <div className="service-dashboard-header-actions">
        {hasPermission(user,'services.create') && (
          <>
            <button type="button" className="service-primary-button is-secondary" onClick={onAddCategory}>
              <FolderPlus size={17} aria-hidden="true"/> Add Category
            </button>
            <button type="button" className="service-primary-button" onClick={onAdd}>
              <Plus size={17} aria-hidden="true"/> Add Service
            </button>
          </>
        )}
      </div>
    </header>
  );
};