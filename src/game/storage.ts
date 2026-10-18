import { RANKS, SUITS } from "./deck";
import type { Card, GameState, Phase, PlayerHand } from "./types";

const STATE_KEY = "blackjack.state.v1";
const PREFS_KEY = "blackjack.prefs.v1";

export interface Prefs {
  sound: boolean;
}

export const DEFAULT_PREFS: Prefs = { sound: true };

const PHASES: readonly Phase[] = ["idle", "dealing", "player", "dealer", "settled"];

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/* ---------- validation ---------- */

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.rank === "string" &&
    typeof c.suit === "string" &&
    (RANKS as readonly string[]).includes(c.rank) &&
    (SUITS as readonly string[]).includes(c.suit)
  );
}

function isCardArray(value: unknown): value is Card[] {
  return Array.isArray(value) && value.every(isCard);
}

function isHand(value: unknown): value is PlayerHand {
  if (!value || typeof value !== "object") return false;
  const h = value as Record<string, unknown>;
  return (
    typeof h.id === "string" &&
    isCardArray(h.cards) &&
    typeof h.bet === "number" &&
    Number.isFinite(h.bet) &&
    h.bet >= 0 &&
    typeof h.doubled === "boolean" &&
    typeof h.fromSplit === "boolean" &&
    typeof h.splitAces === "boolean" &&
    typeof h.done === "boolean"
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Structural check so corrupted or tampered storage can never crash the game. */
export function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  if (!(PHASES as readonly unknown[]).includes(s.phase)) return false;
  if (!isCardArray(s.deck) || !isCardArray(s.dealer)) return false;
  if (!Array.isArray(s.hands) || !s.hands.every(isHand)) return false;
  if (!isFiniteNumber(s.seed) || !isFiniteNumber(s.balance) || s.balance < 0) return false;
  if (!isFiniteNumber(s.bet) || !isFiniteNumber(s.dealStep) || !isFiniteNumber(s.roundId)) return false;
  if (typeof s.holeHidden !== "boolean" || !isFiniteNumber(s.active)) return false;
  if (s.phase !== "idle" && s.phase !== "settled" && s.active >= (s.hands as unknown[]).length) return false;
  // A finished hand can never be the active one while the player is acting – guards against stuck states.
  if (s.phase === "player" && (s.hands as PlayerHand[])[s.active].done) return false;

  // No card may appear twice across the deck and the table.
  const ids = [...(s.deck as Card[]), ...(s.dealer as Card[]), ...(s.hands as PlayerHand[]).flatMap((h) => h.cards)].map(
    (c) => c.id,
  );
  return new Set(ids).size === ids.length;
}

/* ---------- game state ---------- */

export function loadState(): GameState | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGameState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveState(state: GameState): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded or private mode – persistence is best effort */
  }
}

/* ---------- preferences ---------- */

export function loadPrefs(): Prefs {
  const store = storage();
  if (!store) return DEFAULT_PREFS;
  try {
    const raw = store.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return { ...DEFAULT_PREFS, sound: typeof parsed.sound === "boolean" ? parsed.sound : DEFAULT_PREFS.sound };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
