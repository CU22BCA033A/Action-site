"use server";

import { hash } from "@node-rs/argon2";
import { passwordProblem } from "@/lib/auth/password-policy";

export type HashResult = { ok: true; hash: string } | { ok: false; error: string };

/**
 * Hashes the admin password during first setup. Works only while
 * ADMIN_PASSWORD_HASH is not set, so it is closed once the site is configured.
 * The password is never stored or logged.
 */
export async function hashAdminPassword(password: string, again: string): Promise<HashResult> {
  if (process.env.ADMIN_PASSWORD_HASH) return { ok: false, error: "The admin password is already set. This tool is closed." };
  if (typeof password !== "string" || password !== again) return { ok: false, error: "The two passwords do not match." };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  const out = await hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  return { ok: true, hash: out };
}
