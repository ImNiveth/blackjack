/**
 * Keyboard shortcut controller.
 *
 * Pure logic with no DOM access so it can be unit tested with plain objects;
 * `useKeyboardShortcuts` wires it to window events.
 */

export type ShortcutHandler = () => void;

/**
 * Maps `KeyboardEvent.key` values to handlers. Named keys use their exact name
 * ("Enter", "ArrowLeft", "Control"); single characters match case-insensitively.
 * An `undefined` handler means the shortcut is unavailable right now and the key
 * falls through to the browser untouched.
 */
export type ShortcutMap = Record<string, ShortcutHandler | undefined>;

/** The subset of KeyboardEvent the controller reads. */
export interface KeyEventLike {
  key: string;
  code?: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  preventDefault(): void;
}

/**
 * Modifier keys that double as shortcuts when tapped on their own. A tap fires
 * on key *release*, and only if nothing else (another key, a pointer press, a
 * wheel event, losing focus) happened while the modifier was held. Ctrl+C,
 * Ctrl+T, Ctrl+click, Ctrl+scroll and every other combination therefore keep
 * their normal browser behaviour.
 */
export const TAP_KEYS: ReadonlySet<string> = new Set(["Control"]);

export interface ShortcutController {
  keydown(event: KeyEventLike, inEditable?: boolean): void;
  keyup(event: KeyEventLike, inEditable?: boolean): void;
  /** Pointer or wheel activity: cancels a pending modifier tap. */
  interrupt(): void;
  /** Window lost focus or was hidden: forget every held key so none can stick. */
  reset(): void;
}

export function createShortcutController(getMap: () => ShortcutMap): ShortcutController {
  /**
   * Physical keys currently held down. A key must be released before it can
   * fire again, so holding a key never produces a second action even on
   * platforms that do not flag auto-repeat events.
   */
  const held = new Set<string>();
  /** Modifier tap in progress: armed on keydown, cleared by any interruption. */
  let armedTap: string | null = null;

  const identity = (event: KeyEventLike): string => event.code || event.key;

  const lookup = (key: string): ShortcutHandler | undefined => {
    const map = getMap();
    if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
    if (key.length === 1) {
      const lower = key.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(map, lower)) return map[lower];
    }
    return undefined;
  };

  /** Runs at most one handler per event; the browser default is only cancelled when we act. */
  const fire = (event: KeyEventLike, key: string): void => {
    const handler = lookup(key);
    if (!handler) return;
    event.preventDefault();
    handler();
  };

  return {
    keydown(event, inEditable = false) {
      if (event.isComposing) return;

      if (TAP_KEYS.has(event.key)) {
        // Auto-repeat while the modifier is held must neither re-arm nor cancel the tap.
        if (!event.repeat) {
          const bare = !event.shiftKey && !event.altKey && !event.metaKey && !inEditable;
          armedTap = bare ? event.key : null;
        }
        return;
      }

      // Any other key turns a held modifier into a combination – leave those to the browser.
      armedTap = null;

      if (event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const id = identity(event);
      if (held.has(id)) return;
      held.add(id);

      if (inEditable) return;
      fire(event, event.key);
    },

    keyup(event, inEditable = false) {
      held.delete(identity(event));
      if (!TAP_KEYS.has(event.key)) return;

      const tapped = armedTap === event.key;
      armedTap = null;
      if (tapped && !inEditable) fire(event, event.key);
    },

    interrupt() {
      armedTap = null;
    },

    reset() {
      held.clear();
      armedTap = null;
    },
  };
}
