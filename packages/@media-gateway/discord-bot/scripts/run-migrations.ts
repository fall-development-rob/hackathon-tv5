#!/usr/bin/env node
/**
 * Database migration runner
 * Runs SQL migrations for Discord bot tables
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function runMigrations() {
  const pool = new Pool({
    host: process.env["DB_HOST"] || "localhost",
    port: parseInt(process.env["DB_PORT"] || "5432"),
    database: process.env["DB_NAME"] || "mediagateway",
    user: process.env["DB_USER"] || "postgres",
    password: process.env["DB_PASSWORD"] || "",
    ssl:
      process.env["DB_SSL"] === "true" ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log("🔄 Connecting to PostgreSQL...");
    await pool.connect();
    console.log("✅ Connected to PostgreSQL");

    const migrationsDir = join(__dirname, "../src/migrations");
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    console.log(`\n📁 Found ${migrationFiles.length} migration(s)\n`);

    for (const file of migrationFiles) {
      console.log(`🔄 Running migration: ${file}`);

      const migrationPath = join(migrationsDir, file);
      const migration = readFileSync(migrationPath, "utf-8");

      // Split by semicolons and execute each statement
      const statements = migration.split(";").filter((s) => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await pool.query(statement);
          } catch (error: any) {
            // Ignore errors for already existing objects
            if (
              !error.message.includes("already exists") &&
              !error.message.includes("does not exist")
            ) {
              console.error(`  ❌ Error executing statement:`, error.message);
              throw error;
            }
          }
        }
      }

      console.log(`  ✅ Completed: ${file}\n`);
    }

    console.log("✅ All migrations completed successfully!\n");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations().catch(console.error);
