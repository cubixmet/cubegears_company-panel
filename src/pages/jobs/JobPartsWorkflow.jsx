import { appConfirm } from '../../components/common/appDialogs';
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  History,
  PackageCheck,
  PackagePlus,
  RotateCcw,
  Search,
  ShoppingCart,
  FileDown,
  FileUp,
  ShieldCheck,
  X
} from 'lucide-react';
import { stockService } from '../../services/stock.service';
import { financeService } from '../../services/finance.service';
import { jobPartsService } from '../../services/jobParts.service';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const today = () => new Date().toISOString().slice(0, 10);

export function JobPartsWorkflow({ jobId, assignedTo = '', initialPanel = null }) {
  const { user } = useAuth();
  const canApproveOutside = hasPermission(user, 'jobs.view') && hasPermission(user, 'expenses.edit');
  const canCompleteOutside = hasPermission(user, 'jobs.edit') && hasPermission(user, 'expenses.edit');
  const [data, setData] = useState({ lines: [], transactions: [], purchaseOrders: [], canComplete: true, blockingReasons: [] });
  const [stock, setStock] = useState([]);
  const [outsideParts, setOutsideParts] = useState([]);
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [panel, setPanel] = useState(() => initialPanel ? { type: initialPanel } : null);
  const [stockLookup, setStockLookup] = useState('');
  const [qty, setQty] = useState({});
  const [returnQty, setReturnQty] = useState({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [workflow, items, purchases] = await Promise.all([
        jobPartsService.get(jobId),
        stockService.getStockItems(),
        jobPartsService.getOutsideJobParts(jobId)
      ]);
      setData(workflow);
      setStock(Array.isArray(items) ? items : items?.results || []);
      setOutsideParts(purchases);
    } catch (e) {
      setError(e?.message || 'Unable to load parts workflow.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [jobId]);

  const stockMatches = useMemo(() => {
    const term = stockLookup.trim().toLowerCase();
    if (!term) return [];
    return stock.filter((item) => [item.partName, item.sku, item.barcode, item.brand]
      .some((value) => String(value || '').toLowerCase().includes(term))).slice(0, 8);
  }, [stock, stockLookup]);

  const lines = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return data.lines.filter((line) => {
      const matches = !q || [line.partName, line.partNo, line.brand, line.barcode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));

      if (!matches) return false;
      if (tab === 'pending') return line.lineStatus !== 'Cancelled' && line.pendingQty > 0;
      if (tab === 'issued') return line.netIssued > 0;
      if (tab === 'returned') return line.returnedQty > 0;
      return true;
    });
  }, [data.lines, searchTerm, tab]);

  const visibleTransactions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data.transactions;
    return data.transactions.filter((row) =>
      [row.partName, row.type, row.reference, row.createdBy]
        .some((value) => String(value || '').toLowerCase().includes(term))
    );
  }, [data.transactions, searchTerm]);

  const recordCounts = useMemo(() => ({
    pending: data.lines.filter((line) => line.lineStatus !== 'Cancelled' && Number(line.pendingQty) > 0).length,
    issued: data.lines.filter((line) => Number(line.netIssued) > 0).length,
    returned: data.lines.filter((line) => Number(line.returnedQty) > 0).length,
    history: data.transactions.length
  }), [data.lines, data.transactions]);

  const act = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    setNotice('');
    setError('');
    try {
      await fn();
      await load();
      setNotice('Parts records updated successfully.');
      setPanel(null);
    } catch (e) {
      setError(e?.message || 'Action failed.');
    } finally {
      setBusy('');
    }
  };

  const issue = (line) => {
    const value = Number(qty[line.id] || Math.min(line.pendingQty, line.availableQty) || 0);
    if (!Number.isFinite(value) || value <= 0 || value > Number(line.pendingQty) || value > Number(line.availableQty)) {
      setError('Enter a valid issue quantity within the available and pending stock.');
      return;
    }
    return act(`issue-${line.id}`, async () => {
      const result = await jobPartsService.issue(jobId, line.id, value, line.issuedTo || assignedTo);
      setQty((prev) => ({ ...prev, [line.id]: '' }));
      return result;
    });
  };

  const returnPart = (line) => {
    const value = Number(returnQty[line.id] || 0);
    if (!Number.isFinite(value) || value <= 0 || value > Number(line.netIssued)) {
      setError('Enter a positive return quantity not exceeding issued stock.');
      return;
    }
    return act(`return-${line.id}`, async () => {
      const result = await jobPartsService.returnPart(jobId, line.id, value, 'Reusable');
      setReturnQty((prev) => ({ ...prev, [line.id]: '' }));
      return result;
    });
  };

  const outsidePurchaseTotal = outsideParts
    .filter((row) => !row.status || row.status === 'Purchased')
    .reduce((sum, row) => sum + Number(row.totalCost || 0), 0);

  const downloadBill = async (purchase) => {
    if (busy) return;
    setBusy('bill-' + purchase.id);
    setError('');
    try {
      const file = await jobPartsService.downloadOutsidePartBill(jobId, purchase.id);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `supplier-bill-${purchase.invoiceNo || purchase.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError(err?.message || 'Could not download supplier bill.');
    } finally {
      setBusy('');
    }
  };

  const summary = useMemo(() => {
    const active = data.lines.filter((line) => line.lineStatus !== 'Cancelled');
    return {
      parts: active.filter((line) => Number(line.netIssued || 0) > 0).length,
      issued: active.reduce((total, line) => total + Number(line.netIssued || 0), 0),
      selling: active.reduce((total, line) => total + Number(line.netIssued || 0) * Number(line.sellingPrice || 0), 0),
      pending: active.reduce((total, line) => total + Number(line.pendingQty || 0), 0)
    };
  }, [data.lines]);

  return (
    <section className="job-parts-workflow job-parts-refined space-y-4">
      <div className="job-parts-summary-card rounded-xl border border-cg-border bg-cg-surface p-4 shadow-sm md:p-5" aria-label="Parts Overview">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <span className="job-parts-eyebrow">Job Card / Inventory</span>
            <h2 className="job-parts-heading mt-1 text-lg font-bold text-cg-text">Parts Overview</h2>
            <p className="job-parts-subheading mt-1 max-w-2xl text-sm leading-6 text-cg-muted">
              Add required parts, issue stock, order shortages, and track returns.
            </p>
          </div>

          {loading
            ? <span className="job-parts-loading-summary" role="status">Checking parts status…</span>
            : <CompletionGuard canComplete={data.canComplete} reasons={data.blockingReasons} />}
        </div>

        <div className="job-parts-metrics mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric label="Parts Used" value={loading ? '—' : summary.parts} tone="blue" />
          <Metric label="Quantity Issued" value={loading ? '—' : summary.issued} tone="blue" />
          <Metric label="Issued Selling Value" value={loading ? '—' : money.format(summary.selling)} tone="green" />
          <Metric label="Pending Quantity" value={loading ? '—' : summary.pending} tone="amber" />
        </div>
      </div>

      <div className="job-parts-main-card rounded-xl border border-cg-border bg-cg-surface shadow-sm">
        <div className="job-parts-toolbar border-b border-cg-border p-3 md:p-4">
          <div className="job-parts-stock-finder mb-3 rounded-xl border border-cg-border bg-cg-surface-2 p-3">
            <div className="job-parts-finder-head mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="job-parts-finder-title">
                <strong className="text-sm text-cg-text">Find & Add Stock</strong>
                <p>Search your inventory or add a part requirement.</p>
              </div>
              <div className="job-parts-finder-actions">
                <button type="button" className="secondary-button" onClick={() => setPanel({ type: 'outside', partName: stockLookup })}>
                  <ShoppingCart size={15} aria-hidden="true" /> Buy Outside
                </button>
                <button type="button" className="primary-button job-parts-finder-add" onClick={() => setPanel({ type: 'add' })}>
                  <PackagePlus size={15} aria-hidden="true" /> Add Stock Part
                </button>
              </div>
            </div>
            <label className="job-parts-inventory-search relative block min-w-0">
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cg-muted"/>
              <input className="cubegears-input w-full !pl-9" value={stockLookup} onChange={(event) => setStockLookup(event.target.value)} aria-label="Find stock to add" placeholder="Search inventory name, SKU or barcode"/>
            </label>
            {stockLookup.trim() && <div className="job-parts-stock-results mt-2 grid gap-1" role="status">
              {stockMatches.length ? stockMatches.map((item) => {
                const available = Number(item.available ?? (Number(item.onHand || 0) - Number(item.reserved || 0)));
                return <div key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-cg-surface p-2">
                  <div className="min-w-0 flex-1"><strong className="block break-words text-xs text-cg-text">{item.partName}</strong><span className="text-xs text-cg-muted">{item.sku || 'No SKU'} · Available {Math.max(0, available)} · {money.format(item.sellingPrice || 0)}</span></div>
                  <button type="button" className="secondary-button" onClick={() => {
                    setPanel(available > 0 ? { type: 'add', selectedPartId: item.id } : { type: 'outside', partName: item.partName, sku: item.sku || '', sellingPrice: item.sellingPrice || '' });
                    setStockLookup('');
                  }}>
                    {available > 0 ? 'Select' : 'Buy Outside'}
                  </button>
                </div>;
              }) : <div className="job-parts-no-stock">
                <p>No stock match. You can buy the part directly from an outside shop for this Job Card.</p>
                <button type="button" className="secondary-button" onClick={() => setPanel({ type: 'outside', partName: stockLookup })}>
                  <ShoppingCart size={14} aria-hidden="true"/> Buy Outside Shop
                </button>
              </div>}
            </div>}
          </div>
          <div className="job-parts-records-head">
            <div>
              <h3>Parts Records</h3>
              <p>Check pending, issued, returned parts and stock activity.</p>
            </div>
          </div>
          <div className="job-parts-tabs flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter job parts">
            {[
              ['pending', 'Pending Issue'],
              ['issued', 'Issued'],
              ['returned', 'Returned'],
              ['history', 'History']
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`job-parts-tab ${tab === key ? 'is-active' : ''}`}
                aria-pressed={tab === key}
              >
                {label} <span className="job-parts-tab-count">{recordCounts[key]}</span>
              </button>
            ))}
          </div>

          <div className="job-parts-search-row mt-3 flex flex-col gap-2 sm:flex-row">
            <label className="job-parts-record-search relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cg-muted" size={16} />
              <input
                className="cubegears-input !pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === 'history' ? 'Search transaction or part name' : 'Search records by name, SKU or barcode'}
                aria-label="Search job parts"
              />
            </label>
          </div>
        </div>

        {loading && <div className="p-3 text-sm text-cg-muted" role="status">Loading stock and parts records…</div>}
        {notice && <div className="mx-3 mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</div>}
        {error && panel?.type !== 'order' && (
          <div className="mx-3 mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:mx-4">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {tab === 'history' ? (
          <TransactionHistory transactions={visibleTransactions} />
        ) : (
          <>
            <div className="job-parts-table-wrap hidden overflow-x-auto md:block" role="region" aria-label="Job Card parts records" tabIndex={0}>
              <table className="job-parts-record-table">
                <thead>
                  <tr>
                    <th scope="col">Stock</th>
                    <th scope="col">Part</th>
                    <th scope="col">On Hand</th>
                    <th scope="col">Requested</th>
                    <th scope="col">{tab === 'issued' ? 'Issued / Return Qty' : tab === 'returned' ? 'Returned' : 'Issue Qty'}</th>
                    <th scope="col">Pending</th>
                    <th scope="col">Selling</th>
                    <th scope="col" className="job-parts-action-heading">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <PartTableRow
                      key={line.id}
                      line={line}
                      tab={tab}
                      issueQty={qty[line.id] ?? ''}
                      returnQty={returnQty[line.id] ?? ''}
                      onIssueQty={(value) => setQty((p) => ({ ...p, [line.id]: value }))}
                      onReturnQty={(value) => setReturnQty((p) => ({ ...p, [line.id]: value }))}
                      onIssue={() => issue(line)}
                      onReturn={() => returnPart(line)}
                      onOrder={() => setPanel({ type: 'order', line })}
                      onInward={() => {
                        const po = data.purchaseOrders.find((row) => row.lineId === line.id && row.status !== 'Received');
                        setPanel({ type: 'inward', line, po });
                      }}
                      busy={busy}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="job-parts-mobile-list grid gap-3 p-3 md:hidden" aria-label="Job Card parts records">
              {lines.map((line) => (
                <PartMobileCard
                  key={line.id}
                  line={line}
                  tab={tab}
                  issueQty={qty[line.id] ?? ''}
                  returnQty={returnQty[line.id] ?? ''}
                  onIssueQty={(value) => setQty((p) => ({ ...p, [line.id]: value }))}
                  onReturnQty={(value) => setReturnQty((p) => ({ ...p, [line.id]: value }))}
                  onIssue={() => issue(line)}
                  onReturn={() => returnPart(line)}
                  onOrder={() => setPanel({ type: 'order', line })}
                  onInward={() => {
                    const po = data.purchaseOrders.find((row) => row.lineId === line.id && row.status !== 'Received');
                    setPanel({ type: 'inward', line, po });
                  }}
                  busy={busy}
                />
              ))}
            </div>

            {!lines.length && (
              <div className="job-parts-empty p-8 text-center">
                <PackageCheck className="mx-auto text-cg-muted" size={28} />
                <h3 className="mt-3 text-sm font-semibold text-cg-text">
                  {searchTerm.trim() ? 'No matching parts' : tab === 'pending' ? 'No pending parts' : tab === 'issued' ? 'No active issued parts' : 'No returned parts'}
                </h3>
                <p className="mt-1 text-xs text-cg-muted">{searchTerm.trim() ? 'Try another search or clear the search field.' : 'Use Add Part above to select stock or create a pending purchase requirement.'}</p>
              </div>
            )}
          </>
        )}
      </div>

      <section className="job-parts-outside-list" aria-label="Outside shop purchases">
        <div className="job-parts-outside-head">
          <div>
            <h3>Outside Shop Purchases</h3>
            <p>Submit supplier quotations for approval, then attach the bill when purchased. Workshop inventory is unchanged.</p>
            <span className="job-parts-outside-count">{outsideParts.length} {outsideParts.length === 1 ? 'purchase' : 'purchases'}</span>
          </div>
          <div className="job-parts-outside-total">
            <span>Purchase Cost</span>
            <strong>{money.format(outsidePurchaseTotal)}</strong>
          </div>
        </div>
        {outsideParts.length ? (
          <div className="job-parts-outside-records">
            {outsideParts.map((row) => {
              const purchaseStatus = row.status || 'Purchased';
              const purchased = purchaseStatus === 'Purchased';
              const quotedTotal = Number(row.quotedTotal || row.totalCost || 0);
              return (
                <article className="job-parts-outside-record" key={row.id}>
                  <div className="job-parts-outside-info">
                    <div className="job-parts-outside-name">
                      <strong>{row.partName}</strong>
                      <span className={`job-parts-outside-status is-${purchaseStatus.toLowerCase().replace(/\s+/g, '-')}`}>{purchaseStatus}</span>
                    </div>
                    <span>{row.vendor} · Qty {row.quantity} {row.sku ? `· ${row.sku}` : ''}</span>
                    <small>{purchased ? (row.invoiceNo ? `Bill ${row.invoiceNo} · ` : '') + 'Purchased' : 'Supplier quotation pending workflow'} · Quoted {money.format(quotedTotal)}</small>
                    <div className="job-parts-outside-controls">
                      {purchaseStatus === 'Pending Approval' && canApproveOutside && (
                        <>
                          <button type="button" className="primary-button" disabled={Boolean(busy)}
                            onClick={() => act('approve-' + row.id, () => jobPartsService.decideOutsideJobPart(jobId, row.id, 'approve'))}>
                            <ShieldCheck size={14} aria-hidden="true"/> Approve
                          </button>
                          <button type="button" className="secondary-button" disabled={Boolean(busy)}
                            onClick={async () => {
                              if (await appConfirm('Reject this supplier quotation?')) {
                                act('reject-' + row.id, () => jobPartsService.decideOutsideJobPart(jobId, row.id, 'reject'));
                              }
                            }}>Reject</button>
                        </>
                      )}
                      {purchaseStatus === 'Approved' && canCompleteOutside && (
                        <button type="button" className="primary-button" disabled={Boolean(busy)}
                          onClick={() => setPanel({ type: 'outsideComplete', purchase: row })}>
                          <FileUp size={14} aria-hidden="true"/> Upload Bill & Complete
                        </button>
                      )}
                      {purchased && row.billId && (
                        <button type="button" className="secondary-button" disabled={Boolean(busy)}
                          onClick={() => downloadBill(row)}>
                          <FileDown size={14} aria-hidden="true"/> Download Bill
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="job-parts-outside-amount">
                    <strong>{money.format(purchased ? row.totalCost : quotedTotal)}</strong>
                    <span>{purchased ? 'Purchase Cost' : 'Quotation · Not in Total Cost'}</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="job-parts-outside-empty">
            <span className="job-parts-outside-empty-icon" aria-hidden="true"><ShoppingCart size={19}/></span>
            <div>
              <strong>{loading ? 'Loading outside purchases…' : 'No outside purchases yet'}</strong>
              <p>When a part is not available in stock, record a direct shop purchase for this Job Card.</p>
            </div>
            <button type="button" className="secondary-button job-parts-outside-empty-action" onClick={() => setPanel({ type: 'outside', partName: stockLookup })} disabled={loading || Boolean(busy)}>
              <ShoppingCart size={15} aria-hidden="true"/> Buy Outside
            </button>
          </div>
        )}
      </section>

      {panel?.type === 'outside' && (
        <OutsidePartPurchasePanel
          initial={panel}
          error={error}
          onClose={() => setPanel(null)}
          onSave={(payload) => act('outside', () => jobPartsService.buyOutsideJobPart(jobId, payload))}
          busy={busy === 'outside'}
        />
      )}

      {panel?.type === 'outsideComplete' && (
        <OutsidePartCompletionPanel
          purchase={panel.purchase}
          busy={busy === 'completeOutside'}
          error={error}
          onClose={() => setPanel(null)}
          onSave={(form) => act('completeOutside', () => jobPartsService.completeOutsideJobPart(jobId, panel.purchase.id, form))}
        />
      )}

      {panel?.type === 'add' && (
        <AddPartPanel stock={stock} initialPartId={panel.selectedPartId} assignedTo={assignedTo} onClose={() => setPanel(null)}
          onSave={(payload) => act('add', () => jobPartsService.addRequiredPart(jobId, payload))} busy={busy === 'add'} />
      )}

      {panel?.type === 'order' && (
        <OrderPanel line={panel.line} error={error} onClose={() => setPanel(null)}
          onSave={(payload) => act('order', () => jobPartsService.createOrder(jobId, panel.line.id, payload))} busy={busy === 'order'} />
      )}

      {panel?.type === 'inward' && (
        <InwardPanel line={panel.line} po={panel.po} onClose={() => setPanel(null)}
          onSave={(payload) => act('inward', () => {
            if (!panel.po) throw new Error('Create a purchase order before inward.');
            return jobPartsService.inward(jobId, panel.po.id, payload);
          })} busy={busy === 'inward'} />
      )}
    </section>
  );
}

function StockBadge({ line }) {
  const cls = line.stockState === 'Available'
    ? 'bg-emerald-50 text-emerald-700'
    : line.stockState === 'Partial'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700';
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${cls}`}>{line.stockState}</span>;
}

function PartTableRow({ line, tab, issueQty, returnQty, onIssueQty, onReturnQty, onIssue, onReturn, onOrder, onInward, busy }) {
  return (
    <tr className="job-parts-data-row">
      <td className="job-parts-stock-cell"><StockBadge line={line} /></td>
      <td className="job-parts-part-cell">
        <strong className="job-parts-part-name">{line.partName}</strong>
        <span className="job-parts-part-meta">{line.partNo || 'No code'}{line.brand ? ` · ${line.brand}` : ''}</span>
      </td>
      <td className="job-parts-number-cell">{line.qtyOnHand}</td>
      <td className="job-parts-number-cell">{line.requestedQty}</td>
      <td className="job-parts-issue-cell">
        {tab === 'pending' ? (
          <input aria-label={`Issue quantity for ${line.partName}`} className="cubegears-input job-parts-quantity-input !h-9 !w-20 !min-h-9" inputMode="decimal" value={issueQty}
            placeholder={String(Math.min(line.pendingQty, line.availableQty))}
            onChange={(e) => onIssueQty(e.target.value.replace(/[^0-9.]/g, ''))} />
        ) : tab === 'issued' ? (
          <div className="flex items-center gap-2">
            <span>{line.netIssued}</span>
            <input aria-label={`Return quantity for ${line.partName}`} className="cubegears-input job-parts-quantity-input !h-9 !w-20 !min-h-9" inputMode="decimal" value={returnQty}
              placeholder="Return"
              onChange={(e) => onReturnQty(e.target.value.replace(/[^0-9.]/g, ''))} />
          </div>
        ) : line.returnedQty}
      </td>
      <td className="job-parts-number-cell">{line.pendingQty}</td>
      <td className="job-parts-selling-cell">{money.format(line.sellingPrice || 0)}</td>
      <td className="job-parts-action-cell">
        <div className="job-parts-row-actions">
          {tab === 'pending' && line.availableQty > 0 && (
            <button type="button" className="primary-button job-parts-action-button !min-h-9 !px-3 !text-xs" disabled={Boolean(busy)} onClick={onIssue}>
              <PackageCheck size={14}/> Issue
            </button>
          )}
          {tab === 'pending' && line.pendingQty > line.availableQty && (
            <button type="button" className="secondary-button job-parts-action-button !min-h-9 !px-3 !text-xs" disabled={Boolean(busy)} onClick={onOrder}><ShoppingCart size={14} aria-hidden="true"/> Order</button>
          )}
          {tab === 'pending' && (
            <button type="button" className="secondary-button job-parts-action-button !min-h-9 !px-3 !text-xs" disabled={Boolean(busy)} onClick={onInward}><ArrowDownToLine size={14} aria-hidden="true"/> Inward</button>
          )}
          {tab === 'issued' && (
            <button type="button" className="secondary-button job-parts-action-button !min-h-9 !px-3 !text-xs" disabled={Boolean(busy)} onClick={onReturn}>
              <RotateCcw size={14}/> Return
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function PartMobileCard(props) {
  const { line, tab, issueQty, returnQty, onIssueQty, onReturnQty, onIssue, onReturn, onOrder, onInward, busy } = props;
  return (
    <article className="job-parts-mobile-card min-w-0 rounded-xl border border-cg-border bg-cg-surface p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="block break-words text-sm text-cg-text">{line.partName}</strong>
          <span className="text-xs text-cg-muted">{line.partNo || 'No code'}{line.brand ? ` · ${line.brand}` : ''}</span>
        </div>
        <StockBadge line={line} />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl bg-cg-surface-2 p-2">
        <Mini label="On Hand" value={line.qtyOnHand} />
        <Mini label="Requested" value={line.requestedQty} />
        <Mini label="Issued" value={line.netIssued} />
        <Mini label="Pending" value={line.pendingQty} />
      </div>

      <div className="mt-3 flex items-end gap-2">
        {tab === 'pending' && (
          <label className="min-w-0 flex-1 text-[11px] font-semibold text-cg-muted">
            Issue Qty
            <input className="cubegears-input mt-1" inputMode="decimal" value={issueQty}
              placeholder={String(Math.min(line.pendingQty, line.availableQty))}
              onChange={(e) => onIssueQty(e.target.value.replace(/[^0-9.]/g, ''))} />
          </label>
        )}
        {tab === 'issued' && (
          <label className="min-w-0 flex-1 text-[11px] font-semibold text-cg-muted">
            Return Qty
            <input className="cubegears-input mt-1" inputMode="decimal" value={returnQty}
              placeholder={String(line.netIssued)}
              onChange={(e) => onReturnQty(e.target.value.replace(/[^0-9.]/g, ''))} />
          </label>
        )}
        {tab === 'returned' && <div className="flex-1 text-xs text-cg-muted">Returned <strong className="text-cg-text">{line.returnedQty}</strong></div>}
        <div className="text-right"><span className="block text-[10px] text-cg-muted">Selling</span><strong className="text-sm">{money.format(line.sellingPrice || 0)}</strong></div>
      </div>

      <div className="job-parts-mobile-actions mt-3 grid grid-cols-2 gap-2">
        {tab === 'pending' && line.availableQty > 0 && (
          <button className="primary-button !px-2" disabled={busy === `issue-${line.id}`} onClick={onIssue}><PackageCheck size={15}/>Issue</button>
        )}
        {tab === 'pending' && line.pendingQty > line.availableQty && (
          <button className="secondary-button !px-2" onClick={onOrder}><ShoppingCart size={15}/>Order</button>
        )}
        {tab === 'pending' && (
          <button className="secondary-button !px-2" onClick={onInward}><ArrowDownToLine size={15}/>Inward</button>
        )}
        {tab === 'issued' && (
          <button className="secondary-button col-span-2" disabled={busy === `return-${line.id}`} onClick={onReturn}><RotateCcw size={15}/>Return Selected Qty</button>
        )}
      </div>
    </article>
  );
}

function CompletionGuard({ canComplete, reasons }) {
  return (
    <div className={`job-parts-completion min-w-[250px] rounded-[14px] border p-3 ${canComplete ? 'is-clear' : 'is-blocked'}`}>
      <div className="flex items-start gap-2">
        {canComplete ? <CheckCircle2 className="mt-0.5 text-emerald-600" size={18}/> : <AlertTriangle className="mt-0.5 text-amber-600" size={18}/>}
        <div className="min-w-0 flex-1">
          <strong className={`block text-sm ${canComplete ? 'text-emerald-800' : 'text-amber-800'}`}>
            {canComplete ? 'Parts cleared' : 'Job Done blocked'}
          </strong>
          <p className={`mt-0.5 text-xs ${canComplete ? 'text-emerald-700' : 'text-amber-700'}`}>
            {canComplete ? 'No required part quantity is pending.' : reasons.slice(0, 2).map((r) => r.reason).join(' · ')}
          </p>
        </div>
      </div>

    </div>
  );
}

function Metric({ label, value, tone }) {
  const cls = tone === 'green' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : 'text-blue-600';
  return <div className="job-parts-metric rounded-xl bg-cg-surface-2 p-3"><span className="block text-[10px] font-semibold uppercase tracking-wide text-cg-muted">{label}</span><strong className={`mt-1 block text-xl ${cls}`}>{value}</strong></div>;
}

function Mini({ label, value }) {
  return <div><span className="block text-[9px] uppercase tracking-wide text-cg-muted">{label}</span><strong className="text-sm text-cg-text">{value}</strong></div>;
}

function AddPartPanel({ stock, initialPartId = '', assignedTo, onClose, onSave, busy }) {
  const [form, setForm] = useState(() => ({ partId: initialPartId, requestedQty: '1', sellingPrice: stock.find((item) => String(item.id) === String(initialPartId))?.sellingPrice ?? '', issuedTo: assignedTo }));
  const [lookup, setLookup] = useState('');
  const [deferredLookup, setDeferredLookup] = useState('');
  useEffect(() => { const timer = setTimeout(() => setDeferredLookup(lookup), 250); return () => clearTimeout(timer); }, [lookup]);
  const matches = stock.filter((item) => [item.partName, item.sku, item.barcode].some((value) => String(value || '').toLowerCase().includes(deferredLookup.trim().toLowerCase()))).slice(0, 20);
  const chosen = stock.find((item) => String(item.id) === String(form.partId));


  return <Sheet title="Add Required Part" subtitle="Add a stock item required for this Job Card." onClose={onClose}>
    <form className="job-parts-modal-form" onSubmit={(e) => { e.preventDefault(); if (!busy) onSave(form); }}>
      <label className="form-label job-parts-modal-full">Find Inventory Part
        <input className="cubegears-input mt-1" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="Search part name, SKU or barcode" aria-label="Find inventory part"/>
      </label>
      <label className="form-label job-parts-modal-full">Part
        <select className="cubegears-select mt-1" value={form.partId} onChange={(e) => {
          const item = stock.find((x) => String(x.id) === e.target.value);
          setForm({ ...form, partId: e.target.value, sellingPrice: item?.sellingPrice || '' });
        }}>
          <option value="">Select a stock part</option>
          {chosen && !matches.some((item) => String(item.id) === String(chosen.id)) && <option value={chosen.id}>{chosen.partName} · {chosen.sku || "No SKU"}</option>}
          {matches.map((item) => <option key={item.id} value={item.id}>{item.partName} · {item.sku} · Stock {item.onHand}</option>)}
        </select>
      </label>
      <label className="form-label">Part Name<input className="cubegears-input mt-1" readOnly value={chosen?.partName || ""}/></label>
      <label className="form-label">Unit<input className="cubegears-input mt-1" readOnly value={chosen?.unit || "—"}/></label>
      <label className="form-label">Requested Qty<input className="cubegears-input mt-1" inputMode="decimal" value={form.requestedQty} onChange={(e) => setForm({ ...form, requestedQty: e.target.value.replace(/[^0-9.]/g, '') })}/></label>
      <label className="form-label">Selling Price ₹<input className="cubegears-input mt-1" inputMode="decimal" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value.replace(/[^0-9.]/g, '') })}/></label>
      <label className="form-label">Amount ₹<input className="cubegears-input mt-1" readOnly value={(Number(form.requestedQty || 0) * Number(form.sellingPrice || 0)).toFixed(2)}/></label>
      <label className="form-label job-parts-modal-full">Issued To<input className="cubegears-input mt-1" value={form.issuedTo} onChange={(e) => setForm({ ...form, issuedTo: e.target.value })} placeholder="Mechanic / store destination"/></label>
      {chosen && Number(chosen.available ?? (Number(chosen.onHand || 0) - Number(chosen.reserved || 0))) <= 0 && <p className="job-parts-modal-warning job-parts-modal-full" role="status">Out of stock. Save as a pending requirement, then use Order on the Pending Issue tab to purchase it. No stock is deducted until Issue.</p>}
      {chosen && <div className="job-parts-modal-stock-note job-parts-modal-full">Available: <strong className="text-cg-text">{Math.max(0, Number(chosen.onHand || 0) - Number(chosen.reserved || 0))}</strong> · Rack: {chosen.location || '—'} · Cost: {money.format(chosen.costPrice || 0)}</div>}
      <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
      <button className="primary-button" disabled={busy || !form.partId || !(Number(form.requestedQty) > 0) || !Number.isFinite(Number(form.sellingPrice)) || Number(form.sellingPrice) < 0}>{busy ? 'Adding…' : 'Add to Job Card'}</button>
    </form>
  </Sheet>;
}

function OutsidePartPurchasePanel({ initial, onClose, onSave, busy, error }) {
  const [requestId] = useState(() => (
    globalThis.crypto?.randomUUID?.() || `outside-${Date.now()}-${Math.random().toString(36).slice(2)}`
  ));
  const [form, setForm] = useState(() => ({
    partName: initial.partName || '', sku: initial.sku || '',
    vendor: '', invoiceNo: '', quantity: '1',
    unitCost: '', sellingPrice: String(initial.sellingPrice ?? ''), purchaseGstRate: '0'
  }));
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const quantity = Number(form.quantity);
  const cost = Number(form.unitCost);
  const selling = Number(form.sellingPrice);
  const gst = Number(form.purchaseGstRate);
  const valid = !!form.partName.trim() && !!form.vendor.trim() &&
    form.unitCost !== '' && form.sellingPrice !== '' &&
    Number.isFinite(quantity) && quantity > 0 && quantity <= 999999.99 &&
    Number.isFinite(cost) && cost >= 0 && cost <= 999999999.99 &&
    Number.isFinite(selling) && selling >= 0 && selling <= 999999999.99 &&
    Number.isFinite(gst) && gst >= 0 && gst <= 100 && form.purchaseGstRate !== '';
  const submit = (event) => {
    event.preventDefault();
    if (!valid || busy) return;
    onSave({
      requestId, partName: form.partName.trim(), sku: form.sku.trim(),
      vendor: form.vendor.trim(), invoiceNo: form.invoiceNo.trim(),
      quantity: form.quantity, unitCost: form.unitCost,
      sellingPrice: form.sellingPrice, purchaseGstRate: form.purchaseGstRate
    });
  };
  return (
    <Sheet title="Buy Part From Outside Shop" subtitle="Request approval for a supplier quotation. Purchase is not completed yet." onClose={onClose}>
      <form className="job-parts-modal-form job-parts-outside-form" onSubmit={submit}>
        <label className="form-label job-parts-modal-full">Part Name *
          <input className="cubegears-input" required maxLength={160} autoFocus
            value={form.partName} onChange={(e) => set('partName', e.target.value)} placeholder="Part / spare name" />
        </label>
        <label className="form-label job-parts-modal-full">Shop / Supplier Name *
          <input className="cubegears-input" required maxLength={160}
            value={form.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="Outside shop name" />
        </label>
        <label className="form-label">SKU / Part Number
          <input className="cubegears-input" maxLength={80}
            value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Optional" />
        </label>
        <div className="job-parts-approval-note job-parts-modal-full">
          Invoice number and bill file are required after manager approval, when the part is purchased.
        </div>
        <label className="form-label">Quantity *
          <input className="cubegears-input" type="number" required inputMode="decimal"
            min="0.01" step="0.01" max="999999.99"
            value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
        </label>
        <label className="form-label">Purchase Price / Unit (₹) *
          <input className="cubegears-input" type="number" required inputMode="decimal"
            min="0" step="0.01" max="999999999.99"
            value={form.unitCost} onChange={(e) => set('unitCost', e.target.value)} placeholder="Cost from shop" />
        </label>
        <label className="form-label">Purchase GST Rate (%) *
          <input className="cubegears-input" type="number" required min="0" max="100" step="0.01"
            value={form.purchaseGstRate} onChange={event => set('purchaseGstRate', event.target.value)} />
        </label>
        <label className="form-label job-parts-modal-full">Customer Selling Price / Unit (₹) *
          <input className="cubegears-input" type="number" required inputMode="decimal"
            min="0" step="0.01" max="999999999.99"
            value={form.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} placeholder="Selling price" />
        </label>
        <div className="job-parts-outside-calculation job-parts-modal-full">
          <div><span>Purchase Total (incl. GST)</span><strong>{money.format(valid ? quantity * cost * (1 + gst / 100) : 0)}</strong></div>
          <div><span>Customer Value</span><strong>{money.format(valid ? quantity * selling : 0)}</strong></div>
        </div>
        <p className="job-parts-modal-stock-note job-parts-modal-full">
          Submitting this request does not purchase the part or affect Total Cost.
          Manager approval and a supplier bill are required. Workshop inventory stays unchanged.
        </p>
        {error && <p className="job-parts-modal-warning job-parts-modal-full" role="alert">{error}</p>}
        <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="primary-button" disabled={!valid || busy}>
          {busy ? 'Sending Request…' : 'Request Approval'}
        </button>
      </form>
    </Sheet>
  );
}

function OutsidePartCompletionPanel({ purchase, onClose, onSave, busy, error }) {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [paymentType, setPaymentType] = useState('Credit');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accountsError, setAccountsError] = useState('');
  useEffect(() => {
    if (paymentType === 'Credit') {
      setAccountsError('');
      return;
    }
    let active = true;
    setAccountsError('');
    financeService.listAccounts().then(result => {
      if (active) setAccounts(Array.isArray(result) ? result.filter(row => row.isActive !== false) : []);
    }).catch(() => {
      if (active) setAccountsError('Unable to load accounts. Check Finance permissions or choose Credit.');
    });
    return () => { active = false; };
  }, [paymentType]);
  const [unitCost, setUnitCost] = useState(String(purchase.unitCost || ''));
  const [bill, setBill] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const quantity = Number(purchase.quantity);
  const gstRate = Number(purchase.purchaseGstRate || 0);
  const actualTotal = quantity * Number(unitCost) * (1 + gstRate / 100);
  const availableAccounts = accounts.filter(row => row.kind === paymentType);
  const approvedTotal = Number(purchase.quotedTotal || 0);
  const withinApproval = Number.isFinite(actualTotal) &&
    Number(unitCost) >= 0 && actualTotal <= approvedTotal && Number(unitCost) <= 999999999.99;
  const valid = invoiceNo.trim().length > 0 && invoiceNo.trim().length <= 120 &&
    bill && withinApproval && unitCost !== '' &&
    (paymentType === 'Credit' || (availableAccounts.some(account => String(account.id) === accountId)));
  const chooseFile = (file) => {
    setBill(null);
    if (!file) {
      setUploadError('');
      return;
    }
    if (file.size === 0 || file.size > 8 * 1024 * 1024) {
      setUploadError('The supplier bill must be less than 8 MB.');
      return;
    }
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Choose a PDF, JPEG, PNG or WebP invoice.');
      return;
    }
    setUploadError('');
    setBill(file);
  };
  return (
    <Sheet title="Complete Outside Purchase" subtitle="Approved quotation → supplier invoice → actual Job Cost" onClose={onClose}>
      <form className="job-parts-modal-form job-parts-outside-form" onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) onSave({ invoiceNo: invoiceNo.trim(), unitCost, bill, paymentType, accountId });
      }}>
        <div className="job-parts-approval-note job-parts-modal-full">
          <strong>{purchase.partName}</strong>
          <span>{purchase.vendor} · Quantity {purchase.quantity} · Approved maximum {money.format(approvedTotal)}</span>
          <span>Changes above the approved amount need a new quotation and approval.</span>
        </div>
        <label className="form-label job-parts-modal-full">Supplier Bill Number *
          <input className="cubegears-input" required maxLength={120}
            value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)}
            placeholder="Bill / invoice number" />
        </label>
        <label className="form-label job-parts-modal-full">Actual Purchase Price / Unit (₹) *
          <input className="cubegears-input" type="number" inputMode="decimal"
            min="0" max="999999999.99" step="0.01" required
            value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
        </label>
        <div className="job-parts-approval-note job-parts-modal-full">
          Purchase GST: {gstRate}% · Customer invoice uses the separate selling price only.
        </div>
        <label className="form-label">Payment Type *
          <select className="cubegears-select" value={paymentType} onChange={event => {
            setPaymentType(event.target.value); setAccountId('');
          }}>
            <option value="Cash">Cash — pay from cash account</option>
            <option value="Bank">Bank — pay from bank account</option>
            <option value="Credit">Credit — pay supplier later</option>
          </select>
        </label>
        {paymentType !== 'Credit' && (
          <label className="form-label">Pay From Account *
            <select className="cubegears-select" required value={accountId}
              onChange={event => setAccountId(event.target.value)}>
              <option value="">Choose {paymentType.toLowerCase()} account</option>
              {availableAccounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>
        )}
        {accountsError && <p className="job-parts-modal-warning job-parts-modal-full" role="status">{accountsError}</p>}
        <label className="form-label job-parts-modal-full">Supplier Bill (PDF or Image, max 8 MB) *
          <input className="cubegears-input job-parts-file-input" type="file" required
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            onChange={(event) => chooseFile(event.target.files?.[0])} />
        </label>
        <div className="job-parts-outside-calculation job-parts-modal-full">
          <div><span>Approved Quote</span><strong>{money.format(approvedTotal)}</strong></div>
          <div><span>Purchase Cost + GST</span><strong>{money.format(Number.isFinite(actualTotal) ? actualTotal : 0)}</strong></div>
        </div>
        {!withinApproval && <p className="job-parts-modal-warning job-parts-modal-full" role="alert">
          Actual purchase total exceeds the approved quotation. Request a revised approval.
        </p>}
        {paymentType === 'Credit' && <p className="job-parts-modal-stock-note job-parts-modal-full">
          Credit is recorded as an unpaid workshop expense. No bank or cash balance changes until settled.
        </p>}
        {paymentType !== 'Credit' && <p className="job-parts-modal-stock-note job-parts-modal-full">
          After confirming this supplier bill, the selected account is debited by the purchase total including GST.
        </p>}
        {uploadError && <p className="job-parts-modal-warning job-parts-modal-full" role="alert">{uploadError}</p>}
        {error && <p className="job-parts-modal-warning job-parts-modal-full" role="alert">{error}</p>}
        <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="submit" className="primary-button" disabled={!valid || busy}>
          <FileUp size={15} aria-hidden="true"/> {busy ? 'Saving Purchase…' : 'Upload Bill & Mark Purchased'}
        </button>
      </form>
    </Sheet>
  );
}

function OrderPanel({ line, error, onClose, onSave, busy }) {
  const [form, setForm] = useState({ vendor: line.stockItem?.supplier || '', type: 'Cash', orderDate: today(), orderedQty: String(line.pendingQty), unitCost: String(line.stockItem?.costPrice || ''), discount: '0', tax: '18' });
  const errorRef = useRef(null);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    if (!error) return;
    requestAnimationFrame(() => {
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
      });
    });
  }, [error]);
  return <Sheet title="Create Purchase Order" subtitle={`${line.partName} · ${line.pendingQty} pending`} onClose={onClose}>
    <form className="job-parts-modal-form" onSubmit={(e) => { e.preventDefault(); onSave({ ...form, vendor: form.vendor.trim() }); }}>
      {error && <p ref={errorRef} className="job-parts-modal-warning job-parts-modal-full" role="alert" tabIndex={-1}>{error}</p>}
      <div className="job-parts-modal-stock-note job-parts-modal-full">
        <strong>{line.pendingQty} still needed</strong><br />
        Stock updates after you record the delivery in Inward / Goods Receipt.
      </div>
      <label className="form-label job-parts-modal-full">Supplier / Vendor *<input className="cubegears-input mt-1" name="vendor" autoComplete="organization" required maxLength={120} value={form.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="Enter supplier name"/></label>
      <label className="form-label">Payment Type<select className="cubegears-select mt-1" name="type" value={form.type} onChange={(e) => set('type', e.target.value)}><option>Cash</option><option>Credit</option></select></label>
      <label className="form-label">Order Date *<input name="orderDate" type="date" required className="cubegears-input mt-1" value={form.orderDate} onChange={(e) => set('orderDate', e.target.value)}/></label>
      <label className="form-label">Order Quantity *<input name="orderedQty" className="cubegears-input mt-1" type="number" inputMode="decimal" min="0.01" step="0.01" required value={form.orderedQty} onChange={(e) => set('orderedQty', e.target.value)}/></label>
      <label className="form-label">Unit Cost (₹) *<input name="unitCost" className="cubegears-input mt-1" type="number" inputMode="decimal" min="0" step="0.01" required value={form.unitCost} onChange={(e) => set('unitCost', e.target.value)} placeholder="Enter supplier price"/></label>
      <label className="form-label">Discount (%)<input name="discount" className="cubegears-input mt-1" type="number" inputMode="decimal" min="0" max="100" step="0.01" value={form.discount} onChange={(e) => set('discount', e.target.value)}/></label>
      <label className="form-label">GST Rate (%)<input name="tax" className="cubegears-input mt-1" type="number" inputMode="decimal" min="0" max="100" step="0.01" value={form.tax} onChange={(e) => set('tax', e.target.value)}/></label>
      <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
      <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create Purchase Order'}</button>
    </form>
  </Sheet>;
}

function InwardPanel({ line, po, onClose, onSave, busy }) {
  const openQty = po ? Math.max(0, Number(po.orderedQty || 0) - Number(po.receivedQty || 0)) : 0;
  const [form, setForm] = useState({ inwardQty: String(openQty || line.pendingQty || 1), billNo: '', billDate: today(), taxType: 'GST', rack: line.stockItem?.location || '', barcode: '' });
  return <Sheet title="Inward / Goods Receipt" subtitle={po ? `${po.poNo} · ${po.vendor}` : 'Create an order first for this shortage.'} onClose={onClose}>
    {!po ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No open purchase order found for this part.</div> :
    <form className="job-parts-modal-form" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <label className="form-label">Vendor<input className="cubegears-input mt-1" value={po.vendor} disabled/></label>
      <label className="form-label">Inward Qty *<input className="cubegears-input mt-1" inputMode="decimal" value={form.inwardQty} onChange={(e) => setForm({ ...form, inwardQty: e.target.value.replace(/[^0-9.]/g, '') })}/></label>
      <label className="form-label">Bill No.<input className="cubegears-input mt-1" value={form.billNo} onChange={(e) => setForm({ ...form, billNo: e.target.value })}/></label>
      <label className="form-label">Bill Date *<input type="date" required className="cubegears-input mt-1" value={form.billDate} onChange={(e) => setForm({ ...form, billDate: e.target.value })}/></label>
      <label className="form-label">Tax Type<select className="cubegears-select mt-1" value={form.taxType} onChange={(e) => setForm({ ...form, taxType: e.target.value })}><option>GST</option><option>Non-GST</option></select></label>
      <label className="form-label">Rack / Bin<input className="cubegears-input mt-1" value={form.rack} onChange={(e) => setForm({ ...form, rack: e.target.value })}/></label>
      <label className="form-label job-parts-modal-full">Barcode / Serial<input className="cubegears-input mt-1" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Leave blank to auto-generate"/></label>
      <div className="job-parts-modal-stock-note job-parts-modal-full">Open PO Qty: <strong className="text-cg-text">{openQty}</strong> · Unit Cost: {money.format(po.unitCost || 0)}</div>
      <button className="primary-button job-parts-modal-full" disabled={busy}>{busy ? 'Posting…' : 'Post Inward'}</button>
    </form>}
  </Sheet>;
}

function Sheet({ title, subtitle, onClose, children }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('[data-parts-close]')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current?.();
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]'
      ) || [])].filter((node) => node.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="job-parts-modal-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeRef.current?.();
    }}>
      <section
        ref={dialogRef}
        className="job-parts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
      >
        <header className="job-parts-dialog-header">
          <div className="job-parts-dialog-heading">
            <h3 id={titleId}>{title}</h3>
            <p id={subtitleId}>{subtitle}</p>
          </div>
          <button type="button" data-parts-close className="job-parts-dialog-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} aria-hidden="true"/>
          </button>
        </header>
        <div className="job-parts-dialog-content">{children}</div>
      </section>
    </div>,
    document.body
  );
}

function TransactionHistory({ transactions }) {
  if (!transactions.length) return <div className="p-8 text-center text-sm text-cg-muted">No part transactions yet.</div>;
  return (
    <div className="divide-y divide-cg-border">
      {transactions.map((row) => (
        <div key={row.id} className="flex gap-3 p-4">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-cg-surface-2 text-cg-primary"><History size={16}/></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm text-cg-text">{row.type} · {row.partName}</strong>
              <span className="text-xs font-semibold text-cg-text">Qty {row.qty}</span>
            </div>
            <p className="mt-1 text-xs text-cg-muted">{row.reference || row.id} · {row.createdBy || 'User'} {row.createdAt ? ` · ${new Date(row.createdAt).toLocaleString('en-IN')}` : ''}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default JobPartsWorkflow;
