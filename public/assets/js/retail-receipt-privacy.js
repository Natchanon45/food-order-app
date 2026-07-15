function chars(value = '') {
  return Array.from(String(value || '').trim());
}

function maskHead(value = '') {
  const list = chars(value);
  if (!list.length) return '';
  const visible = list.length >= 5 ? 4 : list.length;
  return `${list.slice(0, visible).join('')}${'*'.repeat(Math.max(0, list.length - visible))}`;
}

function maskTail(value = '') {
  const list = chars(value);
  if (!list.length) return '';
  const visible = Math.min(3, list.length);
  return `${'*'.repeat(Math.max(0, list.length - visible))}${list.slice(-visible).join('')}`;
}

export function maskReceiptCustomerName(name = '') {
  const parts = String(name || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return maskHead(parts[0]);
  return `${maskHead(parts[0])} ${maskTail(parts.slice(1).join(''))}`;
}

export function maskReceiptPhone(phone = '') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length < 10) {
    return digits.length <= 2 ? digits : `${digits.slice(0, Math.min(3, digits.length))}-xxx`;
  }
  return `${digits.slice(0, 3)}-xxx-xx${digits.slice(-2)}`;
}
