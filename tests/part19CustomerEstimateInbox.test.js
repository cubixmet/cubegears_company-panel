import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeNotification, isCustomerEstimateResponse, unreadNotificationCount
} from '../src/utils/notificationInbox.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const route='/jobs/12345678-1234-1234-1234-123456789abc/estimate';

test('customer accepted and declined estimate events become actionable high priority inbox rows', () => {
  for (const [type, decision] of [
    ['customer_estimate_accepted', 'Accepted'],
    ['customer_estimate_declined', 'Declined'],
  ]) {
    const notification = {
      id: type, title: 'Customer responded', is_read: false,
      notification_type: type,
      data: {
        jobNumber: 'JOB-19-001', jobId: '12345678-1234-1234-1234-123456789abc',
        route, decision, receiptId: 'receipt-19',
      }
    };
    const row=normalizeNotification(notification);
    assert.equal(row.category, 'Customer Responses');
    assert.equal(row.priority, 'High');
    assert.equal(row.status, 'Unread');
    assert.equal(row.route, route);
    assert.equal(row.reference, 'JOB-19-001');
    assert.equal(row.receiptId, 'receipt-19');
    assert.equal(row.customerEstimateDecision, decision);
    assert.equal(row.isCustomerEstimateResponse, true);
    assert.equal(isCustomerEstimateResponse(notification), true);
    assert.equal(unreadNotificationCount([notification]), 1);
    assert.equal(normalizeNotification({...notification,is_read:true}).status, 'Read');
  }
});

test('reject unsafe routes and do not turn unrelated notifications into estimate responses', () => {
  const base={notification_type:'customer_estimate_declined',data:{route:'//evil.example'}};
  assert.equal(normalizeNotification(base).route,'');
  for (const bad of ['/jobs/other-tenant/estimate','/jobs/12345678-1234-1234-1234-123456789abc/payment','https://evil.example']) {
    assert.equal(normalizeNotification({
      ...base, data:{route:bad}
    }).route,'');
  }
  const attendance=normalizeNotification({
    notification_type:'attendance_leave_request',message:'Leave requested',
    data:{requestId:'REQ-17'},is_read:false
  });
  assert.equal(attendance.category,'Approvals & People');
  assert.equal(attendance.priority,'High');
  assert.equal(attendance.reference,'REQ-17');
  assert.equal(attendance.isCustomerEstimateResponse,false);
});

test('customer response notifications show receipt, have a dedicated filter and open correct Job Card', () => {
  const inbox=read('src/pages/notifications/Notifications.jsx');
  assert.match(inbox,/['"]Customer Responses['"]/);
  assert.match(inbox,/newCustomerResponses/);
  assert.match(inbox,/setCategory\('Customer Responses'\)/);
  assert.match(inbox,/setStatus\('Unread'\)/);
  assert.match(inbox,/selected\.receiptId/);
  assert.match(inbox,/Review Job Card/);
  assert.match(inbox,/navigate\(selected\.route\)/);
  assert.match(inbox,/selected\.isCustomerEstimateResponse/);
  assert.match(inbox,/window\.setInterval\(refreshWhenVisible, 60000\)/);
  assert.match(inbox,/window\.clearInterval\(timer\)/);
  assert.match(read('src/styles/notifications.css'),/\.notification-customer-response-strip/);
});

test('header and sidebar refresh server alerts only while visible and after permission checks', () => {
  const header=read('src/components/layout/Header.jsx');
  const sidebar=read('src/components/layout/Sidebar.jsx');
  for (const source of [header,sidebar]) {
    assert.match(source,/canViewNotifications/);
    assert.match(source,/if \(!canViewNotifications\) \{/);
    assert.match(source,/window\.setInterval\(onVisible, 60000\)/);
    assert.match(source,/window\.clearInterval\(timer\)/);
    assert.match(source,/document\.addEventListener\('visibilitychange', onVisible\)/);
    assert.match(source,/document\.removeEventListener\('visibilitychange', onVisible\)/);
    assert.match(source,/unreadNotificationCount\(rows\)/);
  }
});
