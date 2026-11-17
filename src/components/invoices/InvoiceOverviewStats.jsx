import { BadgeCheck, FileClock, IndianRupee, ReceiptText, Wallet } from 'lucide-react';
import { billingDirectorySummary } from './invoiceDirectorySummary';

export const InvoiceOverviewStats = ({
  activeTab, documents, calculateTotals, formatMoney,
}) => {
  const summary = billingDirectorySummary(documents, activeTab, calculateTotals);
  const estimates = activeTab === 'estimate';

  const cards = estimates ? [
    { label: 'Total Estimates', value: summary.totalCount, icon: ReceiptText },
    { label: 'Issued / Converted', value: summary.issuedCount, icon: BadgeCheck, tone: 'success' },
    { label: 'Draft Estimates', value: summary.draftCount, icon: FileClock, tone: 'warning' },
    { label: 'Issued Estimate Value', value: formatMoney(summary.issuedValue), icon: IndianRupee },
  ] : [
    { label: 'Total Invoices', value: summary.totalCount,
      meta: summary.draftCount + ' drafts', icon: ReceiptText },
    { label: 'Issued Amount', value: formatMoney(summary.issuedValue),
      meta: summary.issuedCount + ' issued', icon: BadgeCheck },
    { label: 'Payments Received', value: formatMoney(summary.received),
      icon: IndianRupee, tone: 'success' },
    { label: 'Outstanding', value: formatMoney(summary.outstanding),
      icon: Wallet, tone: 'warning' },
  ];

  return (
    <section className="invoice-dashboard-stats" aria-label={estimates ? 'Estimate summary' : 'Invoice summary'}>
      {cards.map(({ label, value, meta, icon: Icon, tone = 'primary' }) => (
        <article key={label} className="invoice-dashboard-stat-card">
          <div className="invoice-dashboard-stat-top">
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
            <i className={'is-' + tone}><Icon size={16} aria-hidden="true"/></i>
          </div>
          {meta && <small>{meta}</small>}
        </article>
      ))}
    </section>
  );
};
