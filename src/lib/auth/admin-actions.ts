"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loginAdmin, logoutAdmin } from "./admin";

export type LoginState = { error?: string; username?: string };

const schema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(256),
});

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ username: formData.get("username"), password: formData.get("password") });
  const username = String(formData.get("username") ?? "").slice(0, 100);
  if (!parsed.success) return { error: "Enter your username and password.", username };
  const res = await loginAdmin(parsed.data.username, parsed.data.password);
  if (!res.ok) return { error: res.error, username };
  redirect("/admin");
}

export async function logoutAction() {
  await logoutAdmin();
  redirect("/admin/login");
}
