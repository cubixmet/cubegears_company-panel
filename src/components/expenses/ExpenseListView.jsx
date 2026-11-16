import { recordLabel } from '../../utils/recordReferences.js';

import { Edit3, Eye, Layers3, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';

const statusClass=(status='')=>'is-'+String(status).toLowerCase().replace(/[^a-z0-9]+/g,'-');

export const ExpenseListView=({expenses,query,onQueryChange,categoryFilter,onCategoryChange,statusFilter,onStatusChange,categories,formatMoney,onView,onEdit,onDelete})=>{
 const {user}=useAuth(); const canEdit=hasPermission(user,'expenses.edit'); const canDelete=hasPermission(user,'expenses.delete');
 return <>
  <section className="expense-dashboard-toolbar">
    <label className="expense-dashboard-search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="Search expenses" value={query} onChange={e=>onQueryChange(e.target.value)} placeholder="Search title, vendor, ID or reference"/></label>
    <select aria-label="Filter by expense category" value={categoryFilter} onChange={e=>onCategoryChange(e.target.value)}><option>All</option>{categories.map(c=><option key={c}>{c}</option>)}</select>
    <select aria-label="Filter by expense status" value={statusFilter} onChange={e=>onStatusChange(e.target.value)}><option>All</option><option>Approved</option><option>Paid</option><option>Pending Approval</option><option>Draft</option><option>Rejected</option></select>
  </section>
  <div className="expense-card-grid">{expenses.map(expense=><article key={expense.id} className="expense-card">
    <div className="expense-card__head"><div><span>{recordLabel(expense.id)}</span><strong>{expense.title}</strong></div><b className={'expense-status '+statusClass(expense.status)}>{expense.status}</b></div>
    <div className="expense-category-chip"><Layers3 size={12}/>{expense.category}</div>
    <div className="expense-card-values"><div><span>Amount</span><strong>{formatMoney(expense.amount)}</strong></div><div><span>Date</span><strong>{expense.expenseDate}</strong></div><div><span>Payment</span><strong>{expense.paymentMethod}</strong></div></div>
    <div className="expense-vendor"><span>Vendor / Payable To</span><strong>{expense.vendor}</strong></div>
    <div className="expense-card-actions"><button type="button" onClick={()=>onView(expense)}><Eye size={15} aria-hidden="true"/> View</button>{canEdit&&<button type="button" onClick={()=>onEdit(expense)}><Edit3 size={15} aria-hidden="true"/> Edit</button>}{canDelete&&<button type="button" className="is-danger" onClick={()=>onDelete(expense)}><Trash2 size={15} aria-hidden="true"/> Delete</button>}</div>
  </article>)}</div>
  {!expenses.length&&<div className="expense-empty">No expenses matched your filters.</div>}
 </>;
};