import { describe, expect, it, vi } from "vitest";
import { act, c, deal, rig } from "@/game/__tests__/helpers";
import { availableActions, reducer } from "@/game/engine";
import type { GameState } from "@/game/types";
import { SHORTCUT_LABELS, buildShortcuts, enterAction, type ShortcutHandlers } from "../bindings";

function handlers(): ShortcutHandlers {
  return {
    hit: vi.fn(),
    stand: vi.fn(),
    double: vi.fn(),
    split: vi.fn(),
    newRound: vi.fn(),
    toggleSound: vi.fn(),
    increaseBet: vi.fn(),
    decreaseBet: vi.fn(),
  };
}

const bindingsFor = (state: GameState) => {
  const on = handlers();
  return { on, map: buildShortcuts(availableActions(state), on) };
};

/** Every phase the UI can be in, built from real engine transitions. */
function phases() {
  const idle = rig([c("8"), c("7", "hearts"), c("8", "hearts"), c("9", "hearts")]);
  const dealing = reducer(idle, { type: "NEW_ROUND" });
  const player = deal([c("8"), c("7", "hearts"), c("8", "hearts"), c("9", "hearts")]);
  const dealer = reducer(player, { type: "STAND" });
  const settled = act(player, "STAND");
  const broke = act(deal([c("10"), c("7", "hearts"), c("6"), c("9", "hearts"), c("K", "diamonds")], { balance: 15 }), "HIT");
  return { idle, dealing, player, dealer, settled, broke };
}

describe("Enter", () => {
  it("stands during play, deals when the round is over and is otherwise left alone", () => {
    const p = phases();
    expect(p.dealing.phase).toBe("dealing");
    expect(p.dealer.phase).toBe("dealer");
    expect(p.settled.phase).toBe("settled");

    expect(enterAction(availableActions(p.idle))).toBe("newRound");
    expect(enterAction(availableActions(p.dealing))).toBeNull();
    expect(enterAction(availableActions(p.player))).toBe("stand");
    expect(enterAction(availableActions(p.dealer))).toBeNull();
    expect(enterAction(availableActions(p.settled))).toBe("newRound");
    expect(enterAction(availableActions(p.broke))).toBeNull();
  });

  it("is bound to exactly one handler at a time", () => {
    for (const state of Object.values(phases())) {
      const { on, map } = bindingsFor(state);
      map.Enter?.();
      const fired = [on.stand, on.newRound].filter((fn) => (fn as ReturnType<typeof vi.fn>).mock.calls.length > 0);
      expect(fired.length).toBeLessThanOrEqual(1);
      if (state.phase === "player") expect(on.stand).toHaveBeenCalledTimes(1);
      if (state.phase === "idle" || state.phase === "settled") {
        expect(on.newRound).toHaveBeenCalledTimes(state.balance >= 10 ? 1 : 0);
      }
    }
  });

  it("never stands and deals from the same state", () => {
    // Walk a whole round pressing Enter at every step the UI could receive it.
    let s = rig([c("10"), c("7", "hearts"), c("8"), c("9", "hearts"), c("5", "diamonds")]);
    const log: string[] = [];
    for (let guard = 0; guard < 40 && log.length < 3; guard++) {
      const action = enterAction(availableActions(s));
      if (action === "newRound") {
        log.push("newRound");
        s = reducer(s, { type: "NEW_ROUND" });
      } else if (action === "stand") {
        log.push("stand");
        s = reducer(s, { type: "STAND" });
      } else {
        s = reducer(s, { type: "TICK" });
      }
    }
    expect(log).toEqual(["newRound", "stand", "newRound"]);
  });
});

describe("key layout", () => {
  it("maps each key to its assigned action only", () => {
    const { on, map } = bindingsFor(phases().player); // pair of eights: every action legal
    map.ArrowLeft?.();
    map.ArrowRight?.();
    map.Control?.();
    map.Enter?.();
    expect(on.hit).toHaveBeenCalledTimes(1);
    expect(on.double).toHaveBeenCalledTimes(1);
    expect(on.split).toHaveBeenCalledTimes(1);
    expect(on.stand).toHaveBeenCalledTimes(1);
    expect(on.newRound).not.toHaveBeenCalled();
  });

  it("no longer binds the retired keys", () => {
    const { map } = bindingsFor(phases().player);
    for (const key of ["h", "s", "d", "p", "n", "H", "S", "D", "P", "N"]) {
      expect(map[key]).toBeUndefined();
    }
  });

  it("disables actions that are not legal in the current state", () => {
    const p = phases();
    const idle = bindingsFor(p.idle).map;
    expect(idle.ArrowLeft).toBeUndefined();
    expect(idle.ArrowRight).toBeUndefined();
    expect(idle.Control).toBeUndefined();
    expect(idle.Enter).toBeDefined();

    const hitOnce = act(deal([c("2"), c("7", "hearts"), c("3"), c("9", "hearts"), c("4", "diamonds")]), "HIT");
    const three = bindingsFor(hitOnce).map;
    expect(three.ArrowLeft).toBeDefined();
    expect(three.Enter).toBeDefined();
    expect(three.ArrowRight).toBeUndefined(); // double only on the first two cards
    expect(three.Control).toBeUndefined();
  });

  it("keeps the bet and sound shortcuts", () => {
    const { on, map } = bindingsFor(phases().idle);
    map.ArrowUp?.();
    map["+"]?.();
    map.ArrowDown?.();
    map["-"]?.();
    map.m?.();
    expect(on.increaseBet).toHaveBeenCalledTimes(2);
    expect(on.decreaseBet).toHaveBeenCalledTimes(2);
    expect(on.toggleSound).toHaveBeenCalledTimes(1);
  });

  it("advertises the same keys on the buttons", () => {
    expect(SHORTCUT_LABELS.hit).toMatchObject({ hint: "←", aria: "ArrowLeft" });
    expect(SHORTCUT_LABELS.stand).toMatchObject({ hint: "Enter", aria: "Enter" });
    expect(SHORTCUT_LABELS.double).toMatchObject({ hint: "→", aria: "ArrowRight" });
    expect(SHORTCUT_LABELS.newRound).toMatchObject({ hint: "Enter", aria: "Enter" });
    expect(SHORTCUT_LABELS.split.hint).toBe("Ctrl");
    expect(SHORTCUT_LABELS.split.aria).toBeUndefined(); // a lone modifier is not a valid aria-keyshortcuts value
    expect(SHORTCUT_LABELS.split.description).toMatch(/Control/);
  });
});
