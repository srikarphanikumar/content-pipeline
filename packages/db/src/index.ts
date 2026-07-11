import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize Prisma.");
}

const adapter = new PrismaPg({ connectionString });

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export { PrismaClient };
export {
  formatDate,
  parseTags,
  publishedPostStatuses,
  readyPostStatuses,
  slugify,
  topicSlugToTag,
} from "./content";
export {
  firstMarkdownImage,
  normalizeImportedMarkdown,
  removeLeadingCoverImage,
} from "./markdown";
export type {
  Platform,
  PlatformPublishStatus,
  Post,
  PostStatus,
  PromotionAssetType,
  NotificationChannel,
  NotificationKind,
  SubscriberStatus,
} from "@prisma/client";
