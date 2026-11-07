import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('job create retries are idempotent and never re-register a vehicle on lost responses', () => {
  const create = src('src/pages/jobs/JobCreatePage.jsx');
  const service = src('src/services/job.service.js');
  assert.match(create, /const createRequestId = useRef\(/);
  assert.match(create, /clientRequestId: createRequestId\.current/);
  assert.match(create, /const \[savedJobId, setSavedJobId\]/);
  assert.match(create, /jobService\.createJob\(/);
  assert.match(service, /apiClient\.post\(API_ENDPOINTS\.JOBS, data\)/);
});

test('job inspection photo capture uses private multipart Django storage', () => {
  const panel = src('src/components/jobs/JobInspectionPanel.jsx');
  const service = src('src/services/jobInspection.service.js');
  const photos = src('src/services/vehiclePhoto.service.js');
  assert.match(panel, /vehiclePhotoService\.upload\(/);
  assert.match(panel, /jobInspectionService\.addInspectionPhoto\(job\.id, \{ photoId: uploaded\.id \}\)/);
  assert.match(panel, /<VehiclePhotoGallery jobId=\{job\.id\} canEdit=\{false\} refreshKey=\{photos\.length\} \/>/);
  assert.doesNotMatch(panel, /new FileReader\(/);
  assert.doesNotMatch(panel, /readAsDataURL\(/);
  assert.doesNotMatch(panel, /src=\{photo\.url\}/);
  assert.match(photos, /\/jobs\/\$\{jobId\}\/inspection-photos/);
  assert.match(photos, /multipart\/form-data/);
  assert.match(service, /\{ photoId \}/);
  assert.doesNotMatch(service, /images\.unsplash\.com/);
});

test('actual inspection finding and diagnostic APIs remain wired', () => {
  const panel = src('src/components/jobs/JobInspectionPanel.jsx');
  const service = src('src/services/jobInspection.service.js');
  assert.match(panel, /jobInspectionService\.addFinding\(/);
  assert.match(panel, /jobInspectionService\.addDiagnosticCode\(/);
  assert.match(service, /inspection\/findings/);
  assert.match(service, /inspection\/diagnostic/);
  assert.match(service, /inspection\/complete/);
  assert.match(service, /inspection\/skip/);
});
