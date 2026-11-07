import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path,import.meta.url),'utf8');

test('workshop website gets backend default address without creating Vercel domain per tenant',()=>{
  const source=read('src/pages/settings/CustomerWebsiteSettingsPage.jsx');
  assert.match(source,/website\.subdomainLabel/);
  assert.match(source,/website\.wildcardReady/);
  assert.match(source,/apiClient\.patch\('\/company\/customer-website\/subdomain',\{label\}\)/);
  assert.match(source,/Update Subdomain/);
  assert.match(source,/Existing customer links/);
  assert.match(source,/Default address reserved in CubeGears/);
  assert.match(source,/websiteReady = Boolean\(primaryDomain \|\| wildcardReady\)/);
  assert.match(source,/Add My Own Domain \/ DNS Settings/);
  assert.match(source,/!websiteReady\|\|!websiteHost/);
});

test('verified optional custom domains have DNS/TXT instructions and preserve default site',()=>{
  const source=read('src/pages/settings/CustomerWebsiteDomainsPage.jsx');
  assert.match(source,/Required DNS Records from Vercel/);
  assert.match(source,/dnsRecords/);
  assert.match(source,/verificationRecords/);
  assert.match(source,/Verify DNS/);
  assert.match(source,/Refresh DNS \/ SSL/);
  assert.match(source,/previous website address will still work/);
  assert.match(read('src/styles/customer-website-settings.css'),/\.cws-subdomain-form/);
});
