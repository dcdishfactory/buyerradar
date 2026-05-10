require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://buyerradar.onrender.com',
  methods: ['GET', 'POST'],
}));
app.use(express.json());
app.use(express.static('public'));

// ─────────────────────────────────────────────────────────────
// DOMAIN BLACKLIST
// These sites are auction houses, marketplaces, or seller sites
// Any result from these domains is automatically discarded
// ─────────────────────────────────────────────────────────────
const BLOCKED_DOMAINS = [
  // Auction sites
  'ebay.com',
  'proxibid.com',
  'bidspotter.com',
  'govplanet.com',
  'ironplanet.com',
  'ritchiebros.com',
  'rbauction.com',
  'purplewave.com',
  'bidadoo.com',
  'auctionzip.com',
  'liveauctioneers.com',
  'invaluable.com',
  'hibid.com',
  'auctiontime.com',
  'equipmentfacts.com',
  'macktrucks.com',
  'catauction.com',
  'sandhills.com',
  'auctionnation.com',
  'bringatrailer.com',
  // Marketplace / seller sites
  'amazon.com',
  'walmart.com',
  'etsy.com',
  'mercari.com',
  'poshmark.com',
  'depop.com',
  'shopify.com',
  'alibaba.com',
  'aliexpress.com',
  'webstaurantstore.com',
  'restaurantequipment.com',
  'katom.com',
  'centralrestaurant.com',
  'acitydiscount.com',
  'burkett.com',
  'usedrestaurantequipment.com',
  'excalibur.com',
  'yelp.com',
  'yellowpages.com',
  'angieslist.com',
  'thumbtack.com',
  'homedepot.com',
  'lowes.com',
  'bestbuy.com',
  'target.com',
  'costco.com',
  'samsclub.com',
];

// ─────────────────────────────────────────────────────────────
// SELLER PHRASE BLACKLIST
// If ANY of these appear in the post — discard immediately
// ─────────────────────────────────────────────────────────────
const SELLER_PHRASES = [
  'for sale',
  'i am selling',
  "i'm selling",
  'selling my',
  'selling a ',
  'selling an ',
  'selling these',
  'selling this',
  'asking price',
  'asking $',
  'price is',
  'priced at',
  ' obo',
  'or best offer',
  'firm price',
  'shipped for',
  'free shipping',
  'buy it now',
  'pick up only',
  'local pickup',
  'dm for price',
  'message for price',
  'comment to buy',
  'available for',
  'just reduced',
  'price drop',
  'make an offer',
  'taking offers',
  'open to offers',
  'willing to ship',
  'will ship',
  'can ship',
  'paypal accepted',
  'venmo accepted',
  'cash only',
  'cash preferred',
  'motivated seller',
  'must sell',
  'need to sell',
  'gotta sell',
  'letting go',
  'letting it go',
  'parting with',
  'getting rid of',
  'moving sale',
  'estate sale',
  'garage sale',
  'yard sale',
  'auction',
  'bidding',
  'starting bid',
  'reserve price',
  'lot of',
  'wholesale',
  'bulk pricing',
  'dealer pricing',
  'manufacturer',
  'brand new in box',
  'new in box',
  'never used',
  'never opened',
  'sealed in box',
];

// ─────────────────────────────────────────────────────────────
// BUYER INTENT PHRASES — scored
// ─────────────────────────────────────────────────────────────
const BUYER_PHRASES_SCORED = [
  // Strong signals (3 points)
  { phrase: ' iso ',             score: 3 },
  { phrase: ' wtb ',             score: 3 },
  { phrase: 'want to buy',       score: 3 },
  { phrase: 'wanting to buy',    score: 3 },
  { phrase: 'looking to buy',    score: 3 },
  { phrase: 'in search of',      score: 3 },
  { phrase: 'does anyone have',  score: 3 },
  { phrase: 'does anyone got',   score: 3 },
  { phrase: 'is anyone selling', score: 3 },
  { phrase: 'need to buy',       score: 3 },
  { phrase: 'i need to buy',     score: 3 },
  { phrase: 'trying to buy',     score: 3 },
  // Medium signals (2 points)
  { phrase: 'looking for',       score: 2 },
  { phrase: 'searching for',     score: 2 },
  { phrase: 'trying to find',    score: 2 },
  { phrase: 'hoping to find',    score: 2 },
  { phrase: 'hoping to buy',     score: 2 },
  { phrase: 'on the hunt for',   score: 2 },
  { phrase: 'anyone got',        score: 2 },
  { phrase: 'anyone have',       score: 2 },
  { phrase: 'anyone selling',    score: 2 },
  { phrase: 'does anyone sell',  score: 2 },
  { phrase: 'where can i find',  score: 2 },
  { phrase: 'where can i get',   score: 2 },
  { phrase: 'where do i find',   score: 2 },
  { phrase: 'where do i get',    score: 2 },
  // Weaker signals (1 point — not enough alone)
  { phrase: 'i need a',          score: 1 },
  { phrase: 'i need an',         score: 1 },
  { phrase: 'trying to get',     score: 1 },
  { phrase: 'who has',           score: 1 },
  { phrase: 'who sells',         score: 1 },
  { phrase: 'can anyone sell',   score: 1 },
];

const COMMERCIAL_EXTRA = [
  { phrase: 'opening a restaurant',        score: 3 },
  { phrase: 'starting a restaurant',       score: 3 },
  { phrase: 'opening a catering',          score: 3 },
  { phrase: 'starting a catering',         score: 3 },
  { phrase: 'need equipment for',          score: 3 },
  { phrase: 'looking for commercial',      score: 3 },
  { phrase: 'need commercial',             score: 3 },
  { phrase: 'iso commercial',              score: 3 },
  { phrase: 'wtb commercial',              score: 3 },
  { phrase: 'outfitting my kitchen',       score: 2 },
  { phrase: 'equipping my restaurant',     score: 2 },
  { phrase: 'setting up my kitchen',       score: 2 },
  { phrase: 'setting up a restaurant',     score: 2 },
  { phrase: 'building out my kitchen',     score: 2 },
  { phrase: 'restaurant equipment needed', score: 2 },
  { phrase: 'kitchen equipment needed',    score: 2 },
  { phrase: 'catering equipment needed',   score: 2 },
  { phrase: 'used commercial kitchen',     score: 2 },
  { phrase: 'used restaurant equipment',   score: 2 },
  { phrase: 'need for my restaurant',      score: 1 },
  { phrase: 'need for my kitchen',         score: 1 },
  { phrase: 'need for catering',           score: 1 },
];

// Raised from 2 to 3 — only strong buyer signals pass
const MIN_BUYER_SCORE = 3;

// ─────────────────────────────────────────────────────────────
// CORE FILTER
// ─────────────────────────────────────────────────────────────
function isBlockedDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function getBuyerScore(text, item, mode) {
  const t = ` ${text.toLowerCase()} `;

  // Must mention the item
  if (!t.includes(item.toLowerCase())) return 0;

  // Instantly discard if ANY seller phrase present
  if (SELLER_PHRASES.some(p => t.includes(p))) return 0;

  // Score buyer intent
  const phrases = mode === 'commercial'
    ? [...BUYER_PHRASES_SCORED, ...COMMERCIAL_EXTRA]
    : BUYER_PHRASES_SCORED;

  let score = 0;
  phrases.forEach(({ phrase, score: s }) => {
    if (t.includes(phrase)) score += s;
  });

  return score;
}

function isBuyerPost(text, item, mode) {
  return getBuyerScore(text, item, mode) >= MIN_BUYER_SCORE;
}

function getMatchedPhrase(text, mode) {
  const t = ` ${text.toLowerCase()} `;
  const phrases = mode === 'commercial'
    ? [...BUYER_PHRASES_SCORED, ...COMMERCIAL_EXTRA]
    : BUYER_PHRASES_SCORED;
  const match = phrases
    .filter(({ phrase }) => t.includes(phrase))
    .sort((a, b) => b.score - a.score)[0];
  return match ? match.phrase.trim() : 'buyer intent';
}

// ─────────────────────────────────────────────────────────────
// NEARBY CITIES
// ─────────────────────────────────────────────────────────────
const NEARBY_CITIES = {
  'san bernardino': {
    10: ['San Bernardino', 'Colton', 'Rialto', 'Fontana', 'Highland'],
    20: ['San Bernardino', 'Colton', 'Rialto', 'Fontana', 'Highland', 'Ontario', 'Rancho Cucamonga', 'Redlands', 'Loma Linda'],
    30: ['San Bernardino', 'Colton', 'Rialto', 'Fontana', 'Highland', 'Ontario', 'Rancho Cucamonga', 'Redlands', 'Loma Linda', 'Riverside', 'Moreno Valley', 'Upland', 'Claremont'],
    50: ['San Bernardino', 'Colton', 'Rialto', 'Fontana', 'Highland', 'Ontario', 'Rancho Cucamonga', 'Redlands', 'Loma Linda', 'Riverside', 'Moreno Valley', 'Upland', 'Claremont', 'Pomona', 'Corona', 'Victorville', 'Hesperia', 'Chino', 'Chino Hills'],
  },
  'riverside': {
    10: ['Riverside', 'Moreno Valley', 'Corona', 'Norco'],
    20: ['Riverside', 'Moreno Valley', 'Corona', 'Norco', 'Colton', 'San Bernardino', 'Perris', 'Jurupa Valley'],
    30: ['Riverside', 'Moreno Valley', 'Corona', 'Norco', 'Colton', 'San Bernardino', 'Perris', 'Jurupa Valley', 'Ontario', 'Rancho Cucamonga', 'Redlands', 'Temecula'],
    50: ['Riverside', 'Moreno Valley', 'Corona', 'Norco', 'Colton', 'San Bernardino', 'Perris', 'Jurupa Valley', 'Ontario', 'Rancho Cucamonga', 'Redlands', 'Temecula', 'Hemet', 'Murrieta', 'Lake Elsinore', 'Pomona', 'Chino'],
  },
  'los angeles': {
    10: ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Pasadena'],
    20: ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Pasadena', 'Long Beach', 'Torrance', 'Inglewood', 'Compton', 'El Monte', 'Santa Monica'],
    30: ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Pasadena', 'Long Beach', 'Torrance', 'Inglewood', 'Compton', 'El Monte', 'Santa Monica', 'Pomona', 'Ontario', 'Carson', 'Hawthorne', 'Downey'],
    50: ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Pasadena', 'Long Beach', 'Torrance', 'Inglewood', 'Compton', 'El Monte', 'Santa Monica', 'Pomona', 'Ontario', 'Carson', 'Hawthorne', 'Downey', 'Anaheim', 'Orange', 'Irvine', 'Santa Ana', 'San Bernardino'],
  },
  'la': {
    10: ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale'],
    20: ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Long Beach', 'Torrance', 'Inglewood', 'Santa Monica'],
    30: ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Long Beach', 'Torrance', 'Inglewood', 'Santa Monica', 'Pomona', 'Ontario', 'Carson', 'Downey'],
    50: ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Long Beach', 'Torrance', 'Inglewood', 'Santa Monica', 'Pomona', 'Ontario', 'Carson', 'Downey', 'Anaheim', 'Irvine', 'San Bernardino'],
  },
  'san diego': {
    10: ['San Diego', 'Chula Vista', 'El Cajon', 'La Mesa', 'Santee'],
    20: ['San Diego', 'Chula Vista', 'El Cajon', 'La Mesa', 'Santee', 'Escondido', 'National City', 'Lemon Grove', 'Spring Valley'],
    30: ['San Diego', 'Chula Vista', 'El Cajon', 'La Mesa', 'Santee', 'Escondido', 'National City', 'Lemon Grove', 'Spring Valley', 'Oceanside', 'Vista', 'San Marcos'],
    50: ['San Diego', 'Chula Vista', 'El Cajon', 'La Mesa', 'Santee', 'Escondido', 'National City', 'Lemon Grove', 'Spring Valley', 'Oceanside', 'Vista', 'San Marcos', 'Carlsbad', 'Temecula', 'Murrieta'],
  },
  'san francisco': {
    10: ['San Francisco', 'Oakland', 'Berkeley', 'Daly City', 'South San Francisco'],
    20: ['San Francisco', 'Oakland', 'Berkeley', 'Daly City', 'South San Francisco', 'San Mateo', 'Fremont', 'Hayward', 'San Leandro'],
    30: ['San Francisco', 'Oakland', 'Berkeley', 'Daly City', 'South San Francisco', 'San Mateo', 'Fremont', 'Hayward', 'San Leandro', 'San Jose', 'Santa Clara', 'Sunnyvale', 'Redwood City'],
    50: ['San Francisco', 'Oakland', 'Berkeley', 'Daly City', 'South San Francisco', 'San Mateo', 'Fremont', 'Hayward', 'San Leandro', 'San Jose', 'Santa Clara', 'Sunnyvale', 'Redwood City', 'Palo Alto', 'Mountain View', 'Concord', 'Vallejo'],
  },
  'new york': {
    10: ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Jersey City', 'Hoboken'],
    20: ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Jersey City', 'Hoboken', 'Newark', 'Yonkers', 'Staten Island'],
    30: ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Jersey City', 'Hoboken', 'Newark', 'Yonkers', 'Staten Island', 'Paterson', 'Elizabeth', 'New Rochelle'],
    50: ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Jersey City', 'Hoboken', 'Newark', 'Yonkers', 'Staten Island', 'Paterson', 'Elizabeth', 'New Rochelle', 'Bridgeport', 'Stamford', 'Hartford'],
  },
  'chicago': {
    10: ['Chicago', 'Evanston', 'Oak Park', 'Cicero', 'Skokie'],
    20: ['Chicago', 'Evanston', 'Oak Park', 'Cicero', 'Skokie', 'Naperville', 'Aurora', 'Joliet', 'Waukegan'],
    30: ['Chicago', 'Evanston', 'Oak Park', 'Cicero', 'Skokie', 'Naperville', 'Aurora', 'Joliet', 'Waukegan', 'Elgin', 'Schaumburg', 'Palatine', 'Hammond'],
    50: ['Chicago', 'Evanston', 'Oak Park', 'Cicero', 'Skokie', 'Naperville', 'Aurora', 'Joliet', 'Waukegan', 'Elgin', 'Schaumburg', 'Palatine', 'Hammond', 'Gary', 'Kenosha', 'Rockford'],
  },
  'houston': {
    10: ['Houston', 'Pasadena', 'Pearland', 'Sugar Land', 'Missouri City'],
    20: ['Houston', 'Pasadena', 'Pearland', 'Sugar Land', 'Missouri City', 'Katy', 'Baytown', 'League City'],
    30: ['Houston', 'Pasadena', 'Pearland', 'Sugar Land', 'Missouri City', 'Katy', 'Baytown', 'League City', 'The Woodlands', 'Conroe', 'Friendswood'],
    50: ['Houston', 'Pasadena', 'Pearland', 'Sugar Land', 'Missouri City', 'Katy', 'Baytown', 'League City', 'The Woodlands', 'Conroe', 'Friendswood', 'Galveston', 'Beaumont'],
  },
  'dallas': {
    10: ['Dallas', 'Fort Worth', 'Arlington', 'Irving', 'Garland'],
    20: ['Dallas', 'Fort Worth', 'Arlington', 'Irving', 'Garland', 'Plano', 'Mesquite', 'Grand Prairie', 'Carrollton'],
    30: ['Dallas', 'Fort Worth', 'Arlington', 'Irving', 'Garland', 'Plano', 'Mesquite', 'Grand Prairie', 'Carrollton', 'McKinney', 'Frisco', 'Denton', 'Lewisville'],
    50: ['Dallas', 'Fort Worth', 'Arlington', 'Irving', 'Garland', 'Plano', 'Mesquite', 'Grand Prairie', 'Carrollton', 'McKinney', 'Frisco', 'Denton', 'Lewisville', 'Allen', 'Richardson', 'Waco'],
  },
  'phoenix': {
    10: ['Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler'],
    20: ['Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Gilbert', 'Glendale', 'Peoria', 'Surprise'],
    30: ['Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Gilbert', 'Glendale', 'Peoria', 'Surprise', 'Avondale', 'Goodyear', 'Buckeye'],
    50: ['Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Gilbert', 'Glendale', 'Peoria', 'Surprise', 'Avondale', 'Goodyear', 'Buckeye', 'Casa Grande', 'Queen Creek'],
  },
  'seattle': {
    10: ['Seattle', 'Bellevue', 'Redmond', 'Kirkland', 'Renton'],
    20: ['Seattle', 'Bellevue', 'Redmond', 'Kirkland', 'Renton', 'Tacoma', 'Federal Way', 'Kent', 'Auburn'],
    30: ['Seattle', 'Bellevue', 'Redmond', 'Kirkland', 'Renton', 'Tacoma', 'Federal Way', 'Kent', 'Auburn', 'Everett', 'Marysville', 'Lynnwood'],
    50: ['Seattle', 'Bellevue', 'Redmond', 'Kirkland', 'Renton', 'Tacoma', 'Federal Way', 'Kent', 'Auburn', 'Everett', 'Marysville', 'Lynnwood', 'Olympia', 'Bellingham'],
  },
  'denver': {
    10: ['Denver', 'Aurora', 'Lakewood', 'Englewood', 'Arvada'],
    20: ['Denver', 'Aurora', 'Lakewood', 'Englewood', 'Arvada', 'Westminster', 'Thornton', 'Centennial', 'Littleton'],
    30: ['Denver', 'Aurora', 'Lakewood', 'Englewood', 'Arvada', 'Westminster', 'Thornton', 'Centennial', 'Littleton', 'Boulder', 'Broomfield', 'Commerce City'],
    50: ['Denver', 'Aurora', 'Lakewood', 'Englewood', 'Arvada', 'Westminster', 'Thornton', 'Centennial', 'Littleton', 'Boulder', 'Broomfield', 'Commerce City', 'Fort Collins', 'Longmont', 'Greeley'],
  },
  'miami': {
    10: ['Miami', 'Miami Beach', 'Hialeah', 'Coral Gables', 'South Miami'],
    20: ['Miami', 'Miami Beach', 'Hialeah', 'Coral Gables', 'South Miami', 'Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Miramar'],
    30: ['Miami', 'Miami Beach', 'Hialeah', 'Coral Gables', 'South Miami', 'Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Miramar', 'Homestead', 'Doral', 'Kendall'],
    50: ['Miami', 'Miami Beach', 'Hialeah', 'Coral Gables', 'South Miami', 'Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Miramar', 'Homestead', 'Doral', 'Kendall', 'Boca Raton', 'West Palm Beach', 'Pompano Beach'],
  },
  'atlanta': {
    10: ['Atlanta', 'Decatur', 'Sandy Springs', 'Smyrna', 'Marietta'],
    20: ['Atlanta', 'Decatur', 'Sandy Springs', 'Smyrna', 'Marietta', 'Roswell', 'Alpharetta', 'College Park', 'East Point'],
    30: ['Atlanta', 'Decatur', 'Sandy Springs', 'Smyrna', 'Marietta', 'Roswell', 'Alpharetta', 'College Park', 'East Point', 'Lawrenceville', 'Peachtree City', 'Douglasville'],
    50: ['Atlanta', 'Decatur', 'Sandy Springs', 'Smyrna', 'Marietta', 'Roswell', 'Alpharetta', 'College Park', 'East Point', 'Lawrenceville', 'Peachtree City', 'Douglasville', 'Gainesville', 'Newnan', 'Rome'],
  },
  'boston': {
    10: ['Boston', 'Cambridge', 'Somerville', 'Quincy', 'Brookline'],
    20: ['Boston', 'Cambridge', 'Somerville', 'Quincy', 'Brookline', 'Newton', 'Lynn', 'Lowell', 'Brockton'],
    30: ['Boston', 'Cambridge', 'Somerville', 'Quincy', 'Brookline', 'Newton', 'Lynn', 'Lowell', 'Brockton', 'Worcester', 'Salem', 'Lawrence'],
    50: ['Boston', 'Cambridge', 'Somerville', 'Quincy', 'Brookline', 'Newton', 'Lynn', 'Lowell', 'Brockton', 'Worcester', 'Salem', 'Lawrence', 'Providence', 'Manchester'],
  },
  'las vegas': {
    10: ['Las Vegas', 'Henderson', 'North Las Vegas', 'Summerlin', 'Paradise'],
    20: ['Las Vegas', 'Henderson', 'North Las Vegas', 'Summerlin', 'Paradise', 'Boulder City', 'Enterprise', 'Spring Valley'],
    30: ['Las Vegas', 'Henderson', 'North Las Vegas', 'Summerlin', 'Paradise', 'Boulder City', 'Enterprise', 'Spring Valley', 'Mesquite', 'Pahrump'],
    50: ['Las Vegas', 'Henderson', 'North Las Vegas', 'Summerlin', 'Paradise', 'Boulder City', 'Enterprise', 'Spring Valley', 'Mesquite', 'Pahrump', 'St. George'],
  },
};

function getNearbyKeywords(location, radius) {
  if (radius === '100') return null;
  const locLower = location.toLowerCase().replace(/,.*$/, '').trim();
  const radiusNum = parseInt(radius);
  const tier = radiusNum <= 10 ? 10 : radiusNum <= 20 ? 20 : radiusNum <= 30 ? 30 : 50;
  const cityData = NEARBY_CITIES[locLower];
  if (cityData && cityData[tier]) return cityData[tier];
  return [location.replace(/,.*$/, '').trim()];
}

function buildLocationFilter(location, radius) {
  if (radius === '100') return '';
  const cities = getNearbyKeywords(location, radius);
  if (!cities || cities.length === 0) return '';
  if (cities.length === 1) return ` "${cities[0]}"`;
  return ` (${cities.map(c => `"${c}"`).join(' OR ')})`;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────
// REDDIT
// ─────────────────────────────────────────────────────────────
async function searchReddit(item, location, radius, mode) {
  const results = [];
  const locFilter = buildLocationFilter(location, radius);

  const queries = mode === 'commercial' ? [
    `"ISO" OR "WTB" OR "looking for" "${item}" commercial${locFilter}`,
    `"opening a restaurant" OR "starting a restaurant" "${item}"${locFilter}`,
    `"used commercial" OR "restaurant equipment" "${item}"${locFilter}`,
  ] : [
    `"ISO" OR "WTB" OR "looking for" "${item}"${locFilter}`,
    `"want to buy" OR "in search of" "${item}"${locFilter}`,
    `"does anyone have" OR "anyone selling" "${item}"${locFilter}`,
  ];

  for (const q of queries) {
    try {
      const encoded = encodeURIComponent(q);
      const url = `https://www.reddit.com/search.json?q=${encoded}&sort=new&limit=15&type=link`;

      const res = await axios.get(url, {
        headers: { 'User-Agent': 'BuyerRadar/1.0', 'Accept': 'application/json' },
        timeout: 10000,
      });

      (res.data?.data?.children || []).forEach(post => {
        const d = post.data;
        const fullText = `${d.title} ${d.selftext || ''}`;
        if (!d.permalink) return;
        const postUrl = `https://reddit.com${d.permalink}`;
        if (results.find(r => r.url === postUrl)) return;
        const score = getBuyerScore(fullText, item, mode);
        if (score < MIN_BUYER_SCORE) return;

        results.push({
          url: postUrl,
          title: d.title,
          snippet: d.selftext ? d.selftext.slice(0, 200) : `r/${d.subreddit} · ${d.score} upvotes`,
          platform: 'Reddit',
          color: '#ff6314',
          phraseLabel: getMatchedPhrase(fullText, mode),
          buyerScore: score,
        });
      });

      await sleep(500);
    } catch (err) {
      console.error('Reddit error:', err.message);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// CRAIGSLIST — RSS
// ─────────────────────────────────────────────────────────────
async function searchCraigslist(item, location, radius, mode) {
  const results = [];

  const cityMap = {
    'los angeles': 'losangeles', 'la': 'losangeles',
    'san diego': 'sandiego', 'san francisco': 'sfbay', 'sf': 'sfbay',
    'new york': 'newyork', 'nyc': 'newyork', 'chicago': 'chicago',
    'houston': 'houston', 'phoenix': 'phoenix', 'philadelphia': 'philadelphia',
    'san antonio': 'sanantonio', 'dallas': 'dallas', 'seattle': 'seattle',
    'denver': 'denver', 'boston': 'boston', 'atlanta': 'atlanta',
    'miami': 'miami', 'portland': 'portland', 'las vegas': 'lasvegas',
    'riverside': 'inlandempire', 'san bernardino': 'inlandempire',
    'ontario': 'inlandempire', 'rancho cucamonga': 'inlandempire',
    'colton': 'inlandempire',
  };

  const locLower = location.toLowerCase().replace(/,.*$/, '').trim();
  const subdomain = cityMap[locLower] || locLower.replace(/\s+/g, '');
  const query = encodeURIComponent(item);
  const sections = mode === 'commercial' ? ['wan', 'biz'] : ['wan'];

  for (const section of sections) {
    try {
      const url = `https://${subdomain}.craigslist.org/search/${section}?query=${query}&format=rss`;
      const res = await axios.get(url, {
        headers: { ...HEADERS, 'Accept': 'application/rss+xml, application/xml, text/xml' },
        timeout: 10000,
      });

      const $ = cheerio.load(res.data, { xmlMode: true });

      $('item').each((i, el) => {
        if (results.length >= 20) return;
        const title = $(el).find('title').first().text().trim();
        const link = $(el).find('link').first().text().trim();
        const description = $(el).find('description').first().text().trim();
        if (!title || !link) return;
        if (isBlockedDomain(link)) return;

        const combined = `${title} ${description}`;
        if (!combined.toLowerCase().includes(item.toLowerCase())) return;
        if (results.find(r => r.url === link)) return;

        // Wanted section = buyer by definition, just check seller blacklist
        if (section === 'wan') {
          const t = ` ${combined.toLowerCase()} `;
          if (SELLER_PHRASES.some(p => t.includes(p))) return;
        } else {
          if (getBuyerScore(combined, item, mode) < MIN_BUYER_SCORE) return;
        }

        results.push({
          url: link,
          title,
          snippet: description ? description.slice(0, 200) : 'Craigslist WANTED — looking to buy',
          platform: 'Craigslist',
          color: '#a855f7',
          phraseLabel: section === 'wan' ? 'craigslist wanted' : getMatchedPhrase(combined, mode),
          buyerScore: section === 'wan' ? 3 : getBuyerScore(combined, item, mode),
        });
      });

    } catch (err) {
      console.error(`Craigslist error (${section}):`, err.message);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// X (TWITTER) — Nitter
// ─────────────────────────────────────────────────────────────
async function searchX(item, location, radius, mode) {
  const results = [];

  const nitterInstances = [
    'https://nitter.privacydev.net',
    'https://nitter.poast.org',
    'https://nitter.1d4.us',
    'https://nitter.space',
  ];

  const locFilter = buildLocationFilter(location, radius);

  const intentQueries = mode === 'commercial' ? [
    `"ISO" "${item}" commercial${locFilter}`,
    `"WTB" "${item}" commercial${locFilter}`,
    `"looking for" "${item}" restaurant${locFilter}`,
  ] : [
    `"ISO" "${item}"${locFilter}`,
    `"WTB" "${item}"${locFilter}`,
    `"looking for" "${item}"${locFilter}`,
    `"want to buy" "${item}"${locFilter}`,
  ];

  for (const instance of nitterInstances) {
    let instanceWorking = false;

    for (const q of intentQueries) {
      try {
        const res = await axios.get(`${instance}/search?f=tweets&q=${encodeURIComponent(q)}`, {
          headers: HEADERS, timeout: 8000,
        });
        const $ = cheerio.load(res.data);
        const items = $('.timeline-item, .tweet-body');
        if (items.length === 0) continue;
        instanceWorking = true;

        items.each((i, el) => {
          if (results.length >= 12) return;
          const text = $(el).find('.tweet-content, .content').text().trim();
          const link = $(el).find('a.tweet-link, .tweet-date a').attr('href');
          if (!text || !link) return;
          const score = getBuyerScore(text, item, mode);
          if (score < MIN_BUYER_SCORE) return;
          const fullUrl = `https://x.com${link.replace(/^\/[^/]+/, '')}`;
          if (results.find(r => r.url === fullUrl)) return;

          results.push({
            url: fullUrl,
            title: text.slice(0, 100),
            snippet: text.slice(0, 200),
            platform: 'X (Twitter)',
            color: '#e7e7e7',
            phraseLabel: getMatchedPhrase(text, mode),
            buyerScore: score,
          });
        });

        await sleep(400);
      } catch (err) {
        console.error(`Nitter error:`, err.message);
      }
    }

    if (instanceWorking) break;
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// GOOGLE — SerpApi with domain blacklist
// ─────────────────────────────────────────────────────────────
async function searchGoogle(item, location, radius, mode) {
  const results = [];
  if (!process.env.SERPAPI_KEY) return results;

  const locFilter = buildLocationFilter(location, radius);
  const primaryCity = location.replace(/,.*$/, '').trim();

  // Build exclude string from blocked domains
  const domainExcludes = [
    'reddit.com', 'craigslist.org', 'x.com', 'twitter.com',
    'offerup.com', 'nextdoor.com', 'ebay.com', 'amazon.com',
    'etsy.com', 'walmart.com', 'bidspotter.com', 'proxibid.com',
    'govplanet.com', 'ironplanet.com', 'ritchiebros.com',
    'liveauctioneers.com', 'hibid.com', 'auctionzip.com',
    'webstaurantstore.com', 'katom.com', 'restaurantequipment.com',
  ].map(d => `-site:${d}`).join(' ');

  const intentQueries = mode === 'commercial' ? [
    `"ISO" "${item}" commercial${locFilter} ${domainExcludes}`,
    `"WTB" "${item}" commercial${locFilter} ${domainExcludes}`,
    `"looking for" "${item}" restaurant${locFilter} ${domainExcludes}`,
    `"opening a restaurant" "${item}"${locFilter} ${domainExcludes}`,
    `"used commercial kitchen equipment" "${item}"${locFilter} ${domainExcludes}`,
  ] : [
    `"ISO" "${item}"${locFilter} ${domainExcludes}`,
    `"WTB" "${item}"${locFilter} ${domainExcludes}`,
    `"in search of" "${item}"${locFilter} ${domainExcludes}`,
    `"looking to buy" "${item}"${locFilter} ${domainExcludes}`,
    `"want to buy" "${item}"${locFilter} ${domainExcludes}`,
  ];

  for (const q of intentQueries) {
    try {
      const params = new URLSearchParams({
        api_key: process.env.SERPAPI_KEY,
        engine: 'google',
        q,
        num: '10',
        tbs: 'qdr:m',
        gl: 'us',
        hl: 'en',
        location: radius !== '100' ? `${primaryCity}, United States` : 'United States',
      });

      const res = await axios.get(`https://serpapi.com/search.json?${params.toString()}`, { timeout: 10000 });
      if (res.data.error) continue;

      (res.data.organic_results || []).forEach(r => {
        if (!r.link) return;
        if (isBlockedDomain(r.link)) return;
        if (results.find(x => x.url === r.link)) return;

        const combined = `${r.title || ''} ${r.snippet || ''}`;
        const score = getBuyerScore(combined, item, mode);
        if (score < MIN_BUYER_SCORE) return;

        results.push({
          url: r.link,
          title: r.title || 'View Post',
          snippet: r.snippet || '',
          platform: 'Google',
          color: '#00d4ff',
          phraseLabel: getMatchedPhrase(combined, mode),
          buyerScore: score,
        });
      });

      await sleep(300);
    } catch (err) {
      console.error('SerpApi error:', err.message);
    }
  }

  return results.sort((a, b) => (b.buyerScore || 0) - (a.buyerScore || 0));
}

// ─────────────────────────────────────────────────────────────
// NEXTDOOR — SerpApi
// ─────────────────────────────────────────────────────────────
async function searchNextdoor(item, location, radius, mode) {
  const results = [];
  if (!process.env.SERPAPI_KEY) return results;

  const locFilter = buildLocationFilter(location, radius);
  const intentPart = mode === 'commercial'
    ? `("ISO" OR "WTB" OR "looking for" OR "need" OR "opening a restaurant" OR "catering")`
    : `("ISO" OR "WTB" OR "looking for" OR "want to buy" OR "in search of" OR "does anyone have")`;

  try {
    const params = new URLSearchParams({
      api_key: process.env.SERPAPI_KEY,
      engine: 'google',
      q: `site:nextdoor.com ${intentPart} "${item}"${locFilter}`,
      num: '10',
      tbs: 'qdr:m',
      gl: 'us',
      hl: 'en',
    });

    const res = await axios.get(`https://serpapi.com/search.json?${params.toString()}`, { timeout: 10000 });

    (res.data.organic_results || []).forEach(r => {
      if (!r.link || !r.link.includes('nextdoor.com')) return;
      if (results.find(x => x.url === r.link)) return;
      const combined = `${r.title || ''} ${r.snippet || ''}`;
      const score = getBuyerScore(combined, item, mode);
      if (score < MIN_BUYER_SCORE) return;

      results.push({
        url: r.link,
        title: r.title || 'Nextdoor Post',
        snippet: r.snippet || 'Nextdoor post — click to view',
        platform: 'Nextdoor',
        color: '#f472b6',
        phraseLabel: getMatchedPhrase(combined, mode),
        buyerScore: score,
      });
    });

  } catch (err) {
    console.error('Nextdoor error:', err.message);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// MAIN ENDPOINT
// ─────────────────────────────────────────────────────────────
app.post('/api/search', async (req, res) => {
  const { item, location, radius, mode } = req.body;
  if (!item || !location) return res.status(400).json({ error: 'item and location are required' });

  const searchMode = mode === 'commercial' ? 'commercial' : 'general';
  console.log(`\n◉ [${searchMode.toUpperCase()}] "${item}" near ${location} (${radius} mi)`);

  try {
    const [reddit, craigslist, x, nextdoor, google] = await Promise.allSettled([
      searchReddit(item, location, radius, searchMode),
      searchCraigslist(item, location, radius, searchMode),
      searchX(item, location, radius, searchMode),
      searchNextdoor(item, location, radius, searchMode),
      searchGoogle(item, location, radius, searchMode),
    ]);

    const extract = r => r.status === 'fulfilled' ? r.value : [];

    const allResults = [
      ...extract(reddit),
      ...extract(craigslist),
      ...extract(x),
      ...extract(nextdoor),
      ...extract(google),
    ];

    const seen = new Set();
    const unique = allResults.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    // Sort strongest buyer signals first
    unique.sort((a, b) => (b.buyerScore || 0) - (a.buyerScore || 0));

    console.log(`◉ Found ${unique.length} verified buyer posts`);

    return res.json({
      results: unique,
      counts: {
        Reddit: extract(reddit).length,
        Craigslist: extract(craigslist).length,
        'X (Twitter)': extract(x).length,
        Nextdoor: extract(nextdoor).length,
        Google: extract(google).length,
      },
    });

  } catch (err) {
    console.error('Search failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BuyerRadar — domain blacklist + strict scoring active' });
});

app.listen(PORT, () => {
  console.log(`\n◉ BuyerRadar backend running on http://localhost:${PORT}`);
  console.log(`◉ Health check: http://localhost:${PORT}/api/health\n`);
});
