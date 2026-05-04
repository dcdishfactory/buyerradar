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
// BUYER INTENT PHRASES
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

function isBuyerPost(text, item) {
  const t = ` ${text.toLowerCase()} `;
  const hasItem = t.includes(item.toLowerCase());
  const hasIntent = INTENT_PHRASES.some(phrase => t.includes(phrase));
  return hasItem && hasIntent;
}

function getMatchedPhrase(text) {
  const t = ` ${text.toLowerCase()} `;
  return (INTENT_PHRASES.find(p => t.includes(p)) || 'buyer intent').trim();
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
// REDDIT — official free JSON API
// ─────────────────────────────────────────────────────────────
async function searchReddit(item, location, radius) {
  const results = [];
  const locPart = radius === '100' ? '' : ` ${location}`;

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
        if (!isBuyerPost(fullText, item)) return;

        results.push({
          url: postUrl,
          title: d.title,
          snippet: d.selftext ? d.selftext.slice(0, 200) : `r/${d.subreddit} · ${d.score} upvotes`,
          platform: 'Reddit',
          color: '#ff6314',
          phraseLabel: getMatchedPhrase(fullText),
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
// CRAIGSLIST — RSS feeds (reliable, no blocking)
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
    // RSS feed for wanted section — all posts here are buyers by definition
    const url = `https://${subdomain}.craigslist.org/search/wan?query=${query}&format=rss`;

    const res = await axios.get(url, {
      headers: { ...HEADERS, 'Accept': 'application/rss+xml, application/xml, text/xml' },
      timeout: 10000,
    });

    const $ = cheerio.load(res.data, { xmlMode: true });

    $('item').each((i, el) => {
      if (results.length >= 15) return;

      const title = $(el).find('title').first().text().trim();
      const link = $(el).find('link').first().text().trim();
      const description = $(el).find('description').first().text().trim();

      if (!title || !link) return;
      const combined = `${title} ${description}`;
      if (!combined.toLowerCase().includes(item.toLowerCase())) return;
      if (results.find(r => r.url === link)) return;

      results.push({
        url: link,
        title,
        snippet: description ? description.slice(0, 200) : 'Craigslist WANTED post — this person is looking to buy',
        platform: 'Craigslist',
        color: '#a855f7',
        phraseLabel: 'craigslist wanted',
      });
    });

  } catch (err) {
    console.error('Craigslist RSS error:', err.message);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// X (TWITTER) — via Nitter public instances
// ─────────────────────────────────────────────────────────────
async function searchX(item, location, radius) {
  const results = [];

  const nitterInstances = [
    'https://nitter.privacydev.net',
    'https://nitter.poast.org',
    'https://nitter.1d4.us',
    'https://nitter.space',
  ];

  const locPart = radius === '100' ? '' : ` "${location}"`;

  const intentQueries = [
    `"ISO" "${item}"${locPart}`,
    `"WTB" "${item}"${locPart}`,
    `"looking for" "${item}"${locPart}`,
    `"want to buy" "${item}"${locPart}`,
    `"does anyone have" "${item}"${locPart}`,
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
          if (!isBuyerPost(text, item)) return;

          const fullUrl = `https://x.com${link.replace(/^\/[^/]+/, '')}`;
          if (results.find(r => r.url === fullUrl)) return;

          results.push({
            url: fullUrl,
            title: text.slice(0, 100),
            snippet: text.slice(0, 200),
            platform: 'X (Twitter)',
            color: '#e7e7e7',
            phraseLabel: getMatchedPhrase(text),
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
// GOOGLE — via SerpApi
// ─────────────────────────────────────────────────────────────
async function searchGoogle(item, location, radius) {
  const results = [];

  if (!process.env.SERPAPI_KEY) {
    console.error('SERPAPI_KEY not set — skipping Google');
    return results;
  }

  const locPart = radius === '100' ? '' : ` "${location}"`;
  const exclude = '-site:reddit.com -site:craigslist.org -site:x.com -site:twitter.com -site:offerup.com -site:nextdoor.com';

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
      const params = new URLSearchParams({
        api_key: process.env.SERPAPI_KEY,
        engine: 'google',
        q,
        num: '10',
        tbs: 'qdr:m',
        gl: 'us',
        hl: 'en',
      });

      const url = `https://serpapi.com/search.json?${params.toString()}`;
      const res = await axios.get(url, { timeout: 10000 });

      if (res.data.error) {
        console.error('SerpApi error:', res.data.error);
        continue;
      }

      (res.data.organic_results || []).forEach(r => {
        if (!r.link || results.find(x => x.url === r.link)) return;
        const combined = `${r.title || ''} ${r.snippet || ''}`;
        if (!isBuyerPost(combined, item)) return;

        results.push({
          url: r.link,
          title: r.title || 'View Post',
          snippet: r.snippet || '',
          platform: 'Google',
          color: '#00d4ff',
          phraseLabel: getMatchedPhrase(combined),
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
async function searchNextdoor(item, location, radius) {
  const results = [];

  if (!process.env.SERPAPI_KEY) return results;

  const locPart = radius === '100' ? '' : ` "${location}"`;

  try {
    const q = `site:nextdoor.com ("ISO" OR "WTB" OR "looking for" OR "want to buy" OR "in search of" OR "does anyone have") "${item}"${locPart}`;

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
      if (!isBuyerPost(combined, item)) return;

      results.push({
        url: r.link,
        title: r.title || 'Nextdoor Post',
        snippet: r.snippet || 'Nextdoor post — click to view',
        platform: 'Nextdoor',
        color: '#f472b6',
        phraseLabel: getMatchedPhrase(combined),
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
  const { item, location, radius } = req.body;

  if (!item || !location) {
    return res.status(400).json({ error: 'item and location are required' });
  }

  console.log(`\n◉ Scanning for buyers of "${item}" near ${location} (${radius} mi)`);

  try {
    const [reddit, craigslist, x, nextdoor, google] = await Promise.allSettled([
      searchReddit(item, location, radius),
      searchCraigslist(item, location, radius),
      searchX(item, location, radius),
      searchNextdoor(item, location, radius),
      searchGoogle(item, location, radius),
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
        OfferUp: 0,
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
    message: 'BuyerRadar backend running',
    platforms: ['Reddit', 'Craigslist', 'X (Twitter)', 'Nextdoor', 'Google'],
  });
});

app.listen(PORT, () => {
  console.log(`\n◉ BuyerRadar backend running on http://localhost:${PORT}`);
  console.log(`◉ Health check: http://localhost:${PORT}/api/health\n`);
});
