import { reportMoney } from '../../pages/reports/reportsDashboard.utils';

const money = (number) => reportMoney(number ?? null);
const shortMoney = (amount) => amount == null ? '—' : '₹' + new Intl.NumberFormat('en-IN', {
  notation: 'compact', maximumFractionDigits: 1,
}).format(Number(amount));

const percent = (value) => value === null || value === undefined
  ? '—' : `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(1)}%`;

const formatDate = (value) => value || 'All dates';

const ComparisonRow = ({ label, values, emphasis = false, indent = false }) => (
  <tr className={emphasis ? 'fiscal-row-strong' : indent ? 'fiscal-row-indented' : ''}>
    <th scope="row">{label}</th>
    <td>{money(values?.previous)}</td>
    <td>{money(values?.current)}</td>
    <td>{percent(values?.changePct)}</td>
  </tr>
);

export function ReportFiscalPrint({
  fiscalComparison, companyName, periodLabel, from, to, missingSources = [],
  truncatedSources = [], branch = 'All', staff = 'All',
}) {
  const data = fiscalComparison;
  const ready = data?.available?.invoices === true;
  const quarters = Array.isArray(data?.quarters) ? data.quarters : [];
  const greatest = Math.max(1, ...quarters.flatMap((item) =>
    [Number(item.previous) || 0, Number(item.current) || 0]));
  const isScoped = branch !== 'All' || staff !== 'All';
  return (
    <article className="report-fiscal-print" aria-label="Quarterly sales performance PDF report">
      <div className="report-fiscal-topline">
        <span>{companyName}</span>
        <span>FINANCIAL PERFORMANCE REPORT</span>
      </div>
      <h1>Quarterly Sales Performance in Comparison with Revenue Analysis</h1>
      <p className="report-fiscal-lede">
        Compare billed workshop sales across financial years, with customer collections
        broken down by payment channel. All amounts are in Indian Rupees (INR).
      </p>
      <div className="report-fiscal-meta">
        <span><b>Current:</b> {data?.currentLabel || '—'}</span>
        <span><b>Previous:</b> {data?.previousLabel || '—'}</span>
        <span><b>Selected report:</b> {periodLabel}</span>
      </div>

      <section className="report-fiscal-quarter" aria-labelledby="fiscal-quarter-heading">
        <h2 id="fiscal-quarter-heading">Quarterly sales revenue compared with the previous financial year</h2>
        <div className="report-fiscal-legend">
          <span><i className="fiscal-legend-prior"/>{data?.previousLabel || 'Previous FY'}</span>
          <span><i className="fiscal-legend-current"/>{data?.currentLabel || 'Current FY'}</span>
        </div>
        {ready && quarters.length === 4 ? (
          <div className="report-fiscal-chart">
            {quarters.map((row) => (
              <div key={row.quarter} className="report-fiscal-quarter-column">
                <div className="report-fiscal-bars">
                  {[['previous', 'prior'], ['current', 'current']].map(([field, tone]) => (
                    <div className="report-fiscal-bar-wrap" key={field}>
                      <span className="report-fiscal-bar-value" title={money(row[field])}>
                        {shortMoney(row[field])}
                      </span>
                      <div className={`report-fiscal-bar fiscal-bar-${tone}`}
                        style={{ height: `${Math.max(0, Number(row[field]) || 0) / greatest * 100}%` }} />
                    </div>
                  ))}
                </div>
                <div className="report-fiscal-quarter-caption">
                  <b>{row.quarter}</b>
                  <span>{row.months}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="report-fiscal-empty">
            {data?.available?.invoices === false
              ? 'Sales comparison unavailable: invoice reporting permission is required.'
              : 'Year-on-year sales comparison is unavailable. No figures have been estimated.'}
          </div>
        )}
        <p className="report-fiscal-note">
          Q1 Apr–Jun · Q2 Jul–Sep · Q3 Oct–Dec · Q4 Jan–Mar.
          Billed sales excludes draft, cancelled and void invoices.
        </p>
      </section>

      <section className="report-fiscal-analysis" aria-labelledby="fiscal-analysis-heading">
        <h2 id="fiscal-analysis-heading">Revenue analysis</h2>
        <h3>Annual financial performance</h3>
        <table className="report-fiscal-table">
          <thead>
            <tr><th scope="col">Amounts in INR</th>
              <th scope="col" className="fiscal-table-prior">{data?.previousLabel || 'Previous FY'}</th>
              <th scope="col" className="fiscal-table-current">{data?.currentLabel || 'Current FY'}</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            <ComparisonRow label="Total invoiced sales" values={data?.totals?.invoices} emphasis/>
            <tr className="fiscal-group-row"><th scope="rowgroup" colSpan={4}>Collections by payment channel</th></tr>
            {data?.available?.payments === false
              ? <tr><td colSpan={4} className="report-fiscal-no-access">Customer payment totals unavailable: access restricted.</td></tr>
              : (data?.channels?.length
                ? data.channels.map((row) => (
                  <ComparisonRow key={row.channel} label={row.channel} values={row} indent/>
                ))
                : <tr><td colSpan={4} className="report-fiscal-no-access">No completed customer collections in these years.</td></tr>)}
            <ComparisonRow label="Total customer collections" values={data?.totals?.payments} emphasis/>
            <ComparisonRow label="Recorded operating expenses" values={data?.totals?.expenses}/>
          </tbody>
        </table>
        <p className="report-fiscal-note">
          Collections reflect completed customer payments minus refunds.
          Operating expenses are recorded expense amounts, not necessarily paid out.
          A dash means unavailable or no previous-year baseline—not zero.
        </p>
      </section>
      {(missingSources.length > 0 || truncatedSources.length > 0 || isScoped) && (
        <div className="report-fiscal-caution">
          {missingSources.length > 0 && <p><b>Incomplete selected-period data:</b> {missingSources.join(', ')} unavailable.</p>}
          {truncatedSources.length > 0 && <p><b>Selected-period limit:</b> {truncatedSources.join(', ')} truncated.</p>}
          {isScoped && <p><b>Scope:</b> Comparison above is company-wide. The detailed report below uses
            {branch !== 'All' ? ` branch ${branch}` : ' all branches'}
            {staff !== 'All' ? ` and staff ${staff}` : ''}.</p>}
        </div>
      )}
      <footer className="report-fiscal-foot">
        <span>{companyName} · Prepared with CubixGear</span>
        <span>Selected-period details: {formatDate(from)} to {formatDate(to)}</span>
      </footer>
    </article>
  );
}
