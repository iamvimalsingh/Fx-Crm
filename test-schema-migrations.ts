import 'dotenv/config';
import fs from 'fs';
import path from 'path';

process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runSchemaMigrationTests() {
  console.log('=============================================================================');
  console.log('🧪 CRM PRODUCTION MIGRATION & SCHEMA INTEGRITY TEST SUITE');
  console.log('=============================================================================\n');

  const migrationPath = path.join(process.cwd(), 'netlify/functions/db/migrations/001_create_missing_production_tables.sql');
  const schemaPath = path.join(process.cwd(), 'netlify/functions/db/schema.sql');

  // [1] Migration File Verification
  console.log('[1] Migration File Presence & Structure:');
  assert(fs.existsSync(migrationPath), 'Migration 001_create_missing_production_tables.sql exists');
  assert(fs.existsSync(schemaPath), 'Canonical schema.sql exists');

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  const canonicalSchemaSql = fs.readFileSync(schemaPath, 'utf8');

  // [2] Idempotency & Safety Checks
  console.log('\n[2] Idempotency & Safety Invariants:');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS system_settings'), 'system_settings uses CREATE TABLE IF NOT EXISTS');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS account_transfers'), 'account_transfers uses CREATE TABLE IF NOT EXISTS');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS trading_password_resets'), 'trading_password_resets uses CREATE TABLE IF NOT EXISTS');
  assert(migrationSql.includes('CREATE INDEX IF NOT EXISTS'), 'Indexes use CREATE INDEX IF NOT EXISTS');
  assert(!migrationSql.toUpperCase().includes('DROP TABLE'), 'Migration contains zero destructive DROP statements');
  assert(!migrationSql.toUpperCase().includes('TRUNCATE'), 'Migration contains zero TRUNCATE statements');
  assert(!migrationSql.toUpperCase().includes('DELETE FROM'), 'Migration contains zero DELETE statements');

  // [3] Field & Foreign Key Integrity
  console.log('\n[3] Foreign Key & Column Integrity:');
  assert(migrationSql.includes('REFERENCES users(id)'), 'Foreign key to users table verified');
  assert(migrationSql.includes('REFERENCES wallets(id)'), 'Foreign key to wallets table verified');
  assert(migrationSql.includes('REFERENCES trading_accounts(id)'), 'Foreign key to trading_accounts table verified');
  assert(migrationSql.includes("CHECK (direction IN ('wallet_to_trading', 'trading_to_wallet'))"), 'Transfer direction check constraint verified');
  assert(migrationSql.includes("CHECK (status IN ('pending', 'approved', 'rejected'))"), 'Transfer status check constraint verified');

  console.log('\n=============================================================================');
  console.log(`🎉 Schema Migration Suite: ${passedTests} passed, ${failedTests} failed.`);
  console.log('=============================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSchemaMigrationTests().catch((err) => {
  console.error('Fatal error in schema migration test:', err);
  process.exit(1);
});
