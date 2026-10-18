import { isBroke, netResult } from "./engine";
import { handValue, isNatural } from "./hand";
import { formatMoney, formatSigned } from "./format";
import type { GameState, HandResult } from "./types";

export type Tone = "win" | "lose" | "push" | "neutral";

export interface Status {
  title: string;
  detail?: string;
  tone: Tone;
}

export const RESULT_LABEL: Record<HandResult, string> = {
  blackjack: "Blackjack",
  win: "Win",
  lose: "Lose",
  push: "Push",
  bust: "Bust",
};

export function toneFor(result: HandResult | undefined): Tone {
  switch (result) {
    case "blackjack":
    case "win":
      return "win";
    case "lose":
    case "bust":
      return "lose";
    case "push":
      return "push";
    default:
      return "neutral";
  }
}

/** Derives the headline message shown in the centre of the table. */
export function statusFor(state: GameState): Status | null {
  switch (state.phase) {
    case "idle":
      if (isBroke(state)) {
        return { title: "Out of chips", detail: "Reset your balance to keep playing", tone: "neutral" };
      }
      return { title: "Place your bet", detail: "Press New Game or Enter to deal", tone: "neutral" };

    case "settled": {
      const net = netResult(state);
      const dealerTotal = handValue(state.dealer).total;
      const dealerBust = dealerTotal > 21;
      const dealerNatural = isNatural(state.dealer);
      const broke = isBroke(state);
      const money = formatSigned(net);

      if (state.hands.length === 1) {
        const hand = state.hands[0];
        switch (hand.result) {
          case "blackjack":
            return { title: "Blackjack", detail: `Pays 3 to 2 · ${money}`, tone: "win" };
          case "win":
            return {
              title: "You win",
              detail: dealerBust ? `Dealer busts · ${money}` : money,
              tone: "win",
            };
          case "push":
            return {
              title: "Push",
              detail: dealerNatural ? "Both blackjack · bet returned" : "Bet returned",
              tone: "push",
            };
          case "bust":
            return { title: "Bust", detail: broke ? "Out of chips" : money, tone: "lose" };
          case "lose":
          default:
            return {
              title: "Dealer wins",
              detail: dealerNatural ? `Dealer blackjack · ${money}` : broke ? "Out of chips" : money,
              tone: "lose",
            };
        }
      }

      const wins = state.hands.filter((h) => h.result === "win" || h.result === "blackjack").length;
      const losses = state.hands.filter((h) => h.result === "lose" || h.result === "bust").length;
      const summary = `${wins} won · ${losses} lost · ${money}`;
      if (net > 0) return { title: "You win", detail: summary, tone: "win" };
      if (net < 0) return { title: "Dealer wins", detail: broke ? "Out of chips" : summary, tone: "lose" };
      return { title: "Push", detail: summary, tone: "push" };
    }

    default:
      return null;
  }
}

/** Short caption describing a hand's wager, e.g. "$50 · doubled". */
export function wagerCaption(bet: number, doubled: boolean): string {
  return doubled ? `${formatMoney(bet)} · doubled` : formatMoney(bet);
}
