import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/stock/StockEasyPage.jsx', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../src/services/stockCatalog.service.js', import.meta.url), 'utf8');

test('Add New Part does not show editable SKU input or hold SKU in new-part state', () => {
  assert.doesNotMatch(page, /label="SKU \(leave empty to auto-generate\)"/);
  assert.doesNotMatch(page, /value=\{part\.sku\}/);
  assert.doesNotMatch(page, /const initialPart = [^\n]*sku:/);
  assert.match(catalog, /payload\.sku\?\.trim\(\) \? \{ sku:/);
});

test('Supplier purchase quantity accepts nonnegative values to two decimal places', () => {
  assert.match(page, /const openingText = String\(part\.stockQuantity \?\? ''\)\.trim\(\)/);
  assert.match(page, /!\s*\/\^\\d\+\(\?:\\\.\\d\{1,2\}\)\?\$\//);
  const pattern = /^\d+(?:\.\d{1,2})?$/;
  for (const value of ['0', '0.0', '0.00', '2', '12.3', '12.34']) {
    assert.ok(pattern.test(value), value + ' must be valid');
  }
  for (const value of ['-1', '1.234', '1e3', 'abc', '1.', '-0.01']) {
    assert.ok(!pattern.test(value), value + ' must be rejected');
  }
  assert.match(page, /data-field="stockQuantity"/);
  assert.match(page, /partErrors\.stockQuantity/);
  assert.match(page, /scrollIntoView/);
});