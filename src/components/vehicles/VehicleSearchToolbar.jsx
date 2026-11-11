
import { Search, X } from 'lucide-react';

export const VehicleSearchToolbar = ({ query, onQueryChange, statusFilter, onStatusFilterChange, resultCount, onReset }) => (
  <section className="vehicle-dashboard-toolbar">
    <div className="vehicle-dashboard-search" role="search">
      <Search size={17} aria-hidden="true" />
      <input
        aria-label="Search vehicles"
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search registration, VIN, make/model, customer or phone"
      />
      {query && <button type="button" className="vehicle-dashboard-clear-search" aria-label="Clear vehicle search" onClick={() => onQueryChange('')}><X size={17} aria-hidden="true"/></button>}
    </div>

    <div className="cg-vehicle-toolbar-filters">
      <label className="cg-vehicle-filter">
        <span className="cg-vehicle-sr-only">Filter vehicles by status</span>
        <select aria-label="Filter vehicles by status" value={statusFilter} onChange={event => onStatusFilterChange(event.target.value)}>
          <option value="all">All Vehicles</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive / Archived</option>
          <option value="open-job">Open Jobs</option>
        </select>
      </label>
      {(query.trim() || statusFilter !== 'all') && <button type="button"
        className="cg-vehicle-reset" onClick={onReset}>Reset</button>}
    </div>
    <div className="vehicle-dashboard-result-count" role="status" aria-live="polite">
      <strong>{resultCount}</strong> <span>vehicles</span>
    </div>
  </section>
);
