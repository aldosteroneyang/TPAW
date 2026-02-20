export function asCurrency(value: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0
  }).format(value);
}

export function asPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
