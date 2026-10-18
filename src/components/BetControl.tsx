import { formatMoney } from "@/game/format";
import { cn } from "@/utils/cn";

interface BetControlProps {
  bet: number;
  min: number;
  max: number;
  enabled: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}

function StepButton({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string;
  glyph: "plus" | "minus";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.14] text-paper",
        "transition-[background-color,border-color,transform,opacity] duration-200",
        "hover:enabled:border-white/30 hover:enabled:bg-white/[0.06] active:enabled:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-[0.22]",
      )}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <path d="M3 8h10" />
        {glyph === "plus" && <path d="M8 3v10" />}
      </svg>
    </button>
  );
}

export function BetControl({ bet, min, max, enabled, onIncrease, onDecrease }: BetControlProps) {
  return (
    <div className="flex items-center gap-5 sm:gap-7">
      <StepButton label="Decrease bet" glyph="minus" disabled={!enabled || bet <= min} onClick={onDecrease} />

      <div className="flex min-w-[6.5rem] flex-col items-center">
        <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-mute">Bet</span>
        <span
          className={cn(
            "mt-0.5 text-2xl font-light tabular-nums tracking-tight transition-colors duration-300",
            enabled ? "text-paper" : "text-paper-dim",
          )}
          aria-live="polite"
        >
          {formatMoney(bet)}
        </span>
      </div>

      <StepButton label="Increase bet" glyph="plus" disabled={!enabled || bet >= max} onClick={onIncrease} />
    </div>
  );
}
