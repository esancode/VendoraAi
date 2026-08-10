import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utilitário para mesclar classes Tailwind condicionalmente.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
