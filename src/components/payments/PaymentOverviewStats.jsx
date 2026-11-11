
import { Banknote, CheckCircle2, Clock3, RotateCcw } from 'lucide-react';

export const PaymentOverviewStats = ({ payments, formatMoney }) => {
  const completed = payments.filter(
    (row) => String(row.status).toLowerCase() === 'completed',
  );
  const pending = payments.filter(
    (row) => String(row.status).toLowerCase() === 'pending',
  );
  const refunded = payments.filter(
    (row) => String(row.status).toLowerCase() === 'refunded',
  );
  const collected = completed.filter(row => (row.direction || 'IN') === 'IN')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const paid = completed.filter(row => row.direction === 'OUT')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const cards = [
    { label: 'All Payments', value: payments.length, meta: 'received and paid', icon: Banknote },
    { label: 'Received', value: formatMoney(collected), meta: 'confirmed money in', icon: CheckCircle2, tone: 'success' },
    { label: 'Paid Out', value: formatMoney(paid), meta: 'confirmed supplier, payroll, expense and other payments', icon: Clock3, tone: 'warning' },
    { label: 'Reversed / Refunded', value: refunded.length + payments.filter(row => String(row.status).toLowerCase() === 'reversed').length, meta: 'audited corrections', icon: RotateCcw, tone: 'danger' },
  ];

  return (
    <section className="payments-dashboard-stats">
      {cards.map(({ label, value, meta, icon: Icon, tone = 'primary' }) => (
        <article key={label} className="payments-dashboard-stat-card">
          <div className="payments-dashboard-stat-top">
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
            <i className={'is-' + tone}><Icon size={15} /></i>
          </div>
          <small>{meta}</small>
        </article>
      ))}
    </section>
  );
};
