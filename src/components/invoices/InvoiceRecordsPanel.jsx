
import { Download, Edit3, Eye, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { invoiceStatusClass } from './invoices.utils';

export const InvoiceRecordsPanel = ({
  documents,
  loading,
  activeTab,
  calculateTotals,
  formatMoney,
  onView,
  onPdf,
  onEdit,
}) => {
  const { user } = useAuth();
  const canEdit = hasPermission(user, 'invoices.edit');

  return (
    <section className="invoice-dashboard-records">
      <header className="invoice-dashboard-section-title">
        <div>
          <h2>{activeTab === 'estimate' ? 'Estimate Records' : 'Invoice Records'}</h2>
          <p>Billing documents, customer details, totals and status.</p>
        </div>
        <span>{documents.length} record{documents.length === 1 ? '' : 's'}</span>
      </header>

      {loading ? (
        <div className="invoice-dashboard-empty">Loading billing documents…</div>
      ) : documents.length === 0 ? (
        <div className="invoice-dashboard-empty">
          <FileText size={14} />
          No {activeTab === 'estimate' ? 'estimates' : 'invoices'} matched your filters.
        </div>
      ) : (
        <>
          <div className="invoice-dashboard-table-wrap">
            <table className="invoice-dashboard-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Customer / Vehicle</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {documents.map((document) => {
                  const totals = calculateTotals(document);
                  return (
                    <tr key={document.id}>
                      <td>
                        <button type="button" onClick={() => onView(document)}>
                          <strong>{document.number || document.id}</strong>
                          <span>{document.jobCardNo || document.id}</span>
                        </button>
                      </td>
                      <td>
                        <strong>{document.customer?.name || 'Walk-in customer'}</strong>
                        <span>
                          {document.vehicle?.registration ||
                            document.transportation?.vehicleNo ||
                            document.customer?.phone ||
                            'No vehicle'}
                        </span>
                      </td>
                      <td>{document.date || '—'}</td>
                      <td><strong>{formatMoney(totals.total)}</strong></td>
                      <td>{formatMoney(totals.balance)}</td>
                      <td>
                        <span className={'invoice-dashboard-status ' + invoiceStatusClass(document.status)}>
                          {document.status || 'Draft'}
                        </span>
                      </td>
                      <td>
                        <div className="invoice-dashboard-actions">
                          <button type="button" title="View" aria-label={`View ${document.number || document.id}`} onClick={() => onView(document)}><Eye size={13} /></button>
                          <button type="button" title="PDF" aria-label={`Download PDF for ${document.number || document.id}`} onClick={() => onPdf(document)}><Download size={13} /></button>
                          {canEdit && document.status === 'Draft' && (
                            <button type="button" title="Edit" aria-label={`Edit ${document.number || document.id}`} onClick={() => onEdit(document)}><Edit3 size={13} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="invoice-dashboard-mobile-list">
            {documents.map((document) => {
              const totals = calculateTotals(document);
              return (
                <article key={document.id} className="invoice-dashboard-mobile-card">
                  <div className="invoice-dashboard-mobile-head">
                    <div>
                      <strong>{document.number || document.id}</strong>
                      <span>{document.customer?.name || 'Walk-in customer'}</span>
                    </div>
                    <span className={'invoice-dashboard-status ' + invoiceStatusClass(document.status)}>
                      {document.status || 'Draft'}
                    </span>
                  </div>

                  <div className="invoice-dashboard-mobile-meta">
                    <div><span>Date</span><strong>{document.date || '—'}</strong></div>
                    <div><span>Vehicle</span><strong>{document.vehicle?.registration || document.transportation?.vehicleNo || '—'}</strong></div>
                    <div><span>Total</span><strong>{formatMoney(totals.total)}</strong></div>
                    <div><span>Balance</span><strong>{formatMoney(totals.balance)}</strong></div>
                  </div>

                  <div className="invoice-dashboard-mobile-actions">
                    <button type="button" onClick={() => onView(document)}><Eye size={12} /> View</button>
                    <button type="button" onClick={() => onPdf(document)}><Download size={12} /> PDF</button>
                    {canEdit && document.status !== 'Converted' && (
                      <button type="button" onClick={() => onEdit(document)}><Edit3 size={12} /> Edit</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
