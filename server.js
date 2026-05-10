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
// TIGHT CITY CLUSTERS
// ─────────────────────────────────────────────────────────────
const CITY_CLUSTERS = {
  'san bernardino': ['San Bernardino', 'Redlands', 'Riverside', 'Yucaipa', 'Fontana', 'Ontario'],
  'redlands':       ['Redlands', 'San Bernardino', 'Yucaipa', 'Loma Linda', 'Highland', 'Colton'],
  'riverside':      ['Riverside', 'Moreno Valley', 'Corona', 'Colton', 'Norco', 'Jurupa Valley'],
  'fontana':        ['Fontana', 'Rialto', 'San Bernardino', 'Rancho Cucamonga', 'Ontario', 'Colton'],
  'ontario':        ['Ontario', 'Rancho Cucamonga', 'Fontana', 'Upland', 'Chino', 'Montclair'],
  'rancho cucamonga':['Rancho Cucamonga', 'Ontario', 'Fontana', 'Upland', 'Claremont', 'Chino Hills'],
  'colton':         ['Colton', 'San Bernardino', 'Rialto', 'Loma Linda', 'Fontana', 'Grand Terrace'],
  'rialto':         ['Rialto', 'Fontana', 'Colton', 'San Bernardino', 'Bloomington', 'Grand Terrace'],
  'moreno valley':  ['Moreno Valley', 'Riverside', 'Perris', 'Hemet', 'Beaumont', 'Banning'],
  'corona':         ['Corona', 'Riverside', 'Norco', 'Eastvale', 'Jurupa Valley', 'Chino Hills'],
  'upland':         ['Upland', 'Rancho Cucamonga', 'Ontario', 'Claremont', 'Montclair', 'Pomona'],
  'victorville':    ['Victorville', 'Hesperia', 'Apple Valley', 'Adelanto', 'Barstow', 'Phelan'],
  'hesperia':       ['Hesperia', 'Victorville', 'Apple Valley', 'Adelanto', 'Oak Hills', 'Phelan'],
  'temecula':       ['Temecula', 'Murrieta', 'Menifee', 'Lake Elsinore', 'Wildomar', 'Perris'],
  'murrieta':       ['Murrieta', 'Temecula', 'Menifee', 'Lake Elsinore', 'Wildomar', 'Canyon Lake'],
  'yucaipa':        ['Yucaipa', 'Redlands', 'Calimesa', 'Beaumont', 'Banning', 'San Bernardino'],
  'los angeles':    ['Los Angeles', 'Burbank', 'Glendale', 'Pasadena', 'Culver City', 'West Hollywood'],
  'la':             ['Los Angeles', 'Burbank', 'Glendale', 'Pasadena', 'Culver City', 'West Hollywood'],
  'long beach':     ['Long Beach', 'Compton', 'Carson', 'Torrance', 'Lakewood', 'Signal Hill'],
  'burbank':        ['Burbank', 'Glendale', 'Los Angeles', 'Pasadena', 'Toluca Lake', 'North Hollywood'],
  'glendale':       ['Glendale', 'Burbank', 'Los Angeles', 'Pasadena', 'La Crescenta', 'Montrose'],
  'pasadena':       ['Pasadena', 'Glendale', 'Arcadia', 'Monrovia', 'Temple City', 'San Gabriel'],
  'torrance':       ['Torrance', 'Carson', 'Redondo Beach', 'Gardena', 'Hawthorne', 'Lawndale'],
  'pomona':         ['Pomona', 'Ontario', 'Chino', 'Diamond Bar', 'Walnut', 'La Verne'],
  'inglewood':      ['Inglewood', 'Hawthorne', 'Gardena', 'Lawndale', 'Lennox', 'Culver City'],
  'compton':        ['Compton', 'Carson', 'Gardena', 'Paramount', 'Lynwood', 'South Gate'],
  'santa monica':   ['Santa Monica', 'Culver City', 'West Hollywood', 'Venice', 'Marina del Rey', 'Brentwood'],
  'san diego':      ['San Diego', 'Chula Vista', 'El Cajon', 'La Mesa', 'Santee', 'Lemon Grove'],
  'chula vista':    ['Chula Vista', 'San Diego', 'National City', 'Bonita', 'Eastlake', 'Otay Ranch'],
  'el cajon':       ['El Cajon', 'La Mesa', 'Santee', 'San Diego', 'Spring Valley', 'Lakeside'],
  'escondido':      ['Escondido', 'San Marcos', 'Vista', 'Oceanside', 'San Diego', 'Poway'],
  'oceanside':      ['Oceanside', 'Carlsbad', 'Vista', 'Escondido', 'San Marcos', 'Camp Pendleton'],
  'san francisco':  ['San Francisco', 'Oakland', 'Berkeley', 'Daly City', 'South San Francisco', 'San Mateo'],
  'sf':             ['San Francisco', 'Oakland', 'Berkeley', 'Daly City', 'South San Francisco', 'San Mateo'],
  'oakland':        ['Oakland', 'Berkeley', 'San Francisco', 'Hayward', 'San Leandro', 'Emeryville'],
  'san jose':       ['San Jose', 'Santa Clara', 'Sunnyvale', 'Milpitas', 'Campbell', 'Los Gatos'],
  'fremont':        ['Fremont', 'Newark', 'Union City', 'Hayward', 'Milpitas', 'San Leandro'],
  'berkeley':       ['Berkeley', 'Oakland', 'Albany', 'Emeryville', 'El Cerrito', 'Richmond'],
  'new york':       ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Jersey City', 'Yonkers'],
  'nyc':            ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Jersey City', 'Yonkers'],
  'brooklyn':       ['Brooklyn', 'Queens', 'New York', 'Staten Island', 'Hoboken', 'Jersey City'],
  'queens':         ['Queens', 'Brooklyn', 'New York', 'Bronx', 'Nassau County', 'Long Island City'],
  'bronx':          ['Bronx', 'New York', 'Yonkers', 'Mount Vernon', 'New Rochelle', 'Queens'],
  'chicago':        ['Chicago', 'Evanston', 'Oak Park', 'Cicero', 'Skokie', 'Berwyn'],
  'naperville':     ['Naperville', 'Aurora', 'Bolingbrook', 'Lisle', 'Downers Grove', 'Wheaton'],
  'houston':        ['Houston', 'Pasadena', 'Pearland', 'Sugar Land', 'Missouri City', 'Katy'],
  'katy':           ['Katy', 'Houston', 'Sugar Land', 'Richmond', 'Cypress', 'Fulshear'],
  'dallas':         ['Dallas', 'Fort Worth', 'Arlington', 'Irving', 'Garland', 'Plano'],
  'fort worth':     ['Fort Worth', 'Dallas', 'Arlington', 'Mansfield', 'Euless', 'Bedford'],
  'arlington':      ['Arlington', 'Dallas', 'Fort Worth', 'Irving', 'Grand Prairie', 'Mansfield'],
  'plano':          ['Plano', 'Dallas', 'Frisco', 'Allen', 'McKinney', 'Richardson'],
  'frisco':         ['Frisco', 'Plano', 'McKinney', 'Allen', 'Little Elm', 'Prosper'],
  'phoenix':        ['Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Glendale'],
  'scottsdale':     ['Scottsdale', 'Phoenix', 'Tempe', 'Paradise Valley', 'Fountain Hills', 'Mesa'],
  'mesa':           ['Mesa', 'Chandler', 'Gilbert', 'Tempe', 'Phoenix', 'Scottsdale'],
  'tempe':          ['Tempe', 'Phoenix', 'Mesa', 'Scottsdale', 'Chandler', 'Gilbert'],
  'chandler':       ['Chandler', 'Gilbert', 'Tempe', 'Mesa', 'Ahwatukee', 'Sun Lakes'],
  'seattle':        ['Seattle', 'Bellevue', 'Redmond', 'Kirkland', 'Renton', 'Shoreline'],
  'bellevue':       ['Bellevue', 'Seattle', 'Redmond', 'Kirkland', 'Issaquah', 'Mercer Island'],
  'tacoma':         ['Tacoma', 'Federal Way', 'Auburn', 'Kent', 'Puyallup', 'Lakewood'],
  'denver':         ['Denver', 'Aurora', 'Lakewood', 'Englewood', 'Arvada', 'Westminster'],
  'aurora':         ['Aurora', 'Denver', 'Centennial', 'Englewood', 'Parker', 'Lone Tree'],
  'boulder':        ['Boulder', 'Longmont', 'Louisville', 'Lafayette', 'Broomfield', 'Westminster'],
  'miami':          ['Miami', 'Miami Beach', 'Hialeah', 'Coral Gables', 'Doral', 'Sweetwater'],
  'fort lauderdale':['Fort Lauderdale', 'Hollywood', 'Pompano Beach', 'Deerfield Beach', 'Miramar', 'Pembroke Pines'],
  'atlanta':        ['Atlanta', 'Decatur', 'Sandy Springs', 'Smyrna', 'Marietta', 'Brookhaven'],
  'marietta':       ['Marietta', 'Atlanta', 'Smyrna', 'Kennesaw', 'Roswell', 'Acworth'],
  'roswell':        ['Roswell', 'Alpharetta', 'Sandy Springs', 'Atlanta', 'Johns Creek', 'Dunwoody'],
  'boston':         ['Boston', 'Cambridge', 'Somerville', 'Quincy', 'Brookline', 'Newton'],
  'cambridge':      ['Cambridge', 'Boston', 'Somerville', 'Medford', 'Arlington', 'Watertown'],
  'worcester':      ['Worcester', 'Shrewsbury', 'Westborough', 'Millbury', 'Auburn', 'Leicester'],
  'las vegas':      ['Las Vegas', 'Henderson', 'North Las Vegas', 'Enterprise', 'Spring Valley', 'Paradise'],
  'henderson':      ['Henderson', 'Las Vegas', 'Boulder City', 'Enterprise', 'Green Valley', 'Whitney'],
  'portland':       ['Portland', 'Beaverton', 'Gresham', 'Hillsboro', 'Lake Oswego', 'Tigard'],
  'minneapolis':    ['Minneapolis', 'Saint Paul', 'Bloomington', 'Brooklyn Park', 'Plymouth', 'Maple Grove'],
  'nashville':      ['Nashville', 'Murfreesboro', 'Franklin', 'Brentwood', 'Smyrna', 'Hendersonville'],
  'memphis':        ['Memphis', 'Germantown', 'Bartlett', 'Collierville', 'Cordova', 'Lakeland'],
  'baltimore':      ['Baltimore', 'Towson', 'Columbia', 'Catonsville', 'Dundalk', 'Rosedale'],
  'washington':     ['Washington', 'Arlington', 'Alexandria', 'Silver Spring', 'Bethesda', 'Rockville'],
  'dc':             ['Washington', 'Arlington', 'Alexandria', 'Silver Spring', 'Bethesda', 'Rockville'],
  'charlotte':      ['Charlotte', 'Concord', 'Gastonia', 'Rock Hill', 'Huntersville', 'Matthews'],
  'raleigh':        ['Raleigh', 'Durham', 'Cary', 'Chapel Hill', 'Apex', 'Garner'],
  'orlando':        ['Orlando', 'Kissimmee', 'Sanford', 'Altamonte Springs', 'Winter Park', 'Apopka'],
  'tampa':          ['Tampa', 'St. Petersburg', 'Clearwater', 'Brandon', 'Largo', 'Pinellas Park'],
  'jacksonville':   ['Jacksonville', 'Orange Park', 'St. Augustine', 'Fernandina Beach', 'Middleburg', 'Ponte Vedra'],
  'new orleans':    ['New Orleans', 'Metairie', 'Kenner', 'Chalmette', 'Gretna', 'Harvey'],
  'kansas city':    ['Kansas City', 'Overland Park', 'Olathe', "Lee's Summit", 'Independence', 'Blue Springs'],
  'st louis':       ['St. Louis', 'Clayton', 'Florissant', 'Chesterfield', 'Kirkwood', 'Ballwin'],
  'indianapolis':   ['Indianapolis', 'Carmel', 'Fishers', 'Lawrence', 'Noblesville', 'Greenwood'],
  'columbus':       ['Columbus', 'Dublin', 'Hilliard', 'Grove City', 'Westerville', 'Gahanna'],
  'cleveland':      ['Cleveland', 'Parma', 'Lakewood', 'Euclid', 'Strongsville', 'Mentor'],
  'cincinnati':     ['Cincinnati', 'Covington', 'Florence', 'Norwood', 'Mason', 'Fairfield'],
  'pittsburgh':     ['Pittsburgh', 'Mt. Lebanon', 'Bethel Park', 'Penn Hills', 'Monroeville', 'Carnegie'],
  'sacramento':     ['Sacramento', 'Elk Grove', 'Roseville', 'Folsom', 'Rancho Cordova', 'Citrus Heights'],
  'fresno':         ['Fresno', 'Clovis', 'Madera', 'Tulare', 'Visalia', 'Selma'],
  'bakersfield':    ['Bakersfield', 'Delano', 'Tehachapi', 'Wasco', 'Shafter', 'McFarland'],
  'stockton':       ['Stockton', 'Modesto', 'Tracy', 'Manteca', 'Lodi', 'Turlock'],
  'anaheim':        ['Anaheim', 'Orange', 'Santa Ana', 'Garden Grove', 'Fullerton', 'Buena Park'],
  'santa ana':      ['Santa Ana', 'Anaheim', 'Orange', 'Garden Grove', 'Tustin', 'Irvine'],
  'irvine':         ['Irvine', 'Santa Ana', 'Anaheim', 'Costa Mesa', 'Newport Beach', 'Tustin'],
  'austin':         ['Austin', 'Round Rock', 'Cedar Park', 'Georgetown', 'Pflugerville', 'Kyle'],
  'san antonio':    ['San Antonio', 'New Braunfels', 'Schertz', 'Converse', 'Universal City', 'Live Oak'],
  'detroit':        ['Detroit', 'Dearborn', 'Warren', 'Sterling Heights', 'Livonia', 'Southfield'],
  'milwaukee':      ['Milwaukee', 'Wauwatosa', 'West Allis', 'Brookfield', 'Greenfield', 'Oak Creek'],
  'albuquerque':    ['Albuquerque', 'Rio Rancho', 'Santa Fe', 'Bernalillo', 'Corrales', 'Los Lunas'],
  'tucson':         ['Tucson', 'Marana', 'Oro Valley', 'Sahuarita', 'Green Valley', 'Nogales'],
  'el paso':        ['El Paso', 'Horizon City', 'Socorro', 'Anthony', 'Sunland Park', 'Las Cruces'],
  'tulsa':          ['Tulsa', 'Broken Arrow', 'Owasso', 'Bixby', 'Jenks', 'Sand Springs'],
  'oklahoma city':  ['Oklahoma City', 'Edmond', 'Mustang', 'Yukon', 'Moore', 'Midwest City'],
  'omaha':          ['Omaha', 'Bellevue', 'Council Bluffs', 'Papillion', 'La Vista', 'Ralston'],
  'richmond':       ['Richmond', 'Henrico', 'Chesterfield', 'Petersburg', 'Hopewell', 'Colonial Heights'],
  'virginia beach': ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Portsmouth', 'Hampton', 'Newport News'],
  'norfolk':        ['Norfolk', 'Virginia Beach', 'Chesapeake', 'Portsmouth', 'Hampton', 'Suffolk'],
  'buffalo':        ['Buffalo', 'Cheektowaga', 'Amherst', 'Tonawanda', 'Niagara Falls', 'Lackawanna'],
  'jersey city':    ['Jersey City', 'Newark', 'Hoboken', 'Union City', 'Bayonne', 'Weehawken'],
  'newark':         ['Newark', 'Jersey City', 'Elizabeth', 'Paterson', 'Union City', 'Hoboken'],
};

function getCityCluster(location) {
  const locLower = location.toLowerCase().replace(/,.*$/, '').trim();
  if (CITY_CLUSTERS[locLower]) return CITY_CLUSTERS[locLower];
  return [location.replace(/,.*$/, '').trim()];
}

function buildLocationFilter(location, radius) {
  if (radius === '100') return '';
  const cities = getCityCluster(location);
  if (cities.length === 1) return ` "${cities[0]}"`;
  return ` (${cities.map(c => `"${c}"`).join(' OR ')})`;
}

// ─────────────────────────────────────────────────────────────
// DOMAIN BLACKLIST
// ─────────────────────────────────────────────────────────────
const BLOCKED_DOMAINS = [
  'ebay.com', 'proxibid.com', 'bidspotter.com', 'govplanet.com',
  'ironplanet.com', 'ritchiebros.com', 'rbauction.com', 'purplewave.com',
  'bidadoo.com', 'auctionzip.com', 'liveauctioneers.com', 'invaluable.com',
  'hibid.com', 'auctiontime.com', 'bringatrailer.com', 'amazon.com',
  'walmart.com', 'etsy.com', 'mercari.com', 'poshmark.com', 'depop.com',
  'shopify.com', 'alibaba.com', 'aliexpress.com', 'webstaurantstore.com',
  'restaurantequipment.com', 'katom.com', 'centralrestaurant.com',
  'acitydiscount.com', 'burkett.com', 'yelp.com', 'yellowpages.com',
  'homedepot.com', 'lowes.com', 'bestbuy.com', 'target.com',
  'costco.com', 'samsclub.com', 'duckduckgo.com',
];

function isBlockedDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`));
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────
// SELLER BLACKLIST
// ─────────────────────────────────────────────────────────────
const SELLER_PHRASES = [
  'for sale', 'i am selling', "i'm selling", 'selling my', 'selling a ',
  'selling an ', 'selling these', 'selling this', 'asking price', 'asking $',
  'price is', 'priced at', ' obo', 'or best offer', 'firm price',
  'shipped for', 'free shipping', 'buy it now', 'pick up only', 'local pickup',
  'dm for price', 'message for price', 'just reduced', 'price drop',
  'make an offer', 'taking offers', 'open to offers', 'willing to ship',
  'will ship', 'can ship', 'paypal accepted', 'venmo accepted',
  'cash only', 'cash preferred', 'motivated seller', 'must sell',
  'need to sell', 'gotta sell', 'letting go', 'letting it go',
  'parting with', 'getting rid of', 'moving sale', 'estate sale',
  'garage sale', 'yard sale', 'auction', 'bidding', 'starting bid',
  'reserve price', 'wholesale', 'bulk pricing', 'brand new in box',
  'new in box', 'never used', 'never opened', 'sealed in box',
];

// ─────────────────────────────────────────────────────────────
// BUYER INTENT PHRASES — scored
// ─────────────────────────────────────────────────────────────
const BUYER_PHRASES_SCORED = [
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
  { phrase: 'i need a',          score: 1 },
  { phrase: 'i need an',         score: 1 },
  { phrase: 'trying to get',     score: 1 },
  { phrase: 'who has',           score: 1 },
  { phrase: 'who sells',         score: 1 },
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

const MIN_BUYER_SCORE = 3;

function getBuyerScore(text, item, mode) {
  const t = ` ${text.toLowerCase()} `;
  if (!t.includes(item.toLowerCase())) return 0;
  if (SELLER_PHRASES.some(p => t.includes(p))) return 0;
  const phrases = mode === 'commercial'
    ? [...BUYER_PHRASES_SCORED, ...COMMERCIAL_EXTRA]
    : BUYER_PHRASES_SCORED;
  let score = 0;
  phrases.forEach(({ phrase, score: s }) => { if (t.includes(phrase)) score += s; });
  return score;
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

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────────────────────
// DUCKDUCKGO SCRAPER
// Replaces SerpApi — free, no key needed
// Retries up to 3 times if rate limited
// ─────────────────────────────────────────────────────────────
async function searchDuckDuckGo(query, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Step 1: Get vqd token (required by DDG)
      const initRes = await axios.get(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            ...HEADERS,
            'Referer': 'https://duckduckgo.com/',
          },
          timeout: 12000,
        }
      );

      const $ = cheerio.load(initRes.data);
      const results = [];

      // Parse search results
      $('.result, .web-result').each((i, el) => {
        if (results.length >= 10) return;

        const titleEl = $(el).find('.result__title, .result__a, a.result__a').first();
        const snippetEl = $(el).find('.result__snippet, .result__body').first();
        const linkEl = $(el).find('a.result__url, .result__title a, a[href]').first();

        const title = titleEl.text().trim();
        let href = linkEl.attr('href') || titleEl.attr('href') || '';

        // DDG wraps URLs — extract the real one
        if (href.includes('//duckduckgo.com/l/') || href.startsWith('/l/')) {
          try {
            const urlParams = new URLSearchParams(href.split('?')[1]);
            href = urlParams.get('uddg') || urlParams.get('u') || href;
          } catch { /* keep original */ }
        }

        const snippet = snippetEl.text().trim();

        if (!title || !href || !href.startsWith('http')) return;
        results.push({ title, link: href, snippet });
      });

      return results;

    } catch (err) {
      console.error(`DDG attempt ${attempt + 1} failed:`, err.message);
      if (attempt < retries - 1) await sleep(1500 * (attempt + 1));
    }
  }
  return [];
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
      const res = await axios.get(
        `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=15&type=link`,
        { headers: { 'User-Agent': 'BuyerRadar/1.0', 'Accept': 'application/json' }, timeout: 10000 }
      );

      (res.data?.data?.children || []).forEach(post => {
        const d = post.data;
        const fullText = `${d.title} ${d.selftext || ''}`;
        if (!d.permalink) return;
        const postUrl = `https://reddit.com${d.permalink}`;
        if (results.find(r => r.url === postUrl)) return;
        const score = getBuyerScore(fullText, item, mode);
        if (score < MIN_BUYER_SCORE) return;
        results.push({
          url: postUrl, title: d.title,
          snippet: d.selftext ? d.selftext.slice(0, 200) : `r/${d.subreddit} · ${d.score} upvotes`,
          platform: 'Reddit', color: '#ff6314',
          phraseLabel: getMatchedPhrase(fullText, mode), buyerScore: score,
        });
      });
      await sleep(500);
    } catch (err) { console.error('Reddit error:', err.message); }
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
    'san antonio': 'sanantonio', 'dallas': 'dallas', 'fort worth': 'dallas',
    'arlington': 'dallas', 'plano': 'dallas', 'frisco': 'dallas',
    'seattle': 'seattle', 'bellevue': 'seattle', 'tacoma': 'seattle',
    'denver': 'denver', 'aurora': 'denver', 'boulder': 'boulder',
    'boston': 'boston', 'cambridge': 'boston', 'worcester': 'worcester',
    'atlanta': 'atlanta', 'marietta': 'atlanta', 'roswell': 'atlanta',
    'miami': 'miami', 'fort lauderdale': 'miami',
    'portland': 'portland', 'las vegas': 'lasvegas', 'henderson': 'lasvegas',
    'riverside': 'inlandempire', 'san bernardino': 'inlandempire',
    'ontario': 'inlandempire', 'rancho cucamonga': 'inlandempire',
    'colton': 'inlandempire', 'fontana': 'inlandempire',
    'rialto': 'inlandempire', 'redlands': 'inlandempire',
    'yucaipa': 'inlandempire', 'moreno valley': 'inlandempire',
    'corona': 'inlandempire', 'temecula': 'inlandempire',
    'murrieta': 'inlandempire', 'upland': 'inlandempire',
    'victorville': 'victorville', 'hesperia': 'victorville',
    'sacramento': 'sacramento', 'fresno': 'fresno',
    'bakersfield': 'bakersfield', 'stockton': 'stockton',
    'anaheim': 'orangecounty', 'santa ana': 'orangecounty',
    'irvine': 'orangecounty', 'long beach': 'longbeach',
    'san jose': 'sfbay', 'oakland': 'sfbay', 'berkeley': 'sfbay',
    'fremont': 'sfbay', 'scottsdale': 'phoenix', 'mesa': 'phoenix',
    'tempe': 'phoenix', 'chandler': 'phoenix',
    'nashville': 'nashville', 'memphis': 'memphis',
    'baltimore': 'baltimore', 'washington': 'washingtondc', 'dc': 'washingtondc',
    'charlotte': 'charlotte', 'raleigh': 'raleigh',
    'orlando': 'orlando', 'tampa': 'tampa', 'jacksonville': 'jacksonville',
    'new orleans': 'neworleans', 'kansas city': 'kansascity',
    'st louis': 'stlouis', 'indianapolis': 'indianapolis',
    'columbus': 'columbus', 'cleveland': 'cleveland',
    'cincinnati': 'cincinnati', 'pittsburgh': 'pittsburgh',
    'detroit': 'detroit', 'milwaukee': 'milwaukee', 'minneapolis': 'minneapolis',
    'albuquerque': 'albuquerque', 'tucson': 'tucson', 'el paso': 'elpaso',
    'austin': 'austin', 'tulsa': 'tulsa', 'oklahoma city': 'oklahomacity',
    'omaha': 'omaha', 'richmond': 'richmond',
    'virginia beach': 'norfolk', 'norfolk': 'norfolk',
    'buffalo': 'buffalo', 'jersey city': 'newjersey', 'newark': 'newjersey',
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
        if (!title || !link || isBlockedDomain(link)) return;
        const combined = `${title} ${description}`;
        if (!combined.toLowerCase().includes(item.toLowerCase())) return;
        if (results.find(r => r.url === link)) return;

        if (section === 'wan') {
          const t = ` ${combined.toLowerCase()} `;
          if (SELLER_PHRASES.some(p => t.includes(p))) return;
        } else {
          if (getBuyerScore(combined, item, mode) < MIN_BUYER_SCORE) return;
        }

        results.push({
          url: link, title,
          snippet: description ? description.slice(0, 200) : 'Craigslist WANTED — looking to buy',
          platform: 'Craigslist', color: '#a855f7',
          phraseLabel: section === 'wan' ? 'craigslist wanted' : getMatchedPhrase(combined, mode),
          buyerScore: section === 'wan' ? 3 : getBuyerScore(combined, item, mode),
        });
      });
    } catch (err) { console.error(`Craigslist error (${section}):`, err.message); }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────
// X (TWITTER) — Nitter
// ─────────────────────────────────────────────────────────────
async function searchX(item, location, radius, mode) {
  const results = [];
  const nitterInstances = [
    'https://nitter.privacydev.net', 'https://nitter.poast.org',
    'https://nitter.1d4.us', 'https://nitter.space',
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
            url: fullUrl, title: text.slice(0, 100), snippet: text.slice(0, 200),
            platform: 'X (Twitter)', color: '#e7e7e7',
            phraseLabel: getMatchedPhrase(text, mode), buyerScore: score,
          });
        });
        await sleep(400);
      } catch (err) { console.error(`Nitter error:`, err.message); }
    }
    if (instanceWorking) break;
  }
  return results;
}

// ─────────────────────────────────────────────────────────────
// DUCKDUCKGO WEB SEARCH
// Replaces Google/SerpApi — completely free
// ─────────────────────────────────────────────────────────────
async function searchWeb(item, location, radius, mode) {
  const results = [];
  const locFilter = buildLocationFilter(location, radius);

  const domainExcludes = [
    '-site:reddit.com', '-site:craigslist.org', '-site:x.com',
    '-site:twitter.com', '-site:offerup.com', '-site:ebay.com',
    '-site:amazon.com', '-site:etsy.com', '-site:walmart.com',
    '-site:bidspotter.com', '-site:proxibid.com', '-site:govplanet.com',
    '-site:ironplanet.com', '-site:ritchiebros.com', '-site:liveauctioneers.com',
    '-site:hibid.com', '-site:webstaurantstore.com', '-site:katom.com',
  ].join(' ');

  const intentQueries = mode === 'commercial' ? [
    `"ISO" "${item}" commercial${locFilter} ${domainExcludes}`,
    `"WTB" "${item}" commercial${locFilter} ${domainExcludes}`,
    `"looking for" "${item}" restaurant${locFilter} ${domainExcludes}`,
    `"opening a restaurant" "${item}"${locFilter} ${domainExcludes}`,
  ] : [
    `"ISO" "${item}"${locFilter} ${domainExcludes}`,
    `"WTB" "${item}"${locFilter} ${domainExcludes}`,
    `"in search of" "${item}"${locFilter} ${domainExcludes}`,
    `"looking to buy" "${item}"${locFilter} ${domainExcludes}`,
    `"want to buy" "${item}"${locFilter} ${domainExcludes}`,
  ];

  for (const q of intentQueries) {
    try {
      const ddgResults = await searchDuckDuckGo(q);

      ddgResults.forEach(r => {
        if (!r.link || isBlockedDomain(r.link)) return;
        if (results.find(x => x.url === r.link)) return;
        const combined = `${r.title || ''} ${r.snippet || ''}`;
        const score = getBuyerScore(combined, item, mode);
        if (score < MIN_BUYER_SCORE) return;
        results.push({
          url: r.link, title: r.title || 'View Post', snippet: r.snippet || '',
          platform: 'Web', color: '#00d4ff',
          phraseLabel: getMatchedPhrase(combined, mode), buyerScore: score,
        });
      });

      await sleep(800); // be gentle with DDG
    } catch (err) { console.error('DDG search error:', err.message); }
  }

  return results.sort((a, b) => (b.buyerScore || 0) - (a.buyerScore || 0));
}

// ─────────────────────────────────────────────────────────────
// MAIN ENDPOINT
// ─────────────────────────────────────────────────────────────
app.post('/api/search', async (req, res) => {
  const { item, location, radius, mode } = req.body;
  if (!item || !location) return res.status(400).json({ error: 'item and location are required' });

  const searchMode = mode === 'commercial' ? 'commercial' : 'general';
  const cluster = getCityCluster(location);
  console.log(`\n◉ [${searchMode.toUpperCase()}] "${item}" in ${cluster.join(', ')}`);

  try {
    const [reddit, craigslist, x, web] = await Promise.allSettled([
      searchReddit(item, location, radius, searchMode),
      searchCraigslist(item, location, radius, searchMode),
      searchX(item, location, radius, searchMode),
      searchWeb(item, location, radius, searchMode),
    ]);

    const extract = r => r.status === 'fulfilled' ? r.value : [];
    const allResults = [
      ...extract(reddit), ...extract(craigslist),
      ...extract(x), ...extract(web),
    ];

    const seen = new Set();
    const unique = allResults.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url); return true;
    });

    unique.sort((a, b) => (b.buyerScore || 0) - (a.buyerScore || 0));
    console.log(`◉ Found ${unique.length} verified buyer posts`);

    return res.json({
      results: unique,
      counts: {
        Reddit: extract(reddit).length,
        Craigslist: extract(craigslist).length,
        'X (Twitter)': extract(x).length,
        Web: extract(web).length,
      },
      locationCluster: cluster,
    });
  } catch (err) {
    console.error('Search failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'BuyerRadar — no API keys required, DuckDuckGo powered',
    platforms: ['Reddit', 'Craigslist', 'X (Twitter)', 'Web (DuckDuckGo)'],
  });
});

app.listen(PORT, () => {
  console.log(`\n◉ BuyerRadar backend running on http://localhost:${PORT}`);
  console.log(`◉ No API keys required!`);
  console.log(`◉ Health check: http://localhost:${PORT}/api/health\n`);
});
