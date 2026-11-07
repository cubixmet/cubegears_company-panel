import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Published quote offers a real server-backed WhatsApp draft scoped to the estimate UUID', () => {
  const panel = source('src/components/jobs/QuickEstimatePanel.jsx');
  assert.match(panel,/import \{ WhatsAppManualShareButton \} from '\.\.\/common\/WhatsAppManualShareButton'/);
  assert.match(panel,/latest\?\.status === 'Awaiting Customer'/);
  assert.match(panel,/targetType="estimate" targetId=\{latest\.id\}/);
  assert.match(panel,/Send Estimate via WhatsApp/);
  assert.match(panel,/Automatic alerts require customer consent/);
  assert.doesNotMatch(panel,/window\.open\(['"]https:\/\/wa\.me/);
  const component = source('src/components/common/WhatsAppManualShareButton.jsx');
  assert.match(component,/apiClient\.post\('\/whatsapp\/manual-share', \{ targetType, targetId \}\)/);
  assert.match(component,/Draft prepared/);
  assert.doesNotMatch(component,/status: 'sent'/);
});

test('Workshop WhatsApp settings enable both estimate events and validate 24/48 hour cadence', () => {
  const settings = source('src/pages/settings/WhatsAppSettingsPage.jsx');
  assert.match(settings,/estimate_reminder_hours/);
  assert.match(settings,/setEstimateReminderHours/);
  assert.match(settings,/<option value=\{24\}>Every 24 hours<\/option>/);
  assert.match(settings,/<option value=\{48\}>Every 48 hours<\/option>/);
  assert.match(settings,/!events\.estimate_reminder/);
  assert.match(settings,/approved estimate_reminder template/);
  assert.match(settings,/apiClient\.patch\('\/whatsapp\/settings'/);
  assert.match(source('src/styles/whatsapp-settings.css'),/\.wa-reminder-settings/);
});
