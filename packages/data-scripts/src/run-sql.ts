import { readFileSync } from "node:fs";
import { connectDb } from "./db";

const file = process.argv[2];
if (!file) {
  console.error("Uso: tsx src/run-sql.ts <percorso-file.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf-8");

const client = await connectDb();
try {
  await client.query(sql);
  console.log(`Eseguito: ${file}`);
} finally {
  await client.end();
}
