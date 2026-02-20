import { pool } from "./db.js";

async function main() {
  const q = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;
  const r = await pool.query(q);
  console.log("Tables:", r.rows.map(x => x.table_name));
  await pool.end();
}

main().catch(e => {
  console.error("DB check failed:", e);
  process.exit(1);
});
