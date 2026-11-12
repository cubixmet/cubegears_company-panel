import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from '../hooks/useAuth';
import { settingsService } from '../services/settings.service';

export const CompanyContext = createContext(null);

export const CompanyProvider = ({ children }) => {
  // The authenticated Django profile is the source of company identity.
  // Never render a shared demo company in a real user's workshop session.
  const { user } = useAuth();
  const source = user?.company;
  const [override, setOverride] = useState(null);
  const companyId = source?.id || null;
  const [logoUrl, setLogoUrl] = useState('');
  const [logoVersion, setLogoVersion] = useState(0);

  // One authenticated, tenant-scoped fetch shared by the mobile header,
  // desktop sidebar and mobile drawer. Never expose the private media URL.
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setLogoUrl('');
    if (companyId) {
      settingsService.getCompanyLogo()
        .then((blob) => {
          if (!active || !blob || !blob.type?.startsWith('image/')) return;
          objectUrl = URL.createObjectURL(blob);
          setLogoUrl(objectUrl);
        })
        .catch(() => { /* An absent logo uses a workshop icon. */ });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [companyId, logoVersion]);

  useEffect(() => {
    const onUpdate = () => setLogoVersion((version) => version + 1);
    window.addEventListener('cubixgear:company-logo-updated', onUpdate);
    return () => window.removeEventListener('cubixgear:company-logo-updated', onUpdate);
  }, []);

  const company = useMemo(() => {
    if (!source?.id) return null;
    return {
      ...source,
      ...(override?.id === String(source.id) ? override.changes : {}),
      id: source.id,
    };
  }, [source, override]);

  const setCompany = useCallback((update) => {
    if (!source?.id) return;
    setOverride((previous) => {
      const prior = previous?.id === String(source.id) ? previous.changes : {};
      const value = typeof update === 'function' ? update({ ...source, ...prior }) : update;
      if (!value || typeof value !== 'object' || Array.isArray(value)) return previous;
      const { id: _ignoredId, ...changes } = value;
      return { id: String(source.id), changes };
    });
  }, [source]);

  return (
    <CompanyContext.Provider value={{ company, setCompany, logoUrl }}>
      {children}
    </CompanyContext.Provider>
  );
};
