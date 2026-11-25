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

export const uzpostBranches = [
  { id: 'uzp-tsh-markaz', region: 'Toshkent shahri', district: 'Yunusobod tumani', name: 'UzPost Bosh pochtamt (Oloy)', address: 'Shaxrisabz ko‘chasi, 7', hours: 'Du–Sha 09:00–19:00', lat: 41.3167, lng: 69.2815 },
  { id: 'uzp-tsh-chilonzor', region: 'Toshkent shahri', district: 'Chilonzor tumani', name: 'UzPost Chilonzor-104 filiali', address: 'Bunyodkor shoh ko‘chasi, 52', hours: 'Du–Sha 09:00–19:00', lat: 41.2756, lng: 69.2036 },
  { id: 'uzp-tsh-mirzo', region: 'Toshkent shahri', district: 'Mirzo Ulug‘bek tumani', name: 'UzPost Buyuk Ipak Yo‘li filiali', address: 'Mustaqillik shoh ko‘chasi, 88', hours: 'Du–Sha 09:00–18:30', lat: 41.3265, lng: 69.3285 },
  { id: 'uzp-tsh-sergeli', region: 'Toshkent shahri', district: 'Sergeli tumani', name: 'UzPost Sergeli filiali', address: 'Yangisergeli ko‘chasi, 21', hours: 'Du–Sha 09:00–18:00', lat: 41.2248, lng: 69.2223 },
  { id: 'uzp-tsh-shayx', region: 'Toshkent shahri', district: 'Shayxontohur tumani', name: 'UzPost Chorsu filiali', address: 'Navoiy ko‘chasi, 44', hours: 'Du–Sha 09:00–18:30', lat: 41.3212, lng: 69.2421 },
  { id: 'uzp-tsh-yakkasaroy', region: 'Toshkent shahri', district: 'Yakkasaroy tumani', name: 'UzPost Shota Rustaveli filiali', address: 'Shota Rustaveli ko‘chasi, 35', hours: 'Du–Sha 09:00–18:30', lat: 41.2895, lng: 69.2575 },
  { id: 'uzp-tv-nurafshon', region: 'Toshkent viloyati', district: 'Nurafshon shahri', name: 'UzPost Nurafshon markaziy filiali', address: 'Toshkent yo‘li ko‘chasi, 18', hours: 'Du–Sha 09:00–18:00', lat: 41.0297, lng: 69.3422 },
  { id: 'uzp-tv-chirchiq', region: 'Toshkent viloyati', district: 'Chirchiq shahri', name: 'UzPost Chirchiq filiali', address: 'A. Navoiy shoh ko‘chasi, 45', hours: 'Du–Sha 09:00–18:00', lat: 41.4689, lng: 69.5822 },
  { id: 'uzp-qsh-qarshi', region: 'Qashqadaryo', district: 'Qarshi shahri', name: 'UzPost Qarshi markaziy pochtamti', address: 'Mustaqillik ko‘chasi, 12', hours: 'Du–Sha 09:00–18:00', lat: 38.8606, lng: 65.7891 },
  { id: 'uzp-qsh-kasbi', region: 'Qashqadaryo', district: 'Kasbi tumani', name: 'UzPost Kasbi tuman filiali', address: 'Mug‘lon markazi, Mustaqillik 5', hours: 'Du–Sha 09:00–17:30', lat: 38.9472, lng: 65.4175 },
  { id: 'uzp-qsh-shahrisabz', region: 'Qashqadaryo', district: 'Shahrisabz shahri', name: 'UzPost Shahrisabz filiali', address: 'Ipak Yo‘li ko‘chasi, 102', hours: 'Du–Sha 09:00–18:00', lat: 39.0578, lng: 66.8342 },
  { id: 'uzp-sam-markaz', region: 'Samarqand', district: 'Samarqand shahri', name: 'UzPost Samarqand pochtamti', address: 'Pochta ko‘chasi, 1', hours: 'Du–Sha 09:00–18:30', lat: 39.6542, lng: 66.9597 },
  { id: 'uzp-sam-urgut', region: 'Samarqand', district: 'Urgut tumani', name: 'UzPost Urgut filiali', address: 'Navoiy shoh ko‘chasi, 60', hours: 'Du–Sha 09:00–17:30', lat: 39.4022, lng: 67.2431 },
  { id: 'uzp-bux-markaz', region: 'Buxoro', district: 'Buxoro shahri', name: 'UzPost Buxoro markaziy filiali', address: 'Mustaqillik ko‘chasi, 3', hours: 'Du–Sha 09:00–18:00', lat: 39.7747, lng: 64.4286 },
  { id: 'uzp-and-markaz', region: 'Andijon', district: 'Andijon shahri', name: 'UzPost Andijon pochtamti', address: 'Bobur shoh ko‘chasi, 71', hours: 'Du–Sha 09:00–18:00', lat: 40.7821, lng: 72.3442 },
  { id: 'uzp-far-markaz', region: 'Farg‘ona', district: 'Farg‘ona shahri', name: 'UzPost Farg‘ona markaziy filiali', address: 'Al-Farg‘oniy ko‘chasi, 24', hours: 'Du–Sha 09:00–18:00', lat: 40.3842, lng: 71.7843 },
  { id: 'uzp-far-qoqon', region: 'Farg‘ona', district: 'Qo‘qon shahri', name: 'UzPost Qo‘qon filiali', address: 'Turkiston ko‘chasi, 15', hours: 'Du–Sha 09:00–18:00', lat: 40.5286, lng: 70.9425 },
  { id: 'uzp-nam-markaz', region: 'Namangan', district: 'Namangan shahri', name: 'UzPost Namangan markaziy filiali', address: 'Navoiy ko‘chasi, 40', hours: 'Du–Sha 09:00–18:00', lat: 41.0011, lng: 71.6726 },
  { id: 'uzp-sur-termiz', region: 'Surxondaryo', district: 'Termiz shahri', name: 'UzPost Termiz filiali', address: 'At-Termiziy ko‘chasi, 16', hours: 'Du–Sha 09:00–18:00', lat: 37.2242, lng: 67.2783 },
  { id: 'uzp-jiz-markaz', region: 'Jizzax', district: 'Jizzax shahri', name: 'UzPost Jizzax markaziy filiali', address: 'Sharof Rashidov ko‘chasi, 44', hours: 'Du–Sha 09:00–18:00', lat: 40.1158, lng: 67.8422 },
  { id: 'uzp-sir-guliston', region: 'Sirdaryo', district: 'Guliston shahri', name: 'UzPost Guliston filiali', address: 'O‘zbekiston shoh ko‘chasi, 29', hours: 'Du–Sha 09:00–18:00', lat: 40.4897, lng: 68.7842 },
  { id: 'uzp-nav-markaz', region: 'Navoiy', district: 'Navoiy shahri', name: 'UzPost Navoiy filiali', address: 'Galaba shoh ko‘chasi, 148', hours: 'Du–Sha 09:00–18:00', lat: 40.0844, lng: 65.3792 },
  { id: 'uzp-xor-urganch', region: 'Xorazm', district: 'Urganch shahri', name: 'UzPost Urganch markaziy filiali', address: 'Al-Xorazmiy ko‘chasi, 59', hours: 'Du–Sha 09:00–18:00', lat: 41.5500, lng: 60.6333 },
  { id: 'uzp-qq-nukus', region: 'Qoraqalpog‘iston', district: 'Nukus shahri', name: 'UzPost Nukus markaziy pochtamti', address: 'Qoraqalpog‘iston ko‘chasi, 23', hours: 'Du–Sha 09:00–18:00', lat: 42.4619, lng: 59.6166 }
];

export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export function findNearestBranches(lat, lng, region = '') {
  const pool = region ? uzpostBranches.filter(b => b.region === region) : uzpostBranches;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return pool.map(b => ({ ...b, distanceKm: null }));
  return pool
    .map(b => ({ ...b, distanceKm: haversineKm(lat, lng, b.lat, b.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function getBranchById(id) {
  return uzpostBranches.find(b => b.id === id) || null;
}

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

export function calculateShipping({ region, subtotal = 0, shippingIncluded = false, deliveryMode = 'courier' }) {
  if (shippingIncluded) return { fee: 0, mode: 'included', label: 'Mahsulot narxiga kiritilgan' };
  if (deliveryMode === 'uzpost_pickup') {
    return { fee: 0, mode: 'uzpost_pickup', label: 'UzPost filialidan olib ketish (tarif operator bilan aniqlanadi)' };
  }
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
