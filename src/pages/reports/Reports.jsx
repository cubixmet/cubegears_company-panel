import { useEffect, useMemo, useState } from "react";
import { Search, AlertCircle, RefreshCw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../api/apiClient';
import { USE_MOCK_API } from '../../api/apiConfig';
import { billingService } from '../../services/billing.service';
import { expenseService } from '../../services/expense.service';
import { stockCatalogService } from '../../services/stockCatalog.service';
import { resourceConfigs } from '../operations/resourceConfigs';
import {
  buildReportSummary, invoiceAmounts, reportRows, reportMoney, reportPeriodOptions,
  reportFilterOptions, reportChartBuckets, reportDate,
} from './reportsDashboard.utils';
import { ReportPerformanceChart, ReportExpenseCategoryChart } from '../../components/reports/ReportCharts';
import { ReportFiscalPrint } from '../../components/reports/ReportFiscalPrint';
import { reportLoadErrorMessage } from './reportErrorMessage';
import { ReportPeriodFilter, ReportStats, ReportTabs, ReportsHeader } from '../../components/reports';
import '../../styles/reports-dashboard.css';
import '../../styles/reports-dashboard-polished.css';
import '../../styles/reports-print.css';

const paymentService = resourceConfigs.payments.service;
const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const csvEscape = (value) => {
  const txt = String(value ?? '');
  return /[",\n]/.test(txt) ? '"' + txt.replace(/"/g, '""') + '"' : txt;
};
const objectLabel = (value) => typeof value === 'object' && value !== null
  ? String(value.name || value.number || value.registration || '') : String(value ?? '');
const noRecords = (columns, text = 'No records for this selection.') =>
  <tr className="report-empty-row"><td colSpan={columns}>{text}</td></tr>;

export function Reports() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const now = new Date();
  const defaultYear = String(now.getFullYear());
  const defaultMonth = MONTHS[now.getMonth()];
  const month = params.get('month') || defaultMonth;
  const year = params.get('year') || defaultYear;
  const branch = params.get('branch') || 'All';
  const staff = params.get('staff') || 'All';
  const selectedWindow = reportPeriodOptions(year, MONTHS.indexOf(month) + 1);
  const fallbackWindow = reportPeriodOptions(defaultYear, now.getMonth() + 1);
  const from = params.has('from') ? params.get('from') || '' :
    month === 'All' ? '' : (selectedWindow || fallbackWindow).from;
  const to = params.has('to') ? params.get('to') || '' :
    month === 'All' ? '' : (selectedWindow || fallbackWindow).to;

  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataIssues, setDataIssues] = useState({});
  const [truncatedSources, setTruncatedSources] = useState([]);
  const [reportWorkshop, setReportWorkshop] = useState(null);
  const [fiscalComparison, setFiscalComparison] = useState(null);
  const referenceDate = from || to || new Date().toISOString().slice(0, 10);
  const referenceYear = Number(referenceDate.slice(0, 4));
  const referenceMonth = Number(referenceDate.slice(5, 7));
  const fiscalYearStart = referenceYear - (referenceMonth < 4 ? 1 : 0);
  const [availability, setAvailability] = useState({
    invoices: false, payments: false, expenses: false, stock: false,
  });

  const load = async () => {
    setLoading(true);
    const names = ['invoices', 'payments', 'expenses', 'stock'];
    if (!USE_MOCK_API) {
      try {
        // Dedicated Django report endpoint returns only the sources this role
        // can access. Do not bypass Expenses/Payments permissions via reports.view.
        const payload = await apiClient.get('/reports/workspace', {
          params: { ...(from ? { from } : {}), ...(to ? { to } : {}), fiscalYear: fiscalYearStart },
        });
        if (!payload || !payload.sources) throw new Error('Invalid report API response.');
        const issues = {};
        const availabilityBySource = {};
        const truncated = [];
        const data = {};
        for (const name of names) {
          const source = payload.sources[name];
          if (source?.available === false) {
            issues[name] = source.reason === 'permission'
              ? 'You cannot see this section. Ask the workshop owner to enable View access for it.'
              : source.reason || 'Report source unavailable.';
            availabilityBySource[name] = false;
            data[name] = [];
          } else if (!source || !Array.isArray(payload[name])) {
            issues[name] = 'Unexpected response from reports API.';
            availabilityBySource[name] = false;
            data[name] = [];
          } else {
            data[name] = payload[name];
            availabilityBySource[name] = true;
            if (source.truncated) truncated.push(name);
          }
        }
        setInvoices(data.invoices.filter((row) =>
          String(row.kind || 'invoice').toLowerCase() === 'invoice'));
        setPayments(data.payments);
        setExpenses(data.expenses);
        setStock(data.stock);
        setReportWorkshop(payload.company || null);
        setFiscalComparison(payload.fiscalComparison || null);
        setDataIssues(issues);
        setTruncatedSources(truncated);
        setAvailability(availabilityBySource);
      } catch (error) {
        setInvoices([]);
        setPayments([]);
        setExpenses([]);
        setStock([]);
        setFiscalComparison(null);
        setDataIssues({ reports: reportLoadErrorMessage(error) });
        setTruncatedSources([]);
        setAvailability({ invoices: false, payments: false, expenses: false, stock: false });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Demo mode keeps the old explicit mock adapters; production never
    // silently substitutes demo rows for a failed finance API.
    const results = await Promise.allSettled([
      billingService.list(), paymentService.list(),
      expenseService.getExpenses(), stockCatalogService.getItems(),
    ]);
    const issues = {};
    const data = results.map((result, index) => {
      if (result.status === 'rejected') {
        issues[names[index]] = result.reason?.message || 'Unable to load';
        return [];
      }
      if (!Array.isArray(result.value) && !Array.isArray(result.value?.results)) {
        issues[names[index]] = 'Unexpected API response';
        return [];
      }
      return reportRows(result.value);
    });
    setInvoices(data[0].filter((row) => String(row.kind || 'invoice').toLowerCase() === 'invoice'));
    setPayments(data[1]);
    setExpenses(data[2]);
    setStock(data[3]);
    setFiscalComparison(null);
    setTruncatedSources([]);
    setDataIssues(issues);
    setAvailability(Object.fromEntries(names.map((name) => [name, !issues[name]])));
    setLoading(false);
  };
  useEffect(() => { void load(); }, [from, to]);

  const filterOptions = useMemo(() =>
    reportFilterOptions([invoices, payments, expenses]),
  [invoices, payments, expenses]);
  const years = useMemo(() => [...new Set([
    Number(defaultYear), Number(year),
    ...[invoices, payments, expenses].flatMap((rows) =>
      rows.flatMap((item) => {
        const date = String(item.date || item.paymentDate || item.expenseDate || '');
        return /^\d{4}-/.test(date) ? [Number(date.slice(0, 4))] : [];
      })),
  ])].filter((item) => Number.isInteger(item) && item >= 2000 && item <= 2100)
    .sort((a, b) => b - a).map(String), [defaultYear, year, invoices, payments, expenses]);

  const modifyParams = (updates, remove = []) => {
    const next = new URLSearchParams(params);
    remove.forEach((key) => next.delete(key));
    Object.entries(updates).forEach(([key, value]) => next.set(key, String(value)));
    setParams(next, { replace: true });
  };
  const chooseMonth = (value, targetYear = year) => {
    if (value === 'Custom') {
      modifyParams({ month: value, year: targetYear, from, to }); return;
    }
    if (value === 'All') {
      modifyParams({ month: value, year: targetYear }, ['from', 'to']); return;
    }
    if (reportPeriodOptions(targetYear, MONTHS.indexOf(value) + 1)) {
      modifyParams({ month: value, year: targetYear }, ['from', 'to']);
    }
  };
  const customDate = (key, value) =>
    modifyParams({ month: 'Custom', from, to, [key]: value });

  const report = useMemo(() => buildReportSummary({
    invoices, payments, expenses, stock, from, to, branch, staff,
    available: availability,
  }), [invoices, payments, expenses, stock, from, to, branch, staff, availability]);
  const dateRangeValid = !from || !to || from <= to;
  const activityDates = [...report.invoiceRows.map((r) => reportDate(r, 'invoice')),
    ...report.paymentRows.map((r) => reportDate(r, 'payment')),
    ...report.expenseRows.map((r) => reportDate(r, 'expense'))].filter(Boolean).sort();
  const chartFrom = from || activityDates[0] || '';
  const chartTo = to || activityDates[activityDates.length - 1] || '';
  const buckets = useMemo(() => reportChartBuckets(report, chartFrom, chartTo),
    [report, chartFrom, chartTo]);
  const periodLabel = month === 'Custom' ? (from || 'Beginning') + ' – ' + (to || 'Today')
    : month === 'All' ? 'All time' : month + ' ' + year;
  const workshopName = reportWorkshop?.name || user?.company?.name || 'Workshop';
  const workshopAddress = reportWorkshop?.address || user?.company?.address || '';
  const workshopPhone = reportWorkshop?.phone || user?.company?.phone || '';
  const workshopGstin = reportWorkshop?.gstin || user?.company?.gstin || '';
  const incompleteSources = Object.keys(dataIssues);
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q ? report.invoiceRows : report.invoiceRows.filter((item) =>
      [item.number, item.customerName, item.customer?.name,
        item.vehicle?.registration, item.vehicleReg, item.status].some((v) =>
        String(v || '').toLowerCase().includes(q)));
  }, [query, report.invoiceRows]);

  const exportCsv = () => {
    if (loading || truncatedSources.length || !dateRangeValid) return;
    const rows = [];
    const append = (section, headings, items) => {
      rows.push([section, periodLabel]);
      rows.push(headings);
      rows.push(...items);
      rows.push([]);
    };

    if ((tab === 'overview' || tab === 'sales') && availability.invoices) {
      append('INVOICES', ['Invoice', 'Date', 'Customer', 'Vehicle', 'Status', 'Total', 'Paid', 'Balance'],
        filteredRows.map((item) => {
          const amounts = invoiceAmounts(item);
          return [item.number, reportDate(item, 'invoice'), item.customerName,
            item.vehicleReg || item.vehicle?.registration, item.status,
            amounts.total, amounts.paid, amounts.balance];
        }));
    }
    if ((tab === 'overview' || tab === 'payments') && availability.payments) {
      append('CUSTOMER PAYMENTS', ['Reference', 'Date', 'Customer', 'Invoice', 'Method', 'Direction', 'Status', 'Amount'],
        report.paymentRows.map((item) => [
          item.reference || item.id, reportDate(item, 'payment'), item.customerName,
          item.invoiceNo, item.method, item.direction || 'IN', item.status,
          (String(item.direction || 'IN').toUpperCase() === 'OUT' ? -1 : 1) * Number(item.amount || 0),
        ]));
    }
    if ((tab === 'overview' || tab === 'expenses') && availability.expenses) {
      append('OPERATING EXPENSES', ['Date', 'Expense', 'Category', 'Vendor', 'Status', 'Amount', 'Paid'],
        report.expenseRows.map((item) => [
          reportDate(item, 'expense'), item.title || item.description,
          item.category, item.vendor, item.status, item.amount,
          item.paidAmount ?? item.paid_amount ?? 0,
        ]));
    }
    if ((tab === 'overview' || tab === 'stock') && availability.stock && report.comparable) {
      append('CURRENT STOCK', ['SKU', 'Item', 'On Hand', 'Reserved', 'Cost Price', 'Stock Value'],
        report.stockRows.map((item) => [
          item.sku, item.name || item.partName, item.onHand, item.reserved,
          item.costPrice, Number(item.onHand || 0) * Number(item.costPrice || 0),
        ]));
    }
    if (!rows.length) return;
    const titleRows = [
      ['Workshop', workshopName],
      ['Period', periodLabel],
      ['Exported', new Date().toLocaleString('en-IN')],
      [],
    ];
    const csv = '\uFEFF' + [...titleRows, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cubixgear-report-' + (from || 'all') + '-' + (to || 'all') + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="reports-page reports-page-polished">
      <ReportsHeader onRefresh={load} onCsv={exportCsv} onPrint={() => window.print()}
        loading={loading} exportDisabled={!dateRangeValid || truncatedSources.length > 0 ||
          !Object.values(availability).some(Boolean)}
        periodLabel={periodLabel}/>
      <ReportPeriodFilter from={from} to={to}
        month={month} year={year} years={years}
        branch={branch} staff={staff}
        branches={filterOptions.branches} staffOptions={filterOptions.staff}
        onMonth={chooseMonth} onYear={(value) => chooseMonth(month, value)}
        onBranch={(value) => modifyParams({ branch: value })}
        onStaff={(value) => modifyParams({ staff: value })}
        onFrom={(value) => customDate('from', value)}
        onTo={(value) => customDate('to', value)}
        onThisMonth={() => chooseMonth(defaultMonth, defaultYear)}
        onAllTime={() => chooseMonth('All')}/>
      {!dateRangeValid && <div role="alert" className="reports-error no-print">
        Choose an end date on or after the start date.
      </div>}
      {loading && <div className="reports-inline-loading" role="status">
        <RefreshCw size={16} className="reports-spinning"/> Getting the latest workshop figures…
      </div>}
      {incompleteSources.length > 0 && (
        <div role="alert" className="reports-error no-print">
          <AlertCircle size={16}/>
          <span>Reports are incomplete. Missing figures are shown as — instead of ₹0.
            {Object.entries(dataIssues).map(([source, reason]) =>
              <span key={source} className="report-source-error"><strong>{source}:</strong> {reason}</span>)}
          </span>
          <button type="button" onClick={load}><RefreshCw size={14}/> Retry</button>
        </div>
      )}
      {truncatedSources.length > 0 && (
        <div role="alert" className="reports-error no-print">
          <AlertCircle size={16}/>
          The report reached the API row limit for {truncatedSources.join(', ')}.
          Narrow the date range before relying on totals or exporting.
        </div>
      )}
      {(staff !== 'All' || branch !== 'All') && (
        <p className="reports-filter-notice no-print">
          Only records attributed to the selected staff/branch are included. Untagged
          transactions are excluded. Stock remains a company-wide snapshot.
        </p>
      )}

      <div className="report-print-sheet">
        <ReportFiscalPrint
          fiscalComparison={fiscalComparison}
          companyName={workshopName}
          periodLabel={periodLabel}
          from={from}
          to={to}
          branch={branch}
          staff={staff}
          missingSources={incompleteSources}
          truncatedSources={truncatedSources}
        />
        <header className="report-print-head">
          <div className="report-print-identity">
            <span>CUBIXGEAR / BUSINESS REPORT</span>
            <h2>{workshopName}</h2>
            {workshopAddress && <p>{workshopAddress}</p>}
            {(workshopGstin || workshopPhone) &&
              <p>{[workshopGstin && 'GSTIN: ' + workshopGstin,
                workshopPhone && 'Phone: ' + workshopPhone].filter(Boolean).join(' · ')}</p>}
            <strong>Financial & Operations Report</strong>
          </div>
          <div className="report-print-meta">
            <strong>{periodLabel}</strong>
            <span>{from || 'Beginning'} — {to || 'Today'}</span>
            <span>Generated: {new Date().toLocaleString('en-IN')}</span>
          </div>
        </header>
        {incompleteSources.length > 0 && <div className="report-print-warning">
          INCOMPLETE REPORT — {incompleteSources.join(', ')} data unavailable.
          Missing figures display as —.
        </div>}
        {truncatedSources.length > 0 && <div className="report-print-warning">
          INCOMPLETE REPORT — row limit reached: {truncatedSources.join(', ')}.
          Narrow the date range.
        </div>}
        <ReportStats report={report} formatMoney={reportMoney}/>
        <ReportTabs active={tab} onChange={setTab}/>
        <div className={`reports-charts-grid ${tab === 'overview' ? '' : 'report-section-screen-hidden'}`}>
            <ReportPerformanceChart buckets={buckets} report={report}
              from={chartFrom} to={chartTo}/>
            <ReportExpenseCategoryChart rows={report.expenseCategories}
              expensesAvailable={availability.expenses}/>
        </div>

        <section className={`report-panel ${tab === 'overview' || tab === 'sales' ? '' : 'report-section-screen-hidden'}`}>
            <div className="report-section-head">
              <div><span>CUSTOMER BILLS</span><h3>Customer Invoice Report</h3>
                <p>{filteredRows.length} invoices in the selected period</p></div>
              <label className="report-search no-print"><Search size={16}/>
                <input aria-label="Search invoices" value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Invoice, customer, or vehicle number…"/>
              </label>
            </div>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Vehicle</th>
                  <th>Status</th><th>Invoice Total</th><th>Still Due</th></tr></thead>
                <tbody>
                  {filteredRows.map((item) => {
                    const t = invoiceAmounts(item);
                    return <tr key={item.id}>
                      <td className="report-table-primary">{item.number || '—'}</td>
                      <td>{reportDate(item, 'invoice') || '—'}</td>
                      <td>{item.customerName || item.customer?.name || '—'}</td>
                      <td>{item.vehicle?.registration || item.vehicleReg || '—'}</td>
                      <td>{item.status || '—'}</td>
                      <td>{reportMoney(t.total)}</td><td>{reportMoney(t.balance)}</td>
                    </tr>;
                  })}
                  {!filteredRows.length && noRecords(7, availability.invoices ? 'No invoices for this selection.' : 'Invoice data unavailable.')}
                </tbody>
              </table>
            </div>
          </section>

        <section className={`report-panel ${tab === 'overview' || tab === 'payments' ? '' : 'report-section-screen-hidden'}`}>
            <div className="report-section-head">
              <div><span>CUSTOMER PAYMENTS</span><h3>Money Received from Customers</h3>
                <p>{report.paymentRows.length} completed payments (refunds are deducted)</p></div>
              <Link className="report-related-link no-print" to="/payments">Open Payments</Link>
            </div>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead><tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Invoice</th>
                  <th>Method</th><th>Status</th><th>Amount</th></tr></thead>
                <tbody>
                  {report.paymentRows.map((item) => <tr key={item.id}>
                    <td className="report-table-primary">{item.receiptNo || item.reference || '—'}</td>
                    <td>{reportDate(item, 'payment') || '—'}</td>
                    <td>{item.customerName || objectLabel(item.customer) || '—'}</td>
                    <td>{item.invoiceNo || objectLabel(item.invoice) || '—'}</td>
                    <td>{item.method || item.paymentMethod || '—'}</td>
                    <td>{item.status || 'Completed'}</td>
                    <td>{reportMoney((String(item.direction || 'IN').toUpperCase() === 'OUT' ? -1 : 1) * Number(item.amount || 0))}</td>
                  </tr>)}
                  {!report.paymentRows.length && noRecords(7, availability.payments ? 'No payments for this selection.' : 'Payment data unavailable.')}
                </tbody>
              </table>
            </div>
          </section>

        <section className={`report-panel ${tab === 'overview' || tab === 'expenses' ? '' : 'report-section-screen-hidden'}`}>
            <div className="report-section-head">
              <div><span>WORKSHOP COSTS</span><h3>Expenses Recorded</h3>
                <p>{report.expenseRows.length} operating expenses</p></div>
              <Link className="report-related-link no-print" to="/expenses">Open Expenses</Link>
            </div>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead><tr><th>Date</th><th>Expense</th><th>Category</th>
                  <th>Vendor</th><th>Status</th><th>Amount</th></tr></thead>
                <tbody>
                  {report.expenseRows.map((item) => <tr key={item.id}>
                    <td>{reportDate(item, 'expense') || '—'}</td>
                    <td className="report-table-primary">{item.title || item.description || 'Expense'}</td>
                    <td>{item.category || '—'}</td><td>{item.vendor || '—'}</td>
                    <td>{item.status || '—'}</td><td>{reportMoney(item.amount)}</td>
                  </tr>)}
                  {!report.expenseRows.length && noRecords(6, availability.expenses ? 'No expenses for this selection.' : 'Expense data unavailable.')}
                </tbody>
              </table>
            </div>
          </section>

        <section className={`report-panel ${tab === 'overview' || tab === 'stock' ? '' : 'report-section-screen-hidden'}`}>
            <div className="report-section-head">
              <div><span>CURRENT PARTS</span><h3>Parts &amp; Stock</h3>
                <p>Parts currently in store, at purchase cost (not the selected month's stock history).</p></div>
            </div>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead><tr><th>SKU</th><th>Item</th><th>Category</th><th>On Hand</th>
                  <th>Reserved</th><th>Available</th><th>Cost</th><th>Value</th></tr></thead>
                <tbody>
                  {report.stockRows.map((item) => {
                    const available = Number(item.onHand || 0) - Number(item.reserved || 0);
                    const value = Number(item.onHand || 0) * Number(item.costPrice || 0);
                    return <tr key={item.id}>
                      <td className="report-table-primary">{item.sku || '—'}</td>
                      <td>{item.partName || item.name || '—'}</td>
                      <td>{item.category || '—'}</td><td>{item.onHand || 0}</td>
                      <td>{item.reserved || 0}</td><td>{available}</td>
                      <td>{reportMoney(item.costPrice || 0)}</td><td>{reportMoney(value)}</td>
                    </tr>;
                  })}
                  {!report.stockRows.length && noRecords(8,
                    branch !== 'All' || staff !== 'All'
                      ? 'Stock snapshot is not attributed by staff or branch. Select All to view.'
                      : 'No stock items available.')}
                </tbody>
              </table>
            </div>
          </section>
        <footer className="report-print-footer">Generated by cubixgear · {workshopName} · {periodLabel}</footer>
      </div>
    </div>
  );
}
export default Reports;
