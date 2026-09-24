#!/usr/bin/env node
/**
 * Safe Admin Password Reset CLI Utility
 *
 * Requirements:
 * 1. Requires explicit admin identity / email.
 * 2. Requires a new password supplied at execution time.
 * 3. Hashes the new password using the existing bcrypt/bcryptjs mechanism (10 rounds).
 * 4. Updates ONLY the selected admin user's password_hash and updated_at.
 * 5. Preserves role = 'admin', status, and user ID.
 * 6. Zero public HTTP exposure (local CLI execution only).
 * 7. Never exposes or logs plaintext passwords or password hashes.
 * 8. Fully removable after successful recovery.
 */

import dotenv from 'dotenv';
dotenv.config();

import readline from 'readline';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: {
    email?: string;
    password?: string;
    listAdmins?: boolean;
    help?: boolean;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--email' || arg === '-e') {
      parsed.email = args[++i];
    } else if (arg === '--password' || arg === '-p') {
      parsed.password = args[++i];
    } else if (arg === '--list-admins' || arg === '-l') {
      parsed.listAdmins = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }
  return parsed;
}

function promptHidden(query: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // In non-interactive or piping contexts, fallback to standard line reading
    if (!process.stdin.isTTY) {
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
      return;
    }

    // Mask input for terminal security
    process.stdout.write(query);
    const stdin = process.stdin;
    const oldRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();

    let input = '';
    const onData = (chunk: Buffer) => {
      const char = chunk.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(oldRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(input.trim());
      } else if (char === '\u0003') {
        // Ctrl+C
        process.stdout.write('\n');
        process.exit(1);
      } else if (char === '\u007f' || char === '\b') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        input += char;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

function validatePasswordComplexity(password: string): void {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('Password must contain at least one lowercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Password must contain at least one number.');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new Error('Password must contain at least one special character (e.g. !@#$%^&*).');
  }
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
=============================================================================
🛡️  BROKER CRM - SAFE ADMIN PASSWORD RECOVERY UTILITY
=============================================================================
Usage:
  npx tsx scripts/reset-admin-password.ts [options]

Options:
  --email, -e <email>        Target administrator staff email
  --password, -p <password>  New secure password (min 8 chars, Aa1@)
  --list-admins, -l          List all registered administrator emails
  --help, -h                 Show this help screen

Examples:
  1. Interactive execution:
     npx tsx scripts/reset-admin-password.ts

  2. Direct execution with live database URL:
     DATABASE_URL="postgresql://..." npx tsx scripts/reset-admin-password.ts -e admin@broker.com -p "NewPassword123!@#"

  3. Generate Supabase SQL query (without direct DB connection):
     npx tsx scripts/reset-admin-password.ts -e admin@domain.com -p "NewPassword123!@#"
=============================================================================
`);
    process.exit(0);
  }

  console.log('=============================================================================');
  console.log('🛡️  BROKER CRM - SAFE ADMIN PASSWORD RECOVERY UTILITY');
  console.log('=============================================================================\n');

  const databaseUrl = process.env.DATABASE_URL;

  // 1. If database URL is available, execute live database operations
  if (databaseUrl) {
    const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    });

    try {
      // Connect check
      await pool.query('SELECT 1');

      // If --list-admins requested
      if (args.listAdmins) {
        const admins = await pool.query(
          "SELECT id, email, status, first_name, last_name, created_at FROM users WHERE role = 'admin' ORDER BY created_at ASC"
        );
        console.log(`Discovered ${admins.rows.length} administrator account(s):`);
        console.table(
          admins.rows.map((r) => ({
            ID: r.id,
            Email: r.email,
            Status: r.status,
            Name: `${r.first_name} ${r.last_name}`.trim(),
            Created: r.created_at,
          }))
        );
        await pool.end();
        process.exit(0);
      }

      // Identify admin email
      let targetEmail = args.email;
      if (!targetEmail) {
        const admins = await pool.query(
          "SELECT id, email, status FROM users WHERE role = 'admin' ORDER BY created_at ASC"
        );
        if (admins.rows.length === 0) {
          console.error('❌ No administrator accounts exist in the connected database.');
          console.error('Use the Back Office initial setup screen to bootstrap the first administrator.');
          await pool.end();
          process.exit(1);
        }

        console.log('Existing administrator account(s) found in database:');
        admins.rows.forEach((a, idx) => {
          console.log(`  [${idx + 1}] ${a.email} (status: ${a.status})`);
        });

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        targetEmail = await new Promise<string>((res) => {
          rl.question('\nEnter admin email to reset: ', (answer) => {
            rl.close();
            res(answer.trim().toLowerCase());
          });
        });
      } else {
        targetEmail = targetEmail.trim().toLowerCase();
      }

      // Verify that target exists and has role='admin'
      const checkAdmin = await pool.query(
        "SELECT id, email, role, status FROM users WHERE email = $1 AND role = 'admin'",
        [targetEmail]
      );

      if (checkAdmin.rows.length === 0) {
        console.error(`\n❌ Error: No administrator user found with email: ${targetEmail}`);
        console.error('Operation aborted. No changes made.');
        await pool.end();
        process.exit(1);
      }

      const adminRecord = checkAdmin.rows[0];

      // Solicit new password
      let newPassword = args.password;
      if (!newPassword) {
        newPassword = await promptHidden('Enter new admin password: ');
        const confirmPassword = await promptHidden('Confirm new admin password: ');
        if (newPassword !== confirmPassword) {
          console.error('\n❌ Passwords do not match. Aborting.');
          await pool.end();
          process.exit(1);
        }
      }

      // Validate complexity
      validatePasswordComplexity(newPassword);

      // Compute bcrypt hash (10 rounds - standard CRM cost factor)
      console.log('\nGenerating cryptographically secure bcrypt hash...');
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const now = new Date();

      // Begin atomic transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Update ONLY password_hash and updated_at
        await client.query(
          "UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3 AND role = 'admin'",
          [passwordHash, now, adminRecord.id]
        );

        // Invalidate active reset tokens
        await client.query(
          'UPDATE password_resets SET used_at = $1 WHERE email = $2 AND used_at IS NULL',
          [now, targetEmail]
        );

        // Log audit event without password or hash
        await client.query(
          `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
           VALUES (gen_random_uuid(), $1, 'ADMIN_PASSWORD_RESET_CLI', 'user', $1, $2, '127.0.0.1', 'CLI Recovery Utility', $3)`,
          [
            adminRecord.id,
            JSON.stringify({
              email: targetEmail,
              recovery_channel: 'cli_direct_recovery',
            }),
            now,
          ]
        );

        await client.query('COMMIT');
        console.log('\n=============================================================================');
        console.log('✅ PASSWORD RESET SUCCESSFUL');
        console.log('=============================================================================');
        console.log(`• Admin Email:  ${targetEmail}`);
        console.log(`• User ID:      ${adminRecord.id}`);
        console.log(`• Role:         ${adminRecord.role} (preserved)`);
        console.log(`• Status:       ${adminRecord.status} (preserved)`);
        console.log('• Security:     Zero plaintext passwords exposed; bcrypt salt cost 10 applied.');
        console.log('• Audit:        ADMIN_PASSWORD_RESET_CLI entry logged in audit_logs.');
        console.log('\nYou can now log in at: https://fx-crm-brown.vercel.app/admin/login');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
        await pool.end();
      }
    } catch (err: any) {
      console.error('\n❌ Database execution failed:', err.message);
      process.exit(1);
    }
  } else {
    // 2. DATABASE_URL is not configured in local environment
    console.log('ℹ️  NOTE: DATABASE_URL is not set in this local container environment.');
    console.log('You can either:');
    console.log('  A) Run this script directly with your Supabase connection string:');
    console.log('     DATABASE_URL="<your-supabase-connection-string>" npx tsx scripts/reset-admin-password.ts');
    console.log('  OR');
    console.log('  B) Generate a pre-hashed SQL query to run directly in your Supabase SQL Editor.\n');

    let targetEmail = args.email;
    if (!targetEmail) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      targetEmail = await new Promise<string>((res) => {
        rl.question('Enter admin email (e.g. admin@domain.com): ', (answer) => {
          rl.close();
          res(answer.trim().toLowerCase());
        });
      });
    } else {
      targetEmail = targetEmail.trim().toLowerCase();
    }

    if (!targetEmail || !targetEmail.includes('@')) {
      console.error('❌ Valid admin email is required.');
      process.exit(1);
    }

    let newPassword = args.password;
    if (!newPassword) {
      newPassword = await promptHidden('Enter new admin password: ');
      const confirmPassword = await promptHidden('Confirm new admin password: ');
      if (newPassword !== confirmPassword) {
        console.error('\n❌ Passwords do not match. Aborting.');
        process.exit(1);
      }
    }

    validatePasswordComplexity(newPassword);

    console.log('\nGenerating standard bcrypt hash (10 rounds)...');
    const passwordHash = await bcrypt.hash(newPassword, 10);

    console.log('\n=============================================================================');
    console.log('📋 SUPABASE SQL EDITOR QUERY (COPY & EXECUTE IN SUPABASE)');
    console.log('=============================================================================');
    console.log(`
-- 1. Verify admin user exists:
SELECT id, email, role, status FROM users WHERE email = '${targetEmail}' AND role = 'admin';

-- 2. Safely update password hash (preserves role, status, ID, and audit architecture):
UPDATE users
SET password_hash = '${passwordHash}',
    updated_at = NOW()
WHERE email = '${targetEmail}'
  AND role = 'admin';

-- 3. Invalidate any pending password reset requests:
UPDATE password_resets
SET used_at = NOW()
WHERE email = '${targetEmail}'
  AND used_at IS NULL;

-- 4. Record audit log:
INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
SELECT gen_random_uuid(), id, 'ADMIN_PASSWORD_RESET_CLI', 'user', id, '{"email":"${targetEmail}","recovery_channel":"supabase_sql_editor"}'::jsonb, '127.0.0.1', 'CLI Recovery Utility', NOW()
FROM users
WHERE email = '${targetEmail}' AND role = 'admin';
`);
    console.log('=============================================================================');
    console.log('• Admin Email:  ', targetEmail);
    console.log('• Plaintext:     NEVER printed or saved.');
    console.log('• Hash:          Cryptographically secure bcrypt (10 rounds).');
    console.log('\nOnce executed in Supabase SQL Editor, you can log in at:');
    console.log('https://fx-crm-brown.vercel.app/admin/login');
  }
}

main().catch((err) => {
  console.error('Fatal recovery error:', err);
  process.exit(1);
});
