import { pool } from "./src/db.js";

const tables = ["subscriptions", "usage_periods"];

for (const t of tables) {
  const q = `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position;
  `;
  const { rows } = await pool.query(q, [t]);
  console.log("\n=== " + t + " ===");
  console.table(rows);
}

await pool.end();
