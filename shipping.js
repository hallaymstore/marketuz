import { regions } from './seed.js';

export const regionDistricts = {
  'Toshkent shahri': ['Bektemir tumani', 'Chilonzor tumani', 'Mirobod tumani', 'Mirzo Ulug‘bek tumani', 'Olmazor tumani', 'Sergeli tumani', 'Shayxontohur tumani', 'Uchtepa tumani', 'Yakkasaroy tumani', 'Yangihayot tumani', 'Yashnobod tumani', 'Yunusobod tumani'],
  'Toshkent viloyati': ['Nurafshon shahri', 'Angren shahri', 'Chirchiq shahri', 'Olmaliq shahri', 'Bekobod tumani', 'Bo‘stonliq tumani', 'Qibray tumani', 'Zangiota tumani', 'Yangiyo‘l tumani'],
  'Qashqadaryo': ['Qarshi shahri', 'Shahrisabz shahri', 'Kasbi tumani', 'Kitob tumani', 'Koson tumani', 'G‘uzor tumani', 'Chiroqchi tumani', 'Yakkabog‘ tumani'],
  'Samarqand': ['Samarqand shahri', 'Kattaqo‘rg‘on shahri', 'Bulung‘ur tumani', 'Jomboy tumani', 'Oqdaryo tumani', 'Pastdarg‘om tumani', 'Urgut tumani'],
  'Buxoro': ['Buxoro shahri', 'Kogon shahri', 'G‘ijduvon tumani', 'Jondor tumani', 'Qorako‘l tumani', 'Romitan tumani', 'Vobkent tumani'],
  'Andijon': ['Andijon shahri', 'Xonobod shahri', 'Asaka tumani', 'Baliqchi tumani', 'Marhamat tumani', 'Paxtaobod tumani', 'Shahrixon tumani'],
  'Farg‘ona': ['Farg‘ona shahri', 'Qo‘qon shahri', 'Marg‘ilon shahri', 'Beshariq tumani', 'Oltiariq tumani', 'Quva tumani', 'Rishton tumani'],
  'Namangan': ['Namangan shahri', 'Chortoq tumani', 'Chust tumani', 'Kosonsoy tumani', 'Pop tumani', 'To‘raqo‘rg‘on tumani', 'Uychi tumani'],
  'Surxondaryo': ['Termiz shahri', 'Boysun tumani', 'Denov tumani', 'Jarqo‘rg‘on tumani', 'Qumqo‘rg‘on tumani', 'Sherobod tumani', 'Sho‘rchi tumani'],
  'Jizzax': ['Jizzax shahri', 'Arnasoy tumani', 'Baxmal tumani', 'Do‘stlik tumani', 'G‘allaorol tumani', 'Zomin tumani'],
  'Sirdaryo': ['Guliston shahri', 'Shirin shahri', 'Yangiyer shahri', 'Boyovut tumani', 'Mirzaobod tumani', 'Sirdaryo tumani'],
  'Navoiy': ['Navoiy shahri', 'Zarafshon shahri', 'Karmana tumani', 'Nurota tumani', 'Qiziltepa tumani', 'Xatirchi tumani'],
  'Xorazm': ['Urganch shahri', 'Xiva shahri', 'Bog‘ot tumani', 'Gurlan tumani', 'Hazorasp tumani', 'Xonqa tumani', 'Shovot tumani'],
  'Qoraqalpog‘iston': ['Nukus shahri', 'Beruniy tumani', 'Chimboy tumani', 'Ellikqal‘a tumani', 'Qo‘ng‘irot tumani', 'To‘rtko‘l tumani', 'Xo‘jayli tumani']
};

export const ORDER_STATUSES = [
  'awaiting_payment',
  'new',
  'accepted',
  'packing',
  'handed_over',
  'in_transit',
  'delivered',
  'cancelled'
];

export const SHIPPING_TARIFFS = {
  'Toshkent shahri': 20000,
  'Toshkent viloyati': 25000,
  default: 35000
};

export function isValidRegionDistrict(region, district) {
  if (!regions.includes(region)) return false;
  const clean = String(district || '').trim();
  return clean.length >= 2 && clean.length <= 100;
}

export function calculateShipping({ region, subtotal = 0, shippingIncluded = false, deliveryMode = 'standard' }) {
  if (shippingIncluded) return { fee: 0, mode: 'included', label: 'Mahsulot narxiga kiritilgan' };
  if (deliveryMode === 'pickup') return { fee: 0, mode: 'pickup', label: 'Olib ketish (0 so‘m)' };
  const baseFee = SHIPPING_TARIFFS[region] ?? SHIPPING_TARIFFS.default;
  const freeThreshold = 500_000;
  if (Number(subtotal) >= freeThreshold) {
    return { fee: 0, mode: 'free_threshold', label: '500 000 so‘mdan yuqori xaridda bepul' };
  }
  return { fee: baseFee, mode: 'estimated', label: 'Taxminiy yetkazish tarifi' };
}

export function createShippingProvider() {
  const configured = !!(process.env.UZPOST_API_URL && process.env.UZPOST_API_KEY);
  return {
    name: 'uzpost',
    configured,
    async createShipment() {
      if (!configured) {
        return { ok: false, configured: false, message: 'UzPost API shartnomasi va kalitlari hali ulanmagan.' };
      }
      throw new Error('UzPost API adapteri faqat rasmiy shartnoma va hujjat asosida faollashtiriladi.');
    },
    async trackShipment(trackingNumber) {
      if (!configured) {
        return { ok: false, configured: false, trackingNumber: trackingNumber || null, events: [] };
      }
      throw new Error('UzPost tracking adapteri rasmiy hujjat asosida ulanadi.');
    }
  };
}
