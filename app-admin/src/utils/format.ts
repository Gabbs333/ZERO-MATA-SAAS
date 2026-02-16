/**
 * Format a date string to French locale format
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a date string to short format
 */
export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR');
}

/**
 * Format a timestamp to include time
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format currency in FCFA
 */
export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

/**
 * Format a number with thousand separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('fr-FR');
}

export const format = {
  date: formatDate,
  dateShort: formatDateShort,
  dateTime: formatDateTime,
  currency: formatCurrency,
  number: formatNumber,
};
