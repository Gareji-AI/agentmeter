// Money is always an integer number of micro-dollars. 1 USD == 1_000_000 micro.
// Floating point never touches a balance, a price, or a fee.

export const MICRO = 1_000_000;

export function integer(value, name = 'amount', { min = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < min) throw new RangeError(`${name} must be a safe integer >= ${min}`);
  return value;
}

/** Parse a decimal string such as "0.0100" or "12.5" into micro-dollars. */
export function toMicro(value) {
  if (typeof value !== 'string') throw new TypeError('amount must be a decimal string');
  const trimmed = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new TypeError(`not a decimal amount: ${JSON.stringify(value)}`);
  }
  const negative = trimmed.startsWith('-');
  const [whole, frac = ''] = trimmed.replace('-', '').split('.');
  if (frac.length > 6) throw new RangeError('amount has more than six decimal places');
  const padded = (frac + '000000').slice(0, 6);
  const micro = Number(BigInt(whole) * 1_000_000n + BigInt(padded));
  if (!Number.isSafeInteger(micro)) throw new RangeError(`amount out of range: ${trimmed}`);
  return negative ? -micro : micro;
}

/** Render micro-dollars as a 4-decimal dollar string: 10000 -> "0.0100". */
export function formatMicro(micro) {
  integer(micro, 'amount', { min: -Number.MAX_SAFE_INTEGER });
  const negative = micro < 0;
  const abs = Math.abs(micro);
  const whole = BigInt(abs) / 1_000_000n;
  const frac = String(abs % MICRO).padStart(6, '0').slice(0, 4);
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/** Render micro-dollars as a display string with a currency marker. */
export function usd(micro) {
  return `$${formatMicro(micro)}`;
}

/** PayPal REST wants a 2-decimal string. Round half-up, away from zero. */
export function microToPayPalAmount(micro) {
  integer(micro, 'amount', { min: -Number.MAX_SAFE_INTEGER });
  const negative = micro < 0;
  const abs = Math.abs(micro);
  const cents = (BigInt(abs) + 5_000n) / 10_000n;
  const whole = cents / 100n;
  const rest = String(cents % 100n).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${rest}`;
}

/** Parse a PayPal amount string into micro-dollars. */
export function paypalAmountToMicro(value) {
  return toMicro(value);
}

/** Apply a basis-points fee, rounding down so the platform never over-charges. */
export function feeOf(micro, basisPoints) {
  integer(micro); integer(basisPoints, 'basis points');
  if (basisPoints > 10_000) throw new RangeError('fee cannot exceed 100%');
  return Number(BigInt(micro) * BigInt(basisPoints) / 10_000n);
}
