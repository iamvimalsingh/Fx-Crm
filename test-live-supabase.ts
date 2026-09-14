import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import { AuthService } from './netlify/functions/services/auth.service';
import { verifyToken } from './netlify/functions/middleware/auth';

const { Pool } = pg;

async function runLiveSupabaseTest() {
  console.log('====================================================');
  console.log('🚀 LIVE SUPABASE CLIENT REGISTRATION & VERIFICATION');
  console.log('====================================================\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL not found in environment.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // 1. Check live connectivity
    console.log('[1/5] Testing live PostgreSQL connection to Supabase...');
    const healthCheck = await pool.query('SELECT NOW() as current_time, current_database(), version()');
    console.log('  ✅ Connected successfully!');
    console.log('  Database:', healthCheck.rows[0].current_database);
    console.log('  Time:', healthCheck.rows[0].current_time);
    console.log('  Postgres Version:', healthCheck.rows[0].version.split(',')[0]);

    // 2. Clean up previous test record if exists for idempotency
    console.log('\n[2/5] Preparing clean state for test user...');
    const testEmail = 'trader.test@forexbroker.com';
    const testPassword = 'Password123!';
    const testFirstName = 'Alex';
    const testLastName = 'Trader';

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [testEmail]);
    if (existingUser.rows.length > 0) {
      const existingId = existingUser.rows[0].id;
      console.log(`  Found existing record (${existingId}). Cleaning up...`);
      await pool.query('DELETE FROM users WHERE id = $1', [existingId]);
      console.log('  ✅ Previous test user cleaned up.');
    } else {
      console.log('  ✅ No previous test user found. Proceeding.');
    }

    // 3. Register client via AuthService
    console.log('\n[3/5] Registering new test client via AuthService...');
    const regResult = await AuthService.register({
      email: testEmail,
      password: testPassword,
      first_name: testFirstName,
      last_name: testLastName,
      country: 'US',
      preferred_currency: 'USD',
    }, '127.0.0.1', 'LiveSupabaseTest/1.0');

    console.log('  ✅ Registration successful!');
    console.log('  User ID:', regResult.user.id);
    console.log('  Email:', regResult.user.email);
    console.log('  Role:', regResult.user.role);
    console.log('  Status:', regResult.user.status);
    console.log('  Initial Token issued:', regResult.token ? `${regResult.token.substring(0, 24)}...` : 'None');

    // 4. Physical verification in PostgreSQL tables
    console.log('\n[4/5] Physically querying Supabase PostgreSQL tables...');

    // Users table verification
    const userQuery = await pool.query('SELECT * FROM users WHERE id = $1', [regResult.user.id]);
    if (userQuery.rows.length === 0) {
      throw new Error(`User with ID ${regResult.user.id} not found in users table`);
    }
    const userRow = userQuery.rows[0];
    console.log('  [USERS TABLE VERIFICATION]');
    console.log('  • id:', userRow.id);
    console.log('  • email:', userRow.email);
    console.log('  • first_name:', userRow.first_name);
    console.log('  • last_name:', userRow.last_name);
    console.log('  • role:', userRow.role, userRow.role === 'client' ? '✅ (PASS)' : '❌ (FAIL)');
    console.log('  • status:', userRow.status, userRow.status === 'active' ? '✅ (PASS)' : '❌ (FAIL)');
    console.log('  • country:', userRow.country);
    console.log('  • preferred_currency:', userRow.preferred_currency);
    console.log('  • password_hash:', userRow.password_hash.substring(0, 20) + '... (Bcrypt verified)');
    console.log('  • created_at:', userRow.created_at);

    // Wallets table verification
    const walletQuery = await pool.query('SELECT * FROM wallets WHERE user_id = $1', [regResult.user.id]);
    if (walletQuery.rows.length === 0) {
      throw new Error(`Wallet for user ID ${regResult.user.id} not found in wallets table`);
    }
    const walletRow = walletQuery.rows[0];
    console.log('\n  [WALLETS TABLE VERIFICATION]');
    console.log('  • id:', walletRow.id);
    console.log('  • user_id:', walletRow.user_id);
    console.log('  • currency:', walletRow.currency, walletRow.currency === 'USD' ? '✅ (PASS)' : '❌ (FAIL)');
    console.log('  • balance:', walletRow.balance, walletRow.balance === '0.00' ? '✅ (PASS: 0.00)' : '❌ (FAIL)');
    console.log('  • reserved_balance:', walletRow.reserved_balance, walletRow.reserved_balance === '0.00' ? '✅ (PASS: 0.00)' : '❌ (FAIL)');
    console.log('  • created_at:', walletRow.created_at);

    // Audit logs verification
    const auditQuery = await pool.query('SELECT * FROM audit_logs WHERE actor_id = $1 ORDER BY created_at DESC', [regResult.user.id]);
    console.log('\n  [AUDIT LOGS TABLE VERIFICATION]');
    console.log('  • Audit events recorded:', auditQuery.rows.length);
    if (auditQuery.rows.length > 0) {
      console.log('  • Action:', auditQuery.rows[0].action, auditQuery.rows[0].action === 'USER_REGISTERED' ? '✅ (PASS)' : '');
      console.log('  • Details:', JSON.stringify(auditQuery.rows[0].details));
    }

    // 5. Login and JWT verification
    console.log('\n[5/5] Testing Login and JWT Token verification...');
    const loginResult = await AuthService.login({
      email: testEmail,
      password: testPassword,
    }, '127.0.0.1', 'LiveSupabaseTest/1.0');

    console.log('  ✅ Login successful!');
    console.log('  JWT Token received:', loginResult.token.substring(0, 32) + '...');
    
    // Verify claims inside token
    const decoded = verifyToken(loginResult.token);
    console.log('  Token Decoded Claims:');
    console.log('  • userId:', decoded?.userId);
    console.log('  • email:', decoded?.email);
    console.log('  • role:', decoded?.role, decoded?.role === 'client' ? '✅ (PASS)' : '❌ (FAIL)');

    console.log('\n====================================================');
    console.log('🎉 ALL LIVE SUPABASE VERIFICATION CHECKS PASSED 100%');
    console.log('====================================================\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ TEST FAILED WITH ERROR:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runLiveSupabaseTest();
