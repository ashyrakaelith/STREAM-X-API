const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
});

app.use(limiter);

const BASE_URL = 'https://pornxnow.me';

const axiosInstance = axios.create({
  timeout: 15000,           // Increased timeout
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': BASE_URL,
    'Connection': 'keep-alive'
  }
});

// Retry logic
async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await axiosInstance.get(url);
      return cheerio.load(data);
    } catch (err) {
      console.error(`[Attempt ${i+1}] Failed fetching ${url}: ${err.message}`);
      if (i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, 1500 * (i + 1))); // Backoff
    }
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: "PornXnow.me API (Improved)",
    status: "Running",
    note: "Timeouts were fixed with retries + better headers"
  });
});

app.get('/videos', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const $ = await fetchPage(`${BASE_URL}/page/${page}`);

    const videos = [];
    $('.video-block').each((i, el) => {
      const titleEl = $(el).find('.title');
      const thumbEl = $(el).find('img');
      const durationEl = $(el).find('.duration');
      const viewsEl = $(el).find('.views-number');

      const title = titleEl.text().trim();
      const link = titleEl.closest('a').attr('href') || $(el).find('a.thumb').attr('href');
      const thumbnail = thumbEl.attr('data-src') || thumbEl.attr('src');
      const duration = durationEl.text().trim();
      const views = viewsEl.text().trim();

      if (title && link) {
        videos.push({
          title,
          slug: link.split('/').filter(Boolean).pop(),
          url: link.startsWith('http') ? link : BASE_URL + link,
          thumbnail,
          duration,
          views: views || 'N/A'
        });
      }
    });

    res.json({
      success: true,
      page: parseInt(page),
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
    if (!q) return res.status(400).json({ error: "Missing ?q= parameter" });

    const $ = await fetchPage(`${BASE_URL}/?s=${encodeURIComponent(q)}`);

    const videos = [];
    $('.video-block').each((_, el) => {
      const title = $(el).find('.title').text().trim();
      const link = $(el).find('a.thumb').attr('href');
      const thumb = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
      const duration = $(el).find('.duration').text().trim();

      if (title) {
        videos.push({
          title,
          slug: link.split('/').filter(Boolean).pop(),
          url: link.startsWith('http') ? link : BASE_URL + link,
          thumbnail: thumb,
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
    const $ = await fetchPage(`${BASE_URL}/${slug}/`);

    const title = $('h1').first().text().trim() || $('.infos .title').first().text().trim();
    const thumbnail = $('meta[property="og:image"]').attr('content') || $('.video-img').attr('src');
    const duration = $('.duration').text().trim();
    const views = $('.views-number').text().trim();
    const embed = $('iframe').attr('src') || null;

    res.json({
      success: true,
      title,
      thumbnail,
      duration,
      views,
      embed,
      originalUrl: `${BASE_URL}/${slug}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 PornXnow API v2 running on http://localhost:${PORT}`);
});
