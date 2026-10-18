import { useEffect, useState } from "react";
import { formatMoney } from "@/game/format";
import { cn } from "@/utils/cn";

interface TopBarProps {
  balance: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onReset: () => void;
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.5 3.5V5L8 8.5H5a1 1 0 0 0-1 1Z" />
      {muted ? (
        <path d="M16.5 9.5l4 5M20.5 9.5l-4 5" />
      ) : (
        <>
          <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
          <path d="M18.5 7a7 7 0 0 1 0 10" />
        </>
      )}
    </svg>
  );
}

/** Inline two-step confirmation keeps resets deliberate without a modal. */
export function ResetButton({ onReset, className, prominent = false }: { onReset: () => void; className?: string; prominent?: boolean }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 3200);
    return () => window.clearTimeout(t);
  }, [confirming]);

  const handleClick = () => {
    if (confirming) {
      setConfirming(false);
      onReset();
    } else {
      setConfirming(true);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onBlur={() => setConfirming(false)}
      className={cn(
        "rounded-full text-[11px] font-medium uppercase tracking-[0.22em] transition-colors duration-200",
        prominent
          ? "mt-3 border border-white/[0.14] px-5 py-2.5 text-paper hover:border-white/30 hover:bg-white/[0.06]"
          : "text-mute hover:text-paper",
        confirming && (prominent ? "border-paper bg-paper text-ink hover:bg-white" : "text-paper"),
        className,
      )}
    >
      {confirming ? "Confirm reset" : "Reset balance"}
    </button>
  );
}

export function TopBar({ balance, soundEnabled, onToggleSound, onReset }: TopBarProps) {
  return (
    <header className="flex w-full items-center justify-between gap-4 px-5 py-5 short:py-3 sm:px-8">
      <div className="flex items-center gap-2.5">
        <svg viewBox="0 0 100 100" className="h-3.5 w-3.5 fill-paper" aria-hidden="true">
          <path d="M50 7 C53 11 90 40 90 62 C90 74 81 83 70 83 C63 83 57 80 53 75 C54 84 58 90 64 94 L36 94 C42 90 46 84 47 75 C43 80 37 83 30 83 C19 83 10 74 10 62 C10 40 47 11 50 7 Z" />
        </svg>
        <h1 className="text-[12px] font-semibold uppercase tracking-[0.38em] text-paper">Blackjack</h1>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="flex items-baseline gap-2">
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.3em] text-mute sm:inline">Balance</span>
          <span className="text-base font-light tabular-nums tracking-tight text-paper sm:text-lg" aria-label={`Balance ${formatMoney(balance)}`}>
            {formatMoney(balance)}
          </span>
        </div>

        <span className="h-4 w-px bg-white/10" aria-hidden="true" />

        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundEnabled}
          aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
          title={soundEnabled ? "Sound on (M)" : "Sound off (M)"}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200 hover:bg-white/[0.06]",
            soundEnabled ? "text-paper" : "text-mute",
          )}
        >
          <SpeakerIcon muted={!soundEnabled} />
        </button>

        <ResetButton onReset={onReset} className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}
