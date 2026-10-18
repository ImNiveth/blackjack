import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { AvailableActions } from "@/game/types";
import { SHORTCUT_LABELS, type ShortcutLabel } from "@/keyboard/bindings";
import { cn } from "@/utils/cn";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Keyboard shortcut shown on the key cap and exposed to assistive technology. */
  shortcut?: ShortcutLabel;
  primary?: boolean;
  children: ReactNode;
}

export function ActionButton({ shortcut, primary = false, className, children, disabled, ...rest }: ActionButtonProps) {
  const descriptionId = useId();
  const description = shortcut?.description;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-keyshortcuts={shortcut?.aria}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "group relative inline-flex h-12 items-center justify-center gap-2.5 rounded-full border px-6 text-[12px] font-medium uppercase tracking-[0.2em]",
          "transition-[background-color,border-color,color,transform,opacity] duration-200 ease-out",
          "active:enabled:scale-[0.97]",
          "disabled:cursor-not-allowed disabled:opacity-[0.22]",
          primary
            ? "border-paper bg-paper text-ink hover:enabled:bg-white hover:enabled:border-white"
            : "border-white/[0.14] text-paper hover:enabled:border-white/30 hover:enabled:bg-white/[0.06]",
          className,
        )}
        {...rest}
      >
        <span>{children}</span>
        {shortcut && (
          <kbd
            aria-hidden="true"
            className={cn(
              "hidden h-5 min-w-5 items-center justify-center rounded-[5px] border px-1 font-sans text-[10px] font-medium normal-case tracking-normal sm:inline-flex",
              primary ? "border-ink/20 text-ink/60" : "border-white/[0.14] text-mute group-hover:text-paper-dim",
            )}
          >
            {shortcut.hint}
          </kbd>
        )}
      </button>
      {description && (
        <span id={descriptionId} className="sr-only">
          {description}
        </span>
      )}
    </>
  );
}

interface ControlsProps {
  can: AvailableActions;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onNewRound: () => void;
}

export function Controls({ can, onHit, onStand, onDouble, onSplit, onNewRound }: ControlsProps) {
  return (
    <div className="grid w-full max-w-xl grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
      <ActionButton shortcut={SHORTCUT_LABELS.hit} onClick={onHit} disabled={!can.hit}>
        Hit
      </ActionButton>
      <ActionButton shortcut={SHORTCUT_LABELS.stand} onClick={onStand} disabled={!can.stand}>
        Stand
      </ActionButton>
      <ActionButton shortcut={SHORTCUT_LABELS.double} onClick={onDouble} disabled={!can.double} title={can.doubleReason}>
        <span className="sm:hidden">Double</span>
        <span className="hidden sm:inline">Double down</span>
      </ActionButton>
      <ActionButton shortcut={SHORTCUT_LABELS.split} onClick={onSplit} disabled={!can.split} title={can.splitReason}>
        Split
      </ActionButton>
      <ActionButton
        shortcut={SHORTCUT_LABELS.newRound}
        primary
        onClick={onNewRound}
        disabled={!can.newRound}
        className="col-span-2 sm:ml-3"
      >
        New game
      </ActionButton>
    </div>
  );
}
