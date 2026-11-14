import { Gavel, Trophy } from "lucide-react";
import { RoleIcon } from "@/components/auction/role-icon";
import type { RoleIconKey } from "@/lib/sports/config";

/**
 * Decorative 3D centrepiece for the home hero, drawn in CSS only (no images,
 * no JavaScript): a spinning gold medallion with a gavel on one face and a
 * trophy on the other, real edge thickness from stacked layers, and two tilted
 * orbit rings, one carrying role icons that always face the viewer.
 * Hidden from assistive technology; motion stops under prefers-reduced-motion.
 */
const ORBIT_ICONS: RoleIconKey[] = ["bat", "ball", "gloves", "all_rounder"];
const EDGE_LAYERS = 14;

export function HeroScene() {
  return (
    <div className="hero-scene" aria-hidden="true">
      <div className="hero-scene__halo" />

      <div className="hero-scene__orbit hero-scene__orbit--royal">
        <div className="hero-scene__ring hero-scene__ring--royal">
          <span className="hero-scene__dot" style={{ left: "50%", top: "0%" }} />
          <span className="hero-scene__dot" style={{ left: "50%", top: "100%" }} />
        </div>
      </div>

      <div className="hero-scene__bob">
        <div className="hero-scene__coin">
          {Array.from({ length: EDGE_LAYERS }, (_, i) => (
            <span key={i} className="hero-scene__edge" style={{ ["--z" as string]: `${i - EDGE_LAYERS / 2}px` }} />
          ))}
          <div className="hero-scene__face hero-scene__face--front">
            <Gavel className="hero-scene__glyph" strokeWidth={1.6} />
          </div>
          <div className="hero-scene__face hero-scene__face--back">
            <Trophy className="hero-scene__glyph" strokeWidth={1.6} />
          </div>
        </div>
      </div>

      <div className="hero-scene__orbit hero-scene__orbit--gold">
        <div className="hero-scene__ring hero-scene__ring--gold">
          {ORBIT_ICONS.map((icon, i) => {
            const pos = [
              { left: "50%", top: "0%" },
              { left: "100%", top: "50%" },
              { left: "50%", top: "100%" },
              { left: "0%", top: "50%" },
            ][i]!;
            return (
              <span key={icon} className="hero-scene__chip-anchor" style={pos}>
                <span className="hero-scene__chip">
                  <RoleIcon icon={icon} className="size-7" />
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="hero-scene__floor" />
    </div>
  );
}
