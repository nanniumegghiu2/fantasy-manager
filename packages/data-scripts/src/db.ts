import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";

function loadRootEnv(): Record<string, string> {
  const rootEnvPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../.env",
  );
  if (!existsSync(rootEnvPath)) {
    throw new Error(`File .env non trovato in ${rootEnvPath}`);
  }
  const env: Record<string, string> = {};
  for (const line of readFileSync(rootEnvPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

export async function connectDb(): Promise<Client> {
  const env = loadRootEnv();
  const connectionString = env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error("SUPABASE_DB_URL mancante in .env");
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}
