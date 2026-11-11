
import { Download, Edit3, Eye, FileText, AlertCircle, RefreshCw, Plus } from 'lucide-react';
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
  onCreate,
  onRetry,
  loadError,
  hasFilters = false,
  onReset,
}) => {
  const { user } = useAuth();
  const canEdit = hasPermission(user, 'invoices.edit');
  const canCreate = hasPermission(user, 'invoices.create');

  return (
    <section className="invoice-dashboard-records">
      <header className="invoice-dashboard-section-title">
        <div>
          <h2>{activeTab === 'estimate' ? 'Estimate Records' : 'Invoice Records'}</h2>
          <p>Customer, vehicle, amount due and current document status.</p>
        </div>
        <span>{documents.length} record{documents.length === 1 ? '' : 's'}</span>
      </header>

      {loading ? (
        <div className="invoice-dashboard-empty" role="status">Loading customer billing documents…</div>
      ) : loadError ? (
        <div className="invoice-dashboard-empty invoice-dashboard-load-error" role="alert">
          <AlertCircle size={22} aria-hidden="true"/>
          <strong>Could not load your billing records</strong>
          <span>{loadError}</span>
          <button type="button" className="bill-btn secondary" onClick={onRetry}>
            <RefreshCw size={16}/> Try Again
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className="invoice-dashboard-empty cg-invoice-empty" role="status">
          <FileText size={28} aria-hidden="true"/>
          <strong>{hasFilters ? 'No matching documents' : activeTab === 'estimate' ? 'No estimates yet' : 'No invoices yet'}</strong>
          <span>{hasFilters
            ? 'Try another document number, customer or status.'
            : activeTab === 'estimate' ? 'Create an estimate to start your quotation records.' : 'Create an invoice to start your billing records.'}</span>
          {hasFilters ? <button type="button" className="bill-btn secondary" onClick={onReset}>
            Clear filters
          </button> : canCreate && <button type="button" className="bill-btn" onClick={onCreate}>
            <Plus size={16}/> {activeTab === 'estimate' ? 'Add Estimate' : 'Create Invoice'}
          </button>}
        </div>
      ) : (
        <>
          <div className="invoice-dashboard-table-wrap" role="region" aria-label="Invoice and estimate records table" tabIndex={0}>
            <table className="invoice-dashboard-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Customer / Vehicle</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Still Due</th>
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
                    <div><span>Still Due</span><strong>{formatMoney(totals.balance)}</strong></div>
                  </div>

                  <div className="invoice-dashboard-mobile-actions">
                    <button type="button" onClick={() => onView(document)}><Eye size={15} /> View</button>
                    <button type="button" onClick={() => onPdf(document)}><Download size={15} /> PDF</button>
                    {canEdit && document.status === 'Draft' && (
                      <button type="button" onClick={() => onEdit(document)}><Edit3 size={15} /> Edit</button>
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
