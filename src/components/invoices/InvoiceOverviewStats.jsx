import { BadgeCheck, FileClock, IndianRupee, ReceiptText, Wallet } from 'lucide-react';
import { billingDirectorySummary } from './invoiceDirectorySummary';

export const InvoiceOverviewStats = ({
  activeTab, documents, calculateTotals, formatMoney,
}) => {
  const summary = billingDirectorySummary(documents, activeTab, calculateTotals);
  const estimates = activeTab === 'estimate';

  const cards = estimates ? [
    { label: 'Total Estimates', value: summary.totalCount, meta: 'All saved quotations', icon: ReceiptText },
    { label: 'Issued / Converted', value: summary.issuedCount, meta: 'Excludes drafts and cancelled', icon: BadgeCheck, tone: 'success' },
    { label: 'Draft Estimates', value: summary.draftCount, meta: 'Not issued yet', icon: FileClock, tone: 'warning' },
    { label: 'Issued Estimate Value', value: formatMoney(summary.issuedValue),
      meta: 'Quotation value, not income or cash received', icon: IndianRupee },
  ] : [
    { label: 'Total Invoices', value: summary.totalCount,
      meta: summary.draftCount + ' drafts · including historical records', icon: ReceiptText },
    { label: 'Issued Amount', value: formatMoney(summary.issuedValue),
      meta: summary.issuedCount + ' issued invoices · excludes drafts and cancellations', icon: BadgeCheck },
    { label: 'Payments Received', value: formatMoney(summary.received),
      meta: 'Paid amounts from issued invoices', icon: IndianRupee, tone: 'success' },
    { label: 'Outstanding', value: formatMoney(summary.outstanding),
      meta: 'Unpaid balance on issued invoices', icon: Wallet, tone: 'warning' },
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
          <small>{meta}</small>
        </article>
      ))}
    </section>
  );
};
