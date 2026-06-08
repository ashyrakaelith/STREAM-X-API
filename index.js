const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // ✅ Important for hosting platforms

app.use(cors());
app.use(express.json());

// Rate Limiter Fix
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
});

app.use(limiter);

const BASE_URL = 'https://pornxnow.me';

const axiosInstance = axios.create({
  timeout: 20000, // 20 seconds
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': BASE_URL,
    'Cache-Control': 'no-cache',
  }
});

// Enhanced fetch with retries
async function fetchPage(url, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[Attempt ${i+1}] Fetching: ${url}`);
      const { data } = await axiosInstance.get(url);
      return cheerio.load(data);
    } catch (err) {
      console.error(`[Attempt ${i+1}] Failed ${url}: ${err.message}`);
      if (i === retries - 1) throw err;
      
      // Progressive backoff
      const delay = 2000 * (i + 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: "PornXnow.me API - Fixed",
    status: "Running",
    fixes: ["trust proxy enabled", "better retries", "20s timeout"]
  });
});

app.get('/videos', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const $ = await fetchPage(`${BASE_URL}/page/${page}`);

    const videos = [];
    $('.video-block').each((_, el) => {
      const title = $(el).find('.title').text().trim();
      const link = $(el).find('a.thumb').attr('href') || $(el).find('.infos a').attr('href');
      const thumbnail = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
      const duration = $(el).find('.duration').text().trim();
      const views = $(el).find('.views-number').text().trim();

      if (title && link) {
        videos.push({
          title,
          slug: link.split('/').filter(Boolean).pop(),
          url: link.startsWith('http') ? link : BASE_URL + link,
          thumbnail: thumbnail?.startsWith('http') ? thumbnail : BASE_URL + thumbnail,
          duration: duration || 'N/A',
          views: views || 'N/A'
        });
      }
    });

    res.json({
      success: true,
      page,
      count: videos.length,
      videos
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch videos",
      message: err.message
    });
  }
});

app.get('/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Missing ?q=" });

    const $ = await fetchPage(`${BASE_URL}/?s=${encodeURIComponent(q)}`);

    const videos = [];
    $('.video-block').each((_, el) => {
      const title = $(el).find('.title').text().trim();
      const link = $(el).find('a.thumb').attr('href');
      const thumbnail = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
      const duration = $(el).find('.duration').text().trim();

      if (title && link) {
        videos.push({
          title,
          slug: link.split('/').filter(Boolean).pop(),
          url: link.startsWith('http') ? link : BASE_URL + link,
          thumbnail,
          duration
        });
      }
    });

    res.json({ success: true, query: q, count: videos.length, videos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/video/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const $ = await fetchPage(`${BASE_URL}/${slug}`);

    const title = $('h1').first().text().trim() || $('.title').first().text().trim();
    const thumbnail = $('meta[property="og:image"]').attr('content') || $('.video-img').attr('src');
    const duration = $('.duration').text().trim();
    const views = $('.views-number').text().trim();
    const embed = $('iframe').attr('src');

    res.json({
      success: true,
      title: title || 'Untitled',
      thumbnail,
      duration: duration || 'N/A',
      views: views || 'N/A',
      embed,
      originalUrl: `${BASE_URL}/${slug}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 PornXnow API v3 running on port ${PORT}`);
  console.log(`✅ trust proxy enabled | Better retries active`);
});
