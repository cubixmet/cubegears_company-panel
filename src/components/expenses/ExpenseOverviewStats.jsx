import { AlertTriangle, Calendar, CheckCircle2, IndianRupee, WalletCards } from 'lucide-react';

export const ExpenseOverviewStats = ({
  currentMonthTotal, approvedTotal, pendingCount, todayTotal,
  paidTotal = 0, outstandingTotal = 0, formatMoney,
}) => {
  const cards = [
    ['Recorded Today', formatMoney(todayTotal), 'expenses dated today', Calendar, 'primary'],
    ['Unpaid Balance', formatMoney(outstandingTotal), 'open approved liabilities', AlertTriangle, 'warning'],
    ['Paid So Far', formatMoney(paidTotal), 'confirmed account settlements', WalletCards, 'success'],
    ['This Month', formatMoney(currentMonthTotal), 'month expenses', IndianRupee, 'primary'],
    ['Approved', formatMoney(approvedTotal), 'approved expenses', CheckCircle2, 'success'],
    ['Pending Approval', pendingCount, 'needs review', AlertTriangle, 'warning'],
  ];
  return <section className="expense-dashboard-stats">{cards.map(([label,value,meta,Icon,tone]) =>
    <article key={label} className="expense-dashboard-stat-card">
      <div className="expense-dashboard-stat-top"><div><span>{label}</span><strong>{value}</strong></div><i className={'is-'+tone}><Icon size={15}/></i></div>
      <small>{meta}</small>
    </article>
  )}</section>;
};