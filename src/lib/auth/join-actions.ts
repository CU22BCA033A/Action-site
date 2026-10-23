"use server";

import { redirect } from "next/navigation";
import { joinWithCode, leaveAuction, type JoinFailure } from "./team";

export type JoinState = { error?: JoinFailure; inUse?: number; code?: string };

export async function joinAction(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const code = String(formData.get("code") ?? "").slice(0, 32);
  const res = await joinWithCode(code);
  if (!res.ok) return { error: res.code, inUse: res.inUse, code };
  redirect("/manager");
}

export async function leaveAction() {
  await leaveAuction();
  redirect("/join");
}
