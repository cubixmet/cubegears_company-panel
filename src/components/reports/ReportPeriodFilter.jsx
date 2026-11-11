
import { CalendarDays, Filter } from 'lucide-react';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
export const ReportPeriodFilter = ({
  from, to, onFrom, onTo, onThisMonth, onAllTime,
  month, year, onMonth, onYear, years, branch, staff,
  onBranch, onStaff, branches, staffOptions,
}) => (
  <section className="reports-dashboard-filter no-print" aria-label="Report filters">
    <div className="reports-dashboard-filter__heading">
      <span><Filter size={16}/> Choose your report</span>
      <small>Pick a month, date range, branch or staff member</small>
    </div>
    <div className="reports-dashboard-filter__fields">
      <label>Month
        <select aria-label="Month" value={month || 'Custom'} onChange={(event) => onMonth(event.target.value)}>
          <option value="Custom">Custom dates</option>
          <option value="All">All time</option>
          {MONTHS.map((name) => <option value={name} key={name}>{name}</option>)}
        </select>
      </label>
      <label>Year
        <select aria-label="Year" value={year} onChange={(event) => onYear(event.target.value)}>
          {years.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label>Branch
        <select aria-label="Branch" value={branch} onChange={(event) => onBranch(event.target.value)}>
          <option value="All">All Branches</option>
          {branches.map((name) => <option key={name} value={name}>{name}</option>)}
          {branch !== 'All' && !branches.includes(branch) && <option value={branch}>{branch} (unavailable)</option>}
        </select>
      </label>
      <label>Staff
        <select aria-label="Staff" value={staff} onChange={(event) => onStaff(event.target.value)}>
          <option value="All">All Staff</option>
          {staffOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          {staff !== 'All' && !staffOptions.includes(staff) && <option value={staff}>{staff} (unavailable)</option>}
        </select>
      </label>
      <label><span className="report-filter-label-with-icon"><CalendarDays size={13}/> Start date</span>
        <input type="date" aria-label="Start date" value={from} max={to || undefined}
          onChange={(event) => onFrom(event.target.value)}/>
      </label>
      <label>End date
        <input type="date" aria-label="End date" value={to} min={from || undefined}
          onChange={(event) => onTo(event.target.value)}/>
      </label>
    </div>
    <div className="reports-dashboard-filter__quick">
      <button type="button" onClick={onThisMonth}>Show This Month</button>
      <button type="button" onClick={onAllTime}>Show All Dates</button>
    </div>
  </section>
);