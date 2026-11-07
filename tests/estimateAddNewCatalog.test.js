import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateEstimateCatalogDraft, buildEstimateCatalogSelection,
} from '../src/components/jobs/estimateNewCatalog.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const panel = read('../src/components/jobs/QuickEstimatePanel.jsx');
const picker = read('../src/components/jobs/EstimateCatalogPicker.jsx');
const modal = read('../src/components/jobs/EstimateAddCatalogModal.jsx');
const stylesheet = read('../src/styles/job-estimate-quick.css');

const work = { kind: 'service', name: 'Brake Labour', workType: 'Labour', price: '500' };
const part = { kind: 'part', name: 'Air Filter', sku: 'FIL-A1', brand: '', costPrice: '200', price: '350' };

test('Add New Work accepts description and rate without a required category', () => {
  assert.deepEqual(validateEstimateCatalogDraft(work), {});
  assert.deepEqual(validateEstimateCatalogDraft({ ...work, price: '0.00' }), {});
  assert.match(validateEstimateCatalogDraft({ ...work, name: ' ' }).name, /work/i);
  assert.match(validateEstimateCatalogDraft({ ...work, price: '' }).price, /work rate/i);
  assert.match(validateEstimateCatalogDraft({ ...work, name: 'a'.repeat(161) }).name, /too long/i);
});

test('Add New Spare Part requires unique SKU, purchase cost and selling price', () => {
  assert.deepEqual(validateEstimateCatalogDraft(part), {});
  assert.match(validateEstimateCatalogDraft({ ...part, sku: '' }).sku, /SKU/i);
  assert.match(validateEstimateCatalogDraft({ ...part, costPrice: '' }).costPrice, /purchase cost/i);
  assert.match(validateEstimateCatalogDraft({ ...part, price: '' }).price, /selling price/i);
  assert.match(validateEstimateCatalogDraft({ ...part, sku: 'x'.repeat(81) }).sku, /80/i);
  assert.match(validateEstimateCatalogDraft({ ...part, name: 'x'.repeat(181) }).name, /too long/i);
  assert.deepEqual(validateEstimateCatalogDraft({ ...part, costPrice: '0', price: '0' }), {});
});

test('invalid prices cannot silently create catalogue entries', () => {
  for (const price of ['-1', 'Infinity', 'NaN', '', '5.555', '10000001']) {
    assert.ok(validateEstimateCatalogDraft({ ...work, price }).price, price);
    assert.ok(validateEstimateCatalogDraft({ ...part, costPrice: price }).costPrice, price);
  }
});

test('new catalogue selections preserve backend IDs and quote type', () => {
  assert.deepEqual(buildEstimateCatalogSelection(part, {
    id: 'part-id', partName: 'Air Filter', sku: 'FIL-A1', sellingPrice: '375.00',
  }), {
    description: 'Air Filter', type: 'Part', unitPrice: '375.00', catalogId: 'part-id', catalogCode: 'FIL-A1',
  });
  assert.deepEqual(buildEstimateCatalogSelection({ ...work, workType: 'Service' }, {
    id: 'svc-id', name: 'Brake Labour', price: '500.00', code: 'SVC-123',
  }), {
    description: 'Brake Labour', type: 'Service', unitPrice: '500.00',
    catalogId: 'svc-id', catalogCode: 'SVC-123',
  });
});

test('Work & Labour and Spare Parts have Search & Select and Add New', () => {
  assert.match(panel, /onClick=\{\(\) => addLine\('Labour'\)\}/);
  assert.match(panel, /onClick=\{\(\) => addLine\('Part'\)\}/);
  assert.doesNotMatch(panel, /is-catalog-add/);
  assert.match(picker, /Add New Work/);
  assert.match(picker, /Add New Spare Part/);
  assert.match(panel, /<EstimateCatalogPicker/);
  assert.match(panel, /onAddNew=\{\(name\) => openCatalogCreate/);
  assert.match(picker, /job-quick-catalog-add-new/);
  assert.match(picker, /onClick=\{addNew\}/);
  assert.match(picker, /onClick=\{\(\) => choose\(row\)\}/);
  assert.match(modal, /<ResponsiveModalSheet/);
  assert.match(modal, /Save Part & Add/);
  assert.match(modal, /Save Work & Add/);
});

test('new catalogue entries save to the correct live API and only then add quote items', () => {
  assert.match(panel, /await stockCatalogService\.createItem/);
  assert.match(panel, /await serviceService\.createService/);
  assert.match(panel, /onHand: 0/);
  assert.match(panel, /buildEstimateCatalogSelection\(draft, created\)/);
  assert.match(panel, /selectCatalog\(catalogRequest\.lineKey, selection\)/);
  assert.match(panel, /addLine\(selection\.type, selection\)/);
  assert.match(panel, /setCatalogError\(error\?\.message/);
  assert.match(panel, /if \(!selection\.catalogId\)/);
});

test('Approve & Continue persists fresh and edited estimate drafts without a Save Draft button', () => {
  assert.match(panel, /'Approve & Continue'/);
  assert.doesNotMatch(panel, /'Save Draft'/);
  assert.doesNotMatch(panel, /Update Draft/);
  assert.match(panel, /Approve & Continue/);
  assert.match(panel, /latest\?\.status === 'Draft' && !stale/);
  assert.match(panel, /savedEstimateRef\.current\?\.id/);
  assert.match(panel, /await jobService\.saveQuickJobEstimate\(job\.id/);
  assert.match(panel, /await onApprove\?\.\(target\.id, target\.version\)/);
  assert.match(panel, /, draftId\);/);
  assert.match(panel, /await onApprove\?\.\(target\.id, target\.version\)/);
  assert.match(stylesheet, /job-quick-group-actions/);
  assert.match(stylesheet, /job-estimate-create-two/);
});
