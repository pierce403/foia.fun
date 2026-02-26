import type { VoteTargetType } from "@/lib/types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function isVoteTargetType(value: string): value is VoteTargetType {
  return value === "idea" || value === "comment";
}
