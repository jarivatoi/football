/**
 * Currency formatting utilities for Mauritian Rupees
 */

interface CurrencyFormatResult {
  formatted: string;
}

/**
 * Formats a number as Mauritian Rupees with proper formatting
 * @param amount - The amount to format
 * @returns Object with formatted currency string
 */
export function formatMauritianRupees(amount: number): CurrencyFormatResult {
  // Handle edge cases
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { formatted: 'Rs 0.00' };
  }

  // Format using Intl.NumberFormat for proper localization
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MUR',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // Format the amount
  let formatted = formatter.format(amount);
  
  // Replace currency symbol with Rs for consistency
  formatted = formatted.replace(/MUR|₨/, 'Rs');
  
  // Ensure proper spacing
  formatted = formatted.replace(/Rs(\d)/, 'Rs $1');

  return { formatted };
}

/**
 * Alternative simple formatting function for basic use cases
 * @param amount - The amount to format
 * @returns Formatted currency string
 */
function formatCurrency(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 'Rs 0.00';
  }

  return `Rs ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}