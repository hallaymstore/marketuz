const checkoutFields = new Set(['recipient','phone','region','district','address','note','paymentMethod','items','agree','checkoutKey','promoCode','deliveryMode','pickupBranchId','useBonus']);
const itemFields = new Set(['id','variantId','qty','selected']);

export function hasCardNumber(value) {
  if (typeof value !== 'string') return false;
  for (const candidate of value.match(/(?:\d[ -]?){12,19}\d/g) || []) {
    const digits = candidate.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) continue;
    let sum = 0, double = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = Number(digits[i]);
      if (double) { digit *= 2; if (digit > 9) digit -= 9; }
      sum += digit; double = !double;
    }
    if (sum % 10 === 0) return true;
  }
  return false;
}

export function checkoutContainsCardData(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return true;
  if (Object.keys(body).some(key => !checkoutFields.has(key))) return true;
  if (body.items && (!Array.isArray(body.items) || body.items.some(item => !item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !itemFields.has(key))))) return true;
  return ['recipient','phone','region','district','address','note'].some(key => hasCardNumber(body[key]));
}

const next = {
  new: ['accepted','cancelled'],
  accepted: ['packing','cancelled'],
  packing: ['handed_over','cancelled'],
  handed_over: ['in_transit'],
  in_transit: ['delivered'],
  delivered: [],
  awaiting_payment: [],
  cancelled: []
};
export function canAdvanceOrder(current, target) {
  return current === target || !!next[current]?.includes(target);
}
