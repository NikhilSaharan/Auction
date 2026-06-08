export function formatIndianCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  let formatted = '';
  if (absAmount >= 10000000) {
    // 1 Crore or more
    const crValue = absAmount / 10000000;
    formatted = `${parseFloat(crValue.toFixed(2))} Cr`;
  } else if (absAmount >= 100000) {
    // 1 Lakh or more, less than 1 Crore
    const lValue = absAmount / 100000;
    formatted = `${parseFloat(lValue.toFixed(2))} L`;
  } else {
    formatted = absAmount.toLocaleString('en-IN');
  }

  return `${isNegative ? '-' : ''}₹${formatted}`;
}

export function parseIndianCurrency(input) {
  if (input === null || input === undefined) return 0;
  const str = input.toString().toLowerCase().trim().replace(/,/g, '');
  if (!str) return 0;

  const numericVal = parseFloat(str);
  if (isNaN(numericVal)) return 0;

  if (str.includes('cr') || str.includes('crore')) {
    return numericVal * 10000000;
  }
  if (str.includes('l') || str.includes('lakh')) {
    return numericVal * 100000;
  }

  // If no suffix and the input is small (<= 1000), treat as Crore
  if (numericVal > 0 && numericVal <= 1000) {
    return numericVal * 10000000;
  }

  return numericVal;
}
