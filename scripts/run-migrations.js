#!/usr/bin/env node

/**
 * Script to run database migrations
 * Usage: node scripts/run-migrations.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const readline = require('readline');

// Load environment variables
require('dotenv').config();

// Database connection from DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

// Parse the DATABASE_URL
const dbConfig = parseDatabaseUrl(dbUrl);
const pool = new Pool(dbConfig);

async function main() {
  try {
    // Ensure the migrations table exists
    await ensureMigrationsTable();
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    const availableMigrations = getMigrationDirs(migrationsDir);
    
    // Filter migrations that haven't been applied
    const pendingMigrations = availableMigrations.filter(
      (migration) => !appliedMigrations.includes(migration)
    ).sort();
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations to apply');
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migration(s):`);
    pendingMigrations.forEach((migration) => {
      const metadataPath = path.join(migrationsDir, migration, 'migration.json');
      let name = migration;
      
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        name = metadata.name || migration;
      }
      
      console.log(`- ${migration}: ${name}`);
    });
    
    // Ask for confirmation
    const shouldContinue = await promptYesNo('Apply these migrations?');
    if (!shouldContinue) {
      console.log('Migration cancelled');
      return;
    }
    
    // Apply migrations
    for (const migration of pendingMigrations) {
      try {
        await applyMigration(migration, migrationsDir);
      } catch (error) {
        console.error(`Failed to apply migration ${migration}:`, error);
        process.exit(1);
      }
    }
    
    console.log('All migrations applied successfully');
  } finally {
    await pool.end();
  }
}

async function ensureMigrationsTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

async function getAppliedMigrations() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT name FROM _migrations ORDER BY applied_at ASC');
    return result.rows.map(row => row.name);
  } finally {
    client.release();
  }
}

function getMigrationDirs(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  
  return fs.readdirSync(migrationsDir)
    .filter(file => {
      const stat = fs.statSync(path.join(migrationsDir, file));
      return stat.isDirectory() && 
        fs.existsSync(path.join(migrationsDir, file, 'migration.sql'));
    });
}

async function applyMigration(migration, migrationsDir) {
  const migrationPath = path.join(migrationsDir, migration, 'migration.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log(`Applying migration: ${migration}`);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    try {
      // Apply the migration
      await client.query(migrationSql);
      
      // Record the migration
      await client.query(
        'INSERT INTO _migrations (name) VALUES ($1)',
        [migration]
      );
      
      await client.query('COMMIT');
      console.log(`✅ Migration applied: ${migration}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
  }
}

function parseDatabaseUrl(url) {
  // Simple parsing of postgresql:// URL
  // For production, you might want to use a proper URL parser
  try {
    const matches = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    return {
      user: matches[1],
      password: matches[2],
      host: matches[3],
      port: parseInt(matches[4]),
      database: matches[5].split('?')[0],
      ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : false
    };
  } catch (error) {
    console.error('Failed to parse DATABASE_URL:', error);
    throw new Error('Invalid DATABASE_URL format');
  }
}

function promptYesNo(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`${question} (y/n) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});