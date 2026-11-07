import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('src/pages/services/ServiceList.jsx');
const css = read('src/styles/service-borderless-forms.css');
const legacy = read('src/styles/service-management.css');
const toolbar = read('src/components/services/ServiceFilterToolbar.jsx');

test('Services borderless CSS is scoped and loaded after legacy input styling', () => {
  assert.match(page, /import '..\/..\/styles\/service-management\.css';\s*import '..\/..\/styles\/service-borderless-forms\.css';/);
  assert.match(legacy, /\.service-field input,[\s\S]*?border: 1px solid var\(--service-border\)/);
  assert.match(css, /\.service-form-page \.service-form/);
  assert.match(css, /\.service-category-form/);
  assert.match(css, /\.cg-services\.service-dashboard \.service-dashboard-search/);
  assert.match(css, /\.service-dashboard-toolbar > select/);
  assert.doesNotMatch(css, /\.cg-customers/);
  assert.doesNotMatch(css, /\.cg-easy-stock/);
});

test('Add and Edit Service/Category editors use borderless accessible 16px fields', () => {
  assert.match(css, /border:0 !important/);
  assert.match(css, /background:var\(--surface-2\) !important/);
  assert.match(css, /font-size:16px !important/);
  assert.match(css, /font-size:14px !important/);
  assert.match(css, /min-height:50px !important/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline:2px solid var\(--primary\) !important/);
  assert.match(css, /@media \(max-width:767px\)/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /safe-area-inset-bottom/);
  for (const label of [
    'Add Service', 'Edit Service', 'Service Code', 'Service Name', 'Category',
    'Pricing Type', 'Default Selling Rate (₹)', 'Estimated Duration (minutes)',
    'Description', 'Checklist — one item per line', 'Save Service',
    'Add Category', 'Save Category', 'Main Category (root)',
  ]) assert.ok(page.includes(label), label);
});

test('Services directory search field uses one focus outline and no double border', () => {
  assert.match(toolbar, /className="service-dashboard-search"/);
  assert.match(css, /\.service-dashboard-search input/);
  assert.match(css, /border:0 !important/);
  assert.match(css, /\.service-dashboard-search:focus-within/);
  assert.match(css, /outline:2px solid var\(--primary\) !important/);
  assert.match(css, /height:48px !important/);
});

test('All existing save and price calculations remain untouched', () => {
  assert.match(page, /serviceService\.createService\(payload\)/);
  assert.match(page, /serviceService\.updateService\(id, payload\)/);
  assert.ok(page.includes('serviceService.createServiceCategory({'));
  assert.ok(page.includes('onSubmit={saveCategory}'));
  assert.match(page, /price: Number\(form\.price \|\| 0\)/);
});
