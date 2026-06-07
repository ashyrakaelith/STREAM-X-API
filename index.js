const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rate Limiter
const limiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 60,            
  message: { error: "Too many requests, please slow down." }
});
app.use(limiter);

const BASE_URL = 'https://pornxnow.me';

// Helper to fetch and parse HTML
async function fetchPage(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    return cheerio.load(data);
  } catch (err) {
    console.error(`[Axios Error] Failed fetching: ${url} | Message: ${err.message}`);
    throw new Error(`Failed to fetch page: ${url}`);
  }
}

// 1. Home / Meta Route
app.get('/', (req, res) => {
  res.json({
    message: "PornXnow.me Unofficial API Connected Successfully",
    endpoints: {
      "/videos": "Latest videos",
      "/videos?page=2": "Paginated videos",
      "/search?q=query": "Search videos",
      "/video/video/slug-here": "Video details"
    }
  });
});

// 2. GET Latest Videos
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

// 3. Search Videos
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

// 4. Get Single Video Details 
// FIXED: Using a pure JavaScript RegExp literal to bypass path-to-regexp library completely!
app.get(/^\/video\/(.+)/, async (req, res) => {
  try {
    // req.params[0] safely grabs everything after /video/ (e.g. "video/slug-title" or "slug-title")
    const fullSlug = req.params[0];
    
    if (!fullSlug) {
      return res.status(400).json({ success: false, error: "Slug parameter is required" });
    }

    const targetUrl = `${BASE_URL}/${fullSlug}`;
    const $ = await fetchPage(targetUrl);

    const title = $('h1').first().text().trim() || $('.title').first().text().trim();
    const thumbnail = $('.video-img').attr('src') || $('meta[property="og:image"]').attr('content');
    const duration = $('.duration').text().trim();
    const views = $('.views-number').text().trim();

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

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 API safely running on http://localhost:${PORT}`);
});