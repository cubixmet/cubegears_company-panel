import test from 'node:test';
import assert from 'node:assert/strict';
import { supplierComponentChoices, previewManualPurchaseTax } from '../src/utils/manualGstComponents.js';

test('purchase component menu has ten independent rates and common zero option', () => {
  const expected = [
    'CGST 2.5%', 'CGST 5%', 'CGST 9%', 'CGST 18%',
    'SGST 2.5%', 'SGST 5%', 'SGST 9%', 'SGST 18%',
    'IGST 5%', 'IGST 18%', '0% — Select Classification',
  ];
  assert.deepEqual(supplierComponentChoices().map(row => row.label), expected);
  assert.equal(supplierComponentChoices('UTGST')[4].label, 'UTGST 2.5%');
});

test('CGST-only selection on ₹20 gives only ₹0.50, not auto SGST', () => {
  const result = previewManualPurchaseTax({
    quantity: '1', purchaseRate: '20', taxComponents: ['cgst:2.5'],
  }, 'cgst_sgst');
  assert.equal(result.cgst, 0.5);
  assert.equal(result.stateTax, 0);
  assert.equal(result.igst, 0);
  assert.equal(result.total, 20.5);
  assert.equal(result.status, 'incomplete');
});

test('manual CGST/SGST pair, UTGST pair and IGST alone preview valid', () => {
  for (const [mode, label, choices, tax] of [
    ['cgst_sgst', 'SGST', ['cgst:2.5', 'sgst:2.5'], 1],
    ['cgst_sgst', 'UTGST', ['cgst:9', 'utgst:9'], 3.6],
    ['igst', 'SGST', ['igst:18'], 3.6],
  ]) {
    const result = previewManualPurchaseTax({
      quantity: 1, purchaseRate: 20, taxComponents: choices,
    }, mode, label);
    assert.equal(result.tax, tax);
    assert.equal(result.status, 'valid');
  }
});

test('0% classification remains explicit rather than automatically exempt', () => {
  const draft = { quantity: 1, purchaseRate: 20, taxComponents: ['zero'] };
  assert.equal(previewManualPurchaseTax(draft, 'cgst_sgst').status, 'incomplete');
  assert.equal(previewManualPurchaseTax({ ...draft, gstTreatment: 'exempt' }, 'cgst_sgst').status, 'valid');
  assert.equal(previewManualPurchaseTax({ ...draft, gstTreatment: 'zero_rated' }, 'igst').status, 'incomplete');
  assert.equal(previewManualPurchaseTax({
    ...draft, gstTreatment: 'zero_rated', zeroRatingBasis: 'sez',
  }, 'igst').status, 'valid');
});

test('supplier single page rejects mismatched CGST SGST IGST jurisdiction', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/components/suppliers/SupplierPurchaseFlow.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes("row.gstChoice.split(':')[0]"));
  assert.match(source, /GST component does not match the Supplier State and Place of Supply/);
});
