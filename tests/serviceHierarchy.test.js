import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCategoryTreeRows, categoryIsDescendantOf } from '../src/utils/serviceHierarchy.js';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Unlimited practical categories sort root then descendants and retain path', () => {
  const rows = [
    {id:'a',name:'Body Work',parentId:''},
    {id:'c',name:'Door Painting',parentId:'b'},
    {id:'b',name:'Painting',parentId:'a'},
    {id:'d',name:'Front Door Painting',parentId:'c'},
    {id:'x',name:'Mechanical',parentId:''},
  ];
  const ordered=buildCategoryTreeRows(rows);
  assert.deepEqual(ordered.map(x=>x.id), ['a','b','c','d','x']);
  assert.deepEqual(ordered.map(x=>x.depth), [0,1,2,3,0]);
  assert.equal(ordered[3].path, 'Body Work › Painting › Door Painting › Front Door Painting');
  assert.equal(categoryIsDescendantOf('a','d',rows),true);
  assert.equal(categoryIsDescendantOf('d','a',rows),false);
});

test('Orphaned and malformed legacy categories remain visible', () => {
  const rows=[{id:'o',name:'Orphan',parentId:'missing'},{id:'z',name:'Leaf',parentId:'o'}];
  const result=buildCategoryTreeRows(rows);
  assert.deepEqual(new Set(result.map(x=>x.id)),new Set(['o','z']));
});

test('Current Services UI retains add-only category hierarchy and real API mappings', () => {
  const page=read('src/pages/services/ServiceList.jsx');
  const header=read('src/components/services/ServicesHeader.jsx');
  const api=read('src/services/service.service.js');
  const css=read('src/styles/service-hierarchy.css');
  assert.ok(page.includes('buildCategoryTreeRows(categories)'));
  assert.ok(page.includes('Main Category (root)'));
  assert.ok(page.includes('onSubmit={saveCategory}'));
  assert.ok(page.includes('serviceService.createServiceCategory({'));
  assert.ok(header.includes('onAddCategory'));
  assert.ok(header.includes('Add Category'));
  assert.ok(page.includes('GST Treatment'));
  assert.ok(page.includes('SAC / HSN'));
  assert.ok(api.includes('categoryPayload'));
  assert.ok(api.includes('servicePayload'));
  assert.ok(api.includes('apiClient.patch('));
  assert.match(css, /@media\(max-width:700px\)/);
});
