"use client";

import { Field, Select, SelectWrap } from "@/components/ui/field";

/**
 * Player type (from the auction's own list, such as Student or Faculty) and,
 * only when the auction uses it, domestic or overseas. Both are optional
 * details; nothing shows when the auction uses neither.
 */
export function PlayerTypeFields({
  idPrefix,
  types,
  useNationality,
  playerType,
  onPlayerType,
  nationality,
  onNationality,
  error,
}: {
  idPrefix: string;
  types: string[];
  useNationality: boolean;
  playerType: string;
  onPlayerType: (v: string) => void;
  nationality: "domestic" | "overseas";
  onNationality: (v: "domestic" | "overseas") => void;
  error?: string;
}) {
  // Keep a type the player already has even if it was later removed from the list.
  const options = playerType && !types.includes(playerType) ? [...types, playerType] : types;
  return (
    <>
      {options.length ? (
        <Field name={`${idPrefix}-playerType`} label="Player type" optional error={error}>
          <SelectWrap>
            <Select id={`f-${idPrefix}-playerType`} value={playerType} onChange={(e) => onPlayerType(e.target.value)}>
              <option value="">Not set</option>
              {options.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </SelectWrap>
        </Field>
      ) : null}
      {useNationality || nationality === "overseas" ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Domestic or overseas</legend>
          <div className="flex gap-4">
            {(["domestic", "overseas"] as const).map((n) => (
              <label key={n} className="flex min-h-11 cursor-pointer items-center gap-2">
                <input type="radio" name={`${idPrefix}-nat`} checked={nationality === n} onChange={() => onNationality(n)} className="size-5 accent-[var(--accent)]" />
                {n === "domestic" ? "Domestic" : "Overseas"}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </>
  );
}
