import { describe, expect, it, vi } from "vitest";
import { createShortcutController, type KeyEventLike, type ShortcutMap } from "../shortcuts";

/* ---------- helpers ---------- */

interface FakeEvent extends KeyEventLike {
  prevented: boolean;
}

function ev(key: string, extra: Partial<KeyEventLike> = {}): FakeEvent {
  const event: FakeEvent = {
    key,
    code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
    ...extra,
  };
  return event;
}

function setup(initial: ShortcutMap) {
  let map = initial;
  const controller = createShortcutController(() => map);
  return { controller, setMap: (next: ShortcutMap) => (map = next) };
}

/** Full press of an ordinary key. */
function press(controller: ReturnType<typeof createShortcutController>, key: string, extra: Partial<KeyEventLike> = {}) {
  const down = ev(key, extra);
  controller.keydown(down);
  controller.keyup(ev(key, extra));
  return down;
}

/** Keydown/keyup pair for the Control key as browsers emit it. */
const ctrlDown = (extra: Partial<KeyEventLike> = {}) => ev("Control", { code: "ControlLeft", ctrlKey: true, ...extra });
const ctrlUp = (extra: Partial<KeyEventLike> = {}) => ev("Control", { code: "ControlLeft", ctrlKey: false, ...extra });

/* ---------- ordinary keys ---------- */

describe("ordinary keys", () => {
  it("fires the mapped handler once per press and cancels the browser default", () => {
    const enter = vi.fn();
    const { controller } = setup({ Enter: enter });
    const down = press(controller, "Enter");
    expect(enter).toHaveBeenCalledTimes(1);
    expect(down.prevented).toBe(true);
    press(controller, "Enter");
    expect(enter).toHaveBeenCalledTimes(2);
  });

  it("leaves unmapped keys to the browser", () => {
    const { controller } = setup({ Enter: vi.fn() });
    const down = press(controller, "ArrowLeft");
    expect(down.prevented).toBe(false);
    const undefinedHandler = press(controller, "Enter");
    expect(undefinedHandler.prevented).toBe(true);
  });

  it("ignores auto-repeat while a key is held", () => {
    const enter = vi.fn();
    const { controller } = setup({ Enter: enter });
    controller.keydown(ev("Enter"));
    for (let i = 0; i < 10; i++) controller.keydown(ev("Enter", { repeat: true }));
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it("requires a release before the same key can fire again, even without a repeat flag", () => {
    const enter = vi.fn();
    const { controller } = setup({ Enter: enter });
    controller.keydown(ev("Enter"));
    controller.keydown(ev("Enter"));
    controller.keydown(ev("Enter"));
    expect(enter).toHaveBeenCalledTimes(1);
    controller.keyup(ev("Enter"));
    controller.keydown(ev("Enter"));
    expect(enter).toHaveBeenCalledTimes(2);
  });

  it("tracks the physical key so a modifier change between press and release cannot leave it stuck", () => {
    const sound = vi.fn();
    const { controller } = setup({ m: sound });
    controller.keydown(ev("m", { code: "KeyM" }));
    controller.keyup(ev("M", { code: "KeyM", shiftKey: true }));
    press(controller, "m", { code: "KeyM" });
    expect(sound).toHaveBeenCalledTimes(2);
  });

  it("reads the live map on every event", () => {
    const stand = vi.fn();
    const newRound = vi.fn();
    const { controller, setMap } = setup({ Enter: stand });
    press(controller, "Enter");
    setMap({ Enter: newRound });
    press(controller, "Enter");
    setMap({ Enter: undefined });
    press(controller, "Enter");
    expect(stand).toHaveBeenCalledTimes(1);
    expect(newRound).toHaveBeenCalledTimes(1);
  });

  it("matches single characters case-insensitively but named keys exactly", () => {
    const sound = vi.fn();
    const hit = vi.fn();
    const { controller } = setup({ m: sound, ArrowLeft: hit });
    press(controller, "M", { shiftKey: true });
    expect(sound).toHaveBeenCalledTimes(1);
    press(controller, "arrowleft");
    expect(hit).not.toHaveBeenCalled();
    press(controller, "ArrowLeft");
    expect(hit).toHaveBeenCalledTimes(1);
  });

  it("ignores combinations with Ctrl, Alt or Meta", () => {
    const hit = vi.fn();
    const { controller } = setup({ ArrowLeft: hit });
    expect(press(controller, "ArrowLeft", { ctrlKey: true }).prevented).toBe(false);
    expect(press(controller, "ArrowLeft", { metaKey: true }).prevented).toBe(false);
    expect(press(controller, "ArrowLeft", { altKey: true }).prevented).toBe(false);
    expect(hit).not.toHaveBeenCalled();
  });

  it("ignores keys typed into editable fields and IME composition", () => {
    const enter = vi.fn();
    const { controller } = setup({ Enter: enter });
    const inField = ev("Enter");
    controller.keydown(inField, true);
    controller.keyup(ev("Enter"), true);
    controller.keydown(ev("Enter", { isComposing: true }));
    expect(enter).not.toHaveBeenCalled();
    expect(inField.prevented).toBe(false);
  });

  it("forgets held keys when the window loses focus", () => {
    const enter = vi.fn();
    const { controller } = setup({ Enter: enter });
    controller.keydown(ev("Enter"));
    controller.reset(); // keyup was lost to another window
    controller.keydown(ev("Enter"));
    expect(enter).toHaveBeenCalledTimes(2);
  });
});

/* ---------- Control tap ---------- */

describe("Control tap", () => {
  it("fires on release of a bare Control press", () => {
    const split = vi.fn();
    const { controller } = setup({ Control: split });
    const down = ctrlDown();
    controller.keydown(down);
    expect(split).not.toHaveBeenCalled();
    expect(down.prevented).toBe(false); // the browser still sees the modifier go down
    const up = ctrlUp();
    controller.keyup(up);
    expect(split).toHaveBeenCalledTimes(1);
    expect(up.prevented).toBe(true);
  });

  it("fires once however long Control is held", () => {
    const split = vi.fn();
    const { controller } = setup({ Control: split });
    controller.keydown(ctrlDown());
    for (let i = 0; i < 20; i++) controller.keydown(ctrlDown({ repeat: true }));
    controller.keyup(ctrlUp());
    expect(split).toHaveBeenCalledTimes(1);
  });

  it("does not fire when Control is used as a modifier", () => {
    const split = vi.fn();
    const hit = vi.fn();
    const { controller } = setup({ Control: split, ArrowLeft: hit, c: undefined });

    // Ctrl+C
    controller.keydown(ctrlDown());
    const copy = ev("c", { ctrlKey: true });
    controller.keydown(copy);
    controller.keyup(ev("c", { ctrlKey: true }));
    controller.keyup(ctrlUp());
    expect(copy.prevented).toBe(false);

    // Ctrl+ArrowLeft neither hits nor splits
    controller.keydown(ctrlDown());
    controller.keydown(ev("ArrowLeft", { ctrlKey: true }));
    controller.keyup(ev("ArrowLeft", { ctrlKey: true }));
    controller.keyup(ctrlUp());

    // Ctrl+Shift+…
    controller.keydown(ctrlDown());
    controller.keydown(ev("Shift", { code: "ShiftLeft", ctrlKey: true, shiftKey: true }));
    controller.keyup(ev("Shift", { code: "ShiftLeft", ctrlKey: true }));
    controller.keyup(ctrlUp());

    // Shift already held when Control goes down
    controller.keydown(ctrlDown({ shiftKey: true }));
    controller.keyup(ctrlUp({ shiftKey: true }));

    expect(split).not.toHaveBeenCalled();
    expect(hit).not.toHaveBeenCalled();
  });

  it("is cancelled by pointer or wheel activity and by losing focus", () => {
    const split = vi.fn();
    const { controller } = setup({ Control: split });

    controller.keydown(ctrlDown());
    controller.interrupt(); // Ctrl+click / Ctrl+scroll
    controller.keyup(ctrlUp());

    controller.keydown(ctrlDown());
    controller.reset(); // Ctrl+Tab switched away
    controller.keyup(ctrlUp());

    expect(split).not.toHaveBeenCalled();

    controller.keydown(ctrlDown());
    controller.keyup(ctrlUp());
    expect(split).toHaveBeenCalledTimes(1);
  });

  it("does nothing inside editable fields or when Split is unavailable", () => {
    const split = vi.fn();
    const { controller, setMap } = setup({ Control: split });
    controller.keydown(ctrlDown(), true);
    controller.keyup(ctrlUp(), true);
    setMap({ Control: undefined });
    const up = ctrlUp();
    controller.keydown(ctrlDown());
    controller.keyup(up);
    expect(split).not.toHaveBeenCalled();
    expect(up.prevented).toBe(false);
  });

  it("ignores a release that was never armed in this window", () => {
    const split = vi.fn();
    const { controller } = setup({ Control: split });
    controller.keyup(ctrlUp());
    expect(split).not.toHaveBeenCalled();
  });
});
