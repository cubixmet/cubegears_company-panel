import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ClipboardCheck, RefreshCw } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { USE_MOCK_API } from '../../api/apiConfig';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { branchService } from '../../services/branch.service';
import { stockCatalogService } from '../../services/stockCatalog.service';
import '../../styles/inventory-branch-operations.css';

const rows = (result) => Array.isArray(result) ? result : result?.results || [];
const key = () => globalThis.crypto?.randomUUID?.() ||
  `inventory-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const validQty = (value, allowZero = false) =>
  /^\d+(?:\.\d{1,2})?$/.test(String(value)) &&
  Number.isFinite(Number(value)) && (allowZero ? Number(value) >= 0 : Number(value) > 0);
const errorMessage = (cause) => {
  const data = cause?.response?.data || cause?.data;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const first = Object.values(data).find(Boolean);
    if (typeof first === 'string') return first;
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  }
  return cause?.message || 'Unable to save this inventory transaction.';
};

export default function InventoryBranchOperations({ onChanged }) {
  const { can } = useFeatureAccess();
  const canView = can('stock.view');
  const canEdit = can('stock.edit');
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [balances, setBalances] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [counts, setCounts] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('balances');
  const [transfer, setTransfer] = useState({
    fromBranch: '', toBranch: '', itemId: '', quantity: '', requestKey: key(),
  });
  const [count, setCount] = useState({
    itemId: '', countedQty: '', reason: '', requestKey: key(),
  });

  const refresh = useCallback(async () => {
    if (USE_MOCK_API || !canView) return;
    setLoading(true);
    try {
      const [branchRows, itemRows, stockRows, transferRows, auditRows] = await Promise.all([
        branchService.getBranches(),
        stockCatalogService.getItems(),
        apiClient.get('/stock/branch-balances'),
        apiClient.get('/stock/transfers'),
        apiClient.get('/stock/audit'),
      ]);
      const activeBranches = rows(branchRows).filter((row) => row.is_active !== false);
      setBranches(activeBranches);
      setProducts(rows(itemRows));
      setBalances(rows(stockRows));
      setTransfers(rows(transferRows));
      setCounts(rows(auditRows));
      setTransfer((previous) => ({
        ...previous, fromBranch: previous.fromBranch || activeBranches[0]?.id || '',
      }));
      setError('');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => { refresh(); }, [refresh]);
  const selected = useMemo(() => balances.find((row) =>
    String(row.itemId) === transfer.itemId &&
    String(row.branchId) === transfer.fromBranch,
  ), [balances, transfer.itemId, transfer.fromBranch]);
  const onSubmitTransfer = async (event) => {
    event.preventDefault();
    if (saving || !canEdit || USE_MOCK_API) return;
    if (!transfer.itemId || !transfer.fromBranch || !transfer.toBranch ||
      transfer.fromBranch === transfer.toBranch || !validQty(transfer.quantity)) {
      setError('Select a part, different source/destination branches and a valid quantity.');
      return;
    }
    if (selected && Number(transfer.quantity) > Number(selected.available)) {
      setError('Transfer exceeds available units in the source branch.');
      return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiClient.post('/stock/transfer', transfer);
      setSuccess('Stock transferred with an audited branch-out and branch-in ledger pair.');
      setTransfer((previous) => ({
        ...previous, itemId: '', quantity: '', requestKey: key(),
      }));
      await refresh();
      onChanged?.();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  };
  const onSubmitCount = async (event) => {
    event.preventDefault();
    if (saving || !canEdit || USE_MOCK_API) return;
    if (!count.itemId || !validQty(count.countedQty, true) ||
      count.reason.trim().length < 5) {
      setError('Select an item, a nonnegative count and a reason of at least five characters.');
      return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiClient.post('/stock/audit', count);
      setCount({ itemId: '', countedQty: '', reason: '', requestKey: key() });
      setSuccess('Count reconciled with the inventory ledger for your workshop branch.');
      await refresh();
      onChanged?.();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  };

  if (!canView || USE_MOCK_API) return null;
  return <section className="cg-branch-inventory" aria-label="Live branch inventory operations">
    <div className="cg-branch-heading">
      <div><h2>Branch Stock &amp; Reconciliation</h2>
        <p>Real branch quantities, paired transfers and physical stock counts.</p></div>
      <button type="button" onClick={refresh} disabled={loading || saving}>
        <RefreshCw size={16} aria-hidden="true"/> Refresh
      </button>
    </div>
    {error && <p className="cg-branch-error" role="alert">{error}</p>}
    {success && <p className="cg-branch-success" role="status">{success}</p>}
    <div className="cg-branch-tabs" role="group" aria-label="Branch inventory views">
      {[
        ['balances', 'Branch Balances'],
        ['transfers', 'Transfers'],
        ['counts', 'Physical Counts'],
      ].map(([value, title]) =>
        <button key={value} type="button" className={tab === value ? 'is-selected' : ''}
          aria-pressed={tab === value} onClick={() => setTab(value)}>{title}</button>,
      )}
    </div>
    {loading && <p role="status">Updating live inventory…</p>}
    {tab === 'balances' && <div className="cg-branch-table-wrap">
      <table><thead><tr><th>Branch</th><th>Part</th><th>SKU</th>
        <th>On hand</th><th>Reserved</th><th>Available</th></tr></thead>
        <tbody>{balances.length ? balances.map((row) => <tr key={row.branchId + row.itemId}>
          <td>{row.branchName}</td><td>{row.name}</td><td>{row.sku}</td>
          <td>{row.onHand}</td><td>{row.reserved}</td><td>{row.available}</td>
        </tr>) : <tr><td colSpan={6}>No branch balances found.</td></tr>}</tbody>
      </table>
    </div>}
    {tab === 'transfers' && <>
      {canEdit && <form className="cg-branch-form" onSubmit={onSubmitTransfer}>
        <h3><ArrowLeftRight size={17}/> Transfer stock</h3>
        <div className="cg-branch-grid">
          <label>From branch<select required value={transfer.fromBranch} disabled={saving}
            onChange={(event) => setTransfer((value) => ({ ...value, fromBranch: event.target.value }))}>
            <option value="">Select branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></label>
          <label>To branch<select required value={transfer.toBranch} disabled={saving}
            onChange={(event) => setTransfer((value) => ({ ...value, toBranch: event.target.value }))}>
            <option value="">Select destination</option>
            {branches.filter((b) => b.id !== transfer.fromBranch).map((b) =>
              <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></label>
          <label>Part<select required value={transfer.itemId} disabled={saving}
            onChange={(event) => setTransfer((value) => ({ ...value, itemId: event.target.value }))}>
            <option value="">Select product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.partName} · {p.sku}</option>)}
          </select></label>
          <label>Quantity<input required inputMode="decimal" value={transfer.quantity} disabled={saving}
            onChange={(event) => setTransfer((value) => ({ ...value, quantity: event.target.value }))}/></label>
        </div>
        <p>Source available: {selected?.available ?? '—'}. A transfer never increases total workshop stock.</p>
        <button type="submit" disabled={saving}>{saving ? 'Transferring…' : 'Confirm Branch Transfer'}</button>
      </form>}
      <div className="cg-branch-table-wrap"><table><thead><tr>
        <th>Transfer</th><th>From</th><th>To</th><th>Status</th></tr></thead>
        <tbody>{transfers.length ? transfers.slice(0, 100).map((row) =>
          <tr key={row.id}><td>{row.number}</td>
            <td>{branches.find((b) => b.id === row.from_branch)?.name || row.from_branch}</td>
            <td>{branches.find((b) => b.id === row.to_branch)?.name || row.to_branch}</td>
            <td>{row.status}</td></tr>) : <tr><td colSpan={4}>No branch transfers yet.</td></tr>}</tbody>
      </table></div>
    </>}
    {tab === 'counts' && <>
      {canEdit && <form className="cg-branch-form" onSubmit={onSubmitCount}>
        <h3><ClipboardCheck size={17}/> Physical stock count</h3>
        <p>Reconcile the current employee branch. Existing supplier bills and history remain unchanged.</p>
        <div className="cg-branch-grid">
          <label>Part<select value={count.itemId} required disabled={saving}
            onChange={(event) => setCount((value) => ({ ...value, itemId: event.target.value }))}>
            <option value="">Select part</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.partName} · {p.sku}</option>)}
          </select></label>
          <label>Counted units<input value={count.countedQty} inputMode="decimal" required disabled={saving}
            onChange={(event) => setCount((value) => ({ ...value, countedQty: event.target.value }))}/></label>
          <label className="cg-branch-wide">Reason<input value={count.reason} required minLength={5}
            disabled={saving} onChange={(event) => setCount((value) => ({ ...value, reason: event.target.value }))}/></label>
        </div>
        <button type="submit" disabled={saving}>{saving ? 'Reconciling…' : 'Save Audited Count'}</button>
      </form>}
      <div className="cg-branch-table-wrap"><table><thead><tr>
        <th>Part ID</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Reason</th></tr></thead>
        <tbody>{counts.length ? counts.slice(0, 100).map((row) =>
          <tr key={row.id}><td>{row.item}</td><td>{row.expected_qty}</td>
            <td>{row.counted_qty}</td><td>{row.difference}</td><td>{row.reason}</td></tr>)
          : <tr><td colSpan={5}>No physical counts recorded.</td></tr>}</tbody>
      </table></div>
    </>}
  </section>;
}
