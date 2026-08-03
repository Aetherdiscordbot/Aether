/**
 * Supabase database layer with auto-migrations.
 */
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');
const logger = require('../services/logger');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) must be set in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

/** Run a migration function against the database. */
async function migrate(migration) {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: migration.up });
    if (error) {
      // If exec_sql doesn't exist, log warning and skip
      if (error.message.includes('Could not find the function') || error.code === '42883') {
        logger.warn(`exec_sql RPC not available, skipping migration ${migration.version} (${migration.name}). Run migrations manually in Supabase SQL editor.`);
        return;
      }
      throw error;
    }
    logger.info(`Migration ${migration.version} applied (${migration.name})`);
  } catch (e) {
    if (e.message?.includes('Could not find the function') || e.code === '42883') {
      logger.warn(`exec_sql RPC not available, skipping migration ${migration.version} (${migration.name}). Run migrations manually in Supabase SQL editor.`);
      return;
    }
    logger.error(`Migration ${migration.version} failed: ${e.message}`);
    throw e;
  }
}

/** Initialize database and run all migrations. */
async function init() {
  // Check if exec_sql RPC exists first
  let hasExecSql = false;
  try {
    await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    hasExecSql = true;
  } catch (e) {
    logger.warn('exec_sql RPC not found in Supabase. Migrations will be skipped. Create exec_sql function in Supabase SQL editor for auto-migrations.');
  }

  // Create migrations tracking table if not exists (only if exec_sql works)
  if (hasExecSql) {
    try {
      await supabase.rpc('exec_sql', {
        sql: `CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TIMESTAMPTZ DEFAULT NOW()
        );`
      });
    } catch (e) {
      logger.warn(`Could not create schema_migrations table: ${e.message}`);
    }
  }

  // Load migration files
  const fs = require('fs');
  const path = require('path');
  const migrationsDir = path.resolve(__dirname, '..', 'database');
  
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.startsWith('schema') && f.endsWith('.js'))
    .sort((a, b) => {
      const va = parseInt(a.match(/\d+/)?.[0] || '0');
      const vb = parseInt(b.match(/\d+/)?.[0] || '0');
      return va - vb;
    });

  for (const file of files) {
    const migration = require(path.join(migrationsDir, file));
    
    // Check if already applied (only if exec_sql works)
    let applied = false;
    if (hasExecSql) {
      const { data } = await supabase
        .from('schema_migrations')
        .select('version')
        .eq('version', migration.version)
        .single();
      applied = !!data;
    }
    
    if (applied) continue;
    
    await migrate(migration);
    
    if (hasExecSql) {
      try {
        await supabase.from('schema_migrations').insert({
          version: migration.version,
          name: migration.name
        });
      } catch (e) {
        logger.warn(`Could not record migration ${migration.version}: ${e.message}`);
      }
    }
  }
}

module.exports = { supabase, init };