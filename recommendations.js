const tokens = value => String(value || '').toLocaleLowerCase('uz').split(/[^\p{L}\p{N}]+/u).filter(x => x.length > 2).slice(0, 8);

export function buildInterests(events = [], favorites = [], purchases = []) {
  const categories = new Map(), words = new Map(), productIds = new Map();
  const add = (map, key, weight) => { if (key) map.set(String(key), (map.get(String(key)) || 0) + weight); };
  const record = (p, weight) => { if (!p) return; add(categories, p.category, weight); for (const word of tokens(p.name)) add(words, word, weight * .35); add(productIds, p.id, weight); };
  events.forEach(e => {
    const age = Math.max(0, (Date.now() - new Date(e.created_at).getTime()) / 864e5);
    const decay = Math.exp(-age / 21);
    const weight = ({ search: 1.5, view: 1, dwell: Math.min(4, Math.max(0, Number(e.duration_seconds) || 0) / 20), cart: 5 })[e.kind] || 0;
    if (e.kind === 'search') for (const word of tokens(e.query)) add(words, word, weight * decay);
    else record(e, weight * decay);
  });
  favorites.forEach(p => record(p, 4));
  purchases.forEach(p => record(p, 3));
  return { categories, words, productIds, purchased: new Set(purchases.map(x => String(x.id))) };
}

export function rankProducts(candidates, interests, { context = null, together = new Map(), limit = 12 } = {}) {
  const seen = new Set();
  const ranked = candidates.filter(p => {
    if (seen.has(String(p.id)) || (p.stock_mode !== 'replenishable' && Number(p.stock) < 1) || String(p.id) === String(context?.id)) return false;
    seen.add(String(p.id)); return true;
  }).map(p => {
    let score = Math.min(5, Math.log1p(Number(p.sold_count) || 0) * 1.6);
    let reason = 'Ommabop tanlov';
    if (context) {
      if (context.category === p.category) { score += 5; reason = 'O‘xshash mahsulot'; }
      const price = Number(context.price) || 1;
      if (Math.abs(Number(p.price) - price) / price < .5) score += 1;
    }
    if (interests) {
      const match = Math.min(8, interests.categories.get(p.category) || 0);
      score += match;
      if (match > 1) reason = 'Qiziqishingizga mos';
      for (const word of tokens(p.name)) score += Math.min(2, interests.words.get(word) || 0);
      if (interests.productIds.has(String(p.id))) score -= 3;
      if (interests.purchased.has(String(p.id))) score -= 7;
    }
    const paired = together.get(String(p.id)) || 0;
    if (paired) { score += 11 + Math.min(7, Math.log1p(paired) * 2); reason = 'Birga xarid qilishadi'; }
    score += Math.min(1.5, Number(p.id) / 100000);
    return { ...p, reason, score };
  }).sort((a,b) => b.score - a.score || Number(b.id) - Number(a.id));
  const chosen = [], perCategory = new Map();
  for (const p of ranked) {
    if ((perCategory.get(p.category) || 0) >= Math.max(3, Math.ceil(limit / 2))) continue;
    chosen.push(p); perCategory.set(p.category, (perCategory.get(p.category) || 0) + 1);
    if (chosen.length >= limit) break;
  }
  if(chosen.length<limit) for(const p of ranked) {
    if(!chosen.some(x=>String(x.id)===String(p.id))) chosen.push(p);
    if(chosen.length>=limit) break;
  }
  return chosen;
}
