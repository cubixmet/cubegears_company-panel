import { useEffect, useState } from 'react';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { STATUS_OPTIONS } from './jobs.utils';

export const JobsToolbar = ({
  query, onQueryChange, status, onStatusChange,
  branch = 'all', onBranchChange, branchOptions = [],
  technician = 'all', onTechnicianChange, technicianOptions = [],
  priority = 'all', onPriorityChange, priorityOptions = [],
  from = '', to = '', onFromChange, onToChange,
  resultCount = 0, loading = false, hasError = false, onReset,
}) => {
  const advancedActive = branch !== 'all' || technician !== 'all' || priority !== 'all' || Boolean(from || to);
  const [showAdvanced, setShowAdvanced] = useState(advancedActive);
  useEffect(() => {
    if (advancedActive) setShowAdvanced(true);
  }, [advancedActive]);

  return <section className="jobs-toolbar jobs-toolbar-combined" aria-label="Filter Job Cards">
    <div className="jobs-filter-field jobs-filter-search">
      <label className="jobs-filter-label" htmlFor="jobs-list-search">Search Job Cards</label>
      <div className="jobs-search">
        <Search size={18} aria-hidden="true" />
        <input id="jobs-list-search" type="search" aria-label="Search job cards"
          value={query} onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search job number, customer, vehicle or phone…" />
        {query && <button type="button" className="jobs-search-clear"
          aria-label="Clear job search" onClick={() => onQueryChange('')}>
          <X size={16} aria-hidden="true" />
        </button>}
      </div>
    </div>
    <label className="jobs-filter-field jobs-status-filter jobs-select-filter jobs-filter-status">
      <span className="jobs-filter-label">Status</span>
      <select aria-label="Filter job cards by status" value={status}
        onChange={(event) => onStatusChange(event.target.value)}>
        {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item === 'All' ? 'All Statuses' : item}</option>)}
      </select>
    </label>
    <button type="button" className="jobs-more-filters"
      aria-expanded={showAdvanced} aria-controls="jobs-advanced-filters"
      onClick={() => setShowAdvanced(value => !value)}>
      <SlidersHorizontal size={17} aria-hidden="true"/>
      {showAdvanced ? 'Hide More Filters' : 'More Filters'}
      <ChevronDown size={16} className={showAdvanced ? 'is-open' : ''} aria-hidden="true"/>
    </button>
    <div id="jobs-advanced-filters" className={`jobs-advanced-filters ${showAdvanced ? 'is-open' : ''}`}>
    <label className="jobs-filter-field jobs-status-filter jobs-select-filter jobs-filter-branch">
      <span className="jobs-filter-label">Branch</span>
      <select aria-label="Filter job cards by branch" value={branch}
        onChange={(event) => onBranchChange(event.target.value)}>
        <option value="all">All branches</option>
        {branchOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    <label className="jobs-filter-field jobs-status-filter jobs-select-filter jobs-filter-technician">
      <span className="jobs-filter-label">Technician</span>
      <select aria-label="Filter job cards by technician" value={technician}
        onChange={(event) => onTechnicianChange(event.target.value)}>
        <option value="all">All technicians</option>
        {technicianOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    <label className="jobs-filter-field jobs-status-filter jobs-select-filter jobs-filter-priority">
      <span className="jobs-filter-label">Priority</span>
      <select aria-label="Filter job cards by priority" value={priority}
        onChange={(event) => onPriorityChange(event.target.value)}>
        <option value="all">All priorities</option>
        {priorityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
    <label className="jobs-filter-field jobs-status-filter jobs-date-filter jobs-filter-from">
      <span className="jobs-filter-label">From Date</span>
      <input type="date" aria-label="Job card created from date" value={from}
        max={to || undefined} onChange={(event) => {
          const value = event.target.value;
          if (!value || !to || value <= to) onFromChange(value);
        }} />
    </label>
    <label className="jobs-filter-field jobs-status-filter jobs-date-filter jobs-filter-to">
      <span className="jobs-filter-label">To Date</span>
      <input type="date" aria-label="Job card created to date" value={to}
        min={from || undefined} onChange={(event) => {
          const value = event.target.value;
          if (!value || !from || value >= from) onToChange(value);
        }} />
    </label>
    </div>
    <div className="jobs-toolbar-actions">
      <span className="jobs-filter-label">Matching Records</span>
      <div className="jobs-toolbar-actions-content">
        <strong className="jobs-toolbar-count" aria-live="polite">
          {loading ? 'Loading…' : hasError ? 'Unavailable' : resultCount + ' matching job' + (resultCount === 1 ? '' : 's')}
        </strong>
        <button type="button" className="jobs-filter-reset" onClick={onReset}>Reset Filters</button>
      </div>
    </div>
  </section>;
};
