/**
 * Core domain types for the Blackjack engine.
 * These are plain, serialisable data structures — no classes, no React.
 */

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  /** Unique within a single deck, e.g. "A-spades". */
  id: string;
  rank: Rank;
  suit: Suit;
}

/** Outcome of a single player hand once the round is settled. */
export type HandResult = "blackjack" | "win" | "lose" | "push" | "bust";

export interface PlayerHand {
  /** Stable identifier used for rendering keys. */
  id: string;
  cards: Card[];
  /** Amount wagered on this hand (already deducted from the balance). */
  bet: number;
  doubled: boolean;
  /** Hands created by a split can never be a natural blackjack. */
  fromSplit: boolean;
  /** Split aces receive exactly one card and then stand automatically. */
  splitAces: boolean;
  /** True once the hand can no longer be acted upon. */
  done: boolean;
  result?: HandResult;
  /** Amount returned to the balance when the hand was settled (0 when lost). */
  payout?: number;
}

export type Phase =
  | "idle" // no round in progress – the table is empty
  | "dealing" // the initial four cards are being dealt
  | "player" // waiting for the player to act on the active hand
  | "dealer" // dealer reveals the hole card and draws
  | "settled"; // round complete, results on display

export interface GameState {
  phase: Phase;
  /** Remaining cards in the shoe, top of the deck first. */
  deck: Card[];
  /** PRNG state, advanced on every shuffle so the reducer stays pure. */
  seed: number;
  dealer: Card[];
  /** True while the dealer's second card is face down. */
  holeHidden: boolean;
  hands: PlayerHand[];
  /** Index of the hand currently being played. */
  active: number;
  balance: number;
  /** The bet that will be placed on the next round. */
  bet: number;
  /** Progress of the initial deal (0–4). */
  dealStep: number;
  /** Increments every round so cards get fresh render keys. */
  roundId: number;
  /** Set when the shoe was reshuffled for the current round. */
  shuffled: boolean;
}

export type Action =
  | { type: "ADJUST_BET"; direction: 1 | -1 }
  | { type: "SET_BET"; bet: number }
  | { type: "NEW_ROUND" }
  | { type: "TICK" }
  | { type: "HIT" }
  | { type: "STAND" }
  | { type: "DOUBLE" }
  | { type: "SPLIT" }
  | { type: "RESET_BALANCE"; seed: number };

export interface AvailableActions {
  hit: boolean;
  stand: boolean;
  double: boolean;
  split: boolean;
  newRound: boolean;
  adjustBet: boolean;
  /** Human readable reason why double/split is unavailable (optional). */
  doubleReason?: string;
  splitReason?: string;
}
