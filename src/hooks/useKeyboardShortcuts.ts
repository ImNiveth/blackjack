import { useEffect, useLayoutEffect, useRef } from "react";
import { createShortcutController, type ShortcutMap } from "@/keyboard/shortcuts";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Key presses inside form fields belong to the field, never to the table. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

/**
 * Global keyboard shortcuts. The map is read live on every key event, so the
 * caller simply passes the bindings that are legal for the current state.
 * Behaviour (single action per press, modifier taps, combinations left to the
 * browser) lives in `createShortcutController`; this hook only attaches it.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const ref = useRef(shortcuts);
  useLayoutEffect(() => {
    ref.current = shortcuts;
  });

  useEffect(() => {
    const controller = createShortcutController(() => ref.current);

    const onKeyDown = (event: KeyboardEvent) => controller.keydown(event, isEditable(event.target));
    const onKeyUp = (event: KeyboardEvent) => controller.keyup(event, isEditable(event.target));
    const onInterrupt = () => controller.interrupt();
    const onBlur = () => controller.reset();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") controller.reset();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", onInterrupt, true);
    window.addEventListener("wheel", onInterrupt, { capture: true, passive: true });
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onInterrupt, true);
      window.removeEventListener("wheel", onInterrupt, true);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
