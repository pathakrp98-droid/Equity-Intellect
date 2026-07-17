export function formatCurrency(value: number, currency: string = 'INR') {
  if (value >= 10000000) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value / 10000000) + ' Cr';
  } else if (value >= 100000) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value / 100000) + ' L';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatCompactNumber(number: number) {
  return new Intl.NumberFormat('en-IN', {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1
  }).format(number);
}
