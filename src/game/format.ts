const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "$1,000" — fractional amounts (never produced with the default bet step) still format cleanly. */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  return `${sign}$${formatter.format(Math.abs(amount))}`;
}

/** "+$75", "−$50" or "$0". */
export function formatSigned(amount: number): string {
  if (amount > 0) return `+${formatMoney(amount)}`;
  if (amount < 0) return formatMoney(amount);
  return formatMoney(0);
}
