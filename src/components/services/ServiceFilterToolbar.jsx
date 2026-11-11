
import { Search, X } from 'lucide-react';

export const ServiceFilterToolbar = ({ query,onQueryChange,categoryFilter,onCategoryChange,statusFilter,onStatusChange,categories,onReset }) => (
  <section className="service-dashboard-toolbar cg-service-filters" aria-label="Search and filter workshop services">
    <div className="cg-service-toolbar-row">
      <label className="service-dashboard-search">
        <Search size={18} aria-hidden="true"/>
        <input type="search" aria-label="Search services" value={query}
          onChange={e=>onQueryChange(e.target.value)}
          placeholder="Search service name, code or category…"/>
        {query && <button type="button" className="cg-service-search-clear"
          onClick={()=>onQueryChange('')} aria-label="Clear service search">
          <X size={17} aria-hidden="true"/>
        </button>}
      </label>
      <div className="cg-service-filter-controls">
        <select aria-label="Filter by service category" value={categoryFilter} onChange={e=>onCategoryChange(e.target.value)}>
          <option value="All">All Categories</option>
          {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select aria-label="Filter by service status" value={statusFilter} onChange={e=>onStatusChange(e.target.value)}>
          <option value="All">All Statuses</option><option>Active</option><option>Inactive</option>
        </select>
        {(query.trim() || categoryFilter !== 'All' || statusFilter !== 'All') &&
          <button type="button" className="cg-service-filter-reset" onClick={onReset}>Reset</button>}
      </div>
    </div>
    {(query.trim() || categoryFilter !== 'All' || statusFilter !== 'All') && (
      <div className="cg-service-filter-chips" aria-label="Active service filters">
        {query.trim() && <button type="button" onClick={()=>onQueryChange('')}
          aria-label="Clear service text search">Search: {query.trim()} <span aria-hidden="true">×</span></button>}
        {categoryFilter !== 'All' && <button type="button" onClick={()=>onCategoryChange('All')}
          aria-label="Clear service category filter">Category: {categoryFilter} <span aria-hidden="true">×</span></button>}
        {statusFilter !== 'All' && <button type="button" onClick={()=>onStatusChange('All')}
          aria-label="Clear service status filter">Status: {statusFilter} <span aria-hidden="true">×</span></button>}
      </div>
    )}
  </section>
);