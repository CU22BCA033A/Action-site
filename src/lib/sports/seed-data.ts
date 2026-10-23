import type { AuctionDefaults, SportConfig } from "./config";

/**
 * Starting presets only. The admin edits every value from Admin > Sports.
 * The two league-shaped presets are examples to review, never official data.
 */

const generalSlabs = [
  { from: 0, to: 100, increment: 5 },
  { from: 100, to: 200, increment: 10 },
  { from: 200, to: null, increment: 20 },
];

const baseDefaults: Omit<AuctionDefaults, "squadMin" | "squadMax" | "maxOverseas" | "roleMinimums" | "roleMaximums"> = {
  pointsUnitLabel: "points",
  purse: 1000,
  defaultBasePrice: 20,
  categoryBasePrices: {},
  slabs: generalSlabs,
  bidTimerSeconds: 30,
  timerExtensionSeconds: 10,
  reserveRuleEnabled: true,
  rtmEnabled: false,
  rtmLabel: "RTM",
  rtmAllowFinalRaise: true,
  rtmCardsPerTeam: 0,
  retentionsEnabled: false,
  maxRetentions: 0,
};

export type SeedSport = {
  key: string;
  name: string;
  sortOrder: number;
  config: SportConfig;
  presets: { name: string; description: string; isExample: boolean; config: AuctionDefaults }[];
};

export const seedSports: SeedSport[] = [
  {
    key: "cricket",
    name: "Cricket",
    sortOrder: 1,
    config: {
      roles: [
        { key: "batter", label: "Batter", subRoles: [], hidden: false },
        { key: "bowler", label: "Bowler", subRoles: ["Pace", "Spin"], hidden: false },
        { key: "all_rounder", label: "All-rounder", subRoles: [], hidden: false },
        { key: "wicketkeeper", label: "Wicketkeeper", subRoles: [], hidden: false },
      ],
      categories: [],
      tags: ["Capped", "Uncapped", "Overseas"],
      statFields: [
        { key: "matches", label: "Matches", kind: "integer", showOnCard: true },
        { key: "runs", label: "Runs", kind: "integer", showOnCard: true },
        { key: "wickets", label: "Wickets", kind: "integer", showOnCard: true },
        { key: "strike_rate", label: "Strike rate", kind: "decimal", showOnCard: true },
        { key: "economy", label: "Economy", kind: "decimal", showOnCard: true },
      ],
      defaults: {
        ...baseDefaults,
        squadMin: 15,
        squadMax: 25,
        maxOverseas: 8,
        roleMinimums: { wicketkeeper: 1, bowler: 4 },
        roleMaximums: {},
      },
    },
    presets: [
      {
        name: "Cricket franchise preset",
        description:
          "Example shaped like a franchise league: tiered increments by price band, squad of 18 to 25, up to 8 overseas, retentions and Right to Match with one final raise. Review every value before use.",
        isExample: true,
        config: {
          pointsUnitLabel: "lakh",
          purse: 12000,
          squadMin: 18,
          squadMax: 25,
          maxOverseas: 8,
          roleMinimums: { wicketkeeper: 1, bowler: 4 },
          roleMaximums: {},
          defaultBasePrice: 30,
          categoryBasePrices: {},
          slabs: [
            { from: 0, to: 100, increment: 5 },
            { from: 100, to: 200, increment: 10 },
            { from: 200, to: null, increment: 20 },
          ],
          bidTimerSeconds: 30,
          timerExtensionSeconds: 10,
          reserveRuleEnabled: true,
          rtmEnabled: true,
          rtmLabel: "RTM",
          rtmAllowFinalRaise: true,
          rtmCardsPerTeam: 2,
          retentionsEnabled: true,
          maxRetentions: 6,
        },
      },
    ],
  },
  {
    key: "kabaddi",
    name: "Kabaddi",
    sortOrder: 2,
    config: {
      roles: [
        { key: "raider", label: "Raider", subRoles: [], hidden: false },
        { key: "defender", label: "Defender", subRoles: ["Left corner", "Right corner", "Cover"], hidden: false },
        { key: "all_rounder", label: "All-rounder", subRoles: [], hidden: false },
      ],
      categories: ["A", "B", "C", "D"],
      tags: ["Young player", "Overseas"],
      statFields: [
        { key: "matches", label: "Matches", kind: "integer", showOnCard: true },
        { key: "raid_points", label: "Raid points", kind: "integer", showOnCard: true },
        { key: "tackle_points", label: "Tackle points", kind: "integer", showOnCard: true },
      ],
      defaults: {
        ...baseDefaults,
        squadMin: 12,
        squadMax: 20,
        maxOverseas: 3,
        roleMinimums: { raider: 3, defender: 4 },
        roleMaximums: {},
        categoryBasePrices: { A: 40, B: 30, C: 20, D: 10 },
      },
    },
    presets: [
      {
        name: "Kabaddi category preset",
        description:
          "Example shaped like a category-based league: categories A to D with fixed base prices, squad of 18 to 25, up to 4 overseas, and a Final Bid Match card. Review every value before use.",
        isExample: true,
        config: {
          pointsUnitLabel: "lakh",
          purse: 500,
          squadMin: 18,
          squadMax: 25,
          maxOverseas: 4,
          roleMinimums: { raider: 4, defender: 5 },
          roleMaximums: {},
          defaultBasePrice: 9,
          categoryBasePrices: { A: 30, B: 20, C: 13, D: 9 },
          slabs: [
            { from: 0, to: 50, increment: 1 },
            { from: 50, to: 100, increment: 2 },
            { from: 100, to: null, increment: 5 },
          ],
          bidTimerSeconds: 30,
          timerExtensionSeconds: 10,
          reserveRuleEnabled: true,
          rtmEnabled: true,
          rtmLabel: "FBM",
          rtmAllowFinalRaise: false,
          rtmCardsPerTeam: 2,
          retentionsEnabled: true,
          maxRetentions: 6,
        },
      },
    ],
  },
  {
    key: "football",
    name: "Football",
    sortOrder: 3,
    config: {
      roles: [
        { key: "goalkeeper", label: "Goalkeeper", subRoles: [], hidden: false },
        { key: "defender", label: "Defender", subRoles: ["Centre back", "Full back"], hidden: false },
        { key: "midfielder", label: "Midfielder", subRoles: ["Defensive", "Central", "Attacking"], hidden: false },
        { key: "forward", label: "Forward", subRoles: ["Winger", "Striker"], hidden: false },
      ],
      categories: [],
      tags: ["Overseas", "Youth"],
      statFields: [
        { key: "matches", label: "Matches", kind: "integer", showOnCard: true },
        { key: "goals", label: "Goals", kind: "integer", showOnCard: true },
        { key: "assists", label: "Assists", kind: "integer", showOnCard: true },
        { key: "clean_sheets", label: "Clean sheets", kind: "integer", showOnCard: true },
      ],
      defaults: {
        ...baseDefaults,
        squadMin: 14,
        squadMax: 22,
        maxOverseas: 5,
        roleMinimums: { goalkeeper: 2, defender: 4, midfielder: 4, forward: 2 },
        roleMaximums: { goalkeeper: 3 },
      },
    },
    presets: [],
  },
  {
    key: "volleyball",
    name: "Volleyball",
    sortOrder: 4,
    config: {
      roles: [
        { key: "setter", label: "Setter", subRoles: [], hidden: false },
        { key: "outside_hitter", label: "Outside hitter", subRoles: [], hidden: false },
        { key: "middle_blocker", label: "Middle blocker", subRoles: [], hidden: false },
        { key: "opposite", label: "Opposite", subRoles: [], hidden: false },
        { key: "libero", label: "Libero", subRoles: [], hidden: false },
      ],
      categories: [],
      tags: ["Overseas"],
      statFields: [
        { key: "matches", label: "Matches", kind: "integer", showOnCard: true },
        { key: "kills", label: "Kills", kind: "integer", showOnCard: true },
        { key: "blocks", label: "Blocks", kind: "integer", showOnCard: true },
        { key: "aces", label: "Aces", kind: "integer", showOnCard: true },
        { key: "digs", label: "Digs", kind: "integer", showOnCard: true },
      ],
      defaults: {
        ...baseDefaults,
        squadMin: 10,
        squadMax: 14,
        maxOverseas: 2,
        roleMinimums: { setter: 1, libero: 1, middle_blocker: 2 },
        roleMaximums: { libero: 2 },
      },
    },
    presets: [],
  },
];
