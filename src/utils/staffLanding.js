import { routeConfig } from '../routes/routeConfig.js';
import { getPermissionForPath, hasPermission } from './permissions.js';

/** Only send a signed-in staff member to an actual permitted workshop page. */
export const getStaffLandingPath = (user, requestedPath = '') => {
  if (user?.isCompanyOwner === true) return user?.onboardingRequired ? '/onboarding' : '/account';
  const requested = typeof requestedPath === 'string' ? requestedPath.trim() : '';
  const safePath = requested.startsWith('/') && !requested.startsWith('//')
    && !requested.includes('\\') ? requested : '';
  const pathname = safePath.split(/[?#]/, 1)[0];
  const allowedRoute = routeConfig.some((route) =>
    pathname === route.path || pathname.startsWith(route.path + '/'));
  const required = getPermissionForPath(pathname);
  if (safePath && allowedRoute && required && hasPermission(user, required)) {
    return safePath;
  }
  const defaultRoute = routeConfig.find((route) =>
    !route.permission || hasPermission(user, route.permission));
  return defaultRoute?.path || '/access-denied';
};
