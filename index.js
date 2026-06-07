const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// FIX 1: Tell Express to trust the Railway reverse proxy setup.
// This resolves the 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR' validation warning.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// Production Ready Rate Limiter
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60,            // Limit each IP to 60 requests per window
  message: { error: "Too many requests, please slow down." }
});
app.use(limiter);

const BASE_URL = 'https://pornxnow.me';

// Helper to fetch and parse HTML safely from production servers
async function fetchPage(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 12000, // 12-second timeout to handle high-latency scrape cycles
      headers: {
        // FIX 2: Emulate an exact Chrome browser profile down to the fetch metadata.
        // This stops Cloudflare from throwing 524 timeouts on cloud data center IPs.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    return cheerio.load(data);
  } catch (err) {
    console.error(`[Axios Error] Failed fetching: ${url} | Message: ${err.message}`);
    throw new Error(`Cloud connection error or target timeout: ${err.message}`);
  }
}

// 1. Root Information Entry
app.get('/', (req, res) => {
  res.json({
    message: "PornXnow.me Unofficial API Connected Successfully",
    status: "Active",
    environment: process.env.NODE_ENV || "production"
  });
});

// 2. Fetch Latest Paginated Videos
app.get('/videos', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const $ = await fetchPage(`${BASE_URL}/page/${page}`);

    const videos = [];
    $('.video-block').each((i, el) => {
      const title = $(el).find('.title').text().trim();
      const link = $(el).find('a.thumb').attr('href') || '';
      const thumb = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
      const duration = $(el).find('.duration').text().trim();
      const views = $(el).find('.views-number').text().trim();

      const cleanSlug = link.replace(BASE_URL, '').replace(/^\/+|\/+$/g, '');

      if (title && cleanSlug) {
        videos.push({
          title,
          slug: cleanSlug,
          url: link.startsWith('http') ? link : `${BASE_URL}/${cleanSlug}`,
          thumbnail: thumb,
          duration,
          views
        });
      }
    });

    res.json({ success: true, page: parseInt(page), count: videos.length, videos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Search Engine Lookup
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Query parameter 'q' is required" });

    const $ = await fetchPage(`${BASE_URL}/?s=${encodeURIComponent(query)}`);

    const videos = [];
    $('.video-block').each((i, el) => {
      const title = $(el).find('.title').text().trim();
      const link = $(el).find('a.thumb').attr('href') || '';
      const thumb = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
      const duration = $(el).find('.duration').text().trim();

      const cleanSlug = link.replace(BASE_URL, '').replace(/^\/+|\/+$/g, '');

      if (title && cleanSlug) {
        videos.push({
          title,
          slug: cleanSlug,
          url: link.startsWith('http') ? link : `${BASE_URL}/${cleanSlug}`,
          thumbnail: thumb,
          duration
        });
      }
    });

    res.json({ success: true, query, count: videos.length, videos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Single Video Stream Details
// FIX 3: Uses a clean native JavaScript RegExp pattern matching rule.
// This completely bypasses 'path-to-regexp' to guarantee total compatibility across Express v4 and v5 layouts.
app.get(/^\/video\/(.+)/, async (req, res) => {
  try {
    const fullSlug = req.params[0];
    
    if (!fullSlug) {
      return res.status(400).json({ success: false, error: "Slug parameter path is missing or invalid" });
    }

    const targetUrl = `${BASE_URL}/${fullSlug}`;
    const $ = await fetchPage(targetUrl);

    const title = $('h1').first().text().trim() || $('.title').first().text().trim();
    const thumbnail = $('.video-img').attr('src') || $('meta[property="og:image"]').attr('content');
    const duration = $('.duration').text().trim();
    const views = $('.views-number').text().trim();

    // Pull video player link out of internal wrapper targets
    let embed = $('iframe').attr('src') || $('iframe').attr('data-src') || null;

    res.json({
      success: true,
      title,
      slug: fullSlug,
      thumbnail,
      duration,
      views,
      embed,
      originalUrl: targetUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fire up listeners
app.listen(PORT, () => {
  console.log(`🚀 API safely running on port ${PORT}`);
});
