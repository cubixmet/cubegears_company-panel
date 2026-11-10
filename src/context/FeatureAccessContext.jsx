import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import apiClient from '../api/apiClient';
import { useLocation } from 'react-router-dom';
import { isAccountOnly } from '../utils/accountWorkspace';
import { useAuth } from '../hooks/useAuth';

// UI filtering only. Django tenant permissions and entitlements remain authoritative.
const FeatureAccessContext = createContext(null);
const LOCKED = Object.freeze({
  enforced: true, labelOnly: false, activeLabelModules: [], nextLabelExpiryAt: null,
  modules: [], permissions: [], freeModules: [], canManageFeatures: false, unavailable: true, userKey: '',
  billingHold: false, billingCycle: null,
});
const CORE_MODULES = new Set(['billing', 'settings', 'company', 'storage', 'notifications', 'roles']);
const userIdentity = (user) => user?.id
  ? String(user.id) + ':' + String(user.companyId || user.company?.id || '')
  : '';

export function moduleIsVisible(access, permission) {
  if (!permission) return true;
  if (!access || access.unavailable) return false;
  const module = permission.split('.')[0];
  if (access.billingStatus?.blocked) return module === 'billing' && access.isCompanyOwner === true;
  if (isAccountOnly(access)) return module === 'billing' && access.isCompanyOwner === true;
  // The backend explicitly lists free modules. They still require the exact
  // tenant/role permission returned by Django; free != unrestricted access.
  // Self-attendance is a free, employee-specific permission verified by Django.
  // Do not open paid attendance manager or payroll with this exception.
  if (permission === 'attendance.self') return access.permissions.includes(permission);
  if (access.freeModules?.includes(module)) return access.permissions.includes(permission);
  // Storage history and settings live inside the owner's SaaS Account.
  // The Django role/owner checks remain authoritative for every API request;
  // this does not unlock Storage for staff or grant any missing permission.
  if (module === 'storage' && access.isCompanyOwner) return access.permissions.includes(permission);
  // Keep wallet, activation, security and account recovery reachable.
  if (access.paidAccessRequired) {
    if (module === 'billing') return access.isCompanyOwner === true;
    if (module === 'company' || module === 'dashboard') return access.permissions.includes(permission);
    return access.permissions.includes(permission);
  }
  if (CORE_MODULES.has(module)) return true;
  if (module === 'dashboard') return access.permissions.includes('dashboard.view');
  // Paid workshop modules in label-only mode MUST belong to an activated
  // company label AND the server-authorized role permission intersection.
  if (access.labelOnly && !access.activeLabelModules.includes(module)) return false;
  return !access.enforced || access.modules.includes(module);
}

export function FeatureAccessProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const userKey = userIdentity(user);
  const [access, setAccess] = useState(LOCKED);
  const [loading, setLoading] = useState(false);
  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    if (!isAuthenticated || !userKey) {
      setAccess(LOCKED);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.get('/saas/credits/access');
      if (typeof response?.enforcementEnabled !== 'boolean' ||
          !Array.isArray(response?.enabledModules) || !Array.isArray(response?.permissions)) {
        throw new Error('Invalid feature access response');
      }
      const expectedCompany = user?.companyId || user?.company?.id;
      if (expectedCompany && response.companyId && String(expectedCompany) !== String(response.companyId)) {
        throw new Error('Access response belongs to a different company');
      }
      // Route changes or browser focus may overlap requests; ignore stale
      // permission responses so they cannot overwrite the current tenant.
      if (requestId !== latestRequestRef.current) return;
      setAccess({
        userKey,
        companyId: response.companyId,
        billingStatus: response.billingStatus || {enabled:false, blocked:false},
        enforced: response.enforcementEnabled,
        labelOnly: response.labelOnly === true,
        activeLabelModules: Array.isArray(response.activeLabelModules)
          ? response.activeLabelModules.filter(item => typeof item === 'string') : [],
        nextLabelExpiryAt: typeof response.nextLabelExpiryAt === 'string'
          ? response.nextLabelExpiryAt : null,
        modules: response.enabledModules.filter(item => typeof item === 'string'),
        freeModules: Array.isArray(response.freeModules)
          ? response.freeModules.filter(item => ['dashboard', 'settings', 'staff', 'roles', 'billing'].includes(item)) : [],
        permissions: response.permissions.filter(item => typeof item === 'string'),
        canManageFeatures: response.canManageFeatures === true,
        billingHold: response.billingHold === true,
        billingCycle: response.billingCycle && typeof response.billingCycle === 'object'
          ? response.billingCycle : null,
        isCompanyOwner: response.isCompanyOwner === true,
        paidAccessRequired: response.paidAccessRequired === true,
        unavailable: false,
      });
    } catch {
      // Offline/invalid entitlement results never unlock another tenant's modules.
      if (requestId === latestRequestRef.current) setAccess({ ...LOCKED, userKey });
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [isAuthenticated, userKey]);

  useEffect(() => {
    refresh();
    window.addEventListener('cubegear:credits-updated', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('cubegear:credits-updated', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh, location.pathname]);

  const current = access.userKey === userKey ? access : LOCKED;
  // Time-limited labels disappear at expiry even if the browser stays open.
  useEffect(() => {
    if (!current.labelOnly || !current.nextLabelExpiryAt) return undefined;
    const expiry = new Date(current.nextLabelExpiryAt).getTime();
    if (!Number.isFinite(expiry)) return undefined;
    const delay = Math.min(Math.max(expiry - Date.now() + 150, 0), 2147483647);
    const id = window.setTimeout(refresh, delay);
    return () => window.clearTimeout(id);
  }, [current.labelOnly, current.nextLabelExpiryAt, refresh]);
  // Only the first verification (or a tenant/user change) blocks the shell.
  // Route/focus refreshes still fetch current server permissions, but keep the
  // verified page mounted instead of replacing it with a full-page loader.
  const checking = (loading && current.unavailable) ||
    (isAuthenticated && Boolean(userKey) && access.userKey !== userKey);
  useEffect(() => {
    if (!current.billingStatus?.enabled) return undefined;
    const id = window.setInterval(refresh, 60000);
    return () => window.clearInterval(id);
  }, [current.billingStatus?.enabled, refresh]);
  const can = useCallback((permission) => {
    if (!permission) return true;
    if (!isAuthenticated || checking || current.unavailable || !moduleIsVisible(current, permission)) return false;
    // Always trust the freshly verified server permission intersection, even when paid gating is off.
    return current.permissions.includes(permission);
  }, [isAuthenticated, checking, current]);

  const value = useMemo(() => ({ ...current, loading: checking, refresh, can }), [current, checking, refresh, can]);
  return <FeatureAccessContext.Provider value={value}>{children}</FeatureAccessContext.Provider>;
}

export function useFeatureAccess() {
  const context = useContext(FeatureAccessContext);
  if (!context) throw new Error('useFeatureAccess must be inside FeatureAccessProvider');
  return context;
}
