import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search, UserRound, X } from 'lucide-react';
import { customerService } from '../../services/customer.service';
import { PhoneInput } from '../common/PhoneInput';
import { JOB_PHONE_COUNTRIES, splitInternationalPhone, joinInternationalPhone, validInternationalPhone } from '../../utils/jobCreateAdapters';

const resultsOf = (data) => Array.isArray(data) ? data : data?.results || [];

export function JobCustomerPicker({ selectedCustomer, onSelect, onCreated, disabled = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ name: '', phone: '', email: '', address: '' });
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(selectedCustomer?.name || '');
  }, [selectedCustomer?.id, selectedCustomer?.name]);

  useEffect(() => {
    const onOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setExpanded(false);
      }
    };
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setExpanded(false);
        setAdding(false);
      }
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  useEffect(() => {
    if (!expanded || adding || selectedCustomer?.name === query) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await customerService.getCustomers({ search: query.trim(), status: 'active' });
        if (!cancelled) {
          setResults(resultsOf(data).filter((c) => c.status !== 'archived').slice(0, 12));
          setError('');
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setError('Could not load customers. Check your connection.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, expanded, adding, selectedCustomer?.name]);

  const pick = (customer) => {
    onSelect(customer);
    setQuery(customer.name);
    setExpanded(false);
    setAdding(false);
    setError('');
  };
  const clear = () => {
    onSelect(null);
    setQuery('');
    setExpanded(true);
    setError('');
  };

  const openNew = () => {
    onSelect(null);
    const phoneQuery = /\d{6,}/.test(query) ? query.trim() : '';
    const phoneParts = splitInternationalPhone(phoneQuery);
    setPhoneCountryCode(phoneParts.country);
    setDraft({
      name: phoneQuery ? '' : query.trim(),
      phone: phoneQuery ? joinInternationalPhone(phoneParts.country, phoneParts.national) : '',
      email: '', address: ''
    });
    setAdding(true);
    setExpanded(false);
    setError('');
  };

  const create = async (event) => {
    event.preventDefault();
    if (saving) return;
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    if (!name || !validInternationalPhone(phone)) {
      setError('Enter a customer name and a valid phone number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const dupe = await customerService.checkDuplicateCustomer({ phone });
      if (dupe?.duplicate && dupe.customer) {
        pick(dupe.customer);
        setError('Existing customer found and selected. No duplicate was created.');
        return;
      }
      const customer = await customerService.createCustomer({
        name, phone, email: draft.email.trim(), address: draft.address.trim(),
        customerType: 'individual', status: 'active'
      });
      if (!customer?.id) throw new Error('Customer was not saved. Try again.');
      pick(customer);
      onCreated?.(customer);
    } catch (err) {
      const data = err?.response?.data;
      const detail = data?.phone?.[0] || data?.name?.[0] || data?.detail;
      setError(detail || err?.message || 'Unable to add customer.');
    } finally {
      setSaving(false);
    }
  };

  const phoneParts = splitInternationalPhone(draft.phone, phoneCountryCode);

  return (
    <div className="job-customer-picker" ref={containerRef}>
      <div className="job-customer-heading">
        <div>
          <h3><UserRound size={17} aria-hidden="true"/> Select Customer</h3>
          <p>Find an existing customer or add a new one.</p>
        </div>
        <button type="button" className="job-customer-add-trigger" onClick={openNew} disabled={disabled || saving}>
          <Plus size={15} aria-hidden="true"/> Add Customer
        </button>
      </div>

      <div className="job-customer-search">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search customer by name or phone"
          aria-expanded={expanded}
          aria-controls="job-customer-search-results"
          autoComplete="off"
          value={query}
          disabled={disabled || saving}
          placeholder="Search name or phone number"
          onFocus={() => { if (!selectedCustomer) setExpanded(true); }}
          onChange={(event) => {
            if (selectedCustomer) onSelect(null);
            setQuery(event.target.value);
            setExpanded(true);
            setAdding(false);
            setError('');
          }}
        />
        {selectedCustomer ? (
          <button type="button" aria-label="Clear selected customer" onClick={clear} disabled={disabled}><X size={15}/></button>
        ) : (
          <ChevronDown size={15} aria-hidden="true" className="job-customer-search-arrow"/>
        )}
      </div>
      {selectedCustomer && !adding && (
        <div className="job-customer-picked"><Check size={15} aria-hidden="true"/> Selected: <strong>{selectedCustomer.name}</strong> <span>{selectedCustomer.phone}</span></div>
      )}

      {expanded && !adding && !selectedCustomer && (
        <div id="job-customer-search-results" className="job-customer-results" aria-label="Customer search results">
          {loading ? <p role="status">Searching customers…</p> : (
            <>
              {results.map((customer) => (
                <button key={customer.id} type="button" onClick={() => pick(customer)}>
                  <UserRound size={16} aria-hidden="true" />
                  <span><strong>{customer.name}</strong><small>{customer.phone}{customer.email ? ' · ' + customer.email : ''}</small></span>
                </button>
              ))}
              {!results.length && <p>No customers found. Add a new customer below.</p>}
            </>
          )}
          <button type="button" className="job-customer-results-add" onClick={openNew}>
            <Plus size={15} aria-hidden="true"/> Add New Customer
          </button>
        </div>
      )}

      {adding && (
        <div className="job-customer-create-form" onKeyDown={event => { if (event.key === "Enter" && !["TEXTAREA", "SELECT", "BUTTON"].includes(event.target.tagName)) { event.preventDefault(); create(event); } }}>
          <div className="job-customer-create-head">
            <h4>New Customer</h4>
            <button type="button" aria-label="Close customer form" onClick={() => { setAdding(false); setError(''); }} disabled={saving}><X size={16}/></button>
          </div>
          <div className="job-customer-create-fields">
            <label>Customer Name *
              <input required name="newCustomerName" value={draft.name} disabled={saving}
                onChange={e => setDraft(old => ({ ...old, name: e.target.value }))} placeholder="Full name" />
            </label>
            <PhoneInput label="Phone Number" labelPosition="above" name="newCustomerPhone" required
              className="job-create-phone job-customer-phone"
              countryCode={phoneParts.country} countries={JOB_PHONE_COUNTRIES} value={phoneParts.national} disabled={saving}
              onCountryCodeChange={(code) => {
                setPhoneCountryCode(code);
                setDraft(old => ({ ...old, phone: joinInternationalPhone(code, phoneParts.national) }));
              }}
              onChange={(event) => setDraft(old => ({
                ...old, phone: joinInternationalPhone(phoneParts.country, event.target.value),
              }))} placeholder="Mobile number" />
            <label>Email
              <input type="email" name="newCustomerEmail" value={draft.email} disabled={saving}
                onChange={e => setDraft(old => ({ ...old, email: e.target.value }))} placeholder="Optional" />
            </label>
            <label>Address
              <input name="newCustomerAddress" value={draft.address} disabled={saving}
                onChange={e => setDraft(old => ({ ...old, address: e.target.value }))} placeholder="Optional" />
            </label>
          </div>
          <div className="job-customer-create-actions">
            <button type="button" onClick={() => setAdding(false)} disabled={saving}>Cancel</button>
            <button type="button" onClick={create} disabled={saving}>{saving ? 'Saving…' : 'Save & Select Customer'}</button>
          </div>
        </div>
      )}
      {error && <p className="job-customer-error" role="alert">{error}</p>}
    </div>
  );
}
