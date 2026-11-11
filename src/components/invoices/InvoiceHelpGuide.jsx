import { BookOpen, ChevronDown, CircleHelp, FileCheck2, Printer, Wallet } from 'lucide-react';

export default function InvoiceHelpGuide({ mode = 'invoice' }) {
  const estimate = mode === 'estimate';
  const eway = mode === 'eway';
  const steps = eway
    ? ['Enter sender, recipient and goods', 'Save a local draft', 'Prepare and verify on the official portal']
    : estimate
      ? ['Choose a customer and add work', 'Save or issue the estimate', 'Convert approved estimate to an invoice']
      : ['Choose a customer and add items', 'Save Draft, then finalize the invoice', 'Record the customer payment separately'];

  return (
    <section className="invoice-reading-guide no-print" aria-label="Billing help and next steps">
      <div className="invoice-reading-steps">
        {steps.map((step, index) => (
          <span key={step}><b>{index + 1}</b>{step}</span>
        ))}
      </div>
      <details>
        <summary>
          <CircleHelp size={17} aria-hidden="true"/>
          {eway ? 'E-Way Bill help / സഹായം' : 'How does billing work? / ബില്ലിംഗ് സഹായം'}
          <ChevronDown size={17} aria-hidden="true" className="invoice-reading-chevron"/>
        </summary>
        <div className="invoice-reading-details">
          <p><BookOpen size={16} aria-hidden="true"/>
            <span><strong>Draft:</strong> Keep your details editable. {eway ? 'This is only a local transport document, not an NIC-issued E-Way Bill.' : 'This is not a finalized customer invoice.'}</span></p>
          {!eway && <p><FileCheck2 size={16} aria-hidden="true"/>
            <span><strong>{estimate ? 'Issue estimate:' : 'Finalize:'}</strong> Save the official workshop billing record. Review GST, customer and totals first.</span></p>}
          {!eway && <p><Wallet size={16} aria-hidden="true"/>
            <span><strong>Payment:</strong> Receive or refund money from Finance → Payments. Saving an invoice does not automatically collect money.</span></p>}
          <p><Printer size={16} aria-hidden="true"/>
            <span><strong>Print / PDF:</strong> Open a saved document to print or download its PDF.
              {eway ? ' A local E-Way Bill draft is not an official NIC-issued E-Way Bill.' : ' Downloaded PDFs show saved details, not unsaved form edits.'}</span></p>
        </div>
      </details>
    </section>
  );
}
