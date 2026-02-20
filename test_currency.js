import { formatDisplayValue, formatPoints } from './frontend/src/lib/currency.js';

console.log('INR 100,000:', formatDisplayValue(100000, 'INR'));
console.log('USD 5,000:', formatDisplayValue(5000, 'USD'));
console.log('Points 1,234 (no symbol):', formatPoints(1234, 'INR'));
