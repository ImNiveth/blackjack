import { createDeck } from "../deck";
import { createInitialState, pendingDelay, reducer } from "../engine";
import type { Card, GameState, Rank, Suit } from "../types";

export const c = (rank: Rank, suit: Suit = "spades"): Card => ({ id: `${rank}-${suit}`, rank, suit });

/** Builds an idle state whose deck starts with the given cards, in order. */
export function rig(top: Card[], opts: { balance?: number; bet?: number } = {}): GameState {
  const base = createInitialState(1, opts.balance ?? 1000, opts.bet ?? 50);
  const used = new Set(top.map((x) => x.id));
  const filler = createDeck().filter((x) => !used.has(x.id));
  return { ...base, deck: [...top, ...filler] };
}

/** Drives every automatic step, exactly like the UI ticker does. */
export function auto(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (pendingDelay(s) !== null && guard++ < 100) s = reducer(s, { type: "TICK" });
  return s;
}

/** Starts a round from a rigged deck and plays out the opening deal. */
export const deal = (top: Card[], opts?: { balance?: number; bet?: number }) =>
  auto(reducer(rig(top, opts), { type: "NEW_ROUND" }));

/** Applies a player action and any automatic follow-up steps. */
export const act = (state: GameState, type: "HIT" | "STAND" | "DOUBLE" | "SPLIT") => auto(reducer(state, { type }));
