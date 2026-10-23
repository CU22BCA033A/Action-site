/**
 * Tiny, dependency-free message lookup. Keys are dot paths into a nested
 * dictionary; `{name}` placeholders are replaced from `vars`.
 */
export type Messages = { [key: string]: string | Messages };

type Prev = [never, 0, 1, 2, 3, 4];
/** Dot paths to every string leaf, at most four levels deep. */
export type Paths<T, D extends number = 4> = [D] extends [never]
  ? never
  : T extends string
    ? never
    : { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K], Prev[D]>}` }[keyof T & string];

export type Vars = Record<string, string | number>;

export function lookup(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export type TranslateFn<T> = (key: Paths<T>, vars?: Vars) => string;

export function createTranslator<T extends object>(messages: T, fallback?: object): TranslateFn<T> {
  return (key, vars) => {
    const found = lookup(messages as Messages, key) ?? (fallback ? lookup(fallback as Messages, key) : undefined);
    return format(found ?? key, vars);
  };
}
