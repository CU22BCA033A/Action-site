/**
 * Prints an argon2id hash for the admin password.
 * Usage: npm run hash-password
 * It prints the line for .env.local and the raw value for the hosting dashboard.
 * The password itself is never printed or stored.
 */
import { hash } from "@node-rs/argon2";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { passwordProblem } from "../src/lib/auth/password-policy";

function ask(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const fromStdin = !process.stdin.isTTY;
  let password: string;
  if (fromStdin) {
    password = (await new Promise<string>((resolve) => {
      let data = "";
      process.stdin.on("data", (c) => (data += c));
      process.stdin.on("end", () => resolve(data));
    })).replace(/\r?\n$/, "");
  } else {
    password = await ask("Admin password (input hidden): ");
    const again = await ask("Type it again: ");
    if (password !== again) {
      console.error("The two passwords do not match. Nothing was printed.");
      process.exit(1);
    }
  }
  const problem = passwordProblem(password);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  // argon2id, OWASP-recommended parameters (19 MiB, 2 iterations).
  const out = await hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const escaped = out.replace(/\$/g, "\\$");
  console.log("\nFor .env.local (every $ is escaped, because Next.js expands $ in env files):\n");
  console.log(`ADMIN_PASSWORD_HASH=${escaped}`);
  console.log("\nFor the Vercel dashboard (paste the value exactly as shown, no escaping):\n");
  console.log(out);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
