import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: process.env.DOTENV_PATH || '.env' });
// Optional: fallback für src\.env, falls du später willst:
// dotenv.config({ path: 'src/.env', override: false });

export const pool = (() => {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    console.log("[db] DATABASE_URL fehlt -> DB wird übersprungen (Dev/File-Fallback aktiv)");
    return {
      connect: async () => {
        throw new Error("DB_DISABLED_NO_DATABASE_URL");
      }
    };
  }
  return new pg.Pool({ connectionString: cs });
})();

