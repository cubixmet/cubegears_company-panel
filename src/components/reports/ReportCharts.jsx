import { useState } from "react";
import { BarChart3, TrendingUp, Wallet, Layers3 } from 'lucide-react';
import { reportMoney, reportShortMoney } from '../../pages/reports/reportsDashboard.utils';

const SERIES = [
  { key: 'billed', label: 'Billed', className: 'is-billed' },
  { key: 'collected', label: 'Collected', className: 'is-collected' },
  { key: 'expenses', label: 'Expenses', className: 'is-expenses' },
];

export function ReportPerformanceChart({ buckets, report, from, to }) {
  const [selected, setSelected] = useState(null);
  const valid = buckets.filter((row) => SERIES.some(({ key }) => Number(row[key]) > 0));
  const max = Math.max(0, ...buckets.flatMap((row) => SERIES.map(({ key }) => Number(row[key]) || 0)));
  const active = buckets[selected] || null;

  return (
    <section className="report-chart-card" aria-labelledby="report-performance-title">
      <div className="report-chart-heading">
        <div className="report-chart-heading__label">
          <span className="report-chart-kicker"><TrendingUp size={14}/> BUSINESS PERFORMANCE</span>
          <h3 id="report-performance-title">Customer Bills, Payments & Expenses</h3>
          <p>Compare customer invoices, payments received and workshop expenses for these dates.</p>
        </div>
        <span className="report-chart-pill"><BarChart3 size={15}/> {valid.length} active periods</span>
      </div>
      <div className="report-chart-legend" aria-label="Chart legend">
        {SERIES.map((series) => (
          <span key={series.key}><i className={series.className}/>{series.label}</span>
        ))}
      </div>
      {max > 0 && buckets.length ? (
        <>
          <div className="report-performance-visual">
            <div className="report-chart-yaxis" aria-hidden="true">
              {[1, .75, .5, .25, 0].map((fraction) => (
                <span key={fraction}>{reportShortMoney(max * fraction)}</span>
              ))}
            </div>
            <div className="report-performance-scroll">
              <div className="report-performance-plot" role="group"
                aria-label={'Billed, collected, and expenses chart from ' + from + ' to ' + to}
                style={{ '--chart-columns': buckets.length }}>
                <div className="report-chart-grid-lines" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((idx) => <span key={idx}/>)}
                </div>
                <div className="report-performance-bars">
                  {buckets.map((bucket, index) => (
                    <button type="button" key={bucket.key}
                      className={'report-performance-group' + (selected === index ? ' is-selected' : '')}
                      aria-label={bucket.label + ': billed ' + reportMoney(bucket.billed) +
                        ', collected ' + reportMoney(bucket.collected) + ', expenses ' + reportMoney(bucket.expenses)}
                      aria-pressed={selected === index}
                      title={bucket.label + ' · billed ' + reportMoney(bucket.billed) +
                        ' · collected ' + reportMoney(bucket.collected) +
                        ' · expenses ' + reportMoney(bucket.expenses)}
                      onClick={() => setSelected(selected === index ? null : index)}
                      onFocus={() => setSelected(index)}>
                      <span className="report-performance-bar-pair">
                        {SERIES.map((series) => (
                          <span key={series.key}
                            className={'report-performance-bar ' + series.className}
                            style={{ height: Math.max(0, (bucket[series.key] / max) * 100) + '%' }}/>
                        ))}
                      </span>
                      <span className="report-performance-label">{bucket.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="report-performance-detail" aria-live="polite">
            {active ? (
              <>
                <strong>{active.label}</strong>
                <span>Billed {reportMoney(active.billed)}</span>
                <span>Collected {reportMoney(active.collected)}</span>
                <span>Expenses {reportMoney(active.expenses)}</span>
              </>
            ) : <span>Select or tap a bar to view exact figures.</span>}
          </div>
        </>
      ) : (
        <div className="report-chart-empty">
          <BarChart3 size={29} aria-hidden="true"/>
          <strong>No financial activity for this period</strong>
          <span>Recorded invoices, collections, and expenses will appear here.</span>
        </div>
      )}
      <div className="report-chart-footnote">
        <span><Wallet size={14}/> After paid operating expenses</span>
        <strong>{report.available.payments && report.available.expenses
          ? reportMoney(report.netCash) : '—'}</strong>
        <small>Customer payments minus paid operating expenses only. Not profit; excludes salaries and supplier payments.</small>
      </div>
    </section>
  );
}

export function ReportExpenseCategoryChart({ rows, expensesAvailable }) {
  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const first = rows.slice(0, 6);
  const max = Math.max(1, ...first.map((row) => row.total || 0));
  return (
    <section className="report-chart-card" aria-labelledby="report-expense-title">
      <div className="report-chart-heading">
        <div className="report-chart-heading__label">
          <span className="report-chart-kicker"><Layers3 size={14}/> SPENDING BREAKDOWN</span>
          <h3 id="report-expense-title">Expenses by Category</h3>
          <p>Recorded operating expenses by category; some bills may be unpaid.</p>
        </div>
        <span className="report-chart-pill">{rows.length} categories</span>
      </div>
      {expensesAvailable && total > 0 ? (
        <div className="report-category-chart">
          {first.map((row) => (
            <div className="report-category-chart-row" key={row.category}>
              <div className="report-category-chart-row__top">
                <strong title={row.category}>{row.category}</strong>
                <span>{reportMoney(row.total)}</span>
              </div>
              <div className="report-category-chart-track"
                role="meter" aria-label={row.category + ' expense'}
                aria-valuemin={0} aria-valuemax={max} aria-valuenow={row.total}>
                <span style={{ width: Math.max(0, 100 * row.total / max) + '%' }}/>
              </div>
            </div>
          ))}
          {rows.length > 6 && <p className="report-category-more">
            +{rows.length - 6} more categories in the expense report
          </p>}
          <div className="report-category-total">
            <span>Category expenses total</span>
            <strong>{reportMoney(total)}</strong>
          </div>
        </div>
      ) : (
        <div className="report-chart-empty">
          <Layers3 size={29} aria-hidden="true"/>
          <strong>{expensesAvailable ? 'No expenses recorded' : 'Expense data unavailable'}</strong>
          <span>{expensesAvailable ? 'The category chart will populate when records are added.' :
            'Retry loading the expenses report.'}</span>
        </div>
      )}
    </section>
  );
}
