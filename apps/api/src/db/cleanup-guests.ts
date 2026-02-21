import { and, eq, lt } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";

async function main() {
  const now = new Date();
  const expired = await db
    .delete(users)
    .where(and(eq(users.isAnonymous, true), lt(users.guestExpiresAt, now)))
    .returning({ id: users.id });

  console.log(`Deleted ${expired.length} expired guest account(s)`);
  process.exit(0);
}

main();
