import type { SportConfig } from "@/lib/sports/config";
import type { Slab } from "@/lib/rules/slabs";

export type FloorPhase = "idle" | "live" | "paused" | "rtm_pending" | "sold" | "unsold";
export type AuctionStatus = "draft" | "scheduled" | "live" | "paused" | "completed" | "archived";

export type FloorState = {
  auctionId: string;
  currentAuctionPlayerId: string | null;
  phase: FloorPhase;
  currentPrice: number;
  leadingTeamId: string | null;
  version: number;
  timerEndsAt: string | null;
  pausedRemainingMs: number | null;
  rtmTeamId: string | null;
  rtmStage: "offered" | "awaiting_raise" | "raised" | null;
  lastResultTeamId: string | null;
  lastResultPrice: number | null;
  nextBidAmount: number | null;
  auctionStatus: AuctionStatus;
  eventSeq: number;
  settingsVersion: number;
  rulesChangedAt: string | null;
  serverTime: string;
};

export type PublicAuction = {
  id: string;
  slug: string;
  name: string;
  status: AuctionStatus;
  startsAt: string | null;
  sportId: string;
  sportKey: string;
  sportName: string;
  sportConfig: SportConfig;
  pointsUnitLabel: string;
  squadMin: number;
  squadMax: number;
  maxOverseas: number;
  roleMinimums: Record<string, number>;
  roleMaximums: Record<string, number>;
  reserveRuleEnabled: boolean;
  bidTimerSeconds: number | null;
  timerExtensionSeconds: number | null;
  rtmEnabled: boolean;
  rtmLabel: "RTM" | "FBM";
  rtmAllowFinalRaise: boolean;
  currentRound: number;
  rehearsal: boolean;
  registrationOpen: boolean;
  settingsVersion: number;
  rulesChangedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  slabs: Slab[];
};

export type PublicPlayer = {
  id: string;
  fullName: string;
  photoPath: string | null;
  roleKey: string;
  subRole: string | null;
  category: string | null;
  tags: string[];
  nationalityGroup: "domestic" | "overseas";
  stats: Record<string, number>;
  bioShort: string;
  ageGroup: string | null;
};

export type CurrentPlayer = PublicPlayer & {
  auctionPlayerId: string;
  lotNo: number;
  basePrice: number;
  setName: string;
  status: string;
  previousTeamId: string | null;
  round: number;
};

export type PublicTeam = {
  id: string;
  name: string;
  shortName: string;
  logoPath: string | null;
  primaryColor: string;
  secondaryColor: string;
  ownerDisplayName: string;
  purseTotal: number;
  purseSpent: number;
  purseLeft: number;
  maxBid: number;
  squadCount: number;
  overseasCount: number;
  roleCounts: Record<string, number>;
  slotsLeft: number;
  rtmCardsLeft: number;
};

export type BidEntry = {
  id: string;
  teamId: string;
  amount: number;
  createdAt: string;
  auctionPlayerId: string;
  playerName: string;
  source: "manager" | "admin_on_behalf";
};

export type QueueEntry = {
  auctionPlayerId: string;
  lotNo: number;
  playerId: string;
  fullName: string;
  photoPath: string | null;
  roleKey: string;
  subRole: string | null;
  category: string | null;
  nationalityGroup: "domestic" | "overseas";
  setName: string;
  basePrice: number;
};

export type SaleEntry = {
  auctionPlayerId: string;
  lotNo: number;
  playerId: string;
  fullName: string;
  photoPath: string | null;
  roleKey: string;
  teamId: string;
  price: number;
  soldAt: string | null;
  status: string;
};

export type Snapshot = {
  auction: PublicAuction;
  floor: FloorState;
  currentPlayer: CurrentPlayer | null;
  bids: BidEntry[];
  teams: PublicTeam[];
  totals: { purseTotal: number; spent: number; remaining: number };
  counts: { pool: number; onFloor: number; sold: number; unsold: number; retained: number; total: number };
  queue: QueueEntry[];
  recentSales: SaleEntry[];
  serverTime: string;
};

/** Realtime event payload. Kept tiny to stay inside free-tier limits. */
export type LiveEvent =
  | { seq: number; kind: "bid"; floor: FloorState; bid: BidEntry }
  | { seq: number; kind: "floor"; floor: FloorState }
  | { seq: number; kind: "refresh" };

export type EngineResult = {
  ok: boolean;
  code: string;
  message: string;
  floor: FloorState | null;
  amount?: number;
  conflicts?: { teamId: string; teamName: string; issue: string; role?: string; detail: string }[];
  count?: number;
};

export type AuctionStats = {
  soldCount: number;
  totalSpent: number;
  averagePrice: number;
  highestPrice: number;
  topPlayers: (Omit<SaleEntry, "soldAt" | "status"> & { subRole: string | null; category: string | null })[];
  byCategory: { key: string; spent: number; players: number }[];
  byRole: { key: string; spent: number; players: number }[];
  teams: { teamId: string; players: number; spent: number; average: number; remaining: number }[];
};
