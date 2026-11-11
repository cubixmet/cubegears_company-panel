import { BookOpen, ChevronDown, CircleHelp, FileText, Wallet, Receipt, Landmark } from 'lucide-react';

const TERMS = [
  {
    title: 'Invoice amount',
    local: 'ബിൽ തുക',
    description: 'Total value of finalized customer invoices. This is not the money you have already received.',
    icon: FileText,
  },
  {
    title: 'Money received',
    local: 'ലഭിച്ച പണം',
    description: 'Completed customer payments minus refunds. Pending or reversed payments are excluded.',
    icon: Wallet,
  },
  {
    title: 'Expenses recorded',
    local: 'രേഖപ്പെടുത്തിയ ചെലവ്',
    description: 'Workshop operating expenses entered for these dates. Some of these bills may still be unpaid.',
    icon: Receipt,
  },
  {
    title: 'Customer dues',
    local: 'കിട്ടാനുള്ള പണം',
    description: 'Amount still to be collected on finalized invoices in the selected period.',
    icon: Landmark,
  },
];

export function ReportHelpGuide() {
  return (
    <section className="report-help-guide no-print" aria-label="How to use workshop reports">
      <div className="report-help-steps">
        <span><b>1</b> Choose a month or date range</span>
        <span><b>2</b> Check billed, received and expenses</span>
        <span><b>3</b> Print or save the report as PDF</span>
      </div>
      <details>
        <summary><CircleHelp size={16} aria-hidden="true"/>
          What do these amounts mean? / ഈ തുകകൾ എന്താണ്?
          <ChevronDown size={16} className="report-help-chevron" aria-hidden="true"/>
        </summary>
        <div className="report-help-terms">
          {TERMS.map(({ title, local, description, icon: Icon }) => (
            <div key={title} className="report-help-term">
              <Icon size={17} aria-hidden="true"/>
              <div><strong>{title} <small>· {local}</small></strong><p>{description}</p></div>
            </div>
          ))}
        </div>
        <p className="report-help-disclaimer"><BookOpen size={15} aria-hidden="true"/>
          “Cash after operating expenses” is not business profit or your account balance.
          Supplier and salary payments are outside this simplified figure.
        </p>
      </details>
    </section>
  );
}
