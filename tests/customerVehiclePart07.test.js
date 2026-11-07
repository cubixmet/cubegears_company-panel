import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('customer creation and updates use real Django data and preserve GSTIN', () => {
  const service = read('src/services/customer.service.js');
  const page = read('src/pages/customers/AddCustomer.jsx');
  assert.match(service, /toCustomerPayload\(data\)/);
  assert.match(service, /payload\.gstin = payload\.gstNo/);
  assert.match(service, /apiClient\.patch\(\x60\$\{API_ENDPOINTS\.CUSTOMERS\}/);
  assert.match(page, /customerService\.getCustomerBranches\(/);
  assert.match(page, /customerService\.checkDuplicateCustomer\(/);
  assert.match(page, /customerService\.createCustomer\(/);
  assert.doesNotMatch(page, /Main Garage Branch|Kochi South Branch|sendWhatsappUpdate: true/);
});

test('vehicle registration links to selected customer via live API', () => {
  const vehicleService = read('src/services/vehicle.service.js');
  const add = read('src/pages/vehicles/AddVehicle.jsx');
  const edit = read('src/pages/vehicles/EditVehicle.jsx');
  assert.match(add, /customerId: preselectedCustId/);
  assert.match(add, /vehicleService\.createVehicle\(payload\)/);
  assert.match(edit, /vehicleService\.updateVehicle\(/);
  assert.match(vehicleService, /apiClient\.post\(API_ENDPOINTS\.VEHICLES, payload\)/);
  assert.match(vehicleService, /apiClient\.patch\(\x60\$\{API_ENDPOINTS\.VEHICLES\}/);
});

test('vehicle archive and restore preserve historical service data', () => {
  const service = read('src/services/vehicle.service.js');
  const detail = read('src/pages/vehicles/VehicleDetails.jsx');
  const directory = read('src/components/vehicles/VehicleDirectoryPanel.jsx');
  assert.match(service, /archiveVehicle/);
  assert.match(service, /restoreVehicle/);
  assert.match(detail, /vehicleService\.archiveVehicle/);
  assert.match(detail, /vehicleService\.restoreVehicle/);
  assert.match(detail, /Service and invoice records will be preserved/);
  assert.doesNotMatch(detail, /Delete Vehicle/);
  assert.match(directory, /vehicle\.customerStatus/);
});

test('customer archive has real restore UI and disables new vehicle/job actions', () => {
  const detail = read('src/pages/customers/CustomerDetails.jsx');
  const service = read('src/services/customer.service.js');
  assert.match(detail, /customerService\.restoreCustomer/);
  assert.match(detail, /Restore Customer/);
  assert.match(detail, /disabled=\{archived\}/);
  assert.match(service, /apiClient\.post\(\x60\$\{API_ENDPOINTS\.CUSTOMERS\}\/\$\{id\}\/restore/);
});
