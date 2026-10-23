"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "./config";

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return { ok: false as const };
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });
  return { ok: true as const };
}
