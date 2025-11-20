import { randomBytes, scryptSync } from "crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function comparePassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const hashed = scryptSync(password, salt, 64).toString("hex");
  return hashed === hash;
}
