
import { BarChart3, Layers3, LayoutDashboard, ReceiptText } from 'lucide-react';

const tabs=[['overview','Overview',LayoutDashboard],['expenses','All Expenses',ReceiptText],['categories','Categories',Layers3],['budgets','Budgets',Layers3],['reports','Reports',BarChart3]];
export const ExpenseTabs=({active,onChange})=><nav className="expense-dashboard-tabs" aria-label="Expense views">{tabs.map(([key,label,Icon])=><button key={key} type="button" aria-current={active===key?'page':undefined} className={active===key?'is-active':''} onClick={()=>onChange(key)}><Icon size={16} aria-hidden="true"/>{label}</button>)}</nav>;
