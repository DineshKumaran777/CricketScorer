import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config();

async function runMigration() {
  console.log('Running migrations...');
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });
  
  await migrate(db, { migrationsFolder: './drizzle' });
  
  console.log('Migrations completed successfully!');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
