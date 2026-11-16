import { CalendarDays, Filter, Search, X } from 'lucide-react';

export const InvoiceFilterToolbar = ({
  query, onQueryChange, status, onStatusChange, statuses, resultCount, onReset,
  from, onFromChange, to, onToChange, sort, onSortChange,
  placeholder = 'Search invoice number, customer, phone, vehicle or job',
}) => {
  const activeFilters = Boolean(query.trim() || status !== 'All' || from || to || sort !== 'newest');
  return (
    <section className="invoice-dashboard-toolbar cg-invoice-toolbar"
      aria-label="Search and filter invoices and estimates">
      <div className="cg-invoice-filter-row">
        <label className="invoice-dashboard-search">
          <Search size={18} aria-hidden="true"/>
          <input type="search" aria-label="Search billing records"
            value={query} onChange={event => onQueryChange(event.target.value)}
            placeholder={placeholder}/>
          {query && <button type="button" className="cg-invoice-search-clear"
            aria-label="Clear document search" onClick={() => onQueryChange('')}>
            <X size={17} aria-hidden="true"/>
          </button>}
        </label>
        <label className="invoice-dashboard-status-filter">
          <Filter size={17} aria-hidden="true"/>
          <select aria-label="Filter documents by status" value={status}
            onChange={event => onStatusChange(event.target.value)}>
            <option value="All">All Statuses</option>
            {statuses.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <div className="invoice-dashboard-result-count" role="status" aria-live="polite">
          <span>Records</span><strong>{resultCount}</strong>
        </div>
      </div>
      <div className="cg-invoice-filter-secondary">
        <div className="cg-invoice-date-filter">
          <CalendarDays size={16} aria-hidden="true"/>
          <label htmlFor="invoice-filter-from">From</label>
          <input id="invoice-filter-from" type="date" aria-label="Invoice start date"
            value={from} max={to || undefined}
            onChange={event => onFromChange(event.target.value)}/>
        </div>
        <div className="cg-invoice-date-filter">
          <CalendarDays size={16} aria-hidden="true"/>
          <label htmlFor="invoice-filter-to">To</label>
          <input id="invoice-filter-to" type="date" aria-label="Invoice end date"
            value={to} min={from || undefined}
            onChange={event => onToChange(event.target.value)}/>
        </div>
        <label className="cg-invoice-sort-filter">
          <span>Sort</span>
          <select aria-label="Sort billing documents" value={sort}
            onChange={event => onSortChange(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="number">Document number</option>
          </select>
        </label>
        {activeFilters && <button type="button" className="cg-invoice-reset"
          onClick={onReset}>Clear Filters</button>}
      </div>
      {activeFilters && <div className="cg-invoice-active-filters" aria-label="Active billing filters">
        {query.trim() && <button type="button" onClick={() => onQueryChange('')}
          aria-label="Clear document text filter">Search: {query.trim()} <span aria-hidden="true">×</span></button>}
        {status !== 'All' && <button type="button" onClick={() => onStatusChange('All')}
          aria-label="Clear document status filter">Status: {status} <span aria-hidden="true">×</span></button>}
        {from && <button type="button" onClick={() => onFromChange('')}
          aria-label="Clear from date">From: {from} <span aria-hidden="true">×</span></button>}
        {to && <button type="button" onClick={() => onToChange('')}
          aria-label="Clear to date">To: {to} <span aria-hidden="true">×</span></button>}
        {sort !== 'newest' && <button type="button" onClick={() => onSortChange('newest')}
          aria-label="Reset document sorting">Sort: {sort === 'oldest' ? 'Oldest' : 'Document number'} <span aria-hidden="true">×</span></button>}
      </div>}
    </section>
  );
};
