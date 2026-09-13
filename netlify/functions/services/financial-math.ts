import Decimal from 'decimal.js';

// Configure Decimal.js for financial standards
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 9,
});

export { Decimal };

export interface WalletBalanceSummary {
  balance: string;
  reservedBalance: string;
  availableBalance: string;
}

/**
 * Parses any string or numeric money input into an exact Decimal.
 * Throws a clear error if value is invalid or NaN.
 */
export function toDecimal(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Invalid financial value: number is infinite or NaN');
    }
    return new Decimal(value.toFixed(2));
  }
  const cleanStr = String(value).trim().replace(/[$,]/g, '');
  if (!cleanStr || isNaN(Number(cleanStr))) {
    throw new Error(`Invalid monetary amount format: "${value}"`);
  }
  return new Decimal(cleanStr);
}

/**
 * Formats a Decimal value as a canonical exact 2-decimal money string (e.g. "1250.50").
 */
export function formatMoney(value: string | number | Decimal): string {
  const dec = toDecimal(value);
  return dec.toFixed(2);
}

/**
 * Calculates available funds: balance - reserved_balance.
 */
export function calculateAvailableBalance(
  balance: string | number | Decimal,
  reservedBalance: string | number | Decimal
): Decimal {
  const bal = toDecimal(balance);
  const res = toDecimal(reservedBalance);
  const avail = bal.minus(res);
  if (avail.isNegative()) {
    throw new Error(`Invariant violation: Available balance cannot be negative (Balance: ${bal.toFixed(2)}, Reserved: ${res.toFixed(2)})`);
  }
  return avail;
}

/**
 * Evaluates whether a requested withdrawal can be satisfied.
 */
export function canWithdraw(
  availableBalance: string | number | Decimal,
  requestedAmount: string | number | Decimal,
  minAmount = '10.00',
  maxAmount = '50000.00'
): { valid: boolean; reason?: string } {
  const avail = toDecimal(availableBalance);
  const amount = toDecimal(requestedAmount);
  const min = toDecimal(minAmount);
  const max = toDecimal(maxAmount);

  if (amount.lessThanOrEqualTo(0)) {
    return { valid: false, reason: 'Withdrawal amount must be greater than 0.00' };
  }
  if (amount.lessThan(min)) {
    return { valid: false, reason: `Minimum withdrawal amount is $${min.toFixed(2)}` };
  }
  if (amount.greaterThan(max)) {
    return { valid: false, reason: `Maximum withdrawal amount per request is $${max.toFixed(2)}` };
  }
  if (amount.greaterThan(avail)) {
    return {
      valid: false,
      reason: `Insufficient available funds. Available: $${avail.toFixed(2)}, Requested: $${amount.toFixed(2)}`,
    };
  }
  return { valid: true };
}

/**
 * Evaluates whether a requested deposit satisfies bounds.
 */
export function canDeposit(
  requestedAmount: string | number | Decimal,
  minAmount = '10.00',
  maxAmount = '100000.00'
): { valid: boolean; reason?: string } {
  const amount = toDecimal(requestedAmount);
  const min = toDecimal(minAmount);
  const max = toDecimal(maxAmount);

  if (amount.lessThanOrEqualTo(0)) {
    return { valid: false, reason: 'Deposit amount must be greater than 0.00' };
  }
  if (amount.lessThan(min)) {
    return { valid: false, reason: `Minimum deposit amount is $${min.toFixed(2)}` };
  }
  if (amount.greaterThan(max)) {
    return { valid: false, reason: `Maximum deposit amount per request is $${max.toFixed(2)}` };
  }
  return { valid: true };
}
