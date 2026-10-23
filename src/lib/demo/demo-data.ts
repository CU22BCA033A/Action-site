/**
 * Invented demo data for rehearsals and screenshots. Names are built from
 * syllables so they never match a real athlete. Team names avoid real
 * franchise names. Deterministic for a given seed.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const givenStarts = ["Ar", "Ve", "Ka", "Ni", "Ta", "Ro", "Sa", "Ha", "Ji", "Mo", "De", "Pa", "Lu", "Re", "Za", "Ye", "Fe", "Oru", "Ishi", "Tu"];
const givenEnds = ["van", "ren", "sho", "lin", "dar", "mik", "tesh", "nav", "ron", "lio", "vek", "sen", "jor", "ran", "dev", "lan", "mir", "vit"];
const familyStarts = ["Kelo", "Varu", "Tama", "Orli", "Rishu", "Bena", "Golla", "Mira", "Sandu", "Pela", "Hoka", "Dunne", "Velo", "Chari", "Nadu", "Zeri", "Quila", "Torre"];
const familyEnds = ["di", "kar", "vel", "nath", "wade", "ker", "mane", "bury", "lund", "ppa", "ston", "rao", "dale", "gan", "ford"];

export function inventedNames(count: number, seed = 7): string[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]!;
  const out = new Set<string>();
  while (out.size < count) {
    out.add(`${pick(givenStarts)}${pick(givenEnds)} ${pick(familyStarts)}${pick(familyEnds)}`);
  }
  return [...out];
}

export const demoTeams = [
  { name: "Harbor Hawks", shortName: "HAW", primaryColor: "#1F6FEB", secondaryColor: "#F2F4F8", owner: "Demo owner one" },
  { name: "Ridge Rangers", shortName: "RID", primaryColor: "#2E8B57", secondaryColor: "#F4F1E8", owner: "Demo owner two" },
  { name: "Coastline Comets", shortName: "CMT", primaryColor: "#C2410C", secondaryColor: "#FFF4EC", owner: "Demo owner three" },
  { name: "Monsoon Mariners", shortName: "MON", primaryColor: "#0E7490", secondaryColor: "#ECFEFF", owner: "Demo owner four" },
  { name: "Riverbend Otters", shortName: "OTT", primaryColor: "#7C3AED", secondaryColor: "#F5F3FF", owner: "Demo owner five" },
  { name: "Canyon Cranes", shortName: "CRN", primaryColor: "#B91C1C", secondaryColor: "#FEF2F2", owner: "Demo owner six" },
  { name: "Orchard Owls", shortName: "OWL", primaryColor: "#A16207", secondaryColor: "#FEFCE8", owner: "Demo owner seven" },
  { name: "Lantern Lynx", shortName: "LYN", primaryColor: "#334155", secondaryColor: "#F1F5F9", owner: "Demo owner eight" },
] as const;

export type DemoPlayer = {
  fullName: string;
  roleKey: string;
  subRole: string | null;
  category: string | null;
  tags: string[];
  nationalityGroup: "domestic" | "overseas";
  stats: Record<string, number>;
  bioShort: string;
  setName: string;
  setOrder: number;
};

type RoleSpec = { key: string; subRoles: string[] };

export function demoPlayers(input: {
  roles: RoleSpec[];
  categories: string[];
  statKeys: { key: string; kind: "integer" | "decimal" }[];
  count: number;
  overseasShare?: number;
  seed?: number;
}): DemoPlayer[] {
  const seed = input.seed ?? 11;
  const rnd = mulberry32(seed);
  const names = inventedNames(input.count, seed);
  const players: DemoPlayer[] = [];
  for (let i = 0; i < input.count; i++) {
    const role = input.roles[i % input.roles.length]!;
    const sub = role.subRoles.length ? role.subRoles[Math.floor(rnd() * role.subRoles.length)]! : null;
    const category = input.categories.length ? input.categories[Math.min(Math.floor(i / Math.ceil(input.count / input.categories.length)), input.categories.length - 1)]! : null;
    const overseas = rnd() < (input.overseasShare ?? 0.2);
    const stats: Record<string, number> = {};
    for (const s of input.statKeys) {
      stats[s.key] = s.kind === "decimal" ? Math.round((rnd() * 60 + 60) * 10) / 10 : Math.floor(rnd() * 120);
    }
    const marquee = i < Math.max(4, Math.floor(input.count / 8));
    players.push({
      fullName: names[i]!,
      roleKey: role.key,
      subRole: sub,
      category,
      tags: [],
      nationalityGroup: overseas ? "overseas" : "domestic",
      stats,
      bioShort: "Demo profile with invented details.",
      setName: marquee ? "Marquee" : `Set ${1 + Math.floor((i - 4) / 12)}`,
      setOrder: marquee ? 0 : 1 + Math.floor((i - 4) / 12),
    });
  }
  return players;
}
