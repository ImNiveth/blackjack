import { memo, useId } from "react";
import type { Card, Rank, Suit } from "@/game/types";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/*  Suit glyphs (100 × 100 coordinate space)                           */
/* ------------------------------------------------------------------ */

const SUIT_PATHS: Record<Suit, string> = {
  hearts:
    "M50 91 C47 88 10 62 10 33 C10 19 21 9 34 9 C41 9 47 13 50 19 C53 13 59 9 66 9 C79 9 90 19 90 33 C90 62 53 88 50 91 Z",
  diamonds:
    "M50 5 C57 22 70 38 86 50 C70 62 57 78 50 95 C43 78 30 62 14 50 C30 38 43 22 50 5 Z",
  spades:
    "M50 7 C53 11 90 40 90 62 C90 74 81 83 70 83 C63 83 57 80 53 75 C54 84 58 90 64 94 L36 94 C42 90 46 84 47 75 C43 80 37 83 30 83 C19 83 10 74 10 62 C10 40 47 11 50 7 Z",
  clubs:
    "M50 8 A20 20 0 1 1 49.9 8 Z M28 38 A20 20 0 1 1 27.9 38 Z M72 38 A20 20 0 1 1 71.9 38 Z M45 50 C47 70 42 86 34 94 L66 94 C58 86 53 70 55 50 Z",
};

export const SUIT_NAME: Record<Suit, string> = {
  spades: "Spades",
  hearts: "Hearts",
  diamonds: "Diamonds",
  clubs: "Clubs",
};

const RANK_NAME: Record<Rank, string> = {
  A: "Ace",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
};

export function cardName(card: Card): string {
  return `${RANK_NAME[card.rank]} of ${SUIT_NAME[card.suit]}`;
}

function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

interface GlyphProps {
  suit: Suit;
  cx: number;
  cy: number;
  size: number;
  flipped?: boolean;
}

function SuitGlyph({ suit, cx, cy, size, flipped }: GlyphProps) {
  const scale = size / 100;
  const rotate = flipped ? ` rotate(180 50 50)` : "";
  return (
    <g transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${scale})${rotate}`}>
      <path d={SUIT_PATHS[suit]} />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Pip layouts – x: 0 left, 0.5 centre, 1 right; y: 0 top … 1 bottom  */
/* ------------------------------------------------------------------ */

type Pip = [x: number, y: number];

const PIPS: Partial<Record<Rank, Pip[]>> = {
  "2": [[0.5, 0], [0.5, 1]],
  "3": [[0.5, 0], [0.5, 0.5], [0.5, 1]],
  "4": [[0, 0], [1, 0], [0, 1], [1, 1]],
  "5": [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
  "6": [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  "7": [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  "8": [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
  "9": [
    [0, 0], [1, 0],
    [0, 1 / 3], [1, 1 / 3],
    [0.5, 0.5],
    [0, 2 / 3], [1, 2 / 3],
    [0, 1], [1, 1],
  ],
  "10": [
    [0, 0], [1, 0],
    [0.5, 1 / 6],
    [0, 1 / 3], [1, 1 / 3],
    [0, 2 / 3], [1, 2 / 3],
    [0.5, 5 / 6],
    [0, 1], [1, 1],
  ],
};

const W = 250;
const H = 350;
const PIP_LEFT = 72;
const PIP_RIGHT = 178;
const PIP_TOP = 80;
const PIP_BOTTOM = 270;

function CardFace({ card }: { card: Card }) {
  const color = isRed(card.suit) ? "var(--color-suit-red)" : "var(--color-suit-black)";
  const isFace = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  const isAce = card.rank === "A";
  const pips = PIPS[card.rank] ?? [];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" aria-hidden="true" focusable="false">
      <rect width={W} height={H} rx={16} fill="var(--color-card)" />
      {/* Hairline inner edge gives the face a printed feel. */}
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={15} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={1.5} />

      <g fill={color}>
        {/* Corner indices */}
        {[false, true].map((flipped) => (
          <g key={flipped ? "br" : "tl"} transform={flipped ? `rotate(180 ${W / 2} ${H / 2})` : undefined}>
            <text
              x={28}
              y={48}
              textAnchor="middle"
              fontSize={card.rank === "10" ? 36 : 40}
              fontWeight={600}
              letterSpacing={card.rank === "10" ? -2 : -0.5}
              style={{ fontFamily: "inherit" }}
            >
              {card.rank}
            </text>
            <SuitGlyph suit={card.suit} cx={28} cy={76} size={24} />
          </g>
        ))}

        {/* Centre artwork */}
        {isAce && <SuitGlyph suit={card.suit} cx={W / 2} cy={H / 2} size={card.suit === "spades" ? 118 : 104} />}

        {!isAce &&
          !isFace &&
          pips.map(([px, py], i) => {
            const cx = PIP_LEFT + px * (PIP_RIGHT - PIP_LEFT);
            const cy = PIP_TOP + py * (PIP_BOTTOM - PIP_TOP);
            return <SuitGlyph key={i} suit={card.suit} cx={cx} cy={cy} size={44} flipped={py > 0.5} />;
          })}

        {isFace && (
          <g>
            <rect
              x={56}
              y={70}
              width={W - 112}
              height={H - 140}
              rx={6}
              fill={color}
              fillOpacity={0.05}
              stroke={color}
              strokeOpacity={0.85}
              strokeWidth={2}
            />
            <rect
              x={64}
              y={78}
              width={W - 128}
              height={H - 156}
              rx={3}
              fill="none"
              stroke={color}
              strokeOpacity={0.3}
              strokeWidth={1}
            />
            <SuitGlyph suit={card.suit} cx={84} cy={100} size={22} />
            <SuitGlyph suit={card.suit} cx={W - 84} cy={H - 100} size={22} flipped />
            <text
              x={W / 2}
              y={H / 2 + 36}
              textAnchor="middle"
              fontSize={104}
              fontWeight={300}
              letterSpacing={-2}
              style={{ fontFamily: "inherit" }}
            >
              {card.rank}
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}

function CardBack() {
  const id = useId().replace(/:/g, "");
  const patternId = `lattice-${id}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={patternId} width={16} height={16} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 8 H16 M8 0 V16" stroke="rgba(242,239,230,0.09)" strokeWidth={1} />
        </pattern>
      </defs>
      <rect width={W} height={H} rx={16} fill="var(--color-card)" />
      <rect x={11} y={11} width={W - 22} height={H - 22} rx={9} fill="var(--color-back)" />
      <rect x={11} y={11} width={W - 22} height={H - 22} rx={9} fill={`url(#${patternId})`} />
      <rect
        x={22}
        y={22}
        width={W - 44}
        height={H - 44}
        rx={5}
        fill="none"
        stroke="rgba(242,239,230,0.22)"
        strokeWidth={1.5}
      />
      <circle cx={W / 2} cy={H / 2} r={30} fill="none" stroke="rgba(242,239,230,0.22)" strokeWidth={1.5} />
      <g fill="rgba(242,239,230,0.55)">
        <SuitGlyph suit="spades" cx={W / 2} cy={H / 2} size={30} />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Public component                                                   */
/* ------------------------------------------------------------------ */

interface PlayingCardProps {
  card: Card;
  /** Render face down (the dealer's hole card). Flips smoothly when toggled. */
  faceDown?: boolean;
  /** Play the deal-in animation on mount. */
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const PlayingCard = memo(function PlayingCard({ card, faceDown = false, animate = true, className, style }: PlayingCardProps) {
  return (
    <div
      role="img"
      aria-label={faceDown ? "Face-down card" : cardName(card)}
      className={cn("relative shrink-0 select-none", animate && "animate-deal", className)}
      style={{
        width: "var(--card-w)",
        height: "var(--card-h)",
        perspective: "1200px",
        ...style,
      }}
    >
      <div className={cn("flip", faceDown && "is-down")}>
        <div className="flip-face card-shadow bg-card">
          <CardFace card={card} />
        </div>
        <div className="flip-face flip-back card-shadow bg-card">
          <CardBack />
        </div>
      </div>
    </div>
  );
});

/** Faint outline used to hold space on an empty table. */
export function CardSlot({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("shrink-0 border border-white/[0.07]", className)}
      style={{ width: "var(--card-w)", height: "var(--card-h)", borderRadius: "var(--card-radius)" }}
    />
  );
}
