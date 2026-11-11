import { ArrowDownUp, LayoutGrid, List, X } from 'lucide-react';
import { JOB_SORT_OPTIONS } from './jobDirectorySort';

export function JobDirectoryControls({
  layout = 'auto',
  onLayoutChange,
  sort = 'recent',
  onSortChange,
  activeFilters = [],
  onClearFilter,
  onClearAll,
}) {
  return <section className="jobs-directory-controls" aria-label="Job directory display options">
    <div className="jobs-directory-controls-row">
      <div className="jobs-directory-sort">
        <label htmlFor="jobs-directory-sort"><ArrowDownUp size={16} aria-hidden="true"/> Sort Jobs</label>
        <select id="jobs-directory-sort" value={sort} onChange={event => onSortChange(event.target.value)}>
          {JOB_SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="jobs-directory-layout" role="group" aria-label="Job Card display layout">
        <button type="button" className={layout !== 'cards' ? 'is-active' : ''}
          aria-pressed={layout !== 'cards'} onClick={() => onLayoutChange('auto')}>
          <List size={17} aria-hidden="true"/> Table
        </button>
        <button type="button" className={layout === 'cards' ? 'is-active' : ''}
          aria-pressed={layout === 'cards'} onClick={() => onLayoutChange('cards')}>
          <LayoutGrid size={17} aria-hidden="true"/> Cards
        </button>
      </div>
    </div>
    {activeFilters.length > 0 && <div className="jobs-directory-active-filters"
      aria-label="Applied job filters">
      <span>Applied Filters</span>
      {activeFilters.map(filter => (
        <button type="button" key={filter.key} className="jobs-directory-filter-chip"
          onClick={() => onClearFilter(filter.key)}
          aria-label={`Remove ${filter.name} filter: ${filter.value}`}>
          <strong>{filter.name}:</strong> {filter.value}
          <X size={14} aria-hidden="true"/>
        </button>
      ))}
      <button type="button" className="jobs-directory-clear-all" onClick={onClearAll}>
        Clear all
      </button>
    </div>}
  </section>;
}
