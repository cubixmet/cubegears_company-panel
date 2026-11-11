
import { TrendingUp, IndianRupee, Package, ReceiptText, WalletCards, Landmark } from 'lucide-react';

export const ReportStats = ({ report, formatMoney }) => {
  const cards = [
    ['Invoice Total', report.available.invoices ? formatMoney(report.sales) : '—',
      report.invoiceRows.length + ' completed customer bills (not cash received)', ReceiptText, 'blue'],
    ['Money Received', report.available.payments ? formatMoney(report.collected) : '—',
      report.paymentRows.length + ' completed customer payments, after refunds', WalletCards, 'green'],
    ['Expenses Recorded', report.available.expenses ? formatMoney(report.expenseTotal) : '—',
      report.expenseRows.length + ' recorded costs (including unpaid bills)', IndianRupee, 'orange'],
    ['Collections After Paid Expenses', report.available.payments && report.available.expenses
      ? formatMoney(report.netCash) : '—', 'Customer payments minus paid operating expenses; not profit, excludes salaries and suppliers', TrendingUp, 'purple'],
    ['Customer Dues', report.available.invoices ? formatMoney(report.outstanding) : '—',
      'Still to collect on these customer invoices', Landmark, 'red'],
    ['Stock Cost Value', report.available.stock && report.comparable ? formatMoney(report.stockValue) : '—',
      report.comparable ? report.lowStock.length + ' low-stock items · today’s cost-based stock'
        : 'Not staff / branch scoped', Package, 'neutral'],
  ];
  return (
    <section className="reports-dashboard-stats" aria-label="Report performance summary">
      {cards.map(([label, value, note, Icon, tone]) => (
        <article key={label} className={'is-' + tone}>
          <div className="reports-dashboard-stat-main">
            <span>{label}</span>
            <strong title={value}>{value}</strong>
            <small>{note}</small>
          </div>
          <i aria-hidden="true"><Icon size={19}/></i>
        </article>
      ))}
    </section>
  );
};