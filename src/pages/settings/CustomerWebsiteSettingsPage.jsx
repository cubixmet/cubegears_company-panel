import {useCallback,useEffect,useState} from 'react';
import { appConfirm } from '../../components/common/appDialogs';
import { Link } from 'react-router-dom';
import {AlertCircle,ArrowUpRight,Check,Copy,Globe2,Palette,RefreshCw,ShieldCheck,Trash2} from 'lucide-react';
import apiClient from '../../api/apiClient';
import { customerWebsiteAddresses, isLocalCustomerWebsiteDevelopment } from '../../utils/customerWebsiteAddresses';
import '../../styles/customer-website-settings.css';

const empty = {
  public_name:'', description:'', welcome_message:'', contact_phone:'',
  whatsapp_phone:'', primary_color:'#116f69', secondary_color:'#e4f2ec'
};
const labels = {
  public_name:'Public Workshop Name', description:'Website Description',
  welcome_message:'Welcome Message', contact_phone:'Contact Number',
  whatsapp_phone:'WhatsApp Number', primary_color:'Primary Brand Color',
  secondary_color:'Secondary Brand Color'
};

function ErrorMessage({children}) {
  return children ? <div className="cws-error" role="alert"><AlertCircle size={16}/>{children}</div> : null;
}

export default function CustomerWebsiteSettingsPage(){
  const [fields,setFields] = useState(empty);
  const [subdomain,setSubdomain] = useState('');
  const [subdomainLabel,setSubdomainLabel] = useState('');
  const [subdomainDraft,setSubdomainDraft] = useState('');
  const [wildcardReady,setWildcardReady] = useState(false);
  const [subdomainSaving,setSubdomainSaving] = useState(false);
  const [logo,setLogo] = useState(false);
  const [domains,setDomains] = useState([]);
  const [hostname,setHostname] = useState('');
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [requesting,setRequesting] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  const load = useCallback(async ()=>{
    setLoading(true);setError('');
    try {
      const [website, domainRows] = await Promise.all([
        apiClient.get('/company/customer-website'),
        apiClient.get('/company/customer-website/domains')
      ]);
      setFields(Object.fromEntries(Object.keys(empty).map(k=>[k,website[k]??empty[k]])));
      setSubdomain(website.subdomain||'');
      setSubdomainLabel(website.subdomainLabel||'');
      setSubdomainDraft(website.subdomainLabel||'');
      setWildcardReady(website.wildcardReady===true);
      setLogo(!!website.hasLogo);
      setDomains(Array.isArray(domainRows)?domainRows:[]);
    } catch(e) {setError(e.message||'Could not load your website settings.');}
    finally {setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const update=(key,value)=>{
    setFields(old=>({...old,[key]:value}));
    setNotice('');
  };

  async function save(event){
    event.preventDefault();
    if(saving)return;
    setSaving(true);setError('');setNotice('');
    try {
      const saved=await apiClient.patch('/company/customer-website',fields);
      setFields(old=>({...old,...saved}));
      setNotice('Website branding saved. The updated settings will appear on your Customer Website.');
    }catch(e){setError(e.message||'Unable to save settings.');}
    finally{setSaving(false);}
  }

  async function updateDefaultSubdomain(event){
    event.preventDefault();
    if(subdomainSaving)return;
    const label=subdomainDraft.trim().toLowerCase();
    if(!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(label)){
      setError('Use 3–63 lowercase letters, numbers or hyphens.');
      return;
    }
    if(label===subdomainLabel)return;
    if(!await appConfirm(
      'Change your default website address? Existing customer links using the previous subdomain will need to be sent again.'
    ))return;
    setSubdomainSaving(true);setError('');setNotice('');
    try{
      const changed=await apiClient.patch('/company/customer-website/subdomain',{label});
      setSubdomain(changed.subdomain);
      setSubdomainLabel(changed.subdomainLabel);
      setSubdomainDraft(changed.subdomainLabel);
      setWildcardReady(changed.wildcardReady===true);
      setNotice(changed.message||'Default website address updated.');
    }catch(e){
      setError(e?.response?.data?.label||e?.message||'Could not change this website address.');
    }finally{setSubdomainSaving(false);}
  }

  async function requestDomain(event){
    event.preventDefault();
    if(requesting||!hostname.trim())return;
    setRequesting(true);setError('');setNotice('');
    try{
      const result=await apiClient.post('/company/customer-website/domains',{hostname:hostname.trim()});
      setDomains(old=>[result,...old]);
      setHostname('');
      setNotice(result.lastError ? "Saved, but Vercel setup needs attention: "+result.lastError : "Domain created. Open Manage Domains, DNS & SSL to copy records and verify.");
    }catch(e){setError(e.message||'Could not submit domain request.');}
    finally{setRequesting(false);}
  }

  async function disableDomain(domain){
    if(!await appConfirm('Disable this custom domain? Existing customer data will be preserved.'))return;
    setError('');setNotice('');
    try{
      await apiClient.delete('/company/customer-website/domains/'+domain.id);
      setDomains(old=>old.map(d=>d.id===domain.id?{...d,status:'disabled',isPrimary:false}:d));
      setNotice('Custom domain disabled.');
    }catch(e){setError(e.message||'Could not disable domain.');}
  }

  const primaryDomain = domains.find(d=>d.isPrimary && d.status==='active' && d.sslStatus==='ready' && d.ownershipVerified && d.dnsConfigured);
  const websiteReady = Boolean(primaryDomain || wildcardReady);
  const urls = customerWebsiteAddresses({
    subdomain, subdomainLabel, primaryDomain, wildcardReady,
    localDevelopment: isLocalCustomerWebsiteDevelopment(
      import.meta.env.DEV, window.location.hostname
    ),
  });
  const websiteUrl = urls.displayUrl;

  async function copyLink(){
    if(!urls.canOpen || !websiteUrl)return;
    try{
      await navigator.clipboard.writeText(websiteUrl);
      setNotice(urls.isLocalPreview ? 'Local website address copied.' : 'Website address copied.');
    }catch{setError('Unable to copy. Please copy the address manually.');}
  }

  if(loading)return <main className="cws-page"><div className="cws-loading" role="status"><RefreshCw size={18}/>Loading Customer Website settings…</div></main>;

  return <main className="cws-page">
    <div className="cws-top">
      <div><span className="cws-eyebrow"><Globe2 size={15}/> CubeGears Customer Website</span><h1>Customer Website</h1>
        <p>Manage your workshop's public identity, website address and customer-facing branding.</p></div>
      <button type="button" className="cws-btn cws-secondary" onClick={load}><RefreshCw size={17}/>Refresh</button>
    </div>
    <ErrorMessage>{error}</ErrorMessage>
    {notice&&<div className="cws-success" role="status"><Check size={17}/>{notice}</div>}
    <div className="cws-cards">
      <section className="cws-card">
        <div className="cws-heading"><div className="cws-square"><Globe2 size={23}/></div><div><h2>Your Customer Website</h2><p>Visitors see your workshop website at the domain root.</p></div></div>
        <div className="cws-domain-url">
          <span>{websiteUrl || 'Website domain not configured'}</span>
          <button type="button" aria-label="Copy website URL" onClick={copyLink} disabled={!urls.canOpen||!websiteUrl}><Copy size={17}/></button>
        </div>
        {urls.isLocalPreview&&<p className="cws-local-domain-info">
          <strong>Local development website</strong>
          <span>Production address: {urls.productionUrl || 'Not configured'} {websiteReady ? '(available only when deployed)' : '(DNS / HTTPS activation pending)'}</span>
        </p>}
        <div className="cws-actions">
          {urls.canOpen&&websiteUrl&&<a className="cws-btn cws-primary" href={websiteUrl} target="_blank" rel="noopener noreferrer">Open Website <ArrowUpRight size={16}/></a>}
          <Link to="/settings/customer-website/domains" className="cws-btn cws-secondary">Add My Own Domain / DNS Settings</Link>
        </div>
        <form className="cws-subdomain-form" onSubmit={updateDefaultSubdomain}>
          <label className="cws-field"><span>Default Website Subdomain</span>
            <div className="cws-subdomain-field">
              <input type="text" value={subdomainDraft} maxLength={63} required
                autoCapitalize="none" spellCheck={false}
                aria-label="Default website subdomain name"
                onChange={event=>setSubdomainDraft(event.target.value.toLowerCase())}/>
              <span>{urls.suffix}</span>
            </div>
          </label>
          <button type="submit" className="cws-btn cws-secondary"
            disabled={subdomainSaving||!subdomainDraft.trim()||subdomainDraft.trim()===subdomainLabel}>
            {subdomainSaving?'Saving…':'Update Subdomain'}
          </button>
          <small>Names are unique for every workshop. Changing this address does not change your login. Existing customer links on the old hostname must be sent again.</small>
        </form>
        {!wildcardReady&&<p className="cws-warning" role="status">
          Production address reserved in CubeGears. Platform wildcard DNS and HTTPS have not been marked ready yet; do not share the production address until activation.
        </p>}
        <div className="cws-hint"><ShieldCheck size={17}/><span>
          {urls.isLocalPreview
            ? 'Local preview uses your saved workshop subdomain. Production DNS/HTTPS verification is separate.'
            : primaryDomain
              ? 'Primary verified domain. Default subdomain: '+subdomain
              : 'Using default subdomain. DNS and HTTPS must be live before the website opens publicly.'}
        </span></div>
      </section>

      <section className="cws-card">
        <div className="cws-heading"><div className="cws-square"><Palette size={23}/></div><div><h2>Website Branding</h2><p>Changes will appear across your customer-facing pages.</p></div></div>
        <form onSubmit={save}>
          <div className="cws-form-grid">
            {['public_name','welcome_message','contact_phone','whatsapp_phone'].map(key=><label className="cws-field" key={key}><span>{labels[key]}</span>
              <input name={key} value={fields[key]} maxLength={key==='public_name'?180:key==='welcome_message'?240:30} onChange={e=>update(key,e.target.value)} placeholder={labels[key]}/></label>)}
            <label className="cws-field cws-wide"><span>{labels.description}</span><textarea rows={3} name="description" maxLength={500} value={fields.description} onChange={e=>update('description',e.target.value)} placeholder="Describe your workshop and services."/></label>
            {['primary_color','secondary_color'].map(key=><label className="cws-field" key={key}><span>{labels[key]}</span><div className="cws-color"><input type="color" value={/^#[0-9a-f]{6}$/i.test(fields[key])?fields[key]:empty[key]} aria-label={labels[key]+' picker'} onChange={e=>update(key,e.target.value)}/>
              <input value={fields[key]} name={key} pattern="#[0-9A-Fa-f]{6}" maxLength={7} onChange={e=>update(key,e.target.value)} aria-label={labels[key]+' HEX value'}/></div></label>)}
          </div>
          <div className="cws-preview" style={{'--cws-preview':/^#[0-9a-f]{6}$/i.test(fields.primary_color)?fields.primary_color:'#116f69'}}>
            <div className="cws-preview-logo">{logo?'LOGO':'CG'}</div><div><small>Website Preview</small><h3>{fields.public_name||'Your Workshop'}</h3><p>{fields.welcome_message||fields.description||'Your service updates, all in one place.'}</p></div>
          </div>
          <div className="cws-actions"><a className="cws-btn cws-secondary" href="/settings">Manage Workshop Logo <ArrowUpRight size={16}/></a><button type="submit" className="cws-btn cws-primary" disabled={saving}>{saving?'Saving…':'Save Branding'}</button></div>
        </form>
      </section>

      <section className="cws-card">
        <div className="cws-heading"><div className="cws-square"><Globe2 size={23}/></div><div><h2>Custom Domain</h2><p>Use your own domain after DNS ownership and HTTPS verification.</p></div></div>
        <Link to="/settings/customer-website/domains" className="cws-btn cws-primary" style={{marginBottom:16}}>Manage Domains, DNS & SSL <ArrowUpRight size={16}/></Link>
        <form className="cws-domain-form" onSubmit={requestDomain}><label className="cws-field"><span>Domain Name</span>
          <input type="text" value={hostname} maxLength={253} onChange={e=>setHostname(e.target.value)} placeholder="portal.yourworkshop.com" required autoCapitalize="none" spellCheck={false}/></label>
          <button className="cws-btn cws-primary" disabled={requesting} type="submit">{requesting?'Submitting…':'Request Domain'}</button></form>
        <div className="cws-hint"><ShieldCheck size={17}/>Unverified domains never serve customer records. Exact DNS records must come from your hosting provider.</div>
        <div className="cws-domain-list">
          {!domains.length&&<p className="cws-muted">No custom domains requested yet.</p>}
          {domains.map(d=><div className="cws-domain-item" key={d.id}>
            <div><strong>{d.hostname}</strong><span className={'cws-domain-status is-'+d.status}>{d.status.replaceAll('_',' ')}</span></div>
            <div className="cws-domain-actions">{d.status==='active'&&<a href={'https://'+d.hostname} target="_blank" rel="noreferrer noopener" aria-label={'Open '+d.hostname}><ArrowUpRight size={18}/></a>}
              {d.status!=='disabled'&&<button type="button" aria-label={'Disable '+d.hostname} onClick={()=>disableDomain(d)}><Trash2 size={17}/></button>}</div>
          </div>)}
        </div>
      </section>
    </div>
  </main>;
}
