
import { BadgeCheck, FileClock, IndianRupee, ReceiptText } from 'lucide-react';

export const InvoiceOverviewStats = ({
  activeTab,
  documents,
  calculateTotals,
  formatMoney,
}) => {
  const issuedStatuses =
    activeTab === 'estimate'
      ? new Set(['Issued', 'Converted'])
      : new Set(['Finalized', 'Paid']);

  const totalValue = documents.reduce(
    (sum, document) => sum + Number(calculateTotals(document)?.total || 0),
    0,
  );

  const cards = [
    {
      label: activeTab === 'estimate' ? 'Total Estimates' : 'Total Invoices',
      value: documents.length,
      meta: 'all saved documents',
      icon: ReceiptText,
    },
    {
      label: activeTab === 'estimate' ? 'Issued / Converted' : 'Finalized / Paid',
      value: documents.filter((document) => issuedStatuses.has(document.status)).length,
      meta: 'issued or finalized records',
      icon: BadgeCheck,
      tone: 'success',
    },
    {
      label: 'Draft',
      value: documents.filter((document) => document.status === 'Draft').length,
      meta: 'still editable',
      icon: FileClock,
      tone: 'warning',
    },
    {
      label: 'Document Value',
      value: formatMoney(totalValue),
      meta: 'includes drafts and cancelled; not cash received',
      icon: IndianRupee,
    },
  ];

  return (
    <section className="invoice-dashboard-stats">
      {cards.map(({ label, value, meta, icon: Icon, tone = 'primary' }) => (
        <article key={label} className="invoice-dashboard-stat-card">
          <div className="invoice-dashboard-stat-top">
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
