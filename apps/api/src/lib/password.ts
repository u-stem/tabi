import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

// Matches Better Auth's internal algorithm: scrypt with "salt:hexHash" format
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(password.normalize("NFKC"), salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
