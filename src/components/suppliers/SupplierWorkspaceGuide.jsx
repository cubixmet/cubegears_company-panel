import { BookOpen, CircleHelp, ChevronDown, CreditCard, Landmark, PackageCheck, Wallet } from 'lucide-react';

const topics = [
  {
    title: 'Supplier / സപ്ലയർ',
    body: 'A shop or business that supplies spare parts or other workshop goods. Save their contact and GSTIN once.',
  },
  {
    title: 'Purchase Order / വാങ്ങൽ ഓർഡർ',
    body: 'The order you place for goods. An order is different from a posted supplier purchase bill.',
  },
  {
    title: 'Outstanding / കൊടുക്കാനുള്ള പണം',
    body: 'Money still owed for posted supplier bills. Draft orders are not counted as payable bills.',
  },
  {
    title: 'Supplier Payment / പണം നൽകൽ',
    body: 'Pay a supplier with a selected cash, bank or UPI account. Partial payments reduce only the relevant bill balances.',
  },
  {
    title: 'Return / തിരിച്ചുനൽകൽ',
    body: 'Return purchased goods through the debit-note workflow. Apply credit or record a refund separately.',
  },
];

export function SupplierWorkspaceGuide({ purchaseView = false }) {
  return (
    <section className="cg-supplier-guide" aria-label="Supplier management help">
      <div className="cg-supplier-guide-steps">
        <span><b>1</b> {purchaseView ? 'Filter purchase orders and bills' : 'Add or select a supplier'}</span>
        <span><b>2</b> {purchaseView ? 'Review each bill and posting status' : 'Record purchases from the supplier details page'}</span>
        <span><b>3</b> {purchaseView ? 'Open supplier details to settle credit' : 'Pay, return, or review outstanding credit'}</span>
      </div>
      <details>
        <summary>
          <CircleHelp size={17} aria-hidden="true"/>
          How does Supplier Management work? / സഹായം
          <ChevronDown size={16} aria-hidden="true" className="cg-supplier-guide-chevron"/>
        </summary>
        <div className="cg-supplier-guide-topics">
          {topics.map(topic => (
            <div key={topic.title}>
              <strong>{topic.title}</strong>
              <p>{topic.body}</p>
            </div>
          ))}
        </div>
      </details>
      <p className="cg-supplier-guide-note">
        <BookOpen size={16} aria-hidden="true"/>
        Purchase orders and posted supplier bills are separate records. Never add them together as one outstanding amount.
      </p>
    </section>
  );
}

export function SupplierOverviewCards({ suppliers, balances, canViewFinance, purchaseBillsError }) {
  const money = value => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  }).format(value);
  const values = balances instanceof Map ? [...balances.values()] : null;
  const sum = key => {
    if (!values) return null;
    const amounts = values.map(row => Number(row?.[key]));
    return amounts.every(Number.isFinite) ? amounts.reduce((a, b) => a + b, 0) : null;
  };
  // Reuse the backend's complete posted-bill balance aggregates. Do not
  // double-count Purchase Orders, advances or unposted draft bills.
  const cards = [
    { title: 'Suppliers', value: String(suppliers.length),
      help: 'Saved supplier contacts', icon: PackageCheck },
    { title: 'Active', value: String(suppliers.filter(s => s.is_active !== false).length),
      help: 'Available for purchases', icon: Landmark },
  ];
  if (canViewFinance) {
    const moneyCards = [
      { title: 'Purchased', field: 'totalPurchases',
        help: 'Total posted supplier bills', icon: PackageCheck },
      { title: 'Paid', field: 'totalPaymentsApplied',
        help: 'Payments applied to posted bills', icon: CreditCard },
      { title: 'To Pay', field: 'outstanding',
        help: 'Remaining posted supplier balance', icon: Wallet },
      { title: 'Advance', field: 'availableAdvance',
        help: 'Unused supplier advance payments', icon: Wallet },
    ];
    for (const card of moneyCards) {
      const amount = sum(card.field);
      cards.push({
        title: card.title, value: amount === null ? 'Unavailable' : money(amount),
        help: purchaseBillsError ? 'Unable to load complete balances' : card.help,
        icon: card.icon,
      });
    }
  }
  return <section className="cg-supplier-overview" aria-label="Supplier summary">
    {cards.map(({ title, value, help, icon: Icon }) => (
      <article key={title} className="cg-supplier-overview-card">
        <div className="cg-supplier-overview-card-top">
          <span>{title}</span><Icon size={19} aria-hidden="true"/>
        </div>
        <strong>{value}</strong>
        <small>{help}</small>
      </article>
    ))}
  </section>;
}
