/* eslint-disable @typescript-eslint/no-unused-vars */
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

export function tryDecodeJwt(token: string | null) {
  if (!token) return null;
  try {
    const b = token.split(".")[1];
    // base64url -> base64
    const base64 = b.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}
