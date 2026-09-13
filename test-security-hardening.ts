/**
 * Comprehensive Production Security & Real Database Hardening Test Suite
 * Validates:
 * 1. Zero Production In-Memory Database Fallback (DatabaseGuard)
 * 2. Strict JWT Secret Enforcement (No known default secrets in production)
 * 3. Secure Password Reset Flow (Zero exposed tokens, SHA-256 hash verification)
 * 4. Administrator Setup Security (ADMIN_SETUP_SECRET enforcement, permanent lock after setup)
 * 5. Persistent Object Storage Hardening (Rejection of in-memory storage fallback in production)
 * 6. Safe Infrastructure Diagnostic Endpoint (/health)
 */

import { DatabaseGuard, DatabaseConfigurationError, DatabaseSecurityError, inMemoryDb, getPool } from './netlify/functions/db/client';
import { getJwtSecret, JwtConfigurationError, generateToken, verifyToken } from './netlify/functions/middleware/auth';
import { AuthService } from './netlify/functions/services/auth.service';
import { MailService } from './netlify/functions/services/mail.service';
import { StorageService } from './netlify/functions/services/storage.service';
import { handler } from './netlify/functions/api';

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failed++;
  }
}

async function callApi(event: any) {
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

async function runSecurityHardeningTests() {
  console.log('🔒 Starting Production Security & Persistence Hardening Tests...\n');

  // Save original environment
  const originalEnv = { ...process.env };

  try {
    // =========================================================================
    // 1. IN-MEMORY DATABASE FALLBACK REMOVAL & PRODUCTION DATABASE GUARD
    // =========================================================================
    console.log('[1] Production Database Fallback Prevention:');

    // Simulate Production Environment
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';
    process.env.CRM_TEST_MODE = 'false';
    delete process.env.DATABASE_URL;

    // A: In production, missing DATABASE_URL must immediately throw DatabaseConfigurationError
    let thrownConfigError = false;
    try {
      DatabaseGuard.assertDatabaseConfigured();
    } catch (err: any) {
      thrownConfigError = err instanceof DatabaseConfigurationError;
    }
    assert(thrownConfigError, 'DatabaseGuard throws DatabaseConfigurationError when DATABASE_URL is missing in production');

    // B: In production, getPool() must immediately throw DatabaseConfigurationError
    let thrownPoolError = false;
    try {
      getPool();
    } catch (err: any) {
      thrownPoolError = err instanceof DatabaseConfigurationError;
    }
    assert(thrownPoolError, 'getPool() throws DatabaseConfigurationError when DATABASE_URL is missing in production');

    // C: In production, any access to inMemoryDb must throw DatabaseSecurityError
    let thrownSecurityError = false;
    try {
      const _ = inMemoryDb.users.get('test@example.com');
    } catch (err: any) {
      thrownSecurityError = err instanceof DatabaseSecurityError;
    }
    assert(thrownSecurityError, 'Accessing inMemoryDb in production throws DatabaseSecurityError via runtime proxy');

    // D: Safe diagnostic info does NOT leak password
    const healthDiag = await DatabaseGuard.getHealthDiagnostic();
    assert(healthDiag.environment === 'production', 'Health diagnostic detects production environment');
    assert(healthDiag.database.configured === false, 'Health diagnostic flags unconfigured database without crash');
    assert(healthDiag.database.inMemoryFallbackAllowed === false, 'Health diagnostic reports in-memory fallback is disabled in production');

    // =========================================================================
    // 2. JWT SECRET HARDENING & NO DEFAULT FALLBACK IN PRODUCTION
    // =========================================================================
    console.log('\n[2] JWT Secret Security & High-Entropy Requirement:');

    // A: Missing secret in production must fail startup / token generation
    delete process.env.JWT_SECRET;
    let missingJwtError = false;
    try {
      getJwtSecret();
    } catch (err: any) {
      missingJwtError = err instanceof JwtConfigurationError;
    }
    assert(missingJwtError, 'Missing JWT_SECRET throws JwtConfigurationError in production (no fallback)');

    // B: Weak / short secret in production must be rejected
    process.env.JWT_SECRET = 'short_insecure_key';
    let shortJwtError = false;
    try {
      getJwtSecret();
    } catch (err: any) {
      shortJwtError = err instanceof JwtConfigurationError;
    }
    assert(shortJwtError, 'Short JWT_SECRET (< 32 characters) is rejected in production');

    // C: Valid 256-bit secret is accepted and generates verifiable tokens
    const secureProductionSecret = '9f8e7d6c5b4a3928172635485960718293a4b5c6d7e8f90123456789abcdef01';
    process.env.JWT_SECRET = secureProductionSecret;
    const token = generateToken({ id: 'user_prod_1', email: 'trader@broker.com', role: 'client' });
    assert(Boolean(token), 'Valid high-entropy JWT_SECRET generates tokens successfully');
    const verified = verifyToken(token);
    assert(verified?.userId === 'user_prod_1', 'Verified token payload matches claims');

    // Restore test environment for functional tests
    process.env.NODE_ENV = 'test';
    process.env.CRM_TEST_MODE = 'true';
    delete process.env.APP_ENV;

    // =========================================================================
    // 3. SECURE PASSWORD RESET FLOW
    // =========================================================================
    console.log('\n[3] Secure Password Reset Flow (No Leaked Tokens):');

    inMemoryDb.clear();
    MailService.clearTestDispatches();

    // Register a user
    await AuthService.register({
      email: 'client.security@broker.com',
      password: 'InitialPassword123!',
      first_name: 'Security',
      last_name: 'Tester',
      country: 'GB',
      preferred_currency: 'USD',
    });

    // Request password reset
    const forgotRes = await AuthService.forgotPassword({ email: 'client.security@broker.com' });
    assert(!('demoResetToken' in forgotRes), 'API response NEVER leaks demoResetToken');
    assert(!('token' in forgotRes), 'API response NEVER leaks raw reset token');
    assert(forgotRes.message.includes('password reset link has been dispatched'), 'Generic message returned to prevent enumeration');

    // Verify token was dispatched securely via MailService
    const dispatchedToken = MailService.getLastTestDispatchedToken();
    assert(Boolean(dispatchedToken), 'Cryptographically random token dispatched via MailService');

    // Attempt password reset with valid token
    const resetRes = await AuthService.resetPassword({
      token: dispatchedToken!,
      password: 'NewSecurePassword456!',
    });
    assert(resetRes.message.includes('successfully updated'), 'Password successfully reset');

    // Verify login works with new password
    const newLogin = await AuthService.login({
      email: 'client.security@broker.com',
      password: 'NewSecurePassword456!',
    });
    assert(Boolean(newLogin.token), 'Login succeeds with new password');

    // Attempt replay attack with used token
    let replayBlocked = false;
    try {
      await AuthService.resetPassword({
        token: dispatchedToken!,
        password: 'AnotherPassword789!',
      });
    } catch (err: any) {
      replayBlocked = err.message.includes('Invalid or expired');
    }
    assert(replayBlocked, 'Replay attack blocked: used token cannot be used again');

    // =========================================================================
    // 4. ADMINISTRATOR INITIALIZATION SECURITY
    // =========================================================================
    console.log('\n[4] Administrator Initialization Security:');

    inMemoryDb.clear();
    assert(!(await AuthService.hasAdmin()), 'System starts with zero administrators');

    // Test in production mode: ADMIN_SETUP_SECRET required
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';
    process.env.CRM_TEST_MODE = 'false';
    delete process.env.ADMIN_SETUP_SECRET;

    // A: In production with no setup secret, setup is blocked
    let setupBlockedInProd = false;
    try {
      await AuthService.setupAdmin({
        email: 'admin@broker.com',
        password: 'AdminPassword123!',
        first_name: 'Admin',
        last_name: 'User',
        country: 'GB',
        preferred_currency: 'USD',
      });
    } catch (err: any) {
      setupBlockedInProd = err.message.includes('Public initial admin setup is disabled in production');
    }
    assert(setupBlockedInProd, 'Public initial admin setup is rejected in production without ADMIN_SETUP_SECRET');

    // B: With ADMIN_SETUP_SECRET configured, invalid secret is rejected
    process.env.ADMIN_SETUP_SECRET = 'SuperSecretSetupKey_999!';
    let invalidSecretRejected = false;
    try {
      await AuthService.setupAdmin(
        {
          email: 'admin@broker.com',
          password: 'AdminPassword123!',
          first_name: 'Admin',
          last_name: 'User',
          country: 'GB',
          preferred_currency: 'USD',
        },
        'WrongSecret_123'
      );
    } catch (err: any) {
      invalidSecretRejected = err.message.includes('Invalid or missing administrator setup secret');
    }
    assert(invalidSecretRejected, 'Incorrect setup secret is rejected');

    // C: Valid secret initializes first administrator
    process.env.NODE_ENV = 'test';
    process.env.CRM_TEST_MODE = 'true';
    delete process.env.APP_ENV;

    const initialAdmin = await AuthService.setupAdmin(
      {
        email: 'primary.admin@broker.com',
        password: 'AdminPassword123!',
        first_name: 'Primary',
        last_name: 'Admin',
        country: 'GB',
        preferred_currency: 'USD',
      },
      'SuperSecretSetupKey_999!'
    );
    assert(initialAdmin.user.role === 'admin', 'First administrator initialized with valid setup secret');
    assert(await AuthService.hasAdmin(), 'hasAdmin() returns true after initial setup');

    // D: Setup is PERMANENTLY CLOSED after first admin is initialized
    let secondSetupRejected = false;
    try {
      await AuthService.setupAdmin(
        {
          email: 'second.admin@broker.com',
          password: 'AdminPassword123!',
          first_name: 'Second',
          last_name: 'Admin',
          country: 'GB',
          preferred_currency: 'USD',
        },
        'SuperSecretSetupKey_999!'
      );
    } catch (err: any) {
      secondSetupRejected = err.message.includes('Administrator setup is permanently closed');
    }
    assert(secondSetupRejected, 'Administrator setup is permanently closed after first admin exists');

    // =========================================================================
    // 5. OBJECT STORAGE PRODUCTION HARDENING
    // =========================================================================
    console.log('\n[5] Object Storage Production Hardening:');

    // In production without AWS credentials, upload must throw, never fall back to in-memory
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';
    process.env.CRM_TEST_MODE = 'false';
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    let storageFallbackRejected = false;
    try {
      await StorageService.uploadDocument(
        'user_123',
        Buffer.from('%PDF-1.4 test document'),
        'document.pdf',
        'application/pdf'
      );
    } catch (err: any) {
      storageFallbackRejected = err.message.includes('Local or in-memory file uploads are strictly prohibited in production');
    }
    assert(storageFallbackRejected, 'In-memory storage fallback is strictly rejected in production');

    // Reset back to test mode
    process.env.NODE_ENV = 'test';
    process.env.CRM_TEST_MODE = 'true';
    delete process.env.APP_ENV;

    // =========================================================================
    // 6. SAFE INFRASTRUCTURE DIAGNOSTIC (/api/health)
    // =========================================================================
    console.log('\n[6] Safe Infrastructure Diagnostic (/api/health):');

    const healthResponse = await callApi({
      httpMethod: 'GET',
      path: '/api/health',
      headers: {},
    });

    assert(healthResponse.statusCode === 200 || healthResponse.statusCode === 503, 'Health endpoint responds with appropriate status');
    assert(healthResponse.data.status !== undefined, 'Health diagnostic returns status');
    assert(healthResponse.data.environment !== undefined, 'Health diagnostic returns environment');
    assert(healthResponse.data.database !== undefined, 'Health diagnostic returns database diagnostic');
    assert(healthResponse.data.database.password === undefined, 'Health diagnostic NEVER leaks database passwords');

    console.log(`\n🎉 Security Hardening Test Suite Completed: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    // Restore environment
    process.env = originalEnv;
  }
}

runSecurityHardeningTests();
