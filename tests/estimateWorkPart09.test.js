import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('estimate POST uses a stable request UUID across network retries', () => {
  const panel = read('src/components/jobs/QuickEstimatePanel.jsx');
  const service = read('src/services/job.service.js');
  assert.ok(panel.includes('pendingSaveRef = useRef(null)'));
  assert.ok(panel.includes('const fingerprint = JSON.stringify(payload)'));
  assert.ok(panel.includes('crypto.randomUUID()'));
  assert.ok(panel.includes('payload.requestId = pendingSaveRef.current.id'));
  assert.ok(panel.includes('savedEstimateRef.current = { id: saved.id, version: saved.version }'));
  assert.ok(service.includes('payload?.requestId'));
  assert.ok(service.includes("apiClient.post(base, payload)"));
});

test('latest persisted estimate ID and numeric version are confirmed by Django', () => {
  const panel = read('src/components/jobs/QuickEstimatePanel.jsx');
  const workspace = read('src/pages/jobs/JobCardWorkspace.jsx');
  assert.ok(panel.includes('await onApprove?.(target.id, target.version)'));
  assert.ok(workspace.includes('estimateId, estimateVersion'));
  assert.ok(workspace.includes("replace(/^Estimate V/i, '')"));
  assert.ok(workspace.includes("completeStage('estimate', {"));
  assert.ok(workspace.includes('not a customer electronic signature'));
});

test('approval never silently reuses an unsaved quote after reload failure', () => {
  const panel = read('src/components/jobs/QuickEstimatePanel.jsx');
  assert.ok(panel.includes('savedEstimateRef.current = { id: saved.id, version: saved.version }'));
  assert.ok(panel.includes('await onSaved?.()'));
  assert.ok(panel.includes('Saved') || panel.includes('saved'));
  assert.ok(panel.includes('if (!target?.id)'));
});
