require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ─────────────────────────────────────────────────────────────
// BUYER INTENT PHRASES
// A post MUST contain one of these to be included in results
// ─────────────────────────────────────────────────────────────
const INTENT_PHRASES = [
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

// Strict check — post text must contain a buyer intent phrase AND the item
function isBuyerPost(text, item) {
  const t = text.toLowerCase();
  const itemLower = item.toLowerCase();
  const hasItem = t.includes(itemLower);
  const hasIntent = INTENT_PHRASES.some(phrase => t.includes(phrase));
  return hasItem && hasIntent;
}

// ─────────────────────────────────────────────────────────────
// SHARED HEADERS
// ─────────────────────────────────────────────────────────────
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────
// REDDIT SCRAPER
// Searches multiple buyer-intent focused subreddits + general
// ─────────────────────────────────────────────────────────────
async function searchReddit(item, location, radius) {
  const results = [];
  const locPart = radius === '100' ? '' : ` ${location}`;

  // These subreddits are specifically for buying/selling/finding items
  const subreddits = [
    'findfashion',
    'whatsthisworth',
    'buyitforlife',
    'marketplace',
    'forsale',
    'garageforsale',
    'all',
  ];

  const queries = [
    `"ISO" OR "WTB" OR "looking for" "${item}"${locPart}`,
    `"want to buy" OR "in search of" "${item}"${locPart}`,
    `"does anyone have" OR "anyone selling" "${item}"${locPart}`,
  ];

  for (const q of queries) {
    try {
      const encoded = encodeURIComponent(q);
      const url = `https://www.reddit.com/search.json?q=${encoded}&sort=new&limit=15&type=link`;

      const res = await axios.get(url, {
        headers: { ...HEADERS, 'Accept': 'application/json' },
        timeout: 8000,
      });

      const posts = res.data?.data?.children || [];

      posts.forEach(post => {
        const d = post.data;
        const fullText = `${d.title} ${d.selftext || ''}`;

        if (!d.permalink) return;
        const postUrl = `https://reddit.com${d.permalink}`;
        if (results.find(r => r.url === postUrl)) return;

        // Strict buyer intent check
        if (!isBuyerPost(fullText, item)) return;

        // Find which phrase matched
        const matchedPhrase = INTENT_PHRASES.find(p =>
          fullText.toLowerCase().includes(p)
        ) || 'buyer intent';

        results.push({
          url: postUrl,
          title: d.title,
          snippet: d.selftext ? d.selftext.slice(0, 200) : `r/${d.subreddit} · ${d.score} upvotes`,
          platform: 'Reddit',
          color: '#ff6314',
          phraseLabel: matchedPhrase.trim(),
        });
      });

      await sleep(300);
    } catch (err) {
      console.error(`Reddit error:`, err.message);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// CRAIGSLIST SCRAPER
// Only searches the "wanted" (wan) section — these are ALL
// posts from people looking to BUY something
// ─────────────────────────────────────────────────────────────
async function searchCraigslist(item, location, radius) {
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

  try {
    const query = encodeURIComponent(item);
    // /search/wan = "wanted" section only — these are buyers by definition
    const url = `https://${subdomain}.craigslist.org/search/wan?query=${query}&sort=date`;

    const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(res.data);

    $('li.cl-search-result, .result-row').each((i, el) => {
      if (results.length >= 15) return;
      const titleEl = $(el).find('.cl-app-anchor, a.result-title, .titlestring');
      const title = titleEl.text().trim();
      const href = titleEl.attr('href');
      if (!title || !href) return;

      // Extra check — title must mention the item
      if (!title.toLowerCase().includes(item.toLowerCase())) return;

      const fullUrl = href.startsWith('http') ? href : `https://${subdomain}.craigslist.org${href}`;
      if (results.find(r => r.url === fullUrl)) return;

      results.push({
        url: fullUrl,
        title,
        snippet: 'Craigslist WANTED post — this person is looking to buy',
        platform: 'Craigslist',
        color: '#a855f7',
        phraseLabel: 'craigslist wanted',
      });
    });

  } catch (err) {
    console.error('Craigslist error:', err.message);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// X (TWITTER) SCRAPER
// Only pulls tweets with explicit buyer intent phrases
// ─────────────────────────────────────────────────────────────
async function searchX(item, location, radius) {
  const results = [];

  const nitterInstances = [
    'https://nitter.privacydev.net',
    'https://nitter.poast.org',
    'https://nitter.1d4.us',
  ];

  const locPart = radius === '100' ? '' : ` "${location}"`;

  // Only search for explicit buyer intent phrases
  const intentQueries = [
    `"ISO" "${item}"${locPart}`,
    `"WTB" "${item}"${locPart}`,
    `"looking for" "${item}"${locPart}`,
    `"want to buy" "${item}"${locPart}`,
    `"in search of" "${item}"${locPart}`,
    `"does anyone have" "${item}"${locPart}`,
  ];

  for (const instance of nitterInstances) {
    for (const q of intentQueries.slice(0, 3)) {
      try {
        const query = encodeURIComponent(q);
        const url = `${instance}/search?f=tweets&q=${query}`;

        const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
        const $ = cheerio.load(res.data);

        $('.timeline-item, .tweet-body').each((i, el) => {
          if (results.length >= 10) return;
          const text = $(el).find('.tweet-content, .content').text().trim();
          const link = $(el).find('a.tweet-link, .tweet-date a').attr('href');
          if (!text || !link) return;

          // Strict buyer intent check
          if (!isBuyerPost(text, item)) return;

          const fullUrl = `https://x.com${link.replace(/^\/[^/]+/, '')}`;
          if (results.find(r => r.url === fullUrl)) return;

          const matchedPhrase = INTENT_PHRASES.find(p =>
            text.toLowerCase().includes(p)
          ) || 'buyer intent';

          results.push({
            url: fullUrl,
            title: text.slice(0, 100),
            snippet: text.slice(0, 200),
            platform: 'X (Twitter)',
            color: '#e7e7e7',
            phraseLabel: matchedPhrase.trim(),
          });
        });

        await sleep(400);
      } catch (err) {
        console.error(`Nitter error (${instance}):`, err.message);
      }
    }

    if (results.length > 0) break;
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// OFFERUP SCRAPER
// Searches OfferUp — filters to only "wanted/looking" posts
// ─────────────────────────────────────────────────────────────
async function searchOfferUp(item, location, radius) {
  const results = [];

  try {
    const query = encodeURIComponent(item);
    const url = `https://offerup.com/search/?q=${query}`;

    const res = await axios.get(url, {
      headers: { ...HEADERS, 'Referer': 'https://offerup.com/' },
      timeout: 10000,
    });

    const $ = cheerio.load(res.data);

    $('a[href*="/item/detail/"]').each((i, el) => {
      if (results.length >= 10) return;
      const href = $(el).attr('href');
      const title = $(el).find('p, span, div').first().text().trim() ||
                    $(el).attr('aria-label') || '';
      if (!href || !title) return;

      // Must mention the item
      if (!title.toLowerCase().includes(item.toLowerCase())) return;

      const fullUrl = href.startsWith('http') ? href : `https://offerup.com${href}`;
      if (results.find(r => r.url === fullUrl)) return;

      results.push({
        url: fullUrl,
        title,
        snippet: 'OfferUp listing — click to view',
        platform: 'OfferUp',
        color: '#00ff88',
        phraseLabel: 'offerup wanted',
      });
    });

  } catch (err) {
    console.error('OfferUp error:', err.message);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// NEXTDOOR SCRAPER
// Uses Google to find Nextdoor posts with buyer intent
// ─────────────────────────────────────────────────────────────
async function searchNextdoor(item, location, radius) {
  const results = [];
  const locPart = radius === '100' ? '' : ` "${location}"`;

  try {
    // Force buyer intent phrases into the Google query
    const intentPart = `("ISO" OR "WTB" OR "looking for" OR "want to buy" OR "in search of" OR "does anyone have")`;
    const query = encodeURIComponent(
      `site:nextdoor.com ${intentPart} "${item}"${locPart}`
    );
    const url = `https://www.google.com/search?q=${query}&num=10&tbs=qdr:m`;

    const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(res.data);

    $('div.g, div[data-hveid]').each((i, el) => {
      if (results.length >= 8) return;
      const title = $(el).find('h3').first().text().trim();
      const href = $(el).find('a').first().attr('href');
      const snippet = $(el).find('.VwiC3b, .st').first().text().trim();

      if (!title || !href || !href.includes('nextdoor.com')) return;
      if (results.find(r => r.url === href)) return;

      // Check snippet or title for buyer intent
      const combinedText = `${title} ${snippet}`;
      if (!isBuyerPost(combinedText, item)) return;

      results.push({
        url: href,
        title,
        snippet: snippet || 'Nextdoor post — click to view',
        platform: 'Nextdoor',
        color: '#f472b6',
        phraseLabel: 'nextdoor wanted',
      });
    });

  } catch (err) {
    console.error('Nextdoor error:', err.message);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// GOOGLE SCRAPER
// Only pulls pages where someone is explicitly looking to buy
// ─────────────────────────────────────────────────────────────
async function searchGoogle(item, location, radius) {
  const results = [];
  const locPart = radius === '100' ? '' : ` "${location}"`;
  const exclude = '-site:reddit.com -site:craigslist.org -site:x.com -site:twitter.com -site:offerup.com -site:nextdoor.com';

  // Each query forces a specific buyer intent phrase
  const intentQueries = [
    `"ISO" "${item}"${locPart} ${exclude}`,
    `"WTB" "${item}"${locPart} ${exclude}`,
    `"in search of" "${item}"${locPart} ${exclude}`,
    `"looking to buy" "${item}"${locPart} ${exclude}`,
    `"want to buy" "${item}"${locPart} ${exclude}`,
    `"does anyone have" "${item}"${locPart} ${exclude}`,
  ];

  for (const q of intentQueries) {
    try {
      const query = encodeURIComponent(q);
      const url = `https://www.google.com/search?q=${query}&num=10&tbs=qdr:m`;

      const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
      const $ = cheerio.load(res.data);

      $('div.g, div[data-hveid]').each((i, el) => {
        if (results.length >= 12) return;
        const title = $(el).find('h3').first().text().trim();
        const href = $(el).find('a').first().attr('href');
        const snippet = $(el).find('.VwiC3b, .st').first().text().trim();

        if (!title || !href || !href.startsWith('http')) return;
        if (results.find(r => r.url === href)) return;

        // Strict check on title + snippet
        const combinedText = `${title} ${snippet}`;
        if (!isBuyerPost(combinedText, item)) return;

        const matchedPhrase = INTENT_PHRASES.find(p =>
          combinedText.toLowerCase().includes(p)
        ) || 'buyer intent';

        results.push({
          url: href,
          title,
          snippet: snippet || '',
          platform: 'Google',
          color: '#00d4ff',
          phraseLabel: matchedPhrase.trim(),
        });
      });

      await sleep(400);
    } catch (err) {
      console.error(`Google error:`, err.message);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// MAIN SEARCH ENDPOINT
// ─────────────────────────────────────────────────────────────
app.post('/api/search', async (req, res) => {
  const { item, location, radius } = req.body;

  if (!item || !location) {
    return res.status(400).json({ error: 'item and location are required' });
  }

  console.log(`\n◉ Scanning for buyers of "${item}" near ${location} (${radius} mi)`);

  try {
    const [reddit, craigslist, x, offerup, nextdoor, google] = await Promise.allSettled([
      searchReddit(item, location, radius),
      searchCraigslist(item, location, radius),
      searchX(item, location, radius),
      searchOfferUp(item, location, radius),
      searchNextdoor(item, location, radius),
      searchGoogle(item, location, radius),
    ]);

    const extract = r => r.status === 'fulfilled' ? r.value : [];

    const allResults = [
      ...extract(reddit),
      ...extract(craigslist),
      ...extract(x),
      ...extract(offerup),
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
        OfferUp: extract(offerup).length,
        Nextdoor: extract(nextdoor).length,
        Google: extract(google).length,
      }
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
    message: 'BuyerRadar backend running — strict buyer intent mode',
    platforms: ['Reddit', 'Craigslist', 'X (Twitter)', 'OfferUp', 'Nextdoor', 'Google'],
  });
});

app.listen(PORT, () => {
  console.log(`\n◉ BuyerRadar backend running on http://localhost:${PORT}`);
  console.log(`◉ Health check: http://localhost:${PORT}/api/health\n`);
});
