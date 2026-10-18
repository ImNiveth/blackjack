import type { Status } from "@/game/status";
import { cn } from "@/utils/cn";

interface StatusBannerProps {
  status: Status | null;
  /** Re-mounts the banner so the entrance animation replays. */
  animationKey: string;
  children?: React.ReactNode;
}

export function StatusBanner({ status, animationKey, children }: StatusBannerProps) {
  const isResult = status !== null && status.tone !== "neutral";

  return (
    <div
      className="flex min-h-[4.75rem] flex-col items-center justify-center text-center shorter:min-h-[3.75rem]"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {status && (
        <div key={animationKey} className="animate-rise flex flex-col items-center gap-1.5">
          <span
            className={cn(
              "uppercase transition-colors duration-300",
              isResult
                ? "text-2xl font-semibold tracking-[0.3em] sm:text-[1.75rem]"
                : "text-sm font-medium tracking-[0.34em] text-mute",
              status.tone === "win" && "text-paper",
              status.tone === "lose" && "text-mute",
              status.tone === "push" && "text-paper-dim",
            )}
          >
            {status.title}
          </span>
          {status.detail && (
            <span className="text-[13px] tabular-nums tracking-wide text-mute">{status.detail}</span>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
