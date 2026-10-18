import type { AvailableActions } from "@/game/types";
import type { ShortcutHandler, ShortcutMap } from "./shortcuts";

/* ------------------------------------------------------------------ */
/*  Key layout                                                         */
/*                                                                     */
/*  ←      Hit                                                         */
/*  →      Double down                                                 */
/*  Enter  Stand while a hand is in play · New game once it is over    */
/*  Ctrl   Split (tapped on its own)                                   */
/*  ↑ ↓    Adjust bet (also + / −)                                     */
/*  M      Toggle sound                                                */
/* ------------------------------------------------------------------ */

export interface ShortcutHandlers {
  hit: ShortcutHandler;
  stand: ShortcutHandler;
  double: ShortcutHandler;
  split: ShortcutHandler;
  newRound: ShortcutHandler;
  toggleSound: ShortcutHandler;
  /** Omitted when the bet cannot currently move in that direction. */
  increaseBet?: ShortcutHandler;
  decreaseBet?: ShortcutHandler;
}

export type EnterAction = "stand" | "newRound" | null;

/**
 * Enter is context dependent: it stands while a hand is being played and deals
 * a new round once the previous one is over. The two conditions are mutually
 * exclusive – standing needs the player phase, a new round needs an idle or
 * settled table – so one key press maps to at most one action. While cards are
 * being dealt or the dealer is drawing, Enter is left alone.
 */
export function enterAction(can: AvailableActions): EnterAction {
  if (can.stand) return "stand";
  if (can.newRound) return "newRound";
  return null;
}

export function buildShortcuts(can: AvailableActions, on: ShortcutHandlers): ShortcutMap {
  const enter = enterAction(can);
  return {
    ArrowLeft: can.hit ? on.hit : undefined,
    ArrowRight: can.double ? on.double : undefined,
    Enter: enter === "stand" ? on.stand : enter === "newRound" ? on.newRound : undefined,
    Control: can.split ? on.split : undefined,
    m: on.toggleSound,
    ArrowUp: on.increaseBet,
    "+": on.increaseBet,
    "=": on.increaseBet,
    ArrowDown: on.decreaseBet,
    "-": on.decreaseBet,
    _: on.decreaseBet,
  };
}

export interface ShortcutLabel {
  /** Short text shown on the button's key cap. */
  hint: string;
  /**
   * Value for `aria-keyshortcuts`. ARIA requires at least one non-modifier key,
   * so a bare modifier tap cannot be expressed here and uses `description`.
   */
  aria?: string;
  /** Visually hidden description for assistive technology. */
  description?: string;
}

export const SHORTCUT_LABELS: Record<"hit" | "stand" | "double" | "split" | "newRound", ShortcutLabel> = {
  hit: { hint: "←", aria: "ArrowLeft" },
  stand: { hint: "Enter", aria: "Enter" },
  double: { hint: "→", aria: "ArrowRight" },
  split: { hint: "Ctrl", description: "Keyboard shortcut: tap the Control key on its own." },
  newRound: { hint: "Enter", aria: "Enter" },
};
