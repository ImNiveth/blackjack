import type { Card, Rank, Suit } from "./types";

export const SUITS: readonly Suit[] = ["spades", "hearts", "diamonds", "clubs"];

export const RANKS: readonly Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

/** A fresh, ordered 52-card deck with no duplicates. */
export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: `${rank}-${suit}`, rank, suit });
    }
  }
  return cards;
}

/**
 * One step of the mulberry32 PRNG.
 * Returns a float in [0, 1) together with the advanced seed so that callers
 * can thread the generator state through pure functions.
 */
export function nextRandom(seed: number): [value: number, nextSeed: number] {
  const nextSeed = (seed + 0x6d2b79f5) | 0;
  let t = nextSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, nextSeed];
}

/** Fisher–Yates shuffle driven by the seeded generator. Never mutates input. */
export function shuffle<T>(items: readonly T[], seed: number): { items: T[]; seed: number } {
  const arr = items.slice();
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    const [r, next] = nextRandom(s);
    s = next;
    const j = Math.floor(r * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { items: arr, seed: s };
}

/** A fresh, shuffled deck. */
export function shuffledDeck(seed: number): { items: Card[]; seed: number } {
  return shuffle(createDeck(), seed);
}

/** Produces a random 32-bit seed from the platform's CSPRNG when available. */
export function randomSeed(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] | 0;
  }
  return (Math.random() * 0xffffffff) | 0;
}
