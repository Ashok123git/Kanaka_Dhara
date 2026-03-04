import { format } from 'date-fns';

/**
 * Format date as "12 JAN 2026"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd MMM yyyy').toUpperCase();
}

/**
 * Format currency in Indian Rupee format
 * e.g., 125000 → "₹1,25,000"
 */
export function formatCurrency(amount: number): string {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(amount);
}

/**
 * Get initials from a name (max 2 characters)
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
