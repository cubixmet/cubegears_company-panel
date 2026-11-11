
import { Download, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';

export const ReportsHeader = ({ onRefresh, onCsv, onPrint, loading = false, exportDisabled = false, periodLabel }) => (
  <header className="reports-dashboard-header no-print">
    <div className="reports-dashboard-header__title">
      <span className="reports-dashboard-eyebrow">CUBIXGEAR · WORKSHOP</span>
      <h1>Workshop Reports</h1>
      <p>See your customer bills, money received, workshop expenses and stock in one place.</p>
      {periodLabel && <span className="reports-dashboard-period-badge">{periodLabel}</span>}
    </div>
    <div className="reports-dashboard-actions">
      <button type="button" onClick={onRefresh} disabled={loading}>
        <RefreshCw size={16} className={loading ? 'reports-spinning' : ''}/> {loading ? 'Refreshing…' : 'Refresh'}
      </button>
      <button type="button" onClick={onCsv} disabled={loading || exportDisabled}>
        <FileSpreadsheet size={16}/> Export Excel (CSV)
      </button>
      <button type="button" onClick={onPrint} disabled={loading || exportDisabled}>
        <Printer size={16}/> Print
      </button>
      <button type="button" className="is-primary" onClick={onPrint} disabled={loading || exportDisabled}
        title="Opens your browser print window. Choose Save as PDF to save the complete report.">
        <Download size={16}/> Save as PDF
      </button>
    </div>
  </header>
);