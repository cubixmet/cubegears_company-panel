import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('workshop quote is explicitly shared/withdrawn through authorized backend endpoints', () => {
  const service = source('src/services/job.service.js');
  assert.match(service,/export const shareJobEstimate = async/);
  assert.match(service,/\['share', 'withdraw'\]/);
  assert.match(service,/\/share/);
  assert.match(service,/shareJobEstimate,/);
  assert.match(source('src/pages/jobs/JobCardWorkspace.jsx'),/onShare=\{async \(estimateId, action\)/);
  assert.match(source('src/pages/jobs/JobCardWorkspace.jsx'),/jobService\.shareJobEstimate\(job\.id, estimateId, action\)/);
});

test('staff can save then share immutable quote and see customer decision without inventing acceptance', () => {
  const panel = source('src/components/jobs/QuickEstimatePanel.jsx');
  assert.match(panel,/saveDraftForDecision/);
  assert.match(panel,/shareForReview/);
  assert.match(panel,/withdrawReview/);
  assert.match(panel,/latest\?\.status === 'Awaiting Customer'/);
  assert.match(panel,/latest\?\.status === 'Customer Approved'/);
  assert.match(panel,/latest\?\.status === 'Customer Rejected'/);
  assert.match(panel,/Save & Share with Customer/);
  assert.match(panel,/Confirm Customer Acceptance & Continue/);
  assert.match(panel,/onShare\(target\.id, 'share'\)/);
  assert.match(panel,/onShare\(latest\.id, 'withdraw'\)/);
  assert.doesNotMatch(panel,/localStorage\.setItem\(.+approval/i);
});
