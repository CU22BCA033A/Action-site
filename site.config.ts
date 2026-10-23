/**
 * Single source of truth for every business detail shown in the product.
 *
 * Fill in every value below before launch. `npm run launch-check` fails
 * while any required value is empty. `productionDomain` and `contactPhone`
 * are optional: with no phone, no phone link is shown anywhere; with no
 * custom domain, the free hosting domain is used.
 *
 * Never type these values anywhere else in the code base.
 */
export type SiteConfig = {
  brandName: string;
  productionDomain: string;
  contactEmail: string;
  contactPhone: string;
  legalEntityName: string;
  registeredAddress: string;
  grievanceOfficerName: string;
  grievanceOfficerEmail: string;
  primaryJurisdiction: string;
  useCustomDomain: boolean;
  legalLastUpdated: string;
};

export const siteConfig: SiteConfig = {
  brandName: "",
  productionDomain: "",
  contactEmail: "",
  contactPhone: "",
  legalEntityName: "",
  registeredAddress: "",
  grievanceOfficerName: "",
  grievanceOfficerEmail: "",
  primaryJurisdiction: "",

  /**
   * Set to true only after a custom domain is connected to the hosting
   * project and `productionDomain` is filled in.
   */
  useCustomDomain: false,

  /** Date shown as "Last updated" on every legal page (YYYY-MM-DD). */
  legalLastUpdated: "2026-10-23",
};

/** Keys that are allowed to stay empty at launch. */
export const optionalSiteConfigKeys = ["productionDomain", "contactPhone"] as const;

/** Keys that must be filled before launch. */
export const requiredSiteConfigKeys = [
  "brandName",
  "contactEmail",
  "legalEntityName",
  "registeredAddress",
  "grievanceOfficerName",
  "grievanceOfficerEmail",
  "primaryJurisdiction",
] as const;
