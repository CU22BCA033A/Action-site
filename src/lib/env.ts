import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once at boot (see src/instrumentation.ts)
 * and lazily on first use. Secrets never leave this module except through
 * the narrow helpers that need them.
 */

const isProd = process.env.NODE_ENV === "production";

const nonEmpty = (name: string) =>
  z.string({ error: `${name} is missing` }).trim().min(1, `${name} is empty`);

const schema = z
  .object({
    ADMIN_USERNAME: nonEmpty("ADMIN_USERNAME"),
    ADMIN_PASSWORD_HASH: nonEmpty("ADMIN_PASSWORD_HASH")
      // A value pasted with \$ escapes into a dashboard still works.
      .transform((v) => v.replace(/\\\$/g, "$"))
      .refine(
      (v) => v.startsWith("$argon2id$"),
      "ADMIN_PASSWORD_HASH must be an argon2id hash. Create one with: npm run hash-password",
    ),
    SESSION_SECRET: nonEmpty("SESSION_SECRET").min(32, "SESSION_SECRET must be at least 32 characters"),
    CODE_PEPPER: nonEmpty("CODE_PEPPER").min(32, "CODE_PEPPER must be at least 32 characters"),
    DATABASE_URL: nonEmpty("DATABASE_URL"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().trim().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().trim().optional(),
    SITE_URL: z.string().trim().optional(),
  })
  .superRefine((env, ctx) => {
    const supabaseValues = [
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      env.SUPABASE_SERVICE_ROLE_KEY,
    ];
    const someSet = supabaseValues.some((v) => v && v.length > 0);
    const allSet = supabaseValues.every((v) => v && v.length > 0);
    if ((isProd || someSet) && !allSet) {
      ctx.addIssue({
        code: "custom",
        message:
          "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must all be set" +
          (isProd ? " in production" : " together"),
      });
    }
  });

export type ServerEnv = z.infer<typeof schema> & { storageDriver: "supabase" | "local"; realtimeEnabled: boolean };

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.message}`).join("\n");
    throw new Error(
      `Environment is not configured correctly:\n${lines}\nCopy .env.example to .env.local and fill it in. See docs/launch.md.`,
    );
  }
  const env = parsed.data;
  const supabaseReady = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY,
  );
  cached = {
    ...env,
    storageDriver: supabaseReady ? "supabase" : "local",
    realtimeEnabled: supabaseReady,
  };
  return cached;
}

/** Setup problems as plain messages, for the health check. Never includes values. */
export function envProblems(): string[] {
  const parsed = schema.safeParse(process.env);
  return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
}

/** For tests only. */
export function resetEnvCache() {
  cached = null;
}
