// Money is always an integer number of micro-dollars. 1 USD == 1_000_000 micro.
// Floating point never touches a balance, a price, or a fee.

export const MICRO = 1_000_000;

/** Parse a decimal string such as "0.0100" or "12.5" into micro-dollars. */
export function toMicro(value) {
  if (typeof value === 'number') value = String(value);
  const trimmed = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new TypeError(`not a decimal amount: ${JSON.stringify(value)}`);
  }
  const negative = trimmed.startsWith('-');
  const [whole, frac = ''] = trimmed.replace('-', '').split('.');
  const padded = (frac + '000000').slice(0, 6);
  const micro = Number(whole) * MICRO + Number(padded);
  if (!Number.isSafeInteger(micro)) throw new RangeError(`amount out of range: ${trimmed}`);
  return negative ? -micro : micro;
}

/** Render micro-dollars as a 4-decimal dollar string: 10000 -> "0.0100". */
export function formatMicro(micro) {
  const negative = micro < 0;
  const abs = Math.abs(micro);
  const whole = Math.floor(abs / MICRO);
  const frac = String(abs % MICRO).padStart(6, '0').slice(0, 4);
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/** Render micro-dollars as a display string with a currency marker. */
export function usd(micro) {
  return `$${formatMicro(micro)}`;
}

/** PayPal REST wants a 2-decimal string. Round half-up, away from zero. */
export function microToPayPalAmount(micro) {
  const negative = micro < 0;
  const abs = Math.abs(micro);
  const cents = Math.round(abs / 10_000);
  const whole = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${rest}`;
}

/** Parse a PayPal amount string into micro-dollars. */
export function paypalAmountToMicro(value) {
  return toMicro(value);
}

/** Apply a basis-points fee, rounding down so the platform never over-charges. */
export function feeOf(micro, basisPoints) {
  return Math.floor((micro * basisPoints) / 10_000);
}
