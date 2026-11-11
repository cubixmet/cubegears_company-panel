
import { CircleCheckBig, ClipboardList, Clock3, PackageSearch } from 'lucide-react';

export const JobsStats = ({ counts, onFilter, selectedStatus }) => {
  const cards = [
    { label: 'All Job Cards', value: counts.total, icon: ClipboardList, filter: 'All', tone: 'default' },
    { label: 'Jobs In Progress', value: counts.active, icon: Clock3, filter: 'Active', tone: 'primary' },
    { label: 'Waiting for Parts', value: counts.waiting, icon: PackageSearch, filter: 'Waiting for Parts', tone: 'warning' },
    { label: 'Ready for Delivery', value: counts.ready, icon: CircleCheckBig, filter: 'Ready for Delivery', tone: 'success' },
  ];

  return (
    <section className="jobs-kpi-grid">
      {cards.map(({ label, value, icon: Icon, filter, tone }) => (
        <button
          key={label}
          type="button"
          className={`jobs-kpi-card is-${tone}`}
          onClick={() => onFilter(filter)}
          aria-pressed={selectedStatus === filter}
          aria-label={`Filter ${label.toLowerCase()}: ${value} jobs`}
        >
          <div className="jobs-kpi-top">
            <span className="jobs-kpi-label">{label}</span>
            <span className="jobs-kpi-icon"><Icon size={15} /></span>
          </div>
          <strong>{value}</strong>
          <small>{selectedStatus === filter ? 'Showing selected jobs' : 'Tap to filter'}</small>
        </button>
      ))}
    </section>
  );
};
