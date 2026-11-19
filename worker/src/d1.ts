import type { Sql } from "./store";

interface Prepared {
  bind(...values: unknown[]): {
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results?: T[] }>;
    run(): Promise<{ meta?: { changes?: number } }>;
  };
}

interface DatabaseLike {
  prepare(query: string): Prepared;
}

export function fromD1(db: DatabaseLike): Sql {
  return {
    async first<T>(query: string, ...binds: unknown[]): Promise<T | null> {
      const row = await db.prepare(query).bind(...binds).first<T>();
      return row ?? null;
    },
    async all<T>(query: string, ...binds: unknown[]): Promise<T[]> {
      const result = await db.prepare(query).bind(...binds).all<T>();
      return result.results ?? [];
    },
    async run(query: string, ...binds: unknown[]): Promise<{ changes: number }> {
      const result = await db.prepare(query).bind(...binds).run();
      return { changes: result.meta?.changes ?? 0 };
    },
  };
}
