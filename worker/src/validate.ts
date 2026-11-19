const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isHeroineId(value: unknown, ids: ReadonlySet<string>): value is string {
  return typeof value === "string" && ids.has(value);
}

export async function rateBucket(ip: string, salt: string, kind: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}\n${kind}\n${ip}`),
  );
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${kind}:${hex.slice(0, 24)}`;
}
