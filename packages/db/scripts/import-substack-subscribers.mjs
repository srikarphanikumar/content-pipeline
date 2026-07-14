import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ path: new URL("../../../.env", import.meta.url), quiet: true });

const csvPath = process.argv[2];

if (!csvPath) {
  console.error("Usage: node packages/db/scripts/import-substack-subscribers.mjs <subscriber-export.csv>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function token() {
  return crypto.randomBytes(32).toString("hex");
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function main() {
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\ufeff/, "");
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim()));
  const headers = rows.shift();
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const seen = new Set();
  const subscribers = [];
  const invalid = [];

  for (const row of rows) {
    const email = String(row[index.Email] || "").trim().toLowerCase();
    const name = String(row[index.Name] || "").trim() || null;
    const source = String(row[index["Subscription source (free)"]] || "").trim();
    const startDate = String(row[index["Start date"]] || "").trim();

    if (!validEmail(email)) {
      if (email) invalid.push(email);
      continue;
    }

    if (seen.has(email)) {
      continue;
    }

    seen.add(email);
    subscribers.push({ email, name, source, startDate });
  }

  let created = 0;
  let activated = 0;
  let alreadyActive = 0;

  for (const subscriber of subscribers) {
    const existing = await db.subscriber.findUnique({
      where: {
        email: subscriber.email,
      },
    });
    const importedAt = subscriber.startDate ? new Date(subscriber.startDate) : new Date();
    const source = subscriber.source ? `substack:${subscriber.source}` : "substack-import";

    if (!existing) {
      await db.subscriber.create({
        data: {
          confirmationToken: token(),
          confirmedAt: Number.isNaN(importedAt.getTime()) ? new Date() : importedAt,
          email: subscriber.email,
          name: subscriber.name,
          source,
          status: "ACTIVE",
          unsubscribeToken: token(),
        },
      });
      created += 1;
      continue;
    }

    if (existing.status === "ACTIVE") {
      await db.subscriber.update({
        where: {
          id: existing.id,
        },
        data: {
          confirmationToken: existing.confirmationToken || token(),
          name: subscriber.name ?? existing.name,
          source: existing.source || source,
          unsubscribeToken: existing.unsubscribeToken || token(),
        },
      });
      alreadyActive += 1;
      continue;
    }

    await db.subscriber.update({
      where: {
        id: existing.id,
      },
      data: {
        confirmationToken: existing.confirmationToken || token(),
        confirmedAt:
          existing.confirmedAt || (Number.isNaN(importedAt.getTime()) ? new Date() : importedAt),
        name: subscriber.name ?? existing.name,
        source: existing.source || source,
        status: "ACTIVE",
        unsubscribedAt: null,
        unsubscribeToken: existing.unsubscribeToken || token(),
      },
    });
    activated += 1;
  }

  const counts = await db.subscriber.groupBy({
    by: ["status"],
    _count: {
      status: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        activated,
        alreadyActive,
        counts: counts.map((count) => ({
          count: count._count.status,
          status: count.status,
        })),
        created,
        csvRows: rows.length,
        invalid,
        parsed: subscribers.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
