import Image from "next/image";
import { initials } from "@/lib/format";
import { mediaUrl, readableOn } from "@/lib/media";

/** Role chip: a distinct shape per role position plus the text label. */
const shapes = ["circle", "square", "triangle", "diamond", "hexagon", "cross", "bar"] as const;

function RoleShape({ index }: { index: number }) {
  const shape = shapes[((index % shapes.length) + shapes.length) % shapes.length];
  const common = { fill: "currentColor" };
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 shrink-0">
      {shape === "circle" && <circle cx="6" cy="6" r="4.5" {...common} />}
      {shape === "square" && <rect x="1.8" y="1.8" width="8.4" height="8.4" {...common} />}
      {shape === "triangle" && <path d="M6 1.2l5 9.3H1z" {...common} />}
      {shape === "diamond" && <path d="M6 .8L11.2 6 6 11.2.8 6z" {...common} />}
      {shape === "hexagon" && <path d="M3.2 1.3h5.6L11.5 6l-2.7 4.7H3.2L.5 6z" {...common} />}
      {shape === "cross" && <path d="M4.5 1h3v3.5H11v3H7.5V11h-3V7.5H1v-3h3.5z" {...common} />}
      {shape === "bar" && <rect x="1" y="4" width="10" height="4" {...common} />}
    </svg>
  );
}

export function RoleChip({ label, index, subRole, size = "md" }: { label: string; index: number; subRole?: string | null; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-xs)] border border-line-strong bg-surface-2 font-semibold text-text ${size === "sm" ? "h-6 px-1.5 text-xs" : "h-7 px-2 text-sm"}`}
    >
      <span className="text-accent-text">
        <RoleShape index={index} />
      </span>
      <span>{label}</span>
      {subRole ? <span className="font-normal text-muted">{subRole}</span> : null}
    </span>
  );
}

/** Player photo, or an in-house silhouette with initials when missing. */
export function PlayerAvatar({
  name,
  photoPath,
  size,
  className = "",
  priority = false,
}: {
  name: string;
  photoPath: string | null | undefined;
  size: number;
  className?: string;
  priority?: boolean;
}) {
  const url = mediaUrl(photoPath);
  if (url) {
    return (
      <Image
        src={url}
        alt={`Photo of ${name}`}
        width={size}
        height={size}
        unoptimized
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className={`shrink-0 bg-surface-2 object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={`No photo for ${name}`}
      className={`relative inline-flex shrink-0 items-end justify-center overflow-hidden bg-surface-3 text-muted ${className}`}
      style={{ width: size, height: size }}
    >
      <svg aria-hidden="true" viewBox="0 0 64 64" className="absolute inset-x-0 bottom-0 h-[86%] w-full text-line-strong">
        <circle cx="32" cy="22" r="12" fill="currentColor" />
        <path d="M8 64c2-14 12-22 24-22s22 8 24 22z" fill="currentColor" />
      </svg>
      <span className="num relative mb-[6%] font-bold text-text" style={{ fontSize: Math.max(10, size * 0.22) }}>
        {initials(name)}
      </span>
    </span>
  );
}

/** Team logo, or a block in the team colour with its short name. */
export function TeamMark({
  team,
  size = 40,
  className = "",
}: {
  team: { name: string; shortName: string; logoPath: string | null; primaryColor: string; secondaryColor?: string };
  size?: number;
  className?: string;
}) {
  const url = mediaUrl(team.logoPath);
  if (url) {
    return (
      <Image
        src={url}
        alt={`${team.name} logo`}
        width={size}
        height={size}
        unoptimized
        className={`shrink-0 bg-surface-2 object-contain ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={`${team.name} logo`}
      className={`num inline-flex shrink-0 items-center justify-center font-extrabold tracking-wide ${className}`}
      style={{ width: size, height: size, background: team.primaryColor, color: readableOn(team.primaryColor), fontSize: Math.max(10, size * 0.3) }}
    >
      {team.shortName}
    </span>
  );
}
