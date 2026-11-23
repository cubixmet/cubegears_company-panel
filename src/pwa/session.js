export function inventoryScope(user) {
  const workshop = user?.company?.id;
  const branch = user?.branch?.id;
  if (!user?.id || !workshop || !branch || user.onboardingRequired ||
      (user.allowedBranchIds && !user.allowedBranchIds.includes(String(branch)))) return null;
  return { user: String(user.id), workshop: String(workshop), branch: String(branch) };
}

// General PWA access is company scoped even if the owner has no selected
// branch. Inventory drafts remain stricter and still require a valid branch.
export function offlineUserScope(user) {
  const workshop = user?.company?.id || user?.companyId;
  const branch = user?.branch?.id;
  if (!user?.id || !workshop || user.onboardingRequired ||
      (branch && user.allowedBranchIds && !user.allowedBranchIds.includes(String(branch)))) return null;
  return {
    user: String(user.id),
    workshop: String(workshop),
    branch: branch ? String(branch) : null,
  };
}

export const scopeKey = (scope) => scope ? JSON.stringify(scope) : '';

function accessClaims() {
  try {
    const payload = localStorage.getItem('auth_token')?.split('.')[1];
    return JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/')));
  } catch {
    return {};
  }
}

export function accessDeadline(user) {
  const claims = accessClaims();
  return user?.id && claims.token_type === 'access' && String(claims.user_id) === String(user.id)
    ? Number(claims.exp) * 1000 : 0;
}

const verificationKey = 'cubixgear:verified-offline-session';

export function rememberVerifiedSession(user) {
  const key = scopeKey(offlineUserScope(user));
  if (key && accessDeadline(user) > Date.now()) localStorage.setItem(verificationKey, key);
  else forgetVerifiedSession();
}

export function forgetVerifiedSession() {
  localStorage.removeItem(verificationKey);
}

export function offlineSessionDeadline(user) {
  const key = scopeKey(offlineUserScope(user));
  return key && key === localStorage.getItem(verificationKey) ? accessDeadline(user) : 0;
}
