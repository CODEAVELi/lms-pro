import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT ?? 4000;
const API_KEY = process.env.NFL_ODDS_API_KEY;
const API_BASE_URL =
  process.env.NFL_ODDS_API_BASE_URL ??
  'https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds';

if (!API_KEY) {
  console.warn(
    '[lms-pro] NFL_ODDS_API_KEY is not set. /api/odds requests will fail until it is provided.'
  );
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

const americanOddsToProbability = (price) => {
  if (typeof price !== 'number') {
    return null;
  }
  if (price > 0) {
    return 100 / (price + 100);
  }
  if (price < 0) {
    return -price / (-price + 100);
  }
  return null;
};

const sanitizeOddsData = (events) => {
  if (!Array.isArray(events)) {
    return [];
  }

  return events.map((event) => {
    const homeTeam = event.home_team ?? event.homeTeam ?? null;
    const awayTeam = event.away_team ?? event.awayTeam ?? null;

    const bookmaker = Array.isArray(event.bookmakers)
      ? event.bookmakers[0]
      : null;
    const market = bookmaker && Array.isArray(bookmaker.markets)
      ? bookmaker.markets.find((entry) => entry.key === 'h2h') ??
        bookmaker.markets[0]
      : null;

    const outcomes = market && Array.isArray(market.outcomes)
      ? market.outcomes
      : [];

    const probabilityMap = {};
    outcomes.forEach((outcome) => {
      const name = outcome.name ?? outcome.team ?? null;
      const rawProb =
        americanOddsToProbability(outcome.price ?? outcome.odds ?? null) ??
        null;
      if (name && rawProb) {
        probabilityMap[name] = rawProb;
      }
    });

    // Normalize probabilities if possible so they sum to ~1.
    const totalProb = Object.values(probabilityMap).reduce(
      (sum, value) => sum + value,
      0
    );
    if (totalProb > 0) {
      Object.keys(probabilityMap).forEach((teamName) => {
        probabilityMap[teamName] = probabilityMap[teamName] / totalProb;
      });
    }

    return {
      id: event.id ?? event.event_id ?? null,
      commenceTime: event.commence_time ?? event.commenceTime ?? null,
      homeTeam,
      awayTeam,
      probabilities: probabilityMap
    };
  });
};

const buildApiUrl = (query) => {
  const params = new URLSearchParams({
    regions: 'us',
    markets: 'h2h',
    oddsFormat: 'american',
    bookmakers: process.env.NFL_ODDS_BOOKMAKER ?? 'draftkings',
    ...query
  });

  // The Odds API expects the key as a query parameter.
  params.set('apiKey', API_KEY);
  return `${API_BASE_URL}?${params.toString()}`;
};

app.get('/api/odds', async (req, res) => {
  const { week } = req.query;

  if (!API_KEY) {
    res.status(500).json({
      error:
        'NFL_ODDS_API_KEY is not configured on the server. Add it to your .env file.'
    });
    return;
  }

  try {
    const url = buildApiUrl(req.query);
    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text();
      res.status(response.status).json({
        error: 'Upstream odds API request failed.',
        status: response.status,
        body
      });
      return;
    }

    const payload = await response.json();
    const sanitized = sanitizeOddsData(payload);

    res.json({
      requestedAt: new Date().toISOString(),
      week: week ? Number.parseInt(week, 10) || null : null,
      count: sanitized.length,
      events: sanitized
    });
  } catch (error) {
    console.error('Unable to fetch odds data', error);
    res.status(500).json({
      error: 'Unexpected server error while requesting odds.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.listen(PORT, () => {
  console.log(`[lms-pro] Odds backend listening on http://localhost:${PORT}`);
});
