
import { Eye, ReceiptText } from 'lucide-react';
import { formatPaymentDate, paymentStatusClass } from './payments.utils';

export const PaymentRecordsPanel = ({
  payments,
  loading,
  formatMoney,
  onView,
}) => (
  <section className="payments-dashboard-records">
    <header className="payments-dashboard-section-title">
      <div>
        <h2>Payment Records</h2>
        <p>Customer receipts, spare parts supplier payments, expense and payroll payouts.</p>
      </div>
      <span>{payments.length} record{payments.length === 1 ? '' : 's'}</span>
    </header>

    {loading ? (
      <div className="payments-dashboard-empty">Loading payments…</div>
    ) : payments.length === 0 ? (
      <div className="payments-dashboard-empty">
        <ReceiptText size={14} />
        No payment records matched your filters.
      </div>
    ) : (
      <>
        <div className="payments-dashboard-table-wrap">
          <table className="payments-dashboard-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Party / Related Record</th>
                <th>Date</th>
                <th>Method / Type</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button type="button" onClick={() => onView(row)}>
                      <strong title={String(row.receiptNo || row.id)}>{row.receiptNo || row.id}</strong>
                    </button>
                  </td>
                  <td>
                    <strong>{row.customer || 'Payment party'}</strong>
                    <span>{row.invoice || row.category || 'No related reference'}</span>
                    {row.account && <span>Account: {row.account}</span>}
                    {row.source === 'payment' && row.ledgerPosted === false &&
                      <small role="note">Unlinked legacy ledger — reconciliation needed</small>}
                  </td>
                  <td>{formatPaymentDate(row.date)}</td>
                  <td>{row.method || '—'}<span>{row.category || ''}</span></td>
                  <td>{row.reference || '—'}</td>
                  <td><strong>{row.direction === 'OUT' ? '−' : '+'}{formatMoney(row.amount || 0)}</strong></td>
                  <td>
                    <span className={'payments-dashboard-status ' + paymentStatusClass(row.status)}>
                      {row.status || 'Completed'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="payments-dashboard-view-btn" onClick={() => onView(row)} aria-label={'View payment ' + (row.receiptNo || row.id)}>
                      <Eye size={14} aria-hidden="true" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="payments-dashboard-mobile-list">
          {payments.map((row) => (
            <article key={row.id} className="payments-dashboard-mobile-card">
              <div className="payments-dashboard-mobile-head">
                <div>
                  <strong title={String(row.receiptNo || row.id)}>{row.receiptNo || row.id}</strong>
                  <span>{row.customer || 'Payment party'}</span>
                </div>
                <span className={'payments-dashboard-status ' + paymentStatusClass(row.status)}>
                  {row.status || 'Completed'}
                </span>
              </div>

              <div className="payments-dashboard-mobile-meta">
                <div><span>Related</span><strong>{row.invoice || row.category || '—'}</strong></div>
                <div><span>Account</span><strong>{row.account || 'Not linked'}</strong></div>
                <div><span>Date</span><strong>{formatPaymentDate(row.date)}</strong></div>
                <div><span>Method</span><strong>{row.method || '—'}</strong></div>
                <div><span>{row.direction === 'OUT' ? 'Paid Out' : 'Received'}</span><strong>{formatMoney(row.amount || 0)}</strong></div>
              </div>

              {row.reference && (
                <div className="payments-dashboard-reference">
                  <span>Reference</span>
                  <strong>{row.reference}</strong>
                </div>
              )}

              <button type="button" className="payments-dashboard-mobile-view" onClick={() => onView(row)}>
                <Eye size={15} aria-hidden="true" />
                View Payment
              </button>
            </article>
          ))}
        </div>
      </>
    )}
  </section>
);
