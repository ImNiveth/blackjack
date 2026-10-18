import type { Card, HandResult } from "@/game/types";
import { RESULT_LABEL, toneFor } from "@/game/status";
import { cn } from "@/utils/cn";
import { CardSlot, PlayingCard } from "./PlayingCard";

interface HandProps {
  label: string;
  cards: Card[];
  /** Hide the second card (dealer's hole card). */
  hideSecond?: boolean;
  /** Text for the total pill, e.g. "17" or "7 / 17". Null hides the pill. */
  total: string | null;
  caption?: string;
  result?: HandResult;
  /** Dealer label sits above the cards, player labels below. */
  labelPosition: "above" | "below";
  active?: boolean;
  dim?: boolean;
  bust?: boolean;
  /** Changes every round so cards re-animate on a fresh deal. */
  roundId: number;
  className?: string;
}

export function Hand({
  label,
  cards,
  hideSecond = false,
  total,
  caption,
  result,
  labelPosition,
  active = false,
  dim = false,
  bust = false,
  roundId,
  className,
}: HandProps) {
  const tone = toneFor(result);

  const header = (
    <div
      className={cn(
        "flex h-6 items-center gap-2.5 transition-colors duration-300",
        labelPosition === "above" ? "mb-4" : "mt-4",
      )}
    >
      <span
        className={cn(
          "text-[11px] font-medium uppercase tracking-[0.28em] transition-colors duration-300",
          active ? "text-paper" : "text-mute",
        )}
      >
        {label}
      </span>

      {total !== null && (
        <span
          className={cn(
            "inline-flex h-6 min-w-[2rem] items-center justify-center rounded-full border px-2 text-xs tabular-nums transition-colors duration-300",
            bust
              ? "border-white/[0.06] text-mute line-through decoration-mute/60"
              : "border-white/[0.1] bg-black/25 text-paper",
          )}
        >
          {total}
        </span>
      )}

      {result && (
        <span
          key={result}
          className={cn(
            "animate-rise text-[11px] font-semibold uppercase tracking-[0.22em]",
            tone === "win" && "text-paper",
            tone === "lose" && "text-mute",
            tone === "push" && "text-paper-dim",
          )}
        >
          {RESULT_LABEL[result]}
        </span>
      )}

      {!result && bust && (
        <span className="animate-rise text-[11px] font-semibold uppercase tracking-[0.22em] text-mute">Bust</span>
      )}

      {caption && (
        <span className="text-[11px] tabular-nums tracking-wide text-mute">{caption}</span>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center transition-[opacity,transform] duration-300",
        dim && "opacity-45",
        className,
      )}
    >
      {labelPosition === "above" && header}

      <div className="flex items-center" style={{ minHeight: "var(--card-h)" }}>
        {cards.length === 0 ? (
          <>
            <CardSlot />
            <CardSlot className="ml-[var(--card-overlap)]" />
          </>
        ) : (
          cards.map((card, index) => (
            <PlayingCard
              key={`${roundId}-${card.id}`}
              card={card}
              faceDown={hideSecond && index === 1}
              className={index > 0 ? "ml-[var(--card-overlap)]" : undefined}
              style={{ zIndex: index }}
            />
          ))
        )}
      </div>

      {labelPosition === "below" && header}
    </div>
  );
}
