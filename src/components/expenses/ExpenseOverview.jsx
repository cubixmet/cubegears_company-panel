
import { ReceiptText, Tags } from 'lucide-react';

export const ExpenseOverview=({expenses,categoryTotals,formatMoney,onOpen})=><section className="expense-dashboard-bottom-grid">
  <article className="expense-dashboard-panel">
    <header className="expense-dashboard-panel-title"><div><h2>Recent Expenses</h2></div><ReceiptText size={15}/></header>
    <div className="expense-dashboard-row-list">{!expenses.length&&<p className="expense-dashboard-empty">No expenses recorded yet.</p>}{expenses.slice(0,6).map(expense=><button key={expense.id} type="button" onClick={()=>onOpen(expense)}><div><strong>{expense.title}</strong><span>{expense.expenseDate} · {expense.vendor}</span></div><b>{formatMoney(expense.amount)}</b></button>)}</div>
  </article>
  <article className="expense-dashboard-panel">
    <header className="expense-dashboard-panel-title"><div><h2>Top Categories</h2></div><Tags size={15}/></header>
    <div className="expense-dashboard-row-list">{!categoryTotals.length&&<p className="expense-dashboard-empty">Categories will appear as expenses are recorded.</p>}{categoryTotals.slice(0,6).map((row)=><div key={row.category}><div><strong>{row.category}</strong></div><b>{formatMoney(row.total)}</b></div>)}</div>
  </article>
</section>;
