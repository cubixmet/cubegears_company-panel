import { CircleHelp, FileCheck2, FileUp, ShieldAlert, ChevronDown } from 'lucide-react';

const topics = [
  {
    title: 'GSTR-1 · Sales / വിൽപ്പന',
    body: 'Check the finalized GST invoices issued to customers. The list is preparation data, not an uploaded return.',
  },
  {
    title: 'GSTR-3B · GST Summary / നികുതി സംഗ്രഹം',
    body: 'Review recorded sales tax and internally approved input tax credit. The displayed gap is not a confirmed payable amount.',
  },
  {
    title: 'GSTR-2B · Purchase Matching / വാങ്ങലുകൾ',
    body: 'Upload the official GSTR-2B JSON to compare supplier bills. A successful match does not approve tax credit automatically.',
  },
  {
    title: 'ITC · Tax Credit / ഇൻപുട്ട് ടാക്സ് ക്രെഡിറ്റ്',
    body: 'Record a separate, documented internal eligibility decision. GST rules and official portal records must also be checked.',
  },
  {
    title: 'Exports & Filing / ഫയലിംഗ്',
    body: 'Download working CSV files and save an internal review. Filing and verification happen separately on the GST Portal.',
  },
];

export default function GSTRGuide() {
  return (
    <section className="gstr-guide" aria-label="How to prepare GST reports">
      <div className="gstr-guide-steps">
        <span><b>1</b> Select financial year and month</span>
        <span><b>2</b> Check sales, purchases and tax credits</span>
        <span><b>3</b> Review issues and export preparation data</span>
      </div>
      <details className="gstr-guide-details">
        <summary>
          <CircleHelp size={17} aria-hidden="true" />
          What does each GST section mean? / GST സഹായം
          <ChevronDown size={17} aria-hidden="true" className="gstr-guide-arrow"/>
        </summary>
        <div className="gstr-guide-topics">
          {topics.map(topic => (
            <div className="gstr-guide-topic" key={topic.title}>
              <strong>{topic.title}</strong>
              <p>{topic.body}</p>
            </div>
          ))}
        </div>
      </details>
      <p className="gstr-guide-warning">
        <ShieldAlert size={17} aria-hidden="true"/>
        <span><strong>Important:</strong> This page prepares and reviews workshop GST records.
          <FileCheck2 size={14} aria-hidden="true" className="gstr-inline-icon"/>
          An internal review does not prove the return was filed.
          <FileUp size={14} aria-hidden="true" className="gstr-inline-icon"/>
          Confirm filing and tax payment separately on the official GST Portal.</span>
      </p>
    </section>
  );
}
