import type { Card, PlayerHand, Rank } from "./types";

export interface HandValue {
  /** Best total that does not bust (or the minimum total when every option busts). */
  total: number;
  /** True when an ace is currently counted as 11. */
  soft: boolean;
  /** Total with every ace counted as 1 — useful for "7 / 17" style displays. */
  hard: number;
}

/** Face value of a single card. Aces are returned as 1; see `handValue`. */
export function cardValue(rank: Rank): number {
  if (rank === "A") return 1;
  if (rank === "K" || rank === "Q" || rank === "J") return 10;
  return Number(rank);
}

/**
 * Evaluates a hand. Aces count as 1 or 11 — one ace is promoted to 11
 * whenever that does not bust the hand (two promoted aces would always bust).
 */
export function handValue(cards: readonly Card[]): HandValue {
  let hard = 0;
  let aces = 0;
  for (const card of cards) {
    hard += cardValue(card.rank);
    if (card.rank === "A") aces++;
  }
  if (aces > 0 && hard + 10 <= 21) {
    return { total: hard + 10, soft: true, hard };
  }
  return { total: hard, soft: false, hard };
}

export function isBust(cards: readonly Card[]): boolean {
  return handValue(cards).total > 21;
}

/** Two cards totalling 21 — an ace plus a ten-value card. */
export function isNatural(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** A player hand is a blackjack only if it was not created by a split. */
export function isNaturalHand(hand: Pick<PlayerHand, "cards" | "fromSplit">): boolean {
  return !hand.fromSplit && isNatural(hand.cards);
}

/** Pairs are defined by equal value, so 10-J, Q-K etc. may be split. */
export function isPair(cards: readonly Card[]): boolean {
  return cards.length === 2 && cardValue(cards[0].rank) === cardValue(cards[1].rank);
}
