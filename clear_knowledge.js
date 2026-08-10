require('dotenv/config');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  await pool.query('DELETE FROM knowledge_chunks;');
  await pool.query('DELETE FROM knowledge_sources;');
  console.log("Deleted all knowledge sources and chunks successfully via pg.");
  
  await pool.end();
}

main().catch(console.error);
