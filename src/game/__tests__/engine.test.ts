import { describe, expect, it } from "vitest";
import { createDeck, shuffle } from "../deck";
import {
  DEFAULT_BALANCE,
  DEFAULT_BET,
  MIN_BET,
  availableActions,
  clampBet,
  createInitialState,
  isBroke,
  reducer,
  resumeState,
} from "../engine";
import { handValue, isNatural } from "../hand";
import { isGameState } from "../storage";
import type { GameState } from "../types";
import { act, auto, c, deal } from "./helpers";

/* ---------- deck ---------- */

describe("deck", () => {
  it("contains 52 unique cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((x) => x.id)).size).toBe(52);
  });

  it("shuffles into a permutation deterministically per seed", () => {
    const a = shuffle(createDeck(), 42);
    const b = shuffle(createDeck(), 42);
    const d = shuffle(createDeck(), 7);
    expect(a.items.map((x) => x.id)).toEqual(b.items.map((x) => x.id));
    expect(a.items.map((x) => x.id)).not.toEqual(d.items.map((x) => x.id));
    expect([...a.items].sort((x, y) => x.id.localeCompare(y.id))).toEqual(
      createDeck().sort((x, y) => x.id.localeCompare(y.id)),
    );
  });
});

/* ---------- hand values ---------- */

describe("hand values", () => {
  it("treats aces as 11 only when it does not bust", () => {
    expect(handValue([c("A"), c("9")])).toMatchObject({ total: 20, soft: true });
    expect(handValue([c("A"), c("A", "hearts")])).toMatchObject({ total: 12, soft: true });
    expect(handValue([c("A"), c("9"), c("5")])).toMatchObject({ total: 15, soft: false });
    expect(handValue([c("K"), c("Q"), c("A")])).toMatchObject({ total: 21, soft: false });
    expect(handValue([c("A"), c("A", "hearts"), c("9")])).toMatchObject({ total: 21, soft: true });
  });

  it("recognises naturals only on two cards", () => {
    expect(isNatural([c("A"), c("K")])).toBe(true);
    expect(isNatural([c("A"), c("5"), c("5", "hearts")])).toBe(false);
  });
});

/* ---------- naturals ---------- */

describe("naturals", () => {
  it("pays 3:2 for a player blackjack and the dealer does not draw", () => {
    const s = deal([c("A"), c("5", "hearts"), c("K"), c("9", "hearts")]);
    expect(s.phase).toBe("settled");
    expect(s.hands[0].result).toBe("blackjack");
    expect(s.dealer).toHaveLength(2);
    expect(s.holeHidden).toBe(false);
    expect(s.balance).toBe(1075);
  });

  it("pushes when both sides hold blackjack", () => {
    const s = deal([c("A"), c("A", "hearts"), c("K"), c("K", "hearts")]);
    expect(s.phase).toBe("settled");
    expect(s.hands[0].result).toBe("push");
    expect(s.balance).toBe(1000);
  });

  it("ends the round immediately when only the dealer has blackjack", () => {
    const s = deal([c("10"), c("A", "hearts"), c("9"), c("K", "hearts")]);
    expect(s.phase).toBe("settled");
    expect(s.hands[0].result).toBe("lose");
    expect(s.balance).toBe(950);
  });
});

/* ---------- hit / stand / dealer ---------- */

describe("hit and stand", () => {
  it("busts the player and the dealer does not draw", () => {
    let s = deal([c("10"), c("7", "hearts"), c("6"), c("9", "hearts"), c("K", "diamonds")]);
    expect(s.phase).toBe("player");
    s = act(s, "HIT");
    expect(s.phase).toBe("settled");
    expect(s.hands[0].result).toBe("bust");
    expect(s.dealer).toHaveLength(2); // dealer had 16 but nothing to beat
    expect(s.balance).toBe(950);
  });

  it("auto-stands on 21 after a hit", () => {
    let s = deal([c("10"), c("7", "hearts"), c("6"), c("9", "hearts"), c("5", "diamonds"), c("10", "diamonds")]);
    s = act(s, "HIT"); // 21 → auto stand → dealer draws 10 → busts
    expect(s.phase).toBe("settled");
    expect(s.hands[0].result).toBe("win");
    expect(s.balance).toBe(1050);
  });

  it("dealer hits 16 and stands on 17", () => {
    let s = deal([c("10"), c("7", "hearts"), c("8"), c("9", "hearts"), c("5", "diamonds")]);
    s = act(s, "STAND"); // dealer 16 → draws 5 → 21
    expect(s.dealer).toHaveLength(3);
    expect(s.hands[0].result).toBe("lose");
    expect(s.balance).toBe(950);
  });

  it("dealer stands on soft 17", () => {
    let s = deal([c("10"), c("A", "hearts"), c("8"), c("6", "hearts"), c("5", "diamonds")]);
    s = act(s, "STAND");
    expect(s.dealer).toHaveLength(2);
    expect(s.hands[0].result).toBe("win");
    expect(s.balance).toBe(1050);
  });

  it("returns the bet on a push", () => {
    let s = deal([c("10"), c("10", "hearts"), c("8"), c("8", "hearts")]);
    s = act(s, "STAND");
    expect(s.hands[0].result).toBe("push");
    expect(s.balance).toBe(1000);
  });
});

/* ---------- double down ---------- */

describe("double down", () => {
  it("doubles the bet, deals exactly one card and stands", () => {
    let s = deal([c("5"), c("7", "hearts"), c("6"), c("9", "hearts"), c("9", "diamonds"), c("10", "diamonds")]);
    expect(availableActions(s).double).toBe(true);
    s = act(s, "DOUBLE");
    expect(s.hands[0].cards).toHaveLength(3);
    expect(s.hands[0].bet).toBe(100);
    expect(s.hands[0].doubled).toBe(true);
    expect(s.phase).toBe("settled");
    expect(s.hands[0].result).toBe("win"); // dealer 16 → 26
    expect(s.balance).toBe(1100);
  });

  it("is unavailable after hitting or without funds", () => {
    let s = deal([c("2"), c("7", "hearts"), c("3"), c("9", "hearts"), c("4", "diamonds")]);
    s = act(s, "HIT");
    expect(availableActions(s).double).toBe(false);

    const poor = deal([c("5"), c("7", "hearts"), c("6"), c("9", "hearts")], { balance: 50, bet: 50 });
    const actions = availableActions(poor);
    expect(actions.double).toBe(false);
    expect(actions.doubleReason).toBe("Insufficient balance");
    expect(reducer(poor, { type: "DOUBLE" })).toBe(poor);
  });
});

/* ---------- split ---------- */

describe("split", () => {
  it("plays two independent hands and settles each", () => {
    let s = deal([
      c("8"),
      c("7", "hearts"),
      c("8", "hearts"),
      c("9", "hearts"),
      c("3"),
      c("10"),
      c("2"),
      c("9"),
      c("5", "diamonds"),
    ]);
    expect(availableActions(s).split).toBe(true);
    s = reducer(s, { type: "SPLIT" });
    expect(s.hands).toHaveLength(2);
    expect(s.balance).toBe(900);
    expect(s.hands[0].cards.map((x) => x.id)).toEqual(["8-spades"]);
    expect(availableActions(s).hit).toBe(false); // waiting for the second card

    s = auto(s);
    expect(s.hands[0].cards.map((x) => x.id)).toEqual(["8-spades", "3-spades"]);
    expect(s.hands[1].cards).toHaveLength(1);

    s = act(s, "HIT"); // 8+3+10 = 21 → auto-stand → next hand gets its card
    expect(s.active).toBe(1);
    expect(s.hands[1].cards.map((x) => x.id)).toEqual(["8-hearts", "2-spades"]);

    s = act(s, "HIT"); // 19
    s = act(s, "STAND"); // dealer 16 → 21
    expect(s.phase).toBe("settled");
    expect(s.hands[0].result).toBe("push");
    expect(s.hands[1].result).toBe("lose");
    expect(s.balance).toBe(950);
  });

  it("split aces receive one card each and 21 is not a blackjack", () => {
    let s = deal([
      c("A"),
      c("7", "hearts"),
      c("A", "hearts"),
      c("9", "hearts"),
      c("K"),
      c("5", "diamonds"),
      c("10", "diamonds"),
    ]);
    s = act(s, "SPLIT");
    expect(s.phase).toBe("settled");
    expect(s.hands[0].cards).toHaveLength(2);
    expect(s.hands[1].cards).toHaveLength(2);
    expect(s.hands[0].result).toBe("win"); // 21 pays 1:1, not 3:2
    expect(s.hands[1].result).toBe("win"); // dealer busts
    expect(s.balance).toBe(1100);
  });

  it("allows re-splitting up to four hands", () => {
    let s = deal([c("10"), c("7", "hearts"), c("10", "hearts"), c("9", "hearts"), c("10", "diamonds"), c("10", "clubs"), c("J")]);
    s = act(s, "SPLIT");
    expect(s.hands).toHaveLength(2);
    s = act(s, "SPLIT");
    expect(s.hands).toHaveLength(3);
    s = act(s, "SPLIT");
    expect(s.hands).toHaveLength(4);
    expect(s.balance).toBe(800);
    const actions = availableActions(s);
    expect(actions.split).toBe(false);
    expect(actions.splitReason).toBe("Maximum of 4 hands");
  });

  it("cannot split without funds or non-pairs", () => {
    const poor = deal([c("8"), c("7", "hearts"), c("8", "hearts"), c("9", "hearts")], { balance: 50, bet: 50 });
    expect(availableActions(poor).split).toBe(false);
    expect(availableActions(poor).splitReason).toBe("Insufficient balance");
    const mixed = deal([c("8"), c("7", "hearts"), c("9"), c("9", "hearts")]);
    expect(availableActions(mixed).split).toBe(false);
  });
});

/* ---------- betting & balance ---------- */

describe("betting", () => {
  it("clamps bets to the balance and the minimum", () => {
    expect(clampBet(500, 120)).toBe(120);
    expect(clampBet(500, 125)).toBe(120);
    expect(clampBet(0, 1000)).toBe(MIN_BET);
    expect(clampBet(55, 1000)).toBe(60);
  });

  it("uses tiered increments", () => {
    const s = createInitialState(1, 5000, 90);
    const up = reducer(s, { type: "ADJUST_BET", direction: 1 });
    expect(up.bet).toBe(100);
    expect(reducer(up, { type: "ADJUST_BET", direction: 1 }).bet).toBe(150);
    expect(reducer(up, { type: "ADJUST_BET", direction: -1 }).bet).toBe(90);
    const big = reducer(s, { type: "SET_BET", bet: 500 });
    expect(reducer(big, { type: "ADJUST_BET", direction: 1 }).bet).toBe(600);
    expect(reducer(big, { type: "ADJUST_BET", direction: -1 }).bet).toBe(450);
  });

  it("never allows negative balances and detects bankruptcy", () => {
    let s = deal([c("10"), c("7", "hearts"), c("6"), c("9", "hearts"), c("K", "diamonds")], { balance: 15, bet: 50 });
    expect(s.hands[0].bet).toBe(10);
    s = act(s, "HIT"); // bust
    expect(s.balance).toBe(5);
    expect(isBroke(s)).toBe(true);
    expect(availableActions(s).newRound).toBe(false);
    expect(reducer(s, { type: "NEW_ROUND" })).toBe(s);

    const reset = reducer(s, { type: "RESET_BALANCE", seed: 99 });
    expect(reset.balance).toBe(DEFAULT_BALANCE);
    expect(reset.phase).toBe("idle");
  });

  it("starts new games with a $10,000 balance and a $50 bet", () => {
    expect(DEFAULT_BALANCE).toBe(10000);
    const fresh = createInitialState(7);
    expect(fresh.balance).toBe(10000);
    expect(fresh.bet).toBe(DEFAULT_BET);
    expect(fresh.phase).toBe("idle");
  });

  it("resumes saved sessions, rebuilding only games that never played a round", () => {
    expect(resumeState(null, 3).balance).toBe(DEFAULT_BALANCE);

    // Legacy save from before the default changed, no rounds played → new default.
    const untouched = { ...createInitialState(3, 1000), bet: 200 };
    const resumed = resumeState(untouched, 4);
    expect(resumed.balance).toBe(DEFAULT_BALANCE);
    expect(resumed.bet).toBe(200);

    // Real progress is always preserved, whatever the balance.
    const played = deal([c("A"), c("5", "hearts"), c("K"), c("9", "hearts")]);
    expect(played.roundId).toBe(1);
    expect(resumeState(played, 4)).toBe(played);
    const midRound = deal([c("10"), c("7", "hearts"), c("6"), c("9", "hearts")]);
    expect(resumeState(midRound, 4)).toBe(midRound);
  });

  it("ignores player actions once the round has ended", () => {
    const s = deal([c("A"), c("5", "hearts"), c("K"), c("9", "hearts")]);
    expect(reducer(s, { type: "HIT" })).toBe(s);
    expect(reducer(s, { type: "STAND" })).toBe(s);
    expect(reducer(s, { type: "DOUBLE" })).toBe(s);
    expect(reducer(s, { type: "SPLIT" })).toBe(s);
  });

  it("ignores bet changes during a round", () => {
    const s = deal([c("10"), c("7", "hearts"), c("6"), c("9", "hearts")]);
    expect(reducer(s, { type: "ADJUST_BET", direction: 1 }).bet).toBe(50);
  });
});

/* ---------- deck integrity ---------- */

describe("deck integrity", () => {
  it("never deals a duplicate card within a round", () => {
    let s = createInitialState(123);
    for (let round = 0; round < 30; round++) {
      s = auto(reducer(s, { type: "NEW_ROUND" }));
      while (s.phase === "player") s = act(s, availableActions(s).split ? "SPLIT" : "HIT");
      const ids = [...s.dealer, ...s.hands.flatMap((h) => h.cards)].map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(s.phase).toBe("settled");
    }
  });

  it("reshuffles when the shoe runs low", () => {
    const s = { ...createInitialState(5), deck: createDeck().slice(0, 10) };
    const next = reducer(s, { type: "NEW_ROUND" });
    expect(next.shuffled).toBe(true);
    expect(next.deck.length + 0).toBe(52);
  });

  it("recovers from an exhausted shoe without duplicates", () => {
    const base = deal([c("10"), c("7", "hearts"), c("6"), c("9", "hearts")]);
    const starved: GameState = { ...base, deck: [] };
    const next = reducer(starved, { type: "HIT" });
    const ids = [...next.dealer, ...next.hands.flatMap((h) => h.cards)].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(next.deck).toHaveLength(52 - 5);
  });
});

/* ---------- persistence ---------- */

describe("storage validation", () => {
  it("accepts real states and rejects corrupt ones", () => {
    const s = createInitialState(1);
    expect(isGameState(s)).toBe(true);
    expect(isGameState(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(isGameState({})).toBe(false);
    expect(isGameState(null)).toBe(false);
    expect(isGameState({ ...s, balance: -5 })).toBe(false);
    expect(isGameState({ ...s, deck: [...s.deck, s.deck[0]] })).toBe(false);
    expect(isGameState({ ...s, phase: "player", hands: [] })).toBe(false);

    const stuck = deal([c("10"), c("7", "hearts"), c("6"), c("9", "hearts")]);
    expect(isGameState(stuck)).toBe(true);
    expect(isGameState({ ...stuck, hands: [{ ...stuck.hands[0], done: true }] })).toBe(false);
  });
});
