
import { Filter, Search, X } from 'lucide-react';

export const InvoiceFilterToolbar = ({
  query,
  onQueryChange,
  status,
  onStatusChange,
  statuses,
  resultCount,
  onReset,
  placeholder = 'Search invoice number, customer, phone, vehicle or job',
}) => (
  <section className="invoice-dashboard-toolbar cg-invoice-toolbar" aria-label="Search and filter invoices and estimates">
    <div className="cg-invoice-filter-row">
      <label className="invoice-dashboard-search">
        <Search size={18} aria-hidden="true"/>
        <input type="search" aria-label="Search billing records"
          value={query} onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}/>
        {query && <button type="button" className="cg-invoice-search-clear"
          aria-label="Clear document search" onClick={() => onQueryChange('')}>
          <X size={17} aria-hidden="true"/>
        </button>}
      </label>
      <label className="invoice-dashboard-status-filter">
        <Filter size={17} aria-hidden="true"/>
        <select aria-label="Filter documents by status" value={status}
          onChange={(event) => onStatusChange(event.target.value)}>
          <option value="All">All Statuses</option>
          {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      {(query.trim() || status !== 'All') && <button type="button"
        className="cg-invoice-reset" onClick={onReset}>Reset</button>}
      <div className="invoice-dashboard-result-count" role="status" aria-live="polite">
        <span>Matches</span><strong>{resultCount}</strong>
      </div>
    </div>
    {(query.trim() || status !== 'All') && <div className="cg-invoice-active-filters" aria-label="Active billing filters">
      {query.trim() && <button type="button" onClick={() => onQueryChange('')}
        aria-label="Clear document text filter">Search: {query.trim()} <span aria-hidden="true">×</span></button>}
      {status !== 'All' && <button type="button" onClick={() => onStatusChange('All')}
        aria-label="Clear document status filter">Status: {status} <span aria-hidden="true">×</span></button>}
    </div>}
  </section>
);
