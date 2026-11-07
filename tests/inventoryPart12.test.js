import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('Part 12 live inventory screens use Django branch balance and atomic stock endpoints', () => {
  const screen = source('src/components/stock/InventoryBranchOperations.jsx');
  for (const endpoint of ['/stock/branch-balances', '/stock/transfer', '/stock/audit']) {
    assert.ok(screen.includes(endpoint), `Missing live API ${endpoint}`);
  }
  assert.match(screen, /stockCatalogService\.getItems/);
  assert.match(screen, /branchService\.getBranches/);
  assert.match(screen, /requestKey: key\(\)/);
  assert.match(screen, /USE_MOCK_API/);
  assert.match(screen, /Number\(transfer\.quantity\) > Number\(selected\.available\)/);
  assert.match(screen, /onSubmitTransfer/);
  assert.match(screen, /onSubmitCount/);
});

test('Stock page loads real branch operations and reuses request key during retries', () => {
  const page = source('src/pages/stock/StockEasyPage.jsx');
  assert.match(page, /import InventoryBranchOperations/);
  assert.match(page, /<InventoryBranchOperations onChanged=\{reload\}/);
  assert.match(page, /requestKey: inventoryRequestKey\(\)/);
  assert.match(page, /requestKey: move\.requestKey/);
  assert.match(page, /selected\.branchAvailable/);
});

test('Catalog adapter shows branch available quantities without changing company-wide ledger total', () => {
  const adapter = source('src/services/stockCatalog.service.js');
  assert.match(adapter, /branchOnHand: number\(item\.branchOnHand \?\? item\.onHand\)/);
  assert.match(adapter, /available: number\(item\.branchAvailable/);
  assert.match(adapter, /stockQuantity/);
});

test('Part 12 transfer and physical count forms are responsive and stay accessible', () => {
  const screen = source('src/components/stock/InventoryBranchOperations.jsx');
  const css = source('src/styles/inventory-branch-operations.css');
  assert.match(screen, /aria-label="Live branch inventory operations"/);
  assert.match(screen, /role="alert"/);
  assert.match(screen, /role="status"/);
  assert.match(css, /max-width: 640px/);
  assert.match(css, /overflow: auto/);
  assert.match(css, /height: 44px/);
});

test('Category management uses the real main/subcategory API and product picker', () => {
  const tree = source('src/components/stock/InventoryCategories.jsx');
  const page = source('src/pages/stock/StockEasyPage.jsx');
  assert.match(tree, /apiClient\.post\('\/stock\/categories'/);
  assert.match(tree, /Add Main Category/);
  assert.match(tree, /Add Subcategory/);
  assert.match(tree, /parent: parent \|\| null/);
  assert.match(page, /<InventoryCategories onChanged=\{reload\}/);
  assert.match(page, /x\.parentName/);
});
