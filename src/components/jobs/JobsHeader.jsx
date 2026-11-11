
import { HardHat, History, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';

export const JobsHeader = ({ onNavigate }) => {
  const { user } = useAuth();

  return (
    <header className="jobs-dashboard-header">
      <div>
        <span className="jobs-dashboard-eyebrow">CUBIXGEAR · WORKSHOP OPERATIONS</span>
        <h1>Job Cards</h1>
        <p>Find vehicle jobs, assign staff, follow repair progress, and manage delivery in one place.</p>
      </div>

      <div className="jobs-dashboard-actions">
        {hasPermission(user, 'reports.view') && (
          <button
            type="button"
            className="jobs-secondary-button"
            onClick={() => onNavigate('/jobs/reports')}
          >
            <History size={14} aria-hidden="true" />
            <span>Reports</span>
          </button>
        )}

        {hasPermission(user, 'expenses.view') && (
          <button
            type="button"
            className="jobs-secondary-button jobs-outside-labour-button"
            onClick={() => onNavigate('/jobs/outside-labour')}
          >
            <HardHat size={16} aria-hidden="true" />
            <span>Outside Labour</span>
          </button>
        )}

        {hasPermission(user, 'jobs.create') && (
          <button
            type="button"
            className="jobs-primary-button"
            onClick={() => onNavigate('/jobs/new')}
          >
            <Plus size={14} />
            <span>Create Job Card</span>
          </button>
        )}
      </div>
    </header>
  );
};
