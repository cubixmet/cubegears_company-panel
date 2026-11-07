import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  customerEstimateDeclines, DECLINE_REASON_LABELS,
} from '../src/components/jobs/customerEstimateDeclines.js';

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const oldId='12345678-1234-1234-1234-123456789abc';
const newId='87654321-4321-4321-4321-cba987654321';

test('decline response is attached to the original immutable estimate id', () => {
  const activities=[
    {id:'receipt-one',event:'Customer Estimate Declined',
      metadata:{estimateId:oldId,version:1,declineReason:'price',
        declineNote:'Please reduce the amount.'}},
    {id:'receipt-two',event:'Customer Estimate Accepted',
      metadata:{estimateId:newId,version:2}},
  ];
  const replies=customerEstimateDeclines(activities);
  assert.equal(replies.size,1);
  assert.equal(replies.get(oldId).reason,'price');
  assert.equal(replies.get(oldId).reasonLabel,DECLINE_REASON_LABELS.price);
  assert.equal(replies.get(oldId).note,'Please reduce the amount.');
  assert.equal(replies.get(oldId).version,1);
  assert.equal(replies.get(oldId).receiptId,'receipt-one');
  assert.equal(replies.has(newId),false);
});

test('invalid or oversized feedback is not rendered as an arbitrary customer note', () => {
  const id='abcdefab-aaaa-bbbb-cccc-abcdefabcdef';
  const replies=customerEstimateDeclines([
    {id:'bad',event:'Customer Estimate Declined',metadata:{
      estimateId:'not-a-uuid',declineNote:'ignored',
    }},
    {id:'valid',event:'Customer Estimate Declined',metadata:{
      estimateId:id,declineReason:'unknown-code',declineNote:'x'.repeat(501),
    }},
  ]);
  assert.equal(replies.size,1);
  assert.equal(replies.get(id).reason,'unspecified');
  assert.equal(replies.get(id).note,'');
  assert.equal(customerEstimateDeclines(null).size,0);
});

test('workshop Job Card displays response and receipt before the staff creates a revision', () => {
  const panel=file('src/components/jobs/QuickEstimatePanel.jsx');
  assert.match(panel,/customerEstimateDeclines\(job\?\.activities\)/);
  assert.match(panel,/latest\?\.status === 'Customer Rejected'/);
  assert.match(panel,/job-estimate-customer-feedback/);
  assert.match(panel,/Customer requested an estimate revision/);
  assert.match(panel,/latestDecline\.reasonLabel/);
  assert.match(panel,/latestDecline\.note/);
  assert.match(panel,/Estimate History/);
  assert.match(panel,/job-estimate-history-feedback/);
  assert.match(panel,/declineByEstimate\.get\(String\(item\.id\)\)/);
  assert.match(panel,/Save & Share with Customer/);
  const styles=file('src/styles/job-estimate-iphone.css');
  assert.match(styles,/\.job-estimate-customer-feedback/);
  assert.match(styles,/@media\(max-width:600px\)/);
});
