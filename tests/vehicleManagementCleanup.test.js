import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { knownVehicleMoney, vehicleInvoiceRows, vehicleTotalPaid, latestFirstVehicleJobs } from '../src/pages/vehicles/vehicleProfileFinancials.js';
import { extractVehicleFieldErrors, requiredVehicleFields } from '../src/pages/vehicles/vehicleFormValidation.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const list = read('src/pages/vehicles/VehicleList.jsx');
const profile = read('src/pages/vehicles/VehicleDetails.jsx');
const add = read('src/pages/vehicles/AddVehicle.jsx');
const edit = read('src/pages/vehicles/EditVehicle.jsx');
const directory = read('src/components/vehicles/VehicleDirectoryPanel.jsx');
const header = read('src/components/vehicles/VehiclesHeader.jsx');
const stats = read('src/components/vehicles/VehicleOverviewStats.jsx');
const search = read('src/components/vehicles/VehicleSearchToolbar.jsx');
const gallery = read('src/components/vehicles/VehiclePhotoGallery.jsx');
const css = read('src/styles/vehicle-compact-cleanup.css');
const routes = read('src/routes/AppRoutes.jsx');

test('all four Vehicle Management routes preserve the existing pages and lazy imports', () => {
  for (const route of [
    'path="/vehicles" element={<VehicleList />}',
    'path="/vehicles/new" element={<AddVehicle />}',
    'path="/vehicles/:id" element={<VehicleDetails />}',
    'path="/vehicles/:id/edit" element={<EditVehicle />}',
  ]) assert.ok(routes.includes(route), route);
  for (const page of [list, profile, add, edit])
    assert.ok(page.includes("vehicle-compact-cleanup.css"), 'Missing scoped vehicle styling');
});

test('list has compact header, 4 real KPI labels and no duplicate search aria-label', () => {
  assert.doesNotMatch(header, /Customer vehicles, active jobs, service schedules and insurance reminders/);
  assert.doesNotMatch(header, /Workshop Fleet/);
  for (const name of ['Total Vehicles','Open Jobs','Service Due','Insurance Due'])
    assert.ok(stats.includes(name), name);
  assert.doesNotMatch(stats, /active workshop jobs|renewal attention|due within 30 days/);
  assert.equal((search.match(/aria-label="Search vehicles"/g) || []).length, 1);
  assert.match(search, /Clear vehicle search/);
  assert.match(search, /type="search"/);
  assert.match(list, /new Set\(vehicles\.flatMap/);
  assert.match(list, /vehicleService\.getVehicles\(\)/);
  assert.match(list, /jobService\.getJobs\(\)/);
  assert.match(list, /customerService\.getCustomers\(\)/);
});

test('directory preserves required desktop columns and mobile permission-controlled actions', () => {
  for (const name of ['Registration','Make / Model','Customer','Last Service','Next Service','Open Job','Status','Actions'])
    assert.ok(directory.includes('<th scope="col">'+name+'</th>'), name);
  assert.doesNotMatch(directory, /Open profiles, review active jobs or create a new Job Card/);
  assert.match(directory, /onNavigate\(\`\/vehicles\/\$\{vehicle\.id\}\`\)/);
  assert.match(directory, /onNavigate\(\`\/jobs\/\$\{vehicle\.openJob\.id\}\/overview\`\)/);
  assert.match(directory, /hasPermission\(user, 'vehicles.edit'\)/);
  assert.match(directory, /hasPermission\(user, 'jobs.create'\)/);
  assert.match(directory, /vehicle-mobile-meta/);
});

test('vehicle profile has exactly five tabs, true job and photo actions, concise sections', () => {
  for (const id of ['overview','service-history','parts','invoices','reminders']) {
    assert.ok(profile.includes("id: '"+id+"'"), id);
  }
  assert.match(profile, /<VehiclePhotoGallery vehicleId=\{vehicle\.id\} canEdit=\{canEdit\}/);
  // Delete is now non-destructive archive; restoring is an explicit owner action.
  assert.match(profile, /vehicleService\.archiveVehicle\(vehicle\.id\)/);
  assert.match(profile, /vehicleService\.restoreVehicle\(vehicle\.id\)/);
  assert.match(profile, /Service and invoice records will be preserved/);
  assert.match(profile, /hasPermission\(user, 'vehicles.delete'\)/);
  assert.match(profile, /hasPermission\(user, 'jobs.create'\)/);
  assert.match(profile, /role="alert"/);
  assert.doesNotMatch(profile, /Registration, engine and workshop reference information/);
  assert.doesNotMatch(profile, /Workshop stock and outside-purchase parts used on this vehicle/);
  assert.doesNotMatch(profile, /Vehicle-level billing and outstanding balances/);
  assert.doesNotMatch(gallery, /Historical vehicle photos remain accessible without copying files/);
  for (const action of ['setPublished','LiveVehicleCamera','vehiclePhotoService.upload','vehiclePhotoService.file'])
    assert.ok(gallery.includes(action), action);
  assert.match(profile, /Total Paid/);
  assert.match(profile, /Current Job/);
});

test('only finalized invoice numbers yield invoice rows; money never falls back to estimates or invented zero', () => {
  const jobs = [
    {id:'j-estimate',createdDate:'2026-11-06',estimates:[{grandTotal:9400}],billing:{}},
    {id:'j-invoice',createdDate:'2026-11-05',billing:{
      invoiceNumber:'INV-100',invoiceTotal:'1200.50',paidAmount:'900.25',outstandingBalance:'300.25'}},
    {id:'j-missing',createdDate:'2026-11-04',billing:{invoiceNumber:'INV-101',invoiceTotal:'550',paidAmount:null}},
  ];
  const invoices = vehicleInvoiceRows(jobs);
  assert.equal(invoices.length,2);
  assert.equal(invoices[0].total,1200.5);
  assert.equal(invoices[0].paid,900.25);
  assert.equal(invoices[0].balance,300.25);
  assert.equal(invoices[1].paid,null);
  assert.equal(vehicleTotalPaid(invoices),null);
  assert.equal(vehicleTotalPaid(invoices.slice(0,1)),900.25);
  assert.equal(vehicleTotalPaid([]),null);
  assert.equal(knownVehicleMoney(null),null);
  assert.equal(knownVehicleMoney(undefined),null);
  assert.equal(knownVehicleMoney(''),null);
  assert.equal(knownVehicleMoney('unavailable'),null);
  assert.equal(knownVehicleMoney(0),0);
  assert.deepEqual(latestFirstVehicleJobs(jobs).map(j=>j.id),['j-estimate','j-invoice','j-missing']);
  assert.match(profile, /vehicleInvoiceRows\(history\)/);
  assert.doesNotMatch(profile, /job\.estimates\?\.at\(-1\)\?\.grandTotal/);
  assert.match(profile, /displayMoney\(invoice\.balance\)/);
});

test('vehicle forms never fabricate owners, registration, mileage, dates or customer records', () => {
  assert.doesNotMatch(add, /CUS-0001|Rahul Kumar/);
  // Examples in placeholders are allowed, but saved initial form values must be empty.
  for (const key of ['regNo','make','model','variant','year','color','odometer','vin','engineNo','lastServiceDate','nextServiceDue','insuranceExpiry']) {
    assert.ok(add.includes(key+": ''"), key);
  }
  assert.match(add, /customerId: preselectedCustId,/);
  assert.match(add, /options=\{customerOptions\}/);
  assert.match(add, /customerService\.getCustomers\(\)/);
  assert.match(add, /customerLoadError/);
  assert.match(add, /Retry customers/);
  assert.match(add, /Select fuel type/);
  assert.match(add, /Select transmission/);
  assert.match(edit, /vehicleService\.getVehicleById\(id\)/);
  assert.match(edit, /vehicleService\.updateVehicle\(id,/);
  assert.match(add, /vehicleService\.createVehicle\(payload\)/);
});

test('backend field errors map correctly and required fields require real owner', () => {
  const rows=[{id:'real-customer'}];
  assert.deepEqual(requiredVehicleFields({customerId:'real-customer',regNo:'KL 10 A 1234',make:'Tata',model:'Tiago'},rows),{});
  const errors=requiredVehicleFields({customerId:'CUS-FAKE',regNo:'',make:'',model:''},rows);
  assert.ok(errors.customerId);
  assert.ok(errors.regNo);
  assert.ok(errors.make);
  assert.ok(errors.model);
  assert.deepEqual(extractVehicleFieldErrors({response:{data:{
    registration:['Duplicate registration'],customer_id:['Customer is required'],engine_no:['Invalid engine no']
  }}}),{regNo:'Duplicate registration',customerId:'Customer is required',engineNo:'Invalid engine no'});
  for (const page of [add,edit]){
    assert.match(page, /requiredVehicleFields\(formData, customers\)/);
    assert.match(page, /extractVehicleFieldErrors\(/);
    assert.match(page, /focusFirstVehicleError\(formRef\.current/);
    assert.match(page, /noValidate onSubmit=/);
    assert.match(page, /error=\{fieldErrors\.regNo\}/);
    assert.match(page, /error=\{fieldErrors\.customerId\}/);
    assert.match(page, /error=\{fieldErrors\.insuranceExpiry\}/);
  }
  assert.match(edit, /catch\(\(cause\) =>/);
  assert.match(edit, /setLoadError\(/);
});

test('Add Vehicle retains upload retry using saved ID and does not duplicate vehicle creation', () => {
  assert.match(add, /const \[savedVehicleId, setSavedVehicleId\] = useState\(''\)/);
  assert.match(add, /let vehicleId = savedVehicleId/);
  assert.match(add, /if \(!vehicleId\) \{/);
  assert.match(add, /vehiclePhotoService\.upload\(\{ vehicleId, \.\.\.photo \}\)/);
  assert.match(add, /setPhotos\(\(items\) => items\.filter/);
  assert.match(add, /retry to upload remaining photos/);
  assert.match(add, /if \(submitting\) return/);
  assert.match(edit, /if \(submitting\) return/);
});

test('small screens use clear compact controls while preserving light/dark tokens and camera gallery', () => {
  for (const selector of [
    '.cg-vehicles.vehicle-dashboard .vehicle-dashboard-search',
    '.cg-vehicles.vehicle-dashboard .vehicle-mobile-card',
    '.cg-vehicles.vehicle-profile-page .vehicle-profile-tabs',
    '.cg-vehicles.vehicle-form-page [data-cg-input-shell="true"]',
    '.cg-vehicles.vehicle-form-page .cg-searchable-trigger',
    '@media(max-width:767px)', '@media(max-width:360px)',
    'min-height:44px','font-size:16px','var(--surface)','var(--border)','var(--primary)','var(--danger)'
  ]) assert.ok(css.includes(selector),selector);
  assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /\.app-sidebar\s*\{/);
});
