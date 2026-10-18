import { shuffledDeck, createDeck, shuffle } from "./deck";
import { handValue, isNatural, isNaturalHand, isPair } from "./hand";
import type { Action, AvailableActions, Card, GameState, HandResult, PlayerHand } from "./types";

/* ------------------------------------------------------------------ */
/*  Rules & constants                                                  */
/* ------------------------------------------------------------------ */

export const MIN_BET = 10;
export const DEFAULT_BALANCE = 10000;
export const DEFAULT_BET = 50;
/** Reshuffle before a round whenever fewer cards than this remain. */
export const RESHUFFLE_THRESHOLD = 20;
/** Maximum number of hands a player may hold after splitting. */
export const MAX_HANDS = 4;
/** Dealer draws while below this total (stands on all 17s). */
export const DEALER_STANDS_ON = 17;
export const BLACKJACK_PAYOUT = 1.5;

/* ------------------------------------------------------------------ */
/*  Betting helpers                                                    */
/* ------------------------------------------------------------------ */

/** Largest legal bet for a balance — always a multiple of MIN_BET. */
export function maxBet(balance: number): number {
  return Math.floor(balance / MIN_BET) * MIN_BET;
}

/** Keeps the bet within [MIN_BET, maxBet(balance)]. */
export function clampBet(bet: number, balance: number): number {
  const max = maxBet(balance);
  if (max < MIN_BET) return MIN_BET;
  const rounded = Math.round(bet / MIN_BET) * MIN_BET;
  return Math.min(Math.max(rounded, MIN_BET), max);
}

/** Bet increments grow with the stake so large bets stay quick to reach. */
export function betStep(amount: number): number {
  if (amount < 100) return 10;
  if (amount < 500) return 50;
  return 100;
}

export function adjustBet(bet: number, direction: 1 | -1, balance: number): number {
  const step = direction > 0 ? betStep(bet) : betStep(bet - 1);
  return clampBet(bet + direction * step, balance);
}

/* ------------------------------------------------------------------ */
/*  State construction                                                 */
/* ------------------------------------------------------------------ */

export function createInitialState(seed: number, balance = DEFAULT_BALANCE, bet = DEFAULT_BET): GameState {
  const shoe = shuffledDeck(seed);
  return {
    phase: "idle",
    deck: shoe.items,
    seed: shoe.seed,
    dealer: [],
    holeHidden: true,
    hands: [],
    active: 0,
    balance,
    bet: clampBet(bet, balance),
    dealStep: 0,
    roundId: 0,
    shuffled: false,
  };
}

/**
 * Chooses the state a session starts from. A saved game in which no round has
 * ever been played holds no progress, so it is rebuilt with the current
 * defaults — this is how a changed starting balance reaches returning visitors
 * who never dealt a hand, while anyone mid-session keeps their balance.
 */
export function resumeState(saved: GameState | null, seed: number): GameState {
  if (!saved) return createInitialState(seed);
  if (saved.roundId === 0 && saved.phase === "idle") {
    return createInitialState(seed, DEFAULT_BALANCE, saved.bet);
  }
  return saved;
}

function makeHand(id: string, bet: number): PlayerHand {
  return { id, cards: [], bet, doubled: false, fromSplit: false, splitAces: false, done: false };
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function updateHand(state: GameState, index: number, fn: (hand: PlayerHand) => PlayerHand): GameState {
  return { ...state, hands: state.hands.map((h, i) => (i === index ? fn(h) : h)) };
}

/**
 * Draws the top card. If the shoe is ever exhausted mid-round (practically
 * impossible with the reshuffle threshold, but handled anyway) a fresh deck is
 * shuffled *excluding* every card currently on the table, so no duplicates can
 * appear within a round.
 */
function drawCard(state: GameState): [Card, GameState] {
  let deck = state.deck;
  let seed = state.seed;
  if (deck.length === 0) {
    const inPlay = new Set([...state.dealer, ...state.hands.flatMap((h) => h.cards)].map((c) => c.id));
    const fresh = shuffle(
      createDeck().filter((c) => !inPlay.has(c.id)),
      seed,
    );
    deck = fresh.items;
    seed = fresh.seed;
  }
  const [card, ...rest] = deck;
  return [card, { ...state, deck: rest, seed }];
}

function dealToActive(state: GameState): GameState {
  const [card, next] = drawCard(state);
  return updateHand(next, next.active, (h) => ({ ...h, cards: [...h.cards, card] }));
}

/** Moves on to the next unfinished hand, or hands control to the dealer. */
function advance(state: GameState): GameState {
  const nextIndex = state.hands.findIndex((h, i) => i > state.active && !h.done);
  if (nextIndex !== -1) return { ...state, active: nextIndex };
  return { ...state, phase: "dealer" };
}

function finishActive(state: GameState): GameState {
  return advance(updateHand(state, state.active, (h) => ({ ...h, done: true })));
}

/** Applies automatic consequences after a card lands on the active hand. */
function afterPlayerCard(state: GameState): GameState {
  const hand = state.hands[state.active];
  const { total } = handValue(hand.cards);
  const mustStop =
    total >= 21 || hand.doubled || (hand.splitAces && hand.cards.length >= 2);
  return mustStop ? finishActive(state) : state;
}

/* ------------------------------------------------------------------ */
/*  Round lifecycle                                                    */
/* ------------------------------------------------------------------ */

function startRound(state: GameState): GameState {
  if (state.phase !== "idle" && state.phase !== "settled") return state;
  const bet = clampBet(state.bet, state.balance);
  if (bet > state.balance) return state;

  let deck = state.deck;
  let seed = state.seed;
  let shuffled = false;
  if (deck.length < RESHUFFLE_THRESHOLD) {
    const shoe = shuffledDeck(seed);
    deck = shoe.items;
    seed = shoe.seed;
    shuffled = true;
  }

  const roundId = state.roundId + 1;
  return {
    ...state,
    deck,
    seed,
    bet,
    shuffled,
    balance: state.balance - bet,
    phase: "dealing",
    dealStep: 0,
    dealer: [],
    holeHidden: true,
    hands: [makeHand(`r${roundId}-h0`, bet)],
    active: 0,
    roundId,
  };
}

/** Deals one card of the opening sequence: player, dealer, player, dealer. */
function dealingStep(state: GameState): GameState {
  const step = state.dealStep;
  const [card, drawn] = drawCard(state);
  let next: GameState =
    step % 2 === 0
      ? updateHand(drawn, 0, (h) => ({ ...h, cards: [...h.cards, card] }))
      : { ...drawn, dealer: [...drawn.dealer, card] };
  next = { ...next, dealStep: step + 1 };
  if (next.dealStep < 4) return next;

  // Opening deal complete – check for naturals. The dealer "peeks": if either
  // side holds a blackjack the round resolves immediately.
  const playerNatural = isNatural(next.hands[0].cards);
  const dealerNatural = isNatural(next.dealer);
  if (playerNatural) next = updateHand(next, 0, (h) => ({ ...h, done: true }));
  if (playerNatural || dealerNatural) return { ...next, phase: "dealer" };
  return { ...next, phase: "player", active: 0 };
}

/** Deals the second card to a freshly split hand. */
function playerAutoStep(state: GameState): GameState {
  const hand = state.hands[state.active];
  if (!hand || hand.cards.length >= 2 || hand.done) return state;
  return afterPlayerCard(dealToActive(state));
}

/** One beat of the dealer's turn: reveal, draw, or settle. */
function dealerStep(state: GameState): GameState {
  if (state.holeHidden) return { ...state, holeHidden: false };

  // The dealer only draws when at least one player hand can still be beaten.
  const live = state.hands.some((h) => !isNaturalHand(h) && handValue(h.cards).total <= 21);
  const total = handValue(state.dealer).total;
  if (live && total < DEALER_STANDS_ON) {
    const [card, next] = drawCard(state);
    return { ...next, dealer: [...next.dealer, card] };
  }
  return settle(state);
}

export function resolveHand(hand: PlayerHand, dealer: readonly Card[]): { result: HandResult; payout: number } {
  const total = handValue(hand.cards).total;
  const dealerTotal = handValue(dealer).total;
  const natural = isNaturalHand(hand);
  const dealerNatural = isNatural(dealer);

  if (natural && dealerNatural) return { result: "push", payout: hand.bet };
  if (natural) return { result: "blackjack", payout: hand.bet * (1 + BLACKJACK_PAYOUT) };
  if (total > 21) return { result: "bust", payout: 0 };
  if (dealerNatural) return { result: "lose", payout: 0 };
  if (dealerTotal > 21) return { result: "win", payout: hand.bet * 2 };
  if (total > dealerTotal) return { result: "win", payout: hand.bet * 2 };
  if (total < dealerTotal) return { result: "lose", payout: 0 };
  return { result: "push", payout: hand.bet };
}

function settle(state: GameState): GameState {
  let returned = 0;
  const hands = state.hands.map((h) => {
    const { result, payout } = resolveHand(h, state.dealer);
    returned += payout;
    return { ...h, result, payout, done: true };
  });
  const balance = state.balance + returned;
  return { ...state, hands, balance, phase: "settled", bet: clampBet(state.bet, balance) };
}

/* ------------------------------------------------------------------ */
/*  Player actions                                                     */
/* ------------------------------------------------------------------ */

function hit(state: GameState): GameState {
  if (!availableActions(state).hit) return state;
  return afterPlayerCard(dealToActive(state));
}

function stand(state: GameState): GameState {
  if (!availableActions(state).stand) return state;
  return finishActive(state);
}

function doubleDown(state: GameState): GameState {
  if (!availableActions(state).double) return state;
  const hand = state.hands[state.active];
  const funded = updateHand(
    { ...state, balance: state.balance - hand.bet },
    state.active,
    (h) => ({ ...h, bet: h.bet * 2, doubled: true }),
  );
  return afterPlayerCard(dealToActive(funded));
}

function split(state: GameState): GameState {
  if (!availableActions(state).split) return state;
  const hand = state.hands[state.active];
  const [first, second] = hand.cards;
  const aces = first.rank === "A";
  const left: PlayerHand = { ...hand, cards: [first], fromSplit: true, splitAces: aces };
  const right: PlayerHand = {
    ...hand,
    id: `${hand.id}s${state.hands.length}`,
    cards: [second],
    fromSplit: true,
    splitAces: aces,
  };
  const hands = [...state.hands.slice(0, state.active), left, right, ...state.hands.slice(state.active + 1)];
  // The active hand now holds a single card; the next TICK deals its second.
  return { ...state, hands, balance: state.balance - hand.bet };
}

function resetBalance(state: GameState, seed: number): GameState {
  return createInitialState(seed, DEFAULT_BALANCE, state.bet);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "ADJUST_BET": {
      if (!availableActions(state).adjustBet) return state;
      return { ...state, bet: adjustBet(state.bet, action.direction, state.balance) };
    }
    case "SET_BET": {
      if (!availableActions(state).adjustBet) return state;
      return { ...state, bet: clampBet(action.bet, state.balance) };
    }
    case "NEW_ROUND":
      return availableActions(state).newRound ? startRound(state) : state;
    case "TICK":
      switch (state.phase) {
        case "dealing":
          return dealingStep(state);
        case "player":
          return playerAutoStep(state);
        case "dealer":
          return dealerStep(state);
        default:
          return state;
      }
    case "HIT":
      return hit(state);
    case "STAND":
      return stand(state);
    case "DOUBLE":
      return doubleDown(state);
    case "SPLIT":
      return split(state);
    case "RESET_BALANCE":
      return resetBalance(state, action.seed);
    default:
      return state;
  }
}

/** Which controls are legal right now. The UI uses this to disable buttons. */
export function availableActions(state: GameState): AvailableActions {
  const hand = state.hands[state.active];
  const between = state.phase === "idle" || state.phase === "settled";
  const playing = state.phase === "player" && !!hand && !hand.done && hand.cards.length >= 2;
  const firstDecision = playing && hand.cards.length === 2 && !hand.splitAces;
  const canAfford = !!hand && state.balance >= hand.bet;

  const result: AvailableActions = {
    hit: playing && !hand.splitAces,
    stand: playing,
    double: firstDecision && canAfford,
    split: firstDecision && isPair(hand.cards) && state.hands.length < MAX_HANDS && canAfford,
    newRound: between && state.balance >= MIN_BET,
    adjustBet: between && state.balance >= MIN_BET,
  };

  if (firstDecision && !canAfford) {
    result.doubleReason = "Insufficient balance";
    if (isPair(hand.cards)) result.splitReason = "Insufficient balance";
  }
  if (firstDecision && isPair(hand.cards) && state.hands.length >= MAX_HANDS) {
    result.splitReason = `Maximum of ${MAX_HANDS} hands`;
  }
  return result;
}

/**
 * Milliseconds until the engine should receive the next automatic TICK,
 * or null when the game is waiting on the player.
 */
export function pendingDelay(state: GameState): number | null {
  switch (state.phase) {
    case "dealing":
      return state.dealStep === 0 ? 200 : 340;
    case "player": {
      const hand = state.hands[state.active];
      return hand && hand.cards.length < 2 && !hand.done ? 380 : null;
    }
    case "dealer":
      return state.holeHidden ? 520 : 680;
    default:
      return null;
  }
}

/** Total wagered across all hands in the current round. */
export function totalWagered(state: GameState): number {
  return state.hands.reduce((sum, h) => sum + h.bet, 0);
}

/** Net result of a settled round (positive = profit). */
export function netResult(state: GameState): number {
  return state.hands.reduce((sum, h) => sum + (h.payout ?? 0) - h.bet, 0);
}

export function isBroke(state: GameState): boolean {
  return (state.phase === "idle" || state.phase === "settled") && state.balance < MIN_BET;
}
