process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';

import { AuthService } from './netlify/functions/services/auth.service';
import { MailService } from './netlify/functions/services/mail.service';
import { authenticateRequest } from './netlify/functions/middleware/auth';
import { inMemoryDb } from './netlify/functions/db/client';
import bcrypt from 'bcryptjs';

async function runTests() {
  console.log('🧪 Starting Netlify-Native Auth Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // Test 1: User Registration
    const regResult = await AuthService.register({
      email: 'trader1@example.com',
      password: 'Password123',
      first_name: 'Alex',
      last_name: 'Morgan',
      country: 'GB',
      preferred_currency: 'USD',
    });

    assert(Boolean(regResult.token), 'Registration returns valid JWT token');
    assert(regResult.user.email === 'trader1@example.com', 'Registration stores normalized email');
    assert(regResult.user.role === 'client', 'New user assigned "client" role by default');

    // Test 2: Password Hashing Verification
    const storedUser = inMemoryDb.users.get('trader1@example.com');
    assert(Boolean(storedUser), 'User saved to database store');
    assert(storedUser?.password_hash !== 'Password123', 'Password is not stored in plaintext');
    assert(storedUser?.password_hash.startsWith('$2'), 'Password hash uses bcrypt format');
    const isPasswordHashValid = await bcrypt.compare('Password123', storedUser!.password_hash);
    assert(isPasswordHashValid, 'Bcrypt hash correctly verifies original password');

    // Test 3: Duplicate Registration Prevention
    try {
      await AuthService.register({
        email: 'trader1@example.com',
        password: 'Password123',
        first_name: 'Duplicate',
        last_name: 'User',
        country: 'US',
        preferred_currency: 'USD',
      });
      assert(false, 'Duplicate email should fail registration');
    } catch (e: any) {
      assert(e.message.includes('already exists'), 'Duplicate email rejected with clear error');
    }

    // Test 4: Successful Login
    const loginResult = await AuthService.login({
      email: 'trader1@example.com',
      password: 'Password123',
    });
    assert(Boolean(loginResult.token), 'Valid credentials return JWT token');
    assert(loginResult.user.first_name === 'Alex', 'Login returns user payload');

    // Test 5: Invalid Login
    try {
      await AuthService.login({
        email: 'trader1@example.com',
        password: 'WrongPassword99',
      });
      assert(false, 'Incorrect password should fail login');
    } catch (e: any) {
      assert(e.message.includes('Invalid email or password'), 'Invalid login returns generic error');
    }

    // Test 6: Authenticated Request (Valid Token)
    const authedUser = await authenticateRequest(`Bearer ${loginResult.token}`);
    assert(Boolean(authedUser), 'Token authentication succeeds with valid Bearer header');
    assert(authedUser?.id === regResult.user.id, 'Token resolves to correct user record');

    // Test 7: Unauthorized Access (Invalid / Missing Token)
    const unauthed1 = await authenticateRequest(null);
    assert(unauthed1 === null, 'Missing Authorization header returns null user');

    const unauthed2 = await authenticateRequest('Bearer invalid_token_xyz_123');
    assert(unauthed2 === null, 'Tampered token is rejected by auth middleware');

    // Test 8: Empty DB State & Admin Setup Workflow
    const hasAdminInitial = await AuthService.hasAdmin();
    assert(!hasAdminInitial, 'Clean database starts with zero administrator accounts');

    const adminSetup = await AuthService.setupAdmin({
      email: 'ops.admin@broker.internal',
      password: 'AdminSecret@123',
      first_name: 'Ops',
      last_name: 'Director',
      country: 'US',
      preferred_currency: 'USD',
    });
    assert(adminSetup.user.role === 'admin', 'Setup creates user with "admin" role');

    const hasAdminAfter = await AuthService.hasAdmin();
    assert(hasAdminAfter, 'Admin check returns true after admin initialization');

    try {
      await AuthService.setupAdmin({
        email: 'second.admin@broker.internal',
        password: 'AdminSecret@123',
        first_name: 'Second',
        last_name: 'Admin',
        country: 'US',
        preferred_currency: 'USD',
      });
      assert(false, 'Duplicate admin setup should be rejected');
    } catch (e: any) {
      assert(e.message.includes('already been initialized'), 'Subsequent admin setups rejected');
    }

    const adminLogin = await AuthService.login({
      email: 'ops.admin@broker.internal',
      password: 'AdminSecret@123',
    });
    assert(adminLogin.user.role === 'admin', 'Admin login authenticates with "admin" role');

    // Test 9: Password Reset Flow
    const forgotRes = await AuthService.forgotPassword({ email: 'trader1@example.com' });
    assert(!('demoResetToken' in forgotRes), 'API response never leaks reset token or demoResetToken');
    const resetToken = MailService.getLastTestDispatchedToken();
    assert(Boolean(resetToken), 'Password reset token securely generated and dispatched via MailService');

    const resetRes = await AuthService.resetPassword({
      token: resetToken!,
      password: 'NewPassword999',
    });
    assert(resetRes.message.includes('successfully updated'), 'Password reset completes successfully');

    // Test login with new password
    const newLogin = await AuthService.login({
      email: 'trader1@example.com',
      password: 'NewPassword999',
    });
    assert(Boolean(newLogin.token), 'Login succeeds with updated password');

    console.log(`\n🎉 Test Suite Completed: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
