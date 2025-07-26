const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Load environment variables

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Yelp + OpenCage API Keys
const YELP_API_KEY = process.env.YELP_API_KEY || "your-yelp-api-key-here";
const GEOCODE_API_KEY = process.env.GEOCODE_API_KEY || "your-opencage-api-key-here";

// Mood to Yelp categories mapping
const MOOD_CATEGORIES = {
  comfort: ['comfortfood', 'southern'],
  spicy: ['thai', 'indpak', 'mexican'],
  budget: ['foodtrucks', 'hotdogs', 'cheap'],
  fancy: ['steak', 'french', 'sushi'],
  clean: ['vegan', 'salad', 'healthy'],
  sweet: ['desserts', 'cupcakes', 'icecream'],
  random: [] // No filter
};

// ✅ Existing API: Direct coordinate-based search
app.post('/api/search', async (req, res) => {
  const { latitude, longitude, radius, categories } = req.body;

  if (!latitude || !longitude || !radius || !categories) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
      headers: {
        Authorization: `Bearer ${YELP_API_KEY}`
      },
      params: {
        latitude,
        longitude,
        radius,
        term: 'restaurants',
        term: categories.join(', '),
        limit: 20,
        sort_by: 'best_match'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error("Yelp API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch data from Yelp." });
  }
});

// ✅ NEW API: Mood + ZIP search
app.post('/api/mood-search', async (req, res) => {
  const { mood, zip } = req.body;

  if (!mood || !zip) {
    return res.status(400).json({ error: "Mood and ZIP code are required." });
  }

  try {
    // 1. Convert ZIP to coordinates
    const geoRes = await axios.get(`https://api.opencagedata.com/geocode/v1/json`, {
      params: {
        q: zip,
        key: GEOCODE_API_KEY,
        countrycode: 'us'
      }
    });

    const geoData = geoRes.data;
    if (!geoData.results.length) {
      return res.status(400).json({ error: 'Invalid ZIP code.' });
    }

    const { lat, lng } = geoData.results[0].geometry;
    const categories = MOOD_CATEGORIES[mood] || [];
    const categoryStr = categories.join(',');

    // 2. Query Yelp API
    const yelpRes = await axios.get('https://api.yelp.com/v3/businesses/search', {
      headers: {
        Authorization: `Bearer ${YELP_API_KEY}`
      },
      params: {
        latitude: lat,
        longitude: lng,
        categories: categoryStr,
        term: 'restaurants',
        limit: 10,
        sort_by: 'best_match'
      }
    });

    res.json(yelpRes.data.businesses);
  } catch (error) {
    console.error("Mood ZIP Yelp Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to perform mood-based search." });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🌐 RandomNoms server running at http://localhost:${port}`);
});
