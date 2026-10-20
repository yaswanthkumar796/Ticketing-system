import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../config/db.js';

// Resolve __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Migration script — reads schema.sql and executes each statement
 * against the configured MySQL database.
 *
 * Usage:  npm run migrate
 */
async function migrate() {
  console.log('🔄 Starting database migration...');

  // Read the SQL file from the same directory
  const schemaPath = join(__dirname, 'schema.sql');
  const schemaSql = readFileSync(schemaPath, 'utf8');

  // Split on semicolons and filter out blank/comment-only statements
  const statements = schemaSql
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

  let connection;
  try {
    connection = await pool.getConnection();

    for (const statement of statements) {
      console.log(`   ▶ Executing:\n     ${statement.split('\n')[0]}...`);
      await connection.query(statement);
    }

    console.log('✅ Migration completed successfully — tables are ready.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

migrate();
