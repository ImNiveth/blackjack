import { useCallback, useEffect, useRef, useState } from "react";
import { BetControl } from "@/components/BetControl";
import { Controls } from "@/components/Controls";
import { Hand } from "@/components/Hand";
import { StatusBanner } from "@/components/StatusBanner";
import { ResetButton, TopBar } from "@/components/TopBar";
import { MIN_BET, isBroke, maxBet, netResult } from "@/game/engine";
import { handValue } from "@/game/hand";
import { wagerCaption } from "@/game/status";
import { loadPrefs, savePrefs } from "@/game/storage";
import type { Card, GameState } from "@/game/types";
import { useBlackjack } from "@/hooks/useBlackjack";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSound } from "@/hooks/useSound";
import { buildShortcuts } from "@/keyboard/bindings";
import { cn } from "@/utils/cn";

/** "17", or "7/17" for a soft hand that is still being played. */
function totalLabel(cards: Card[], final: boolean): string | null {
  if (cards.length === 0) return null;
  const value = handValue(cards);
  if (!final && value.soft && cards.length >= 2 && value.total !== 21) {
    return `${value.hard}/${value.total}`;
  }
  return String(value.total);
}

function cardsOnTable(state: GameState): number {
  return state.dealer.length + state.hands.reduce((n, h) => n + h.cards.length, 0);
}

export default function App() {
  const { state, can, status, actions } = useBlackjack();

  /* ---------- preferences ---------- */
  const [soundEnabled, setSoundEnabled] = useState(() => loadPrefs().sound);
  useEffect(() => {
    savePrefs({ sound: soundEnabled });
  }, [soundEnabled]);
  const play = useSound(soundEnabled);
  const toggleSound = useCallback(() => setSoundEnabled((v) => !v), []);

  /* ---------- sound cues derived from state transitions ---------- */
  const previous = useRef(state);
  useEffect(() => {
    const prev = previous.current;
    previous.current = state;
    if (prev === state) return;

    if (cardsOnTable(state) > cardsOnTable(prev)) play("deal");
    if (prev.holeHidden && !state.holeHidden && state.dealer.length >= 2) play("flip");
    if (prev.phase !== "settled" && state.phase === "settled") {
      const net = netResult(state);
      const natural = state.hands.some((h) => h.result === "blackjack");
      play(natural && net > 0 ? "blackjack" : net > 0 ? "win" : net < 0 ? "lose" : "push");
    }
  }, [state, play]);

  const increaseBet = useCallback(() => {
    play("chip");
    actions.increaseBet();
  }, [actions, play]);
  const decreaseBet = useCallback(() => {
    play("chip");
    actions.decreaseBet();
  }, [actions, play]);

  /* ---------- keyboard ---------- */
  // Bindings are rebuilt from the legal actions each render, so a key can only
  // ever reach the single action that is valid for the current game state.
  useKeyboardShortcuts(
    buildShortcuts(can, {
      hit: actions.hit,
      stand: actions.stand,
      double: actions.double,
      split: actions.split,
      newRound: actions.newRound,
      toggleSound,
      increaseBet: can.adjustBet && state.bet < maxBet(state.balance) ? increaseBet : undefined,
      decreaseBet: can.adjustBet && state.bet > MIN_BET ? decreaseBet : undefined,
    }),
  );

  /* ---------- derived view data ---------- */
  const dealerCards = state.dealer;
  const dealerVisible = state.holeHidden ? dealerCards.slice(0, 1) : dealerCards;
  const dealerValue = handValue(dealerVisible);
  const dealerBust = !state.holeHidden && dealerValue.total > 21;
  const playerTurn = state.phase === "player";
  const multiHand = state.hands.length > 1;
  const broke = isBroke(state);

  return (
    <div className="flex min-h-screen flex-col bg-ink text-paper">
      <TopBar balance={state.balance} soundEnabled={soundEnabled} onToggleSound={toggleSound} onReset={actions.resetBalance} />

      <main className="flex flex-1 flex-col items-center justify-center gap-7 px-4 pb-6 pt-1 short:gap-5 short:pb-4 sm:gap-8 sm:px-8">
        {/* ---------- table ---------- */}
        <section
          aria-label="Blackjack table"
          className="felt relative w-full max-w-[880px] rounded-[28px] px-5 py-6 short:py-5 sm:rounded-[36px] sm:px-12 sm:py-8"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-[18px] border border-white/[0.05] sm:rounded-[26px]" />

          {state.shuffled && state.phase !== "idle" && (
            <span className="animate-fade absolute right-6 top-5 text-[10px] font-medium uppercase tracking-[0.3em] text-white/25 sm:right-8 sm:top-6">
              Shuffled
            </span>
          )}

          <div className="relative grid min-h-[400px] grid-rows-[auto_1fr_auto] gap-2 short:min-h-0 sm:min-h-[440px]">
            {/* dealer */}
            <div className="flex justify-center">
              <Hand
                label="Dealer"
                cards={dealerCards}
                hideSecond={state.holeHidden}
                total={totalLabel(dealerVisible, true)}
                bust={dealerBust}
                active={state.phase === "dealer"}
                labelPosition="above"
                roundId={state.roundId}
              />
            </div>

            {/* centre */}
            <div className="flex flex-col items-center justify-center gap-3 py-2 shorter:gap-2 shorter:py-0">
              <StatusBanner status={status} animationKey={`${state.roundId}-${state.phase}`}>
                {broke && <ResetButton prominent onReset={actions.resetBalance} />}
              </StatusBanner>
              <p
                aria-hidden="true"
                className={cn(
                  "select-none text-center text-[9px] font-medium uppercase tracking-[0.42em] text-white/[0.13] transition-opacity duration-500 sm:text-[10px]",
                  status && status.tone !== "neutral" ? "opacity-0" : "opacity-100",
                )}
              >
                <span className="sm:hidden">Blackjack pays 3 to 2</span>
                <span className="hidden sm:inline">Blackjack pays 3 to 2 · Dealer stands on 17</span>
              </p>
            </div>

            {/* player */}
            <div className="flex flex-wrap items-end justify-center gap-x-8 gap-y-6 sm:gap-x-12">
              {state.hands.length === 0 ? (
                <Hand label="Player" cards={[]} total={null} labelPosition="below" roundId={0} />
              ) : (
                state.hands.map((hand, index) => {
                  const total = handValue(hand.cards).total;
                  return (
                    <Hand
                      key={hand.id}
                      label={multiHand ? `Hand ${index + 1}` : "Player"}
                      cards={hand.cards}
                      total={totalLabel(hand.cards, hand.done)}
                      caption={wagerCaption(hand.bet, hand.doubled)}
                      result={hand.result}
                      bust={total > 21}
                      active={playerTurn && index === state.active}
                      dim={multiHand && playerTurn && index !== state.active}
                      labelPosition="below"
                      roundId={state.roundId}
                    />
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* ---------- controls ---------- */}
        <div className="flex w-full flex-col items-center gap-6 short:gap-4">
          <BetControl
            bet={state.bet}
            min={MIN_BET}
            max={maxBet(state.balance)}
            enabled={can.adjustBet}
            onIncrease={increaseBet}
            onDecrease={decreaseBet}
          />
          <Controls
            can={can}
            onHit={actions.hit}
            onStand={actions.stand}
            onDouble={actions.double}
            onSplit={actions.split}
            onNewRound={actions.newRound}
          />
        </div>
      </main>

      <footer className="flex flex-col items-center gap-3 px-6 pb-7 text-center short:pb-4">
        <p className="hidden text-[11px] tracking-[0.08em] text-mute/70 short:hidden sm:block">
          Single deck · ↑ ↓ adjust bet · M toggles sound
        </p>
        <ResetButton onReset={actions.resetBalance} className="sm:hidden" />
      </footer>
    </div>
  );
}
