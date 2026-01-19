#!/usr/bin/env node

/**
 * Script to create a new migration file
 * Usage: node scripts/create-migration.js "Add user preferences table"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Validate input
const migrationName = process.argv[2];
if (!migrationName) {
  console.error('Error: Migration name is required');
  console.error('Usage: node scripts/create-migration.js "Add user preferences table"');
  process.exit(1);
}

// Create timestamp and slug
const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14);
const slug = migrationName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
const migrationId = `${timestamp}_${slug}`;

// Ensure migrations directory exists
const migrationsDir = path.join(__dirname, '../prisma/migrations');
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

// Create migration directory
const migrationDir = path.join(migrationsDir, migrationId);
fs.mkdirSync(migrationDir);

// Create migration file
const migrationFile = path.join(migrationDir, 'migration.sql');
const template = `-- Migration: ${migrationName}
-- Created at: ${new Date().toISOString()}

-- Write your SQL migration here
-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--   id SERIAL PRIMARY KEY,
--   name TEXT NOT NULL,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

`;

fs.writeFileSync(migrationFile, template);

// Create migration metadata file
const metadataFile = path.join(migrationDir, 'migration.json');
const metadata = {
  name: migrationName,
  created_at: new Date().toISOString(),
  description: '',
  status: 'pending'
};

fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

console.log(`Created migration: ${migrationId}`);
console.log(`Edit the migration file at: ${migrationFile}`);

// Generate Prisma migration if requested
if (process.argv.includes('--prisma')) {
  try {
    console.log('Generating Prisma migration...');
    execSync(`npx prisma migrate dev --name ${slug}`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to generate Prisma migration:', error.message);
  }
}