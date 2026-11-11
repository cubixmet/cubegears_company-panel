import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Coins, CreditCard, Database, FileClock, RefreshCcw, ShieldCheck, Wallet, Zap } from 'lucide-react';
import { creditWalletService, notifyCreditChange, purchaseCredits } from '../../services/creditWallet.service';
import { saasAccountService } from '../../services/saasAccount.service';
import { AccountHeader } from '../../components/account';
import { CreditCycleCard } from '../../components/account/CreditCycleCard';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { useAuth } from '../../hooks/useAuth';
import { routeConfig } from '../../routes/routeConfig';
import { featureLabelStatus } from '../../utils/featureActivation';
import '../../styles/credit-wallet.css';

const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const money = (value) => value == null ? '—' : `₹${nf.format(Number(value))}`;
const credits = (value) => value == null ? '—' : nf.format(Number(value));
const when = (value) => value ? new Date(value).toLocaleString('en-IN') : '—';
const timeUsed = (total) => {
  const seconds = Math.max(0, Number(total) || 0);
  if (seconds >= 86400) return `${nf.format(seconds / 86400)} days`;
  if (seconds >= 3600) return `${nf.format(seconds / 3600)} hours`;
  if (seconds >= 60) return `${nf.format(seconds / 60)} min`;
  return `${seconds} sec`;
};
const ratePeriod = (period) => ({
  ten_seconds: '10 seconds', hourly: 'hour', daily: 'day',
  weekly: 'week', monthly: '30 days', permanent: 'lifetime',
})[period] || period || '—';

export function CreditWorkspace({ section = 'overview' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const modulePricingRef = useRef(null);
  const { user } = useAuth();
  const featureAccess = useFeatureAccess();
  const [wallet, setWallet] = useState(null);
  const [storageOverview, setStorageOverview] = useState(null);
  const [account, setAccount] = useState(null);
  const [featureActivity, setFeatureActivity] = useState([]);
  const [featureUsage, setFeatureUsage] = useState(null);
  const [packages, setPackages] = useState([]);
  const [featureBundles, setFeatureBundles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [monthlyStatements, setMonthlyStatements] = useState([]);
  const [calendarBilling, setCalendarBilling] = useState(null);
  const [cycleBusy, setCycleBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const purchaseInFlightRef = useRef(false);
  const [purchaseRetryAt, setPurchaseRetryAt] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [logView, setLogView] = useState('transactions');
  const [logSearch, setLogSearch] = useState('');
  const [logKind, setLogKind] = useState('all');
  const [logFrom, setLogFrom] = useState('');
  const [logTo, setLogTo] = useState('');
  const [logPage, setLogPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const [balance, bundles, history, labels, statements, accountInfo, activity, calendarResult, usageResult, storageResult] = await Promise.allSettled([
      creditWalletService.overview(), creditWalletService.packages(),
      creditWalletService.logs(),
      creditWalletService.bundles(), creditWalletService.monthlyStatements(),
      creditWalletService.account(), creditWalletService.featureActivity(),
      creditWalletService.calendarBilling(),
      creditWalletService.featureUsageLogs(),
      section === 'overview' ? saasAccountService.getStorageAccount() : Promise.resolve(null),
    ]);
    const problems = [];
    setStorageOverview(storageResult.status === 'fulfilled' ? storageResult.value : null);
    if (usageResult.status === 'fulfilled') setFeatureUsage(usageResult.value);
    else {
      setFeatureUsage(null);
      if (usageResult.reason?.status !== 404) problems.push('module usage logs');
    }
    if (calendarResult.status === 'fulfilled') setCalendarBilling(calendarResult.value);
    else {
      setCalendarBilling(null);
      if (calendarResult.reason?.status !== 404) problems.push('calendar billing statement');
    }
    if (accountInfo.status === 'fulfilled') setAccount(accountInfo.value);
    else { setAccount(null); problems.push('account details'); }
    if (activity.status === 'fulfilled') setFeatureActivity(activity.value);
    else { setFeatureActivity([]); problems.push('feature activity'); }
    if (balance.status === 'fulfilled') setWallet(balance.value);
    else { setWallet(null); problems.push('wallet balance'); }
    if (bundles.status === 'fulfilled') setPackages(Array.isArray(bundles.value) ? bundles.value : []);
    else { setPackages([]); problems.push('credit packages'); }
    if (history.status === 'fulfilled') setLogs(Array.isArray(history.value) ? history.value : []);
    else { setLogs([]); problems.push('transaction logs'); }
    if (labels.status === 'fulfilled') setFeatureBundles(Array.isArray(labels.value) ? labels.value : []);
    else { setFeatureBundles([]); problems.push('module prices'); }
    if (statements.status === 'fulfilled') setMonthlyStatements(Array.isArray(statements.value) ? statements.value : []);
    else {
      setMonthlyStatements([]);
      // Older backend deployments return 404 until the read-only statement
      // endpoint ships. Wallet, feature activation and ledger remain usable.
      if (statements.reason?.status !== 404) problems.push('monthly credit statements');
    }
    setError(problems.length ? `Could not load ${problems.join(', ')}. No balance or payment has been assumed.` : '');
    setLoading(false);
  }, [section]);

  useEffect(() => { load(); }, [load]);

  // The old Feature Controls route was retired. Its pricing and activation
  // controls now live lower down on this overview, so navigate to that section
  // instead of re-opening the same Wallet Overview.
  const scrollToModulePricing = useCallback(() => {
    const sectionElement = modulePricingRef.current;
    if (!sectionElement) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    sectionElement.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    sectionElement.focus({ preventScroll: true });
  }, []);

  const openModulePricing = () => {
    scrollToModulePricing();
    if (location.hash !== '#module-pricing') {
      navigate(`${location.pathname}#module-pricing`, { replace: true });
    }
  };

  // Deep links from other Account pages must also land on the real marketplace.
  useEffect(() => {
    if (section === 'overview' && location.hash === '#module-pricing') {
      modulePricingRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      modulePricingRef.current?.focus({ preventScroll: true });
    }
  }, [section, location.hash]);

  // Razorpay redirects back with a purchase ID. Confirm status with Django,
  // which independently fetches the payment from Razorpay before adding credits.
  useEffect(() => {
    if (section !== 'buy') return undefined;
    const purchaseId = new URLSearchParams(window.location.search).get('credit_purchase');
    if (!purchaseId) return undefined;
    if (!/^[a-f0-9-]{36}$/i.test(purchaseId)) {
      setError('Invalid payment return reference.');
      return undefined;
    }
    let cancelled = false;
    let pendingTimer = null;
    let attempts = 0;
    const checkPayment = async () => {
      try {
        const payment = await creditWalletService.hostedCheckoutStatus(purchaseId);
        if (cancelled) return;
        if (payment.credited === true && payment.status === 'credited') {
          setNotice(`Payment verified. ${credits(payment.credits)} credits added to your wallet.`);
          setError('');
          window.history.replaceState({}, '', window.location.pathname);
          await load();
          notifyCreditChange();
          return;
        }
        if (payment.status === 'refunded') {
          setError('This payment was refunded. No credits are available from it.');
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
        attempts += 1;
        setNotice('Payment confirmation pending. Only captured payments add credits.');
        if (attempts < 12) pendingTimer = window.setTimeout(checkPayment, 3000);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Unable to verify payment. Please refresh this page.');
      }
    };
    checkPayment();
    return () => {
      cancelled = true;
      if (pendingTimer !== null) window.clearTimeout(pendingTimer);
    };
  }, [section, load]);

  const buy = async (pack) => {
    setBusy(`package:${pack.id}`); setError(''); setNotice('');
    try {
      await purchaseCredits(pack.id);
      // The browser now leaves CubeGear for Razorpay. Credit confirmation happens
      // only after the hosted page returns and the Django API verifies capture.
    } catch (e) { setError(e?.message || 'Payment not confirmed. Review your transaction logs.'); }
    finally { setBusy(''); }
  };

  useEffect(() => {
    if (!purchaseRetryAt) return undefined;
    const timer = window.setTimeout(() => setPurchaseRetryAt(0),
      Math.max(0, purchaseRetryAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [purchaseRetryAt]);

  const buyBundle = async (bundle) => {
    // A ref prevents double-clicks before React can render its busy state.
    // Never automatically replay financial/purchase mutations.
    if (purchaseInFlightRef.current || busy || !bundle?.id || purchaseRetryAt > Date.now()) return;
    purchaseInFlightRef.current = true;
    setBusy(`bundle:${bundle.id}`); setError(''); setNotice('');
    try {
      const result = await creditWalletService.purchaseBundle(bundle.id);
      setNotice(result?.billingMode === 'monthly_postpaid'
        ? 'Module activated; nothing was debited today. Usage will be collected on your monthly due date.'
        : result?.chargedCredits === '0.00'
        ? 'Your purchased module access is active. No additional credits charged.'
        : `${bundle.name} enabled. ${credits(result.chargedCredits)} credits charged by the server.`);
      await load();
      notifyCreditChange();
    } catch (e) {
      if (e?.status === 429) {
        const seconds = Number(e?.retryAfterSeconds);
        if (Number.isFinite(seconds) && seconds > 0) {
          setPurchaseRetryAt(Date.now() + seconds * 1000);
          setError(`Too many activation attempts. Try again in about ${Math.ceil(seconds / 60)} minute(s). No automatic retry was made. Check feature status before retrying.`);
        } else {
          setError('Too many activation attempts. Wait before trying again. No automatic retry was made.');
        }
      } else {
        setError(e?.message || 'Label purchase could not be verified.');
      }
    } finally {
      purchaseInFlightRef.current = false;
      setBusy('');
    }
  };

  const stopBundle = async (bundle) => {
    setBusy(`bundle:${bundle.id}`); setError(''); setNotice('');
    try {
      await creditWalletService.disableBundle(bundle.id);
      setNotice(`${bundle.name} access disabled. Prepaid credits are not refunded.`);
      await load();
      notifyCreditChange();
    } catch (e) { setError(e?.message || 'Could not disable this module access.'); }
    finally { setBusy(''); }
  };

  const low = wallet?.lowBalance === true;
  // Never combine a lifetime charge with a daily/weekly/monthly rate into a
  // fake "monthly total". Display each server-published label price separately.
  const freeKeys = ['dashboard', 'settings', 'staff', 'roles', 'billing'];
  // The server hides free-only labels; also guard stale cached API responses.
  // Mixed labels remain visible for the paid modules they contain.
  const paidBundles = featureBundles.filter(bundle =>
    (bundle.features || []).some(item => !freeKeys.includes(item.key))
  );
  const activeBundles = paidBundles.filter(bundle => bundle.active === true);
  const freeRoutes = [
    ...routeConfig.filter(route =>
      ['credits', 'dashboard', 'settings', 'staff-management'].includes(route.id) &&
      featureAccess.freeModules?.includes(route.permission.split('.')[0]) &&
      featureAccess.can(route.permission)
    ),
    // Role management already lives under Staff Management and is guarded
    // by Django's company.manage check. Free does not grant admin privileges.
    ...(featureAccess.freeModules?.includes('roles') && featureAccess.can('company.manage')
      ? [{ id: 'roles-permissions', label: 'Roles & Permissions', path: '/staff-management/roles',
           icon: ShieldCheck, permission: 'company.manage' }]
      : []),
  ];
  const availableRoutes = routeConfig.filter(route => route.permission &&
    !['billing', 'company', 'roles'].includes(route.permission.split('.')[0]) &&
    !featureAccess.freeModules?.includes(route.permission.split('.')[0]) &&
    featureAccess.can(route.permission));
  const sections = {
    overview: ['Account Overview', ''],
    buy: ['Buy Credits', 'Add credits with secure Razorpay checkout. Only captured payments update your wallet.'],
    logs: ['Billing Logs', ''],
  };
  const [title, subtitle] = sections[section] || sections.overview;
  const logDate = (value) => value ? new Date(value).toLocaleDateString('sv-SE') : '';
  const filteredLogs = logs.filter(row => {
    const date = logDate(row.createdAt);
    const search = [row.description, row.kind, row.reference].filter(Boolean).join(' ').toLowerCase();
    return (!logSearch || search.includes(logSearch.trim().toLowerCase()))
      && (logKind === 'all' || row.kind === logKind)
      && (!logFrom || date >= logFrom)
      && (!logTo || date <= logTo);
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const logPages = Math.max(1, Math.ceil(filteredLogs.length / 10));
  const visibleLogs = filteredLogs.slice((Math.min(logPage, logPages) - 1) * 10, Math.min(logPage, logPages) * 10);

  return <div className="saas-page cg-credit-page">
    <AccountHeader title={title} subtitle={subtitle} active={section === 'buy' ? 'credits-buy' : section === 'logs' ? 'credits-logs' : 'overview'} onNavigate={navigate} actions={<button type="button" className="cg-credit-refresh" disabled={loading || Boolean(busy)} onClick={() => { load(); featureAccess.refresh(); }}><RefreshCcw size={16} aria-hidden="true"/> Refresh</button>}/>
    {featureAccess.billingStatus?.enabled && <section className="cg-credit-alert" role="status">
      <strong>{featureAccess.billingStatus.blocked ? 'Monthly payment overdue — workspace restricted.' : 'Monthly usage billing'}</strong>
      <p>Collection day: {featureAccess.billingStatus.dueDay} of the next month. Outstanding: {credits(featureAccess.billingStatus.outstandingCredits)} credits.</p>
      {featureAccess.billingStatus.blocked && <p>Buy credits to settle outstanding usage. Storage logs and your account remain available.</p>}
      <button type="button" onClick={() => navigate('/account/credits/buy')}>Buy credits</button>
    </section>}
    {(section === 'overview' || (section === 'logs' && logView === 'statements')) && calendarBilling?.enabled && <section className="cg-credit-panel" aria-label="Calendar month credit billing">
      <header><div><span>CALENDAR MONTH BILLING</span><h2>{calendarBilling.restricted ? 'Payment overdue — workshop restricted' : 'Monthly usage & payment'}</h2></div><FileClock size={22}/></header>
      <p>Usage is recorded from the 1st through the last day of each calendar month. Wallet settlement is due on the {calendarBilling.dueDay}th of the next month. The due day remains a grace day; overdue restrictions start the following day.</p>
      <div className="cg-credit-inline"><span>Outstanding credits</span><strong>{credits(calendarBilling.amountDue)} credits</strong></div>
      <div className="cg-credit-inline"><span>Next payment deadline</span><strong>{when(calendarBilling.nextDueAt)}</strong></div>
      <div className="cg-credit-inline"><span>Postpaid usage with zero wallet balance</span><strong>{calendarBilling.allowZeroBalanceUsage ? 'Allowed until due date' : 'Disabled'}</strong></div>
      {calendarBilling.restricted && <p role="alert">Only account access, credit top-ups and read-only billing/storage audit remain available until outstanding credits are settled.</p>}
      <div className="cg-credit-actions">
        <button className="primary" type="button" onClick={() => navigate('/account/credits/buy')}>Buy credits</button>
        <button type="button" disabled={cycleBusy} onClick={async () => {
          setCycleBusy(true);
          try {
            const updated = await creditWalletService.retryCalendarBilling();
            setCalendarBilling(updated);
            await featureAccess.refresh();
            await load();
          } catch (failure) {
            setError(failure?.message || 'Could not retry the billing settlement.');
          } finally { setCycleBusy(false); }
        }}>{cycleBusy ? 'Checking…' : 'Retry settlement'}</button>
        <button type="button" onClick={() => navigate('/account/storage/history')}>Storage usage logs</button>
      </div>
      <div className="cg-credit-table-wrap"><table><thead><tr><th>Usage month</th><th>Features</th><th>Storage</th><th>Total credits</th><th>Due date</th><th>Status</th></tr></thead>
        <tbody>{(calendarBilling.statements || []).map(item => <tr key={item.id}><td>{item.month}</td><td>{credits(item.featureCredits)}</td><td>{credits(item.storageCredits)}</td><td>{credits(item.totalCredits)}</td><td>{when(item.dueAt)}</td><td>{item.status}</td></tr>)}
        {!(calendarBilling.statements || []).length && <tr><td colSpan={6}>No finalized monthly usage statements yet.</td></tr>}</tbody>
      </table></div>
    </section>}
    {error && <div className="cg-credit-alert error" role="alert">{error} <button type="button" onClick={load}>Retry</button></div>}
    {notice && <div className="cg-credit-alert success" role="status">{notice}</div>}
    {loading && <p role="status" className="cg-credit-status">Loading your company wallet…</p>}

    {section !== 'logs' && <div className="cg-credit-metrics">
      <article className="cg-credit-metric primary">
        <div><span>Available Credits</span><Wallet size={22}/></div>
        <strong>{credits(wallet?.balance)}</strong>
        {low && <small>Low balance — add credits to avoid interruption</small>}
      </article>
      {section === 'overview' && <>
        <article className="cg-credit-metric">
          <div><span>Active Modules</span><Zap size={20}/></div>
          <strong>{featureAccess.unavailable ? '—' : featureAccess.labelOnly ? featureAccess.activeLabelModules.length : (featureAccess.modules?.length ?? '—')}</strong>
        </article>
        <article className="cg-credit-metric">
          <div><span>Storage Used</span><Database size={20}/></div>
          <strong>{storageOverview?.usedGb == null ? '—' : `${storageOverview.usedGb} GB`}</strong>
        </article>
      </>}
    </div>}
    {section === 'overview' && <details className="cg-credit-expandable">
      <summary>More account details</summary>
      <div className="cg-credit-inline"><span>Active Staff</span><strong>{wallet?.staffCount ?? '—'}</strong></div>
      <div className="cg-credit-inline"><span>Estimated Monthly Features</span><strong>{credits(wallet?.monthlyCredits)} credits</strong></div>
      <div className="cg-credit-inline"><span>Pending Postpaid Usage</span><strong>{credits(wallet?.postpaidAccruedCredits)} credits</strong></div>
    </details>}

    {low && <div className="cg-credit-low" role="alert"><Coins size={20}/><div><strong>Your credit balance is running low.</strong><span>Buy more credits so paid modules can renew when due.</span></div><button onClick={() => navigate('/account/credits/buy')}>Buy Credits </button></div>}

    {section === 'overview' && featureAccess.paidAccessRequired && featureAccess.modules.length === 0 &&
      <div className="cg-credit-low" role="status"><Zap size={20}/><div><strong>Welcome — activate your workshop modules</strong><span>Start by buying credits and selecting features. Only modules activated by the owner become available.</span></div><button type="button" onClick={openModulePricing} aria-controls="module-pricing">Choose Features </button></div>}

    {section === 'overview' && <details className="cg-credit-expandable cg-credit-module-access">
      <summary>Module access &amp; status</summary>
    {section === 'overview' && <section className="cg-credit-panel" aria-label="Free modules">
      <header><div><span>INCLUDED — NO CREDITS</span><h2>Free modules for your company</h2></div><ShieldCheck size={22}/></header>
      <p>Dashboard, Settings, Staff Management, Roles & Permissions and SaaS Account have no feature activation or credit charge. Login and role permissions still apply. Other modules require an active paid Feature Label.</p>
      <div className="cg-credit-shortcuts">
        {freeRoutes.map(route => { const Icon = route.icon; return <button type="button" key={route.id} onClick={() => navigate(route.path)}>
          <Icon size={19}/><strong>{route.label}</strong><small>Free • allowed by your role</small>
        </button>; })}
      </div>
      {!freeRoutes.length && <p className="cg-credit-empty">No free modules are assigned to this login. Ask your company administrator about role permissions.</p>}
    </section>}

    {section === 'overview' && <section className="cg-credit-panel" aria-label="Company feature access">
      <header><div><span>COMPANY ACCESS</span><h2>{user?.companyName || user?.company?.name || 'Your workshop'} — Available modules</h2></div><ShieldCheck size={22}/></header>
      {featureAccess.unavailable ? <p role="alert">Company access could not be verified. Refresh to retry; unavailable modules stay locked.</p> : <>
        <p>{featureAccess.enforced
          ? 'Only company-enabled modules permitted for your login appear here, on the dashboard and in navigation.'
          : 'Paid-feature enforcement is currently off. Visible modules follow your role permissions.'}</p>
        {availableRoutes.length ? <div className="cg-credit-shortcuts">
          {availableRoutes.map(route => { const Icon = route.icon; return <button key={route.id} type="button" onClick={() => navigate(route.path)}>
            <Icon size={19}/><strong>{route.label}</strong><small>Open authorized module</small>
          </button>; })}
        </div> : <p className="cg-credit-empty">No workshop modules are available for this login. An authorized company admin can review the SaaS Account.</p>}
      </>}
    </section>}

    {section === 'overview' && featureAccess.labelOnly && <section className="cg-credit-panel cg-credit-active-labels" aria-label="Activated feature label prices and status">
      <header><div><span>ACTIVE LABELS &amp; BILLING</span><h2>Activated modules and their credit costs</h2></div><Coins size={22}/></header>
      <p>Only purchased active labels unlock paid modules; Dashboard, Settings, Staff Management, Roles & Permissions and SaaS Account are free. Staff still need their role permissions. Wallet Logs show actual debits.</p>
      {activeBundles.length ? <div className="cg-credit-active-label-grid">
        {activeBundles.map(bundle => {
          const period = ratePeriod(bundle.billingType);
          return <article key={bundle.id} className="cg-credit-active-label-card">
            <div className="cg-credit-active-label-head"><strong>{bundle.name}</strong><span className="cg-credit-pill active">Enabled</span></div>
            <div className="cg-credit-active-label-price">
              <strong>{credits(bundle.totalCredits)} credits</strong>
              <small>{bundle.billingType === 'permanent' ? 'Lifetime activation' : `Per ${period} activation or renewal`}</small>
            </div>
            <p>{credits(bundle.perUserCredits)} credits per active login user × {bundle.userCount ?? '—'} users</p>
            <small>{bundle.validUntil ? `Valid until ${when(bundle.validUntil)}` : bundle.billingType === 'permanent' ? 'Permanent access until switched off' : 'See active label status'}</small>
          </article>;
        })}
      </div> : <p className="cg-credit-empty">No active feature labels. Activate a published label to unlock paid workshop modules.</p>}
      <div className="cg-credit-actions">
        <button type="button" className="primary" onClick={openModulePricing} aria-controls="module-pricing">View Prices &amp; Activation </button>
        <button type="button" onClick={() => navigate('/account/credits/logs')}>Check Wallet Cash Flow <FileClock size={16}/></button>
      </div>
    </section>}

    </details>}
    {section === 'overview' && <CreditCycleCard />}
    {section === 'overview' && <div className="cg-credit-columns">
      <section className="cg-credit-panel"><header><div><span>WALLET OVERVIEW</span><h2>Your credits at a glance</h2></div><Wallet size={22}/></header>
        <p>Buy wallet credits as needed. {wallet?.billingMode === 'monthly_postpaid'
        ? 'Monthly feature usage and actual storage GB-time accumulate in the backend and settle after month-end.'
        : 'Feature activation and renewals are recorded in the company wallet ledger.'}</p>
        <div className="cg-credit-actions"><button className="primary" onClick={() => navigate('/account/credits/buy')}><CreditCard size={17}/> Buy Credits</button><button type="button" onClick={openModulePricing} aria-controls="module-pricing">Manage Features </button></div>
        {account && <div className="cg-credit-inline"><span>Company subdomain identifier</span><strong>{account.subdomain}</strong></div>}
        {account?.configuredTenantUrl && <p><a href={account.configuredTenantUrl}>{account.configuredTenantUrl}</a></p>}
        <div className="cg-credit-inline"><span>Low credit alert threshold</span><strong>{credits(wallet?.lowThreshold)} credits</strong></div>
        <div className="cg-credit-inline"><span>Staff billing basis</span><strong>{wallet?.userCount ?? '—'} active login accounts</strong></div>
      </section>
      <section className="cg-credit-panel"><header><div><span>RECENT ACTIVITY</span><h2>Latest wallet changes</h2></div><FileClock size={22}/></header>
        {logs.slice(0,5).map((row) => <div className="cg-credit-log" key={row.id}><div className={Number(row.delta) >= 0 ? 'in' : 'out'}>{Number(row.delta) >= 0 ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</div><div><strong>{row.description}</strong><small>{when(row.createdAt)}</small></div><b>{Number(row.delta) > 0 ? '+' : ''}{credits(row.delta)}</b></div>)}
        {!logs.length && <p className="cg-credit-empty">No verified credit transactions available.</p>}
        <button className="cg-credit-link" onClick={() => navigate('/account/credits/logs')}>View all logs </button>
      </section>
      <section className="cg-credit-panel cg-credit-wide"><header><div><span>MANAGE YOUR TOOLS</span><h2>Features and storage</h2></div><Zap size={22}/></header>
        <div className="cg-credit-shortcuts"><button type="button" onClick={openModulePricing} aria-controls="module-pricing"><Zap size={19}/><strong>Module Pricing</strong><small>Review activation and renewal prices</small></button>{featureAccess.isCompanyOwner && featureAccess.can('billing.view') && <button onClick={() => navigate('/account/storage')}><Database size={19}/><strong>Storage Usage</strong><small>Files, GB and real storage event history</small></button>}<button onClick={() => navigate('/account/credits/logs')}><FileClock size={19}/><strong>Wallet Logs</strong><small>Charges, top-ups and adjustments</small></button></div>
      </section>
    </div>}

    {section === 'buy' && <section className="cg-credit-panel"><header><div><h2>Choose a credit package</h2></div><CreditCard size={22}/></header>
      <div className="cg-credit-packages">{packages.filter(p => p.active).map((pack) => <article key={pack.id}>
        <span>ONE-TIME TOP-UP</span><h3>{pack.name}</h3><strong>{credits(pack.credits)} <small>credits</small></strong><p>{money(pack.priceInr)} payable</p><button className="primary" type="button" disabled={busy !== '' || !wallet?.checkoutAvailable || !wallet?.canManage} onClick={() => buy(pack)}>{busy === `package:${pack.id}` ? 'Opening payment page…' : 'Buy Credits'} </button>
      </article>)}</div>
      {!packages.some(p=>p.active) && !loading && <p className="cg-credit-empty">No credit packages have been published by the administrator.</p>}
      {wallet && !wallet.checkoutAvailable && <p className="cg-credit-note">Secure checkout is not configured on the backend yet. Buying credits is disabled.</p>}
      {wallet && !wallet.canManage && <p className="cg-credit-note">Only the company account owner can purchase credits.</p>}
      <p className="cg-credit-note"><ShieldCheck size={16}/> UPI, bank cards and net banking are provided by Razorpay when enabled for your merchant account.</p>
    </section>}

    {section === 'overview' && <section className="cg-credit-panel cg-bundle-marketplace" id="module-pricing" ref={modulePricingRef} tabIndex={-1} aria-label="Available modules">
      <header><div><span>MODULE PRICING</span><h2>Paid workshop modules ({paidBundles.length})</h2></div><Coins size={22}/></header>
      <p>Free modules above do not need a purchase. Postpaid module credits accrue only while access is ON, using the period selected by the administrator. Usage is logged now and paid on the configured due date next month, not after every period.</p>
      <div className="cg-bundle-grid">
        {paidBundles.map((bundle) => {
          const status = featureLabelStatus(bundle, wallet);
          const period = bundle.billingMode === 'monthly_postpaid' ? 'calendar month' : ({ permanent: 'lifetime', monthly: '30 days', weekly: '7 days', daily: '24 hours', hourly: '1 hour', per_use: 'use' })[bundle.billingType] || bundle.billingType;
          return <article key={bundle.id ?? `unpriced:${bundle.key}`} className="cg-bundle-card">
            <div className="cg-bundle-head">
              <h3>{bundle.name}</h3>
              <span className={bundle.active ? 'cg-credit-pill active' : 'cg-credit-pill'}>{bundle.active ? 'Active' : bundle.purchaseDisabledReason === 'FREE_MODULES_ONLY' ? 'Already free' : bundle.purchaseDisabledReason === 'MODULE_PRICE_NOT_SET' ? 'Price not set' : 'Inactive'}</span>
            </div>
            <p>{bundle.description || 'Existing workshop features grouped into one package.'}</p>
            {(bundle.workflowPaths || []).map(path => (
              <p key={path} className="cg-bundle-workflow"><strong>Connected workflow:</strong> {path}</p>
            ))}
            {bundle.workflowDependencies?.length > 0 && (
              <p className="cg-bundle-workflow">
                <strong>Works with:</strong> {bundle.workflowDependencies.map(key => ({
                  workshop_operations: 'Workshop Operations', accounts_tax: 'Accounts & Tax',
                  attendance_payroll: 'Attendance & Payroll', business_insights: 'Reports & Analytics',
                }[key] || key.replaceAll('_',' '))).join(', ')}
              </p>
            )}
            <div className="cg-bundle-price">
              {bundle.purchaseDisabledReason === 'FREE_MODULES_ONLY'
                ? <><span>Included free</span><strong>0 <small>credits — no purchase needed</small></strong></>
                : <><span>{bundle.cyclePostpaid || bundle.billingMode === 'monthly_postpaid' ? 'Usage rate (monthly settlement)' : 'Per user credits'}</span>
                  <strong>{credits(bundle.perUserCredits)} <small>credits / user / {period}</small></strong>
                  <div className="cg-bundle-summary">
                    <span>{bundle.userCount ?? '—'} active login users</span>
                    <b>{credits(bundle.totalCredits)} credits total</b>
                  </div></>}
            </div>
            <div className="cg-bundle-feature-list">
              <small>Included existing features</small>
              <div className="cg-bundle-features">
                {(bundle.includedModules?.length
                      ? bundle.includedModules
                      : (bundle.features || []).filter(item => !freeKeys.includes(item.key)).map(item => item.label)
                    ).map(label => <span key={label}>{label}</span>)}
              </div>
            </div>
            {bundle.active && <small>{bundle.validUntil ? `Available until ${when(bundle.validUntil)}` : 'Permanent entitlement'}</small>}
            {status.message && <p className="cg-bundle-reason" role="status">{status.message}</p>}
            <div className="cg-bundle-actions">
              <button className="primary" type="button" disabled={busy !== '' || purchaseRetryAt > Date.now() || !status.allow || featureAccess.billingStatus?.blocked}
                onClick={() => buyBundle(bundle)}>
                {purchaseRetryAt > Date.now() ? 'Temporarily rate limited'
                 : busy === `bundle:${bundle.id}` ? 'Saving…'
                  : !status.allow && !bundle.active ? status.label
                  : bundle.billingType === 'permanent' && bundle.active ? 'Owned permanently'
                  : bundle.purchaseDisabledReason === 'FREE_MODULES_ONLY' ? 'Included Free'
                  : bundle.billingMode === 'monthly_postpaid' ? (bundle.active ? 'Active · usage metered' : 'Switch ON · pay next month') : bundle.canResume ? 'Switch On' : bundle.active ? 'Extend access' : 'Activate access'}
              </button>
              {bundle.active && <button className="secondary" type="button" disabled={busy !== '' || !wallet?.canManage}
                onClick={() => stopBundle(bundle)}>Switch Off</button>}
            </div>
          </article>;
        })}
      </div>
      {!paidBundles.length && !loading && <p className="cg-credit-empty">No paid modules are published yet. Module pricing is managed by your SaaS administrator.</p>}
      {wallet && !wallet.canManage && <p className="cg-credit-note">Only the company account owner can purchase module access.</p>}
    </section>}

    {section === 'logs' && <div className="cg-credit-log-tabs" role="tablist" aria-label="Billing log categories">
      {[
        ['transactions', 'Credit Transactions'],
        ['features', 'Feature Activity'],
        ['statements', 'Monthly Statements'],
        ['usage', 'Usage History'],
      ].map(([key, label]) => <button type="button" role="tab" key={key}
        aria-selected={logView === key} className={logView === key ? 'is-active' : ''}
        onClick={() => setLogView(key)}>{label}</button>)}
    </div>}
    {section === 'logs' && logView === 'transactions' && <div className="cg-credit-log-filters">
      <label>Search<input type="search" placeholder="Search transactions" value={logSearch}
        onChange={e => { setLogSearch(e.target.value); setLogPage(1); }}/></label>
      <label>Type<select value={logKind} onChange={e => { setLogKind(e.target.value); setLogPage(1); }}>
        <option value="all">All types</option>
        {[...new Set(logs.map(item => item.kind).filter(Boolean))].map(kind =>
          <option key={kind} value={kind}>{kind.replaceAll('_', ' ')}</option>)}
      </select></label>
      <label>From<input type="date" value={logFrom} max={logTo || undefined}
        onChange={e => { setLogFrom(e.target.value); setLogPage(1); }}/></label>
      <label>To<input type="date" value={logTo} min={logFrom || undefined}
        onChange={e => { setLogTo(e.target.value); setLogPage(1); }}/></label>
    </div>}
    {section === 'logs' && logView === 'usage' && featureUsage && <section className="cg-credit-panel" aria-label="Metered module usage history">
      <header><div><span>TIME-BASED BILLING LOG</span><h2>Recorded usage checkpoints</h2></div><FileClock size={22}/></header>
      <details className="cg-credit-help"><summary>About usage readings</summary><p>Usage readings are company-scoped. A zero-second entry marks activation or a rate change. Previously recorded credits remain payable after a module is switched off.</p></details>
      <div className="cg-credit-table-wrap"><table><thead><tr><th>Recorded at</th><th>Module</th><th>Used time</th><th>Rate</th><th>Accrued</th><th>Login users</th></tr></thead><tbody>
        {(featureUsage.readings || []).slice().sort((a,b) => new Date(b.sampledAt) - new Date(a.sampledAt)).map(row => <tr key={row.id}>
          <td>{when(row.sampledAt)}</td><td><strong>{row.name}</strong></td>
          <td>{timeUsed(row.coveredSeconds)}</td>
          <td>{credits(row.rateCredits)} / {ratePeriod(row.billingPeriod)}</td>
          <td><strong>{credits(row.accruedCredits)}</strong></td><td>{row.userCount}</td>
        </tr>)}
        {!(featureUsage.readings || []).length && <tr><td colSpan={6} className="cg-credit-empty">No usage checkpoints yet. Start a module, then switch it OFF or refresh after metering.</td></tr>}
      </tbody></table></div>
      <p className="cg-credit-note">These are credits, not rupees. Monthly statements are authoritative for wallet settlement. Usage checkpoints do not individually debit the wallet.</p>
    </section>}

    {section === 'logs' && logView === 'features' && <section className="cg-credit-panel" aria-label="Feature activation history">
      <header><h2>Feature On / Off history</h2></header>
      <div className="cg-credit-table-wrap"><table><thead><tr><th>Date &amp; time</th><th>Change</th><th>Module / label</th><th>Changed by</th></tr></thead><tbody>
        {featureActivity.slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(row => <tr key={row.id}><td>{when(row.createdAt)}</td><td>{row.event.replaceAll('_', ' ')}</td><td>{row.details?.name || row.details?.feature || '—'}</td><td>{row.actor || 'System'}</td></tr>)}
        {!featureActivity.length && <tr><td colSpan={4}>No feature changes recorded.</td></tr>}
      </tbody></table></div>
    </section>}

    {section === 'logs' && logView === 'statements' && <section className="cg-credit-panel" aria-label="Monthly postpaid usage statements">
      <header><div><span>MONTH-END FEATURE &amp; STORAGE BILLING</span><h2>Monthly usage statements</h2></div><Database size={22}/></header>
      <p>Only completed-month charges are settled from the company wallet. Unpaid credits remain outstanding.</p>
      <div className="cg-credit-table-wrap"><table><thead><tr><th>Period</th><th>Features</th><th>Storage</th><th>Total credits</th><th>Due date</th><th>Status</th></tr></thead>
        <tbody>
          {monthlyStatements.slice().sort((a,b) => String(b.period).localeCompare(String(a.period))).map((row) => <tr key={row.id}>
            <td><strong>{row.period}</strong></td><td>{credits(row.featureCredits)}</td>
            <td>{credits(row.storageCredits)}</td><td><strong>{credits(row.totalCredits)}</strong></td>
            <td>{row.dueAt ? new Date(row.dueAt).toLocaleDateString() : '—'}</td>
            <td><span className={row.status === 'paid' ? 'cg-credit-pill active' : 'cg-credit-pill'}>{row.overdue ? 'overdue' : row.status}</span></td>
          </tr>)}
          {!monthlyStatements.length && <tr><td colSpan={6} className="cg-credit-empty">No completed-month usage statements yet.</td></tr>}
        </tbody></table></div>
      <p className="cg-credit-note">Each statement is locked to the company and calendar month; wallet debits are recorded below with a unique reference.</p>
    </section>}

    {section === 'logs' && logView === 'transactions' && <section className="cg-credit-panel"><header><div><span>COMPANY AUDIT TRAIL</span><h2>Credit Transactions</h2></div><FileClock size={22}/></header>
      <div className="cg-credit-table-wrap"><table><thead><tr><th>Date & time</th><th>Activity</th><th>Credits</th><th>Balance after</th><th>Reference</th></tr></thead><tbody>
        {visibleLogs.map(row => <tr key={row.id}><td>{when(row.createdAt)}</td><td><strong>{row.description}</strong><small>{row.kind}</small></td><td className={Number(row.delta)>=0?'positive':'negative'}>{Number(row.delta)>0?'+':''}{credits(row.delta)}</td><td>{credits(row.balanceAfter)}</td><td>{row.reference || '—'}</td></tr>)}
        {!filteredLogs.length && <tr><td colSpan={5} className="cg-credit-empty">No transactions found.</td></tr>}
      </tbody></table></div>
      <div className="cg-credit-log-pagination">
        <span>{filteredLogs.length} matching records · Page {Math.min(logPage,logPages)} of {logPages}</span>
        <button type="button" disabled={logPage <= 1} onClick={() => setLogPage(p => Math.max(1,p-1))}>Previous</button>
        <button type="button" disabled={logPage >= logPages} onClick={() => setLogPage(p => Math.min(logPages,p+1))}>Next</button>
      </div>
      <p className="cg-credit-note">Logs are read-only and company-scoped. {featureAccess.isCompanyOwner && featureAccess.can('billing.view') && <>For storage upload/delete events, open <button onClick={() => navigate('/account/storage/history')}>Storage History </button>.</>}</p>
    </section>}
  </div>;
}
