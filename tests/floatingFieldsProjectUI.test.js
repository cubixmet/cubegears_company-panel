import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('src/App.jsx');
const css = read('src/styles/floating-fields.css');
const input = read('src/components/ui/Input.jsx');
const select = read('src/components/ui/Select.jsx');
const textarea = read('src/components/ui/Textarea.jsx');
const phone = read('src/components/ui/PhoneInput.jsx');
const searchable = read('src/components/common/forms/SearchableSelect.jsx');

test('shared form controls are outlined with visible associated floating labels', () => {
  assert.match(app, /import '\.\/styles\/floating-fields\.css'/);
  for (const [name, component] of [['Input',input],['Select',select],
    ['Textarea',textarea],['PhoneInput',phone]]) {
    assert.match(component, /<Label htmlFor=\{inputId\}/,name);
    assert.match(component, /cg-floating-label/,name);
    assert.match(component, /aria-invalid=\{Boolean\(error\)\}/,name);
    assert.match(component, /data-cg-input-wrapper|cg-floating-phone/,name);
  }
  assert.match(css,/--cg-floating-height: 48px/);
  assert.match(css,/--cg-floating-radius: 10px/);
  assert.match(css,/\.cg-floating-field:focus-within \.cg-floating-label/);
  assert.match(css,/\.cg-floating-control:not\(:placeholder-shown\)/);
  assert.match(css,/select\.cg-floating-control/);
  assert.match(css,/\.cg-floating-control\[aria-invalid=true\]/);
  assert.match(css,/font-size: 16px !important/);
  assert.match(css,/var\(--text-primary\)/);
});

test('searchable select is keyboard operable, themed, and clears values without altering parent state', () => {
  assert.match(searchable,/role="combobox"/);
  assert.match(searchable,/role="listbox"/);
  assert.match(searchable,/role="option"/);
  assert.match(searchable,/aria-expanded=\{isOpen\}/);
  assert.match(searchable,/ArrowDown/);
  assert.match(searchable,/ArrowUp/);
  assert.match(searchable,/Escape/);
  assert.match(searchable,/event\.key === 'Enter'/);
  assert.match(searchable,/document\.addEventListener\('pointerdown'/);
  assert.match(searchable,/onChange\?\.\(''\)/);
  assert.match(css,/\.cg-floating-searchable \.cg-searchable-menu/);
  assert.match(css,/\.cg-floating-searchable \.cg-searchable-list/);
});

test('unnecessary descriptions removed, critical stock and tax rules retained', () => {
  const stock = read('src/pages/stock/StockEasyPage.jsx');
  const work = read('src/components/jobs/JobWorkStockPanel.jsx');
  const labour = read('src/components/jobs/OutsideLabourPanel.jsx');
  assert.doesNotMatch(stock,/cg-easy-tax-guidance/);
  assert.match(stock,/validGstRate/);
  assert.ok(stock.includes('label="GST Component / Rate *"'));
  assert.doesNotMatch(stock,/Choose the total GST rate applicable to this part\./);
  assert.match(work,/Stock is deducted only after confirming Issue Stock/);
  assert.match(labour,/Expenses View permission/);
  assert.match(labour,/No outside staff added\./);
  assert.match(css,/prefers-reduced-motion/);
});

test('native input state/validation and no floating overlay for checkbox, toggle or file upload', () => {
  assert.match(input,/placeholder=\{label \? \(placeholder \|\| ' '\) : placeholder\}/);
  assert.match(input,/required=\{required\} disabled=\{disabled\}/);
  assert.match(select,/options\.map\(/);
  assert.match(textarea,/rows=\{rows\}/);
  assert.doesNotMatch(css,/input\[type="checkbox"\]\s*\{/);
  assert.doesNotMatch(css,/p\s*\{\s*display:\s*none/);
});
