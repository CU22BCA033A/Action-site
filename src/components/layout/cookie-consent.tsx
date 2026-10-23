"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONSENT_COOKIE, parseConsent, serializeConsent, UTM_STORAGE_KEY, utmFromSearch, type Consent } from "@/lib/consent";
import { formatDate } from "@/lib/format";

const OPEN_EVENT = "open-cookie-settings";
const CHANGE_EVENT = "consent-change";

/** Raw cookie value; "" when absent. The server snapshot is null (unknown). */
function readConsentRaw(): string {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return match?.slice(CONSENT_COOKIE.length + 1) ?? "";
}

function subscribeConsent(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function writeConsent(measurement: boolean): Consent {
  const consent: Consent = { measurement, date: new Date().toISOString() };
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(consent)}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax${secure}`;
  try {
    if (measurement) {
      const utm = utmFromSearch(location.search);
      if (Object.keys(utm).length) localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    } else {
      localStorage.removeItem(UTM_STORAGE_KEY);
    }
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return consent;
}

export function CookieConsent() {
  const { t, locale } = useI18n();
  const raw = useSyncExternalStore<string | null>(subscribeConsent, readConsentRaw, () => null);
  // undefined while rendering on the server, null when no choice was made yet.
  const consent: Consent | null | undefined = raw === null ? undefined : parseConsent(raw || undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [measurement, setMeasurement] = useState(false);

  const openSettings = useCallback(() => {
    setMeasurement(parseConsent(readConsentRaw() || undefined)?.measurement ?? false);
    setSettingsOpen(true);
  }, []);

  // Capture campaign parameters on landing, only when allowed.
  const measurementAllowed = consent?.measurement === true;
  useEffect(() => {
    if (measurementAllowed) {
      const utm = utmFromSearch(location.search);
      if (Object.keys(utm).length) {
        try {
          localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
        } catch {
          /* storage blocked */
        }
      }
    }
  }, [measurementAllowed]);

  useEffect(() => {
    window.addEventListener(OPEN_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_EVENT, openSettings);
  }, [openSettings]);

  const choose = useCallback((m: boolean) => {
    writeConsent(m);
    setMeasurement(m);
    setSettingsOpen(false);
  }, []);

  return (
    <>
      {consent === null ? (
        <section
          aria-labelledby="cookie-banner-title"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-line-strong bg-surface p-4 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md sm:border sm:p-5"
        >
          <h2 id="cookie-banner-title" className="text-xl">
            {t("cookies.title")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("cookies.body")}</p>
          <p className="mt-2 text-sm">
            <Link href="/cookies" className="link text-muted hover:text-text">
              {t("cookies.policyLink")}
            </Link>
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
            <Button variant="secondary" onClick={() => choose(true)}>
              {t("cookies.accept")}
            </Button>
            <Button variant="secondary" onClick={() => choose(false)}>
              {t("cookies.reject")}
            </Button>
            <Button variant="secondary" onClick={openSettings}>
              {t("cookies.settings")}
            </Button>
          </div>
        </section>
      ) : null}

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t("cookies.settingsTitle")} closeLabel={t("common.close")}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 border border-line p-4">
            <div>
              <p className="font-semibold">{t("cookies.essential")}</p>
              <p className="mt-1 text-sm text-muted">{t("cookies.essentialBody")}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-muted">{t("cookies.alwaysOn")}</span>
          </div>
          <div className="flex items-start justify-between gap-4 border border-line p-4">
            <div>
              <label htmlFor="consent-measurement" className="cursor-pointer font-semibold">
                {t("cookies.measurement")}
              </label>
              <p id="consent-measurement-desc" className="mt-1 text-sm text-muted">
                {t("cookies.measurementBody")}
              </p>
            </div>
            <input
              id="consent-measurement"
              type="checkbox"
              role="switch"
              aria-describedby="consent-measurement-desc"
              checked={measurement}
              onChange={(e) => setMeasurement(e.target.checked)}
              className="mt-1 size-6 shrink-0 cursor-pointer accent-[var(--accent)]"
            />
          </div>
          {consent ? <p className="text-sm text-faint">{t("cookies.saved", { date: formatDate(consent.date, locale) })}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => choose(false)}>
              {t("cookies.reject")}
            </Button>
            <Button variant="primary" onClick={() => choose(measurement)}>
              {t("cookies.save")}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function CookieSettingsLink() {
  const { t } = useI18n();
  return (
    <button type="button" className="link text-left text-muted hover:text-text" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {t("footer.cookieSettings")}
    </button>
  );
}
