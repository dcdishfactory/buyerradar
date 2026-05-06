require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://buyerradar-production.up.railway.app',
  methods: ['GET', 'POST'],
}));
app.use(express.json());
app.use(express.static('public'));

// ─────────────────────────────────────────────────────────────
// NEARBY CITIES MAP
// For each city we list nearby cities within ~10/30/50/70 miles
// radius tiers: 10, 20, 30, 50, 100 (nationwide = no filter)
// ─────────────────────────────────────────────────────────────
const NEARBY_CITIES = {
  // INLAND EMPIRE / SAN BERNARDINO AREA
  'san bernardino': {
    10:  ['San Bernardino', 'Colton', 'Rialto', 'Fontana', 'Highland'],
    20:  ['San Bernardino', 'Colton', 'Rialto', 'Fontana', 'Highland', 'Ontario', 'Rancho Cucamonga', 'Redlands', 'Loma Linda'],
    30:  ['San Bernardino', 'Colton', 'Rialto', 'Fontana', 'Highland', 'Ontario', 'Rancho Cucamonga', 'Redlands', 'Loma Linda', 'Riverside', 'Moreno Valley', 'Upland', 'Claremont'],
    50:  ['San Bernardino', 'Colton', 'Rialto', 'Fontana', 'Highland', 'Ontario', 'Rancho Cucamonga', 'Redlands', 'Loma Linda', 'Riverside', 'Moreno Valley', 'Upland', 'Claremont', 'Pomona', 'Corona', 'Victorville', 'Hesperia', 'Chino', 'Chino Hills'],
  },
  'riverside': {
    10:  ['Riverside', 'Moreno Valley', 'Corona', 'Norco'],
    20:  ['Riverside', 'Moreno Valley', 'Corona', 'Norco', 'Colton', 'San Bernardino', 'Perris', 'Jurupa Valley'],
    30:  ['Riverside', 'Moreno Valley', 'Corona', 'Norco', 'Colton', 'San Bernardino', 'Perris', 'Jurupa Valley', 'Ontario', 'Rancho Cucamonga', 'Redlands', 'Temecula'],
    50:  ['Riverside', 'Moreno Valley', 'Corona', 'Norco', 'Colton', 'San Bernardino', 'Perris', 'Jurupa Valley', 'Ontario', 'Rancho Cucamonga', 'Redlands', 'Temecula', 'Hemet', 'Murrieta', 'Lake Elsinore', 'Pomona', 'Chino'],
  },
  // LOS ANGELES AREA
  'los angeles': {
    10:  ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Pasadena'],
    20:  ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Pasadena', 'Long Beach', 'Torrance', 'Inglewood', 'Compton', 'El Monte', 'Santa Monica'],
    30:  ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Pasadena', 'Long Beach', 'Torrance', 'Inglewood', 'Compton', 'El Monte', 'Santa Monica', 'Pomona', 'Ontario', 'Carson', 'Hawthorne', 'Downey'],
    50:  ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Pasadena', 'Long Beach', 'Torrance', 'Inglewood', 'Compton', 'El Monte', 'Santa Monica', 'Pomona', 'Ontario', 'Carson', 'Hawthorne', 'Downey', 'Anaheim', 'Orange', 'Irvine', 'Santa Ana', 'San Bernardino'],
  },
  'la': {
    10:  ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale'],
    20:  ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Long Beach', 'Torrance', 'Inglewood', 'Santa Monica'],
    30:  ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Long Beach', 'Torrance', 'Inglewood', 'Santa Monica', 'Pomona', 'Ontario', 'Carson', 'Downey'],
    50:  ['Los Angeles', 'West Hollywood', 'Culver City', 'Burbank', 'Glendale', 'Long Beach', 'Torrance', 'Inglewood', 'Santa Monica', 'Pomona', 'Ontario', 'Carson', 'Downey', 'Anaheim', 'Irvine', 'San Bernardino'],
  },
  // SAN DIEGO
  'san diego': {
    10:  ['San Diego', 'Chula Vista', 'El Cajon', 'La Mesa', 'Santee'],
    20:  ['San Diego', 'Chula Vista', 'El Cajon', 'La Mesa', 'Santee', 'Escondido', 'National City', 'Lemon Grove', 'Spring Valley'],
    30:  ['San Diego', 'Chula Vista', 'El Cajon', 'La Mesa', 'Santee', 'Escondido', 'National City', 'Lemon Grove', 'Spring Valley', 'Oceanside', 'Vista', 'San Marcos'],
    50:  ['San Diego', 'Chula Vista', 'El Cajon', 'La Mesa', 'Santee', 'Escondido', 'National City', 'Lemon Grove', 'Spring Valley', 'Oceanside', 'Vista', 'San Marcos', 'Carlsbad', 'Temecula', 'Murrieta'],
  },
  // SAN FRANCISCO BAY AREA
  'san francisco': {
    10:  ['San Francisco', 'Oakland', 'Berkeley', 'Daly City', 'South San Francisco'],
    20:  ['San Francisco', 'Oakland', 'Berkeley', 'Daly City', 'South San Francisco', 'San Mateo', 'Fremont', 'Hayward', 'San Leandro'],
    30:  ['San Francisco', 'Oakland', 'Berkeley', 'Daly City', 'South San Francisco', 'San Mateo', 'Fremont', 'Hayward', 'San Leandro', 'San Jose', 'Santa Clara', 'Sunnyvale', 'Redwood City'],
    50:  ['San Francisco', 'Oakland', 'Berkeley', 'Daly City', 'South San Francisco', 'San Mateo', 'Fremont', 'Hayward', 'San Leandro', 'San Jose', 'Santa Clara', 'Sunnyvale', 'Redwood City', 'Palo Alto', 'Mountain View', 'Concord', 'Vallejo'],
  },
  // NEW YORK
  'new york': {
    10:  ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Jersey City', 'Hoboken'],
    20:  ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Jersey City', 'Hoboken', 'Newark', 'Yonkers', 'Staten Island'],
    30:  ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Jersey City', 'Hoboken', 'Newark', 'Yonkers', 'Staten Island', 'Paterson', 'Elizabeth', 'New Rochelle'],
    50:  ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Jersey City', 'Hoboken', 'Newark', 'Yonkers', 'Staten Island', 'Paterson', 'Elizabeth', 'New Rochelle', 'Bridgeport', 'Stamford', 'Hartford'],
  },
  // CHICAGO
  'chicago': {
    10:  ['Chicago', 'Evanston', 'Oak Park', 'Cicero', 'Skokie'],
    20:  ['Chicago', 'Evanston', 'Oak Park', 'Cicero', 'Skokie', 'Naperville', 'Aurora', 'Joliet', 'Waukegan'],
    30:  ['Chicago', 'Evanston', 'Oak Park', 'Cicero', 'Skokie', 'Naperville', 'Aurora', 'Joliet', 'Waukegan', 'Elgin', 'Schaumburg', 'Palatine', 'Hammond'],
    50:  ['Chicago', 'Evanston', 'Oak Park', 'Cicero', 'Skokie', 'Naperville', 'Aurora', 'Joliet', 'Waukegan', 'Elgin', 'Schaumburg', 'Palatine', 'Hammond', 'Gary', 'Kenosha', 'Rockford'],
  },
  // HOUSTON
  'houston': {
    10:  ['Houston', 'Pasadena', 'Pearland', 'Sugar Land', 'Missouri City'],
    20:  ['Houston', 'Pasadena', 'Pearland', 'Sugar Land', 'Missouri City', 'Katy', 'Baytown', 'League City', 'Galveston'],
    30:  ['Houston', 'Pasadena', 'Pearland', 'Sugar Land', 'Missouri City', 'Katy', 'Baytown', 'League City', 'Galveston', 'The Woodlands', 'Conroe', 'Friendswood'],
    50:  ['Houston', 'Pasadena', 'Pearland', 'Sugar Land', 'Missouri City', 'Katy', 'Baytown', 'League City', 'Galveston', 'The Woodlands', 'Conroe', 'Friendswood', 'Beaumont', 'Texas City'],
  },
  // DALLAS
  'dallas': {
    10:  ['Dallas', 'Fort Worth', 'Arlington', 'Irving', 'Garland'],
    20:  ['Dallas', 'Fort Worth', 'Arlington', 'Irving', 'Garland', 'Plano', 'Mesquite', 'Grand Prairie', 'Carrollton'],
    30:  ['Dallas', 'Fort Worth', 'Arlington', 'Irving', 'Garland', 'Plano', 'Mesquite', 'Grand Prairie', 'Carrollton', 'McKinney', 'Frisco', 'Denton', 'Lewisville'],
    50:  ['Dallas', 'Fort Worth', 'Arlington', 'Irving', 'Garland', 'Plano', 'Mesquite', 'Grand Prairie', 'Carrollton', 'McKinney', 'Frisco', 'Denton', 'Lewisville', 'Allen', 'Richardson', 'Waco'],
  },
  // PHOENIX
  'phoenix': {
    10:  ['Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler'],
    20:  ['Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Gilbert', 'Glendale', 'Peoria', 'Surprise'],
    30:  ['Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Gilbert', 'Glendale', 'Peoria', 'Surprise', 'Avondale', 'Goodyear', 'Buckeye'],
    50:  ['Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Gilbert', 'Glendale', 'Peoria', 'Surprise', 'Avondale', 'Goodyear', 'Buckeye', 'Casa Grande', 'Queen Creek'],
  },
  // SEATTLE
  'seattle': {
    10:  ['Seattle', 'Bellevue', 'Redmond', 'Kirkland', 'Renton'],
    20:  ['Seattle', 'Bellevue', 'Redmond', 'Kirkland', 'Renton', 'Tacoma', 'Federal Way', 'Kent', 'Auburn'],
    30:  ['Seattle', 'Bellevue', 'Redmond', 'Kirkland', 'Renton', 'Tacoma', 'Federal Way', 'Kent', 'Auburn', 'Everett', 'Marysville', 'Lynnwood'],
    50:  ['Seattle', 'Bellevue', 'Redmond', 'Kirkland', 'Renton', 'Tacoma', 'Federal Way', 'Kent', 'Auburn', 'Everett', 'Marysville', 'Lynnwood', 'Olympia', 'Bellingham'],
  },
  // DENVER
  'denver': {
    10:  ['Denver', 'Aurora', 'Lakewood', 'Englewood', 'Arvada'],
    20:  ['Denver', 'Aurora', 'Lakewood', 'Englewood', 'Arvada', 'Westminster', 'Thornton', 'Centennial', 'Littleton'],
    30:  ['Denver', 'Aurora', 'Lakewood', 'Englewood', 'Arvada', 'Westminster', 'Thornton', 'Centennial', 'Littleton', 'Boulder', 'Broomfield', 'Commerce City'],
    50:  ['Denver', 'Aurora', 'Lakewood', 'Englewood', 'Arvada', 'Westminster', 'Thornton', 'Centennial', 'Littleton', 'Boulder', 'Broomfield', 'Commerce City', 'Fort Collins', 'Longmont', 'Greeley'],
  },
  // MIAMI
  'miami': {
    10:  ['Miami', 'Miami Beach', 'Hialeah', 'Coral Gables', 'South Miami'],
    20:  ['Miami', 'Miami Beach', 'Hialeah', 'Coral Gables', 'South Miami', 'Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Miramar'],
    30:  ['Miami', 'Miami Beach', 'Hialeah', 'Coral Gables', 'South Miami', 'Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Miramar', 'Homestead', 'Doral', 'Kendall'],
    50:  ['Miami', 'Miami Beach', 'Hialeah', 'Coral Gables', 'South Miami', 'Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Miramar', 'Homestead', 'Doral', 'Kendall', 'Boca Raton', 'West Palm Beach', 'Pompano Beach'],
  },
  // ATLANTA
  'atlanta': {
    10:  ['Atlanta', 'Decatur', 'Sandy Springs', 'Smyrna', 'Marietta'],
    20:  ['Atlanta', 'Decatur', 'Sandy Springs', 'Smyrna', 'Marietta', 'Roswell', 'Alpharetta', 'College Park', 'East Point'],
    30:  ['Atlanta', 'Decatur', 'Sandy Springs', 'Smyrna', 'Marietta', 'Roswell', 'Alpharetta', 'College Park', 'East Point', 'Lawrenceville', 'Peachtree City', 'Douglasville'],
    50:  ['Atlanta', 'Decatur', 'Sandy Springs', 'Smyrna', 'Marietta', 'Roswell', 'Alpharetta', 'College Park', 'East Point', 'Lawrenceville', 'Peachtree City', 'Douglasville', 'Gainesville', 'Newnan', 'Rome'],
  },
  // BOSTON
  'boston': {
    10:  ['Boston', 'Cambridge', 'Somerville', 'Quincy', 'Brookline'],
    20:  ['Boston', 'Cambridge', 'Somerville', 'Quincy', 'Brookline', 'Newton', 'Lynn', 'Lowell', 'Brockton'],
    30:  ['Boston', 'Cambridge', 'Somerville', 'Quincy', 'Brookline', 'Newton', 'Lynn', 'Lowell', 'Brockton', 'Worcester', 'Salem', 'Lawrence'],
    50:  ['Boston', 'Cambridge', 'Somerville', 'Quincy', 'Brookline', 'Newton', 'Lynn', 'Lowell', 'Brockton', 'Worcester', 'Salem', 'Lawrence', 'Providence', 'Manchester'],
  },
  // LAS VEGAS
  'las vegas': {
    10:  ['Las Vegas', 'Henderson', 'North Las Vegas', 'Summerlin', 'Paradise'],
    20:  ['Las Vegas', 'Henderson', 'North Las Vegas', 'Summerlin', 'Paradise', 'Boulder City', 'Enterprise', 'Spring Valley'],
    30:  ['Las Vegas', 'Henderson', 'North Las Vegas', 'Summerlin', 'Paradise', 'Boulder City', 'Enterprise', 'Spring Valley', 'Mesquite', 'Pahrump'],
    50:  ['Las Vegas', 'Henderson', 'North Las Vegas', 'Summerlin', 'Paradise', 'Boulder City', 'Enterprise', 'Spring Valley', 'Mesquite', 'Pahrump', 'St. George'],
  },
};

// ─────────────────────────────────────────────────────────────
// GET NEARBY CITIES FOR A LOCATION + RADIUS
// ─────────────────────────────────────────────────────────────
function getNearbyKeywords(location, radius) {
  if (radius === '100') return null; // nationwide — no filter

  const locLower = location.toLowerCase().replace(/,.*$/, '').trim();
  const radiusNum = parseInt(radius);

  // Find the best radius tier
  const tier = radiusNum <= 10 ? 10
             : radiusNum <= 20 ? 20
             : radiusNum <= 30 ? 30
             : 50;

  const cityData = NEARBY_CITIES[locLower];

  if (cityData && cityData[tier]) {
    return cityData[tier];
  }

  // Fallback — just use the entered location as-is
  const cityName = location.replace(/,.*$/, '').trim();
  return [cityName];
}

// Build the location OR string for queries
// e.g. ("San Bernardino" OR "Colton" OR "Rialto" OR "Fontana")
function buildLocationFilter(location, radius) {
  if (radius === '100') return '';
  const cities = getNearbyKeywords(location, radius);
  if (!cities || cities.length === 0) return '';
  if (cities.length === 1) return ` "${cities[0]}"`;
  return ` (${cities.map(c => `"${c}"`).join(' OR ')})`;
}

// ─────────────────────────────────────────────────────────────
// BUYER INTENT PHRASES
// ─────────────────────────────────────────────────────────────
const GENERAL_PHRASES = [
  'does anyone have',
  'does anyone got',
  'in search of',
  ' iso ',
  'is anyone selling',
  'where can i find',
  'where can i get',
  'looking for',
  'looking to buy',
  'want to buy',
  'wanting to buy',
  ' wtb ',
  'anyone got',
  'anyone have',
  'does anyone sell',
  'trying to find',
  'need to buy',
  'i need a',
  'i need to buy',
  'anyone selling',
  'can anyone sell',
  'who has',
  'who sells',
  'where do i find',
  'where do i get',
  'trying to get',
  'hoping to find',
  'hoping to buy',
  'searching for',
  'on the hunt for',
];

const COMMERCIAL_PHRASES = [
  ...GENERAL_PHRASES,
  'opening a restaurant',
  'starting a restaurant',
  'opening a catering',
  'starting a catering',
  'need equipment for',
  'looking for commercial',
  'need commercial',
  'restaurant equipment needed',
  'kitchen equipment needed',
  'need a commercial kitchen',
  'looking for used commercial',
  'iso commercial',
  'wtb commercial',
  'need for my restaurant',
  'need for my kitchen',
  'outfitting my kitchen',
  'equipping my restaurant',
  'furnishing my restaurant',
  'building out my kitchen',
  'setting up my kitchen',
  'setting up a restaurant',
  'need for catering',
  'catering equipment needed',
  'used restaurant equipment',
  'used commercial kitchen',
  'surplus kitchen equipment',
];

const COMMERCIAL_SUBREDDITS = [
  'KitchenConfidential',
  'restaurants',
  'restaurantowners',
  'Cooking',
  'Entrepreneur',
  'smallbusiness',
  'catering',
  'foodservice',
  'chef',
];

function isBuyerPost(text, item, mode) {
  const t = ` ${text.toLowerCase()} `;
  const phrases = mode === 'commercial' ? COMMERCIAL_PHRASES : GENERAL_PHRASES;
  const hasItem = t.includes(item.toLowerCase());
  const hasIntent = phrases.some(phrase => t.includes(phrase));
  return hasItem && hasIntent;
}

function getMatchedPhrase(text, mode) {
  const t = ` ${text.toLowerCase()} `;
  const phrases = mode === 'commercial' ? COMMERCIAL_PHRASES : GENERAL_PHRASES;
  return (phrases.find(p => t.includes(p)) || 'buyer intent').trim();
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

  let queries;
  if (mode === 'commercial') {
    queries = [
      `"ISO" OR "WTB" OR "looking for" OR "need" "${item}" commercial${locFilter}`,
      `"opening a restaurant" OR "starting a restaurant" OR "catering" "${item}"${locFilter}`,
      `"used commercial" OR "restaurant equipment" "${item}"${locFilter}`,
    ];
  } else {
    queries = [
      `"ISO" OR "WTB" OR "looking for" "${item}"${locFilter}`,
      `"want to buy" OR "in search of" "${item}"${locFilter}`,
      `"does anyone have" OR "anyone selling" "${item}"${locFilter}`,
    ];
  }

  for (const q of queries) {
    try {
      const encoded = encodeURIComponent(q);
      const url = `https://www.reddit.com/search.json?q=${encoded}&sort=new&limit=15&type=link`;

      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'BuyerRadar/1.0 (buyer intent search tool)',
          'Accept': 'application/json',
        },
        timeout: 10000,
      });

      const posts = res.data?.data?.children || [];

      posts.forEach(post => {
        const d = post.data;
        const fullText = `${d.title} ${d.selftext || ''}`;
        if (!d.permalink) return;

        const postUrl = `https://reddit.com${d.permalink}`;
        if (results.find(r => r.url === postUrl)) return;
        if (!isBuyerPost(fullText, item, mode)) return;

        results.push({
          url: postUrl,
          title: d.title,
          snippet: d.selftext ? d.selftext.slice(0, 200) : `r/${d.subreddit} · ${d.score} upvotes`,
          platform: 'Reddit',
          color: '#ff6314',
          phraseLabel: getMatchedPhrase(fullText, mode),
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
// CRAIGSLIST — RSS feeds
// Already city-specific by subdomain — naturally bounded
// ─────────────────────────────────────────────────────────────
async function searchCraigslist(item, location, radius, mode) {
  const results = [];

  const cityMap = {
    'los angeles': 'losangeles', 'la': 'losangeles',
    'san diego': 'sandiego',
    'san francisco': 'sfbay', 'sf': 'sfbay',
    'new york': 'newyork', 'nyc': 'newyork',
    'chicago': 'chicago',
    'houston': 'houston',
    'phoenix': 'phoenix',
    'philadelphia': 'philadelphia',
    'san antonio': 'sanantonio',
    'dallas': 'dallas',
    'seattle': 'seattle',
    'denver': 'denver',
    'boston': 'boston',
    'atlanta': 'atlanta',
    'miami': 'miami',
    'portland': 'portland',
    'las vegas': 'lasvegas',
    'riverside': 'inlandempire',
    'san bernardino': 'inlandempire',
    'ontario': 'inlandempire',
    'rancho cucamonga': 'inlandempire',
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
        const combined = `${title} ${description}`;
        if (!combined.toLowerCase().includes(item.toLowerCase())) return;
        if (section === 'biz' && !isBuyerPost(combined, item, mode)) return;
        if (results.find(r => r.url === link)) return;

        results.push({
          url: link,
          title,
          snippet: description ? description.slice(0, 200) : 'Craigslist post — this person is looking to buy',
          platform: 'Craigslist',
          color: '#a855f7',
          phraseLabel: section === 'wan' ? 'craigslist wanted' : getMatchedPhrase(combined, mode),
        });
      });

    } catch (err) {
      console.error(`Craigslist RSS error (${section}):`, err.message);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// X (TWITTER) — via Nitter
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
    `"need" "${item}" catering${locFilter}`,
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
        const query = encodeURIComponent(q);
        const url = `${instance}/search?f=tweets&q=${query}`;

        const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
        const $ = cheerio.load(res.data);

        const items = $('.timeline-item, .tweet-body');
        if (items.length === 0) continue;

        instanceWorking = true;

        items.each((i, el) => {
          if (results.length >= 12) return;
          const text = $(el).find('.tweet-content, .content').text().trim();
          const link = $(el).find('a.tweet-link, .tweet-date a').attr('href');
          if (!text || !link) return;
          if (!isBuyerPost(text, item, mode)) return;

          const fullUrl = `https://x.com${link.replace(/^\/[^/]+/, '')}`;
          if (results.find(r => r.url === fullUrl)) return;

          results.push({
            url: fullUrl,
            title: text.slice(0, 100),
            snippet: text.slice(0, 200),
            platform: 'X (Twitter)',
            color: '#e7e7e7',
            phraseLabel: getMatchedPhrase(text, mode),
          });
        });

        await sleep(400);
      } catch (err) {
        console.error(`Nitter error (${instance}):`, err.message);
      }
    }

    if (instanceWorking) break;
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// GOOGLE — via SerpApi with location targeting
// ─────────────────────────────────────────────────────────────
async function searchGoogle(item, location, radius, mode) {
  const results = [];

  if (!process.env.SERPAPI_KEY) {
    console.error('SERPAPI_KEY not set — skipping Google');
    return results;
  }

  const locFilter = buildLocationFilter(location, radius);
  const exclude = '-site:reddit.com -site:craigslist.org -site:x.com -site:twitter.com -site:offerup.com -site:nextdoor.com';

  const intentQueries = mode === 'commercial' ? [
    `"ISO" "${item}" commercial${locFilter} ${exclude}`,
    `"WTB" "${item}" commercial${locFilter} ${exclude}`,
    `"looking for" "${item}" restaurant${locFilter} ${exclude}`,
    `"opening a restaurant" "${item}"${locFilter} ${exclude}`,
    `"used commercial kitchen equipment" "${item}"${locFilter} ${exclude}`,
  ] : [
    `"ISO" "${item}"${locFilter} ${exclude}`,
    `"WTB" "${item}"${locFilter} ${exclude}`,
    `"in search of" "${item}"${locFilter} ${exclude}`,
    `"looking to buy" "${item}"${locFilter} ${exclude}`,
    `"want to buy" "${item}"${locFilter} ${exclude}`,
  ];

  // Get the primary city for SerpApi location parameter
  const primaryCity = location.replace(/,.*$/, '').trim();

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

      if (res.data.error) {
        console.error('SerpApi error:', res.data.error);
        continue;
      }

      (res.data.organic_results || []).forEach(r => {
        if (!r.link || results.find(x => x.url === r.link)) return;
        const combined = `${r.title || ''} ${r.snippet || ''}`;
        if (!isBuyerPost(combined, item, mode)) return;

        results.push({
          url: r.link,
          title: r.title || 'View Post',
          snippet: r.snippet || '',
          platform: 'Google',
          color: '#00d4ff',
          phraseLabel: getMatchedPhrase(combined, mode),
        });
      });

      await sleep(300);
    } catch (err) {
      console.error('SerpApi error:', err.message);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// NEXTDOOR — via SerpApi
// ─────────────────────────────────────────────────────────────
async function searchNextdoor(item, location, radius, mode) {
  const results = [];
  if (!process.env.SERPAPI_KEY) return results;

  const locFilter = buildLocationFilter(location, radius);
  const intentPart = mode === 'commercial'
    ? `("ISO" OR "WTB" OR "looking for" OR "need" OR "opening a restaurant" OR "catering")`
    : `("ISO" OR "WTB" OR "looking for" OR "want to buy" OR "in search of" OR "does anyone have")`;

  try {
    const q = `site:nextdoor.com ${intentPart} "${item}"${locFilter}`;

    const params = new URLSearchParams({
      api_key: process.env.SERPAPI_KEY,
      engine: 'google',
      q,
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
      if (!isBuyerPost(combined, item, mode)) return;

      results.push({
        url: r.link,
        title: r.title || 'Nextdoor Post',
        snippet: r.snippet || 'Nextdoor post — click to view',
        platform: 'Nextdoor',
        color: '#f472b6',
        phraseLabel: getMatchedPhrase(combined, mode),
      });
    });

  } catch (err) {
    console.error('Nextdoor/SerpApi error:', err.message);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// MAIN SEARCH ENDPOINT
// ─────────────────────────────────────────────────────────────
app.post('/api/search', async (req, res) => {
  const { item, location, radius, mode } = req.body;

  if (!item || !location) {
    return res.status(400).json({ error: 'item and location are required' });
  }

  const searchMode = mode === 'commercial' ? 'commercial' : 'general';
  const nearbyCities = getNearbyKeywords(location, radius);

  console.log(`\n◉ [${searchMode.toUpperCase()}] "${item}" near ${location} (${radius} mi)`);
  if (nearbyCities) console.log(`◉ Location filter: ${nearbyCities.join(', ')}`);

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
      locationFilter: nearbyCities,
    });

  } catch (err) {
    console.error('Search failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'BuyerRadar backend running — strict location filtering active',
    platforms: ['Reddit', 'Craigslist', 'X (Twitter)', 'Nextdoor', 'Google'],
  });
});

app.listen(PORT, () => {
  console.log(`\n◉ BuyerRadar backend running on http://localhost:${PORT}`);
  console.log(`◉ Health check: http://localhost:${PORT}/api/health\n`);
});
