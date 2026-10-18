import { useCallback, useEffect, useMemo, useReducer } from "react";
import { randomSeed } from "@/game/deck";
import { availableActions, pendingDelay, reducer, resumeState } from "@/game/engine";
import { statusFor } from "@/game/status";
import { loadState, saveState } from "@/game/storage";
import type { GameState } from "@/game/types";

function init(): GameState {
  return resumeState(loadState(), randomSeed());
}

/**
 * Binds the pure engine to React. The engine never deals with time; whenever
 * it reports a pending delay (dealing, dealer's turn, split follow-up card)
 * this hook schedules the next TICK, which keeps animations evenly paced and
 * makes every transition cancellable.
 */
export function useBlackjack() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    const delay = pendingDelay(state);
    if (delay === null) return;
    const timer = window.setTimeout(() => dispatch({ type: "TICK" }), delay);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const hit = useCallback(() => dispatch({ type: "HIT" }), []);
  const stand = useCallback(() => dispatch({ type: "STAND" }), []);
  const double = useCallback(() => dispatch({ type: "DOUBLE" }), []);
  const split = useCallback(() => dispatch({ type: "SPLIT" }), []);
  const newRound = useCallback(() => dispatch({ type: "NEW_ROUND" }), []);
  const increaseBet = useCallback(() => dispatch({ type: "ADJUST_BET", direction: 1 }), []);
  const decreaseBet = useCallback(() => dispatch({ type: "ADJUST_BET", direction: -1 }), []);
  const resetBalance = useCallback(() => dispatch({ type: "RESET_BALANCE", seed: randomSeed() }), []);

  const can = useMemo(() => availableActions(state), [state]);
  const status = useMemo(() => statusFor(state), [state]);

  return {
    state,
    can,
    status,
    actions: { hit, stand, double, split, newRound, increaseBet, decreaseBet, resetBalance },
  };
}
