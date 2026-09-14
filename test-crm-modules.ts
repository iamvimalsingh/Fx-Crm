process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';

/**
 * Operational CRM Modules Integration & Security Test Suite
 * Tests KYC, Support Tickets, Notifications, Storage abstraction, and IDOR protection
 */
import { handler } from './netlify/functions/api';
import { inMemoryDb } from './netlify/functions/db/client';
import { rateLimiter } from './netlify/functions/middleware/rate-limiter';
import { StorageService } from './netlify/functions/services/storage.service';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

async function callEndpoint(event: any): Promise<{ statusCode: number; headers: Record<string, string>; data: any }> {
  const res: any = await handler(event, {} as any);
  let parsed: any = null;
  try {
    parsed = res?.body ? JSON.parse(res.body) : null;
  } catch {
    parsed = res?.body;
  }
  return {
    statusCode: res?.statusCode || 500,
    headers: res?.headers || {},
    data: parsed,
  };
}

async function runCrmModulesTests() {
  console.log('🧪 Starting CRM Operational Modules (KYC, Support, Notifications) Test Suite...\n');

  inMemoryDb.clear();
  rateLimiter.reset();

  // 1. Provision Admin and Two Clients (Alice & Bob)
  console.log('[1] Setting Up Test Accounts:');
  const adminRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/auth/setup-admin',
    headers: { 'client-ip': '127.0.0.1' },
    body: JSON.stringify({
      email: 'superadmin@broker.com',
      password: 'AdminPassword123!',
      first_name: 'Super',
      last_name: 'Admin',
      country: 'GB',
      preferred_currency: 'USD',
      setup_secret: process.env.ADMIN_SETUP_SECRET || 'forex-crm-secure-admin-setup-secret-2026',
    }),
  });
  assert(adminRes.statusCode === 201, 'Super Admin provisioned');
  const adminToken = adminRes.data.data.token;

  const aliceRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/auth/register',
    headers: { 'client-ip': '127.0.0.2' },
    body: JSON.stringify({
      email: 'alice@client.com',
      password: 'AlicePassword123!',
      first_name: 'Alice',
      last_name: 'Trader',
      country: 'DE',
      preferred_currency: 'EUR',
    }),
  });
  assert(aliceRes.statusCode === 201, 'Alice registered');
  const aliceToken = aliceRes.data.data.token;
  const aliceId = aliceRes.data.data.user.id;

  const bobRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/auth/register',
    headers: { 'client-ip': '127.0.0.3' },
    body: JSON.stringify({
      email: 'bob@client.com',
      password: 'BobPassword123!',
      first_name: 'Bob',
      last_name: 'Investor',
      country: 'FR',
      preferred_currency: 'USD',
    }),
  });
  assert(bobRes.statusCode === 201, 'Bob registered');
  const bobToken = bobRes.data.data.token;
  const bobId = bobRes.data.data.user.id;

  // 2. Storage Service & Security
  console.log('\n[2] Object Storage Security & Validation:');
  let blockedPhp = false;
  try {
    StorageService.validateDocument('exploit.php', 'application/x-php', Buffer.from('<?php echo 1; ?>'));
  } catch {
    blockedPhp = true;
  }
  assert(blockedPhp, 'Storage service blocks PHP file uploads');

  let blockedExe = false;
  try {
    StorageService.validateDocument('trojan.exe', 'application/octet-stream', Buffer.from('MZ...'));
  } catch {
    blockedExe = true;
  }
  assert(blockedExe, 'Storage service blocks executable .exe uploads');

  const validPdfBuffer = Buffer.from('%PDF-1.4 sample document content');
  const validResult = StorageService.validateDocument('passport.pdf', 'application/pdf', validPdfBuffer);
  assert(validResult.safeFilename === 'passport.pdf', 'Storage service accepts valid application/pdf');

  const uploadRes = await StorageService.uploadDocument(aliceId, validPdfBuffer, 'passport.pdf', 'application/pdf', 'kyc');
  assert(uploadRes.objectKey.includes(`kyc-documents/${aliceId}/`), 'Storage key isolates by feature and user_id');

  // 3. KYC Workflow
  console.log('\n[3] KYC Lifecycle Workflow:');
  // Alice checks initial KYC status
  const aliceInitialKyc = await callEndpoint({
    httpMethod: 'GET',
    path: '/api/kyc/profile',
    headers: { Authorization: `Bearer ${aliceToken}` },
  });
  assert(aliceInitialKyc.statusCode === 200, 'Alice retrieves KYC status');
  assert(aliceInitialKyc.data.data === null, 'Alice has no KYC profile initially');

  // Alice submits KYC profile
  const submitProfileRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/kyc/profile',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({
      first_name: 'Alice',
      last_name: 'Trader',
      date_of_birth: '1990-05-15',
      nationality: 'German',
      address_line1: '123 Berlin Way',
      city: 'Berlin',
      country: 'DE',
      postal_code: '10115',
      id_type: 'passport',
      id_number: 'DE987654321',
    }),
  });
  assert(submitProfileRes.statusCode === 200, 'Alice submitted KYC profile data');
  const aliceKycProfileId = submitProfileRes.data.data.id;
  assert(submitProfileRes.data.data.status === 'pending', 'KYC profile initialized as pending');

  // Alice uploads KYC document
  const uploadDocRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/kyc/documents',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({
      document_type: 'passport',
      original_filename: 'alice_passport.pdf',
      mime_type: 'application/pdf',
      file_size: validPdfBuffer.length,
      file_base64: validPdfBuffer.toString('base64'),
    }),
  });
  assert(uploadDocRes.statusCode === 201, 'Alice uploaded passport document');
  const aliceDocKey = uploadDocRes.data.data.object_key;

  // 4. KYC Security & IDOR Enforcement
  console.log('\n[4] KYC IDOR & Privilege Separation:');
  // Bob tries to view Alice's KYC document directly via document preview
  const bobIdorDocRes = await callEndpoint({
    httpMethod: 'GET',
    path: '/api/documents/preview',
    queryStringParameters: { key: aliceDocKey },
    headers: { Authorization: `Bearer ${bobToken}` },
  });
  assert(bobIdorDocRes.statusCode === 403, 'Bob is blocked from downloading Alice KYC document (HTTP 403 IDOR protected)');

  // Bob tries to access Admin KYC API
  const bobAdminKycRes = await callEndpoint({
    httpMethod: 'GET',
    path: '/api/admin/kyc',
    headers: { Authorization: `Bearer ${bobToken}` },
  });
  assert(bobAdminKycRes.statusCode === 403, 'Bob forbidden from accessing Admin KYC review API');

  // Admin retrieves KYC list
  const adminKycListRes = await callEndpoint({
    httpMethod: 'GET',
    path: '/api/admin/kyc',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminKycListRes.statusCode === 200, 'Admin can view KYC applications');
  assert(adminKycListRes.data.data.profiles.length >= 1, 'Admin finds Alice application in queue');

  // Admin approves Alice KYC
  const adminApproveKycRes = await callEndpoint({
    httpMethod: 'POST',
    path: `/api/admin/kyc/${aliceKycProfileId}/review`,
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      status: 'approved',
      review_notes: 'All documents verified against international sanction lists.',
    }),
  });
  assert(adminApproveKycRes.statusCode === 200, 'Admin approved Alice KYC profile');
  assert(adminApproveKycRes.data.data.status === 'approved', 'Status is approved');

  // Verify Alice received an in-app notification about KYC approval
  const aliceKycNotifs = await callEndpoint({
    httpMethod: 'GET',
    path: '/api/notifications',
    headers: { Authorization: `Bearer ${aliceToken}` },
  });
  assert(aliceKycNotifs.statusCode === 200, 'Alice retrieves notifications');
  const kycApprovedNotif = aliceKycNotifs.data.data.notifications.find((n: any) => n.title.includes('Approved') || n.type === 'kyc_status');
  assert(!!kycApprovedNotif, 'Alice has received automated KYC approval notification');

  // 5. Support Ticket Lifecycle & Data Isolation
  console.log('\n[5] Support Ticket Lifecycle & Security:');
  // Alice creates a support ticket
  const createTicketRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/support/tickets',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({
      category: 'deposit_withdrawal',
      priority: 'high',
      subject: 'Deposit inquiry for SEPA wire',
      message: 'Hello, I would like to know if SEPA instant transfers are supported for EUR wallets.',
      attachments: [
        {
          original_filename: 'wire_receipt.pdf',
          mime_type: 'application/pdf',
          file_size: validPdfBuffer.length,
          file_base64: validPdfBuffer.toString('base64'),
        },
      ],
    }),
  });
  assert(createTicketRes.statusCode === 201, 'Alice created support ticket');
  const aliceTicketId = createTicketRes.data.data.id;
  assert(createTicketRes.data.data.ticket_no.startsWith('TKT-'), 'Ticket assigned formal tracking number');

  // Bob attempts IDOR to read Alice ticket
  const bobReadAliceTicket = await callEndpoint({
    httpMethod: 'GET',
    path: `/api/support/tickets/${aliceTicketId}`,
    headers: { Authorization: `Bearer ${bobToken}` },
  });
  assert(bobReadAliceTicket.statusCode === 404 || bobReadAliceTicket.statusCode === 403, 'Bob blocked from reading Alice ticket (IDOR prevention)');

  // Bob attempts IDOR to post reply to Alice ticket
  const bobPostAliceTicket = await callEndpoint({
    httpMethod: 'POST',
    path: `/api/support/tickets/${aliceTicketId}/reply`,
    headers: { Authorization: `Bearer ${bobToken}` },
    body: JSON.stringify({ message: 'I am hijacking your ticket!' }),
  });
  assert(bobPostAliceTicket.statusCode === 404 || bobPostAliceTicket.statusCode === 403, 'Bob blocked from posting to Alice ticket (IDOR prevention)');

  // Admin views ticket list
  const adminTicketsRes = await callEndpoint({
    httpMethod: 'GET',
    path: '/api/admin/support/tickets',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminTicketsRes.statusCode === 200, 'Admin can view support tickets');
  assert(adminTicketsRes.data.data.tickets.some((t: any) => t.id === aliceTicketId), 'Alice ticket present in admin support queue');

  // Admin posts an INTERNAL NOTE (is_internal: true)
  const internalNoteRes = await callEndpoint({
    httpMethod: 'POST',
    path: `/api/admin/support/tickets/${aliceTicketId}/reply`,
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      message: 'Staff check: SEPA Instant provider gateway currently healthy with BNP Paribas.',
      is_internal: true,
    }),
  });
  assert(internalNoteRes.statusCode === 201, 'Admin posted internal staff note');

  // Admin posts a PUBLIC SUPPORT REPLY (is_internal: false)
  const adminReplyRes = await callEndpoint({
    httpMethod: 'POST',
    path: `/api/admin/support/tickets/${aliceTicketId}/reply`,
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      message: 'Hello Alice, yes! SEPA Instant is fully supported with zero broker fees.',
      is_internal: false,
    }),
  });
  assert(adminReplyRes.statusCode === 201, 'Admin posted client-facing reply');

  // CRITICAL SECURITY CHECK: Alice views ticket. Ensure Alice CANNOT see the internal staff note!
  const aliceTicketView = await callEndpoint({
    httpMethod: 'GET',
    path: `/api/support/tickets/${aliceTicketId}`,
    headers: { Authorization: `Bearer ${aliceToken}` },
  });
  assert(aliceTicketView.statusCode === 200, 'Alice views her ticket details');
  const aliceMessages = aliceTicketView.data.data.messages;
  const hasInternalNote = aliceMessages.some((m: any) => m.message.includes('Staff check') || m.is_internal);
  assert(!hasInternalNote, 'CONFIRMED: Internal staff notes are NOT leaked to client');
  const hasPublicReply = aliceMessages.some((m: any) => m.message.includes('SEPA Instant is fully supported'));
  assert(hasPublicReply, 'Alice receives admin public support reply');

  // 6. Notification Center Real-time Functionality
  console.log('\n[6] In-App Notification Center:');
  const notifsList = await callEndpoint({
    httpMethod: 'GET',
    path: '/api/notifications',
    headers: { Authorization: `Bearer ${aliceToken}` },
  });
  assert(notifsList.statusCode === 200, 'Alice retrieves notifications list');
  assert(notifsList.data.data.unreadCount > 0, `Alice has unread notifications (${notifsList.data.data.unreadCount})`);

  // Alice marks single notification as read
  const markSingleRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/notifications/read',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({ notification_id: kycApprovedNotif.id }),
  });
  assert(markSingleRes.statusCode === 200, 'Alice marks single notification read');

  // Alice marks all notifications as read
  const markAllRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/notifications/read-all',
    headers: { Authorization: `Bearer ${aliceToken}` },
  });
  assert(markAllRes.statusCode === 200, 'Alice marks all notifications read');

  const notifsAfter = await callEndpoint({
    httpMethod: 'GET',
    path: '/api/notifications',
    headers: { Authorization: `Bearer ${aliceToken}` },
  });
  assert(notifsAfter.data.data.unreadCount === 0, 'Unread notification count successfully reset to 0');

  // Bob cannot mark Alice notification as read (IDOR check)
  const bobMarkAliceNotif = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/notifications/read',
    headers: { Authorization: `Bearer ${bobToken}` },
    body: JSON.stringify({ notification_id: kycApprovedNotif.id }),
  });
  assert(bobMarkAliceNotif.data.data.success === false, 'Bob cannot mark Alice notification as read (IDOR blocked)');

  console.log('\n========================================');
  console.log(`🎉 CRM Modules Test Suite Complete: ${passCount} passed, ${failCount} failed`);
  console.log('========================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runCrmModulesTests().catch((err) => {
  console.error('CRM Modules test failure:', err);
  process.exit(1);
});
