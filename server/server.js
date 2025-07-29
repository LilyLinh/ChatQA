import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import NodeCache from "node-cache";
import OpenAI from "openai";
import yahooFinance from "yahoo-finance2";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const cache = new NodeCache({ stdTTL: 3600 });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// In-memory store for user favorites (keyed by userId)
const userFavorites = new Map();

// Mapping common names or wrong inputs to valid ticker symbols
const SYMBOL_MAP = {
  APPLE: "AAPL",
  GOOGLE: "GOOG",
  ALPHABET: "GOOG",
  TESLA: "TSLA",
  MICROSOFT: "MSFT",
  AMAZON: "AMZN",
  // Add more mappings as needed
};

// 🌍 Detect language
async function detectLanguage(text) {
  try {
    const res = await axios.post(
      `https://translation.googleapis.com/language/translate/v2/detect?key=${GOOGLE_API_KEY}`,
      { q: text }
    );
    return res.data.data.detections[0][0].language;
  } catch (err) {
    // fallback detection service
    try {
      const fallback = await axios.post("https://libretranslate.de/detect", { q: text });
      return fallback.data[0]?.language || "en";
    } catch {
      return "en";
    }
  }
}

// 🌐 Translate text with fallback + caching
async function translateText(text, target = "en") {
  const cacheKey = `trans:${text}:${target}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const res = await axios.post(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`,
      { q: text, target, format: "text" }
    );
    const translated = res.data.data.translations[0].translatedText;
    cache.set(cacheKey, translated);
    return translated;
  } catch (err) {
    try {
      const fallback = await axios.post("https://libretranslate.de/translate", {
        q: text,
        source: "auto",
        target,
        format: "text",
      });
      const translated = fallback.data.translatedText;
      cache.set(cacheKey, translated);
      return translated;
    } catch (innerErr) {
      console.error("❌ Translation failed for:", text);
      return null;
    }
  }
}

// Get current stock price + 6 months history
async function getStockData(symbol) {
  try {
    // Normalize symbol
    symbol = SYMBOL_MAP[symbol.toUpperCase()] || symbol.toUpperCase();

    // Current quote
    const quote = await yahooFinance.quote(symbol);

    // Calculate 6 months ago date
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const period1 = sixMonthsAgo.toISOString().split("T")[0];
    const period2 = new Date().toISOString().split("T")[0];

    // Historical daily data for last 6 months
    const history = await yahooFinance.historical(symbol, {
      period1,
      period2,
      interval: "1d",
    });

    return {
      symbol,
      currentPrice: quote.regularMarketPrice,
      history, // array of daily OHLCV data
    };
  } catch (err) {
    console.error(`Failed to fetch stock data for ${symbol}:`, err);
    return null;
  }
}

// Routes to manage user favorites
app.post("/api/stocks/favorites", (req, res) => {
  const { userId, symbol } = req.body;
  if (!userId || !symbol) {
    return res.status(400).json({ error: "Missing userId or symbol" });
  }

  let favs = userFavorites.get(userId) || [];
  const sym = symbol.toUpperCase();
  if (!favs.includes(sym)) favs.push(sym);
  userFavorites.set(userId, favs);
  res.json({ favorites: favs });
});

app.get("/api/stocks/favorites/:userId", (req, res) => {
  const favs = userFavorites.get(req.params.userId) || [];
  res.json({ favorites: favs });
});

// Route to get stock data
app.get("/api/stocks/:symbol", async (req, res) => {
  try {
    let symbol = req.params.symbol.toUpperCase();
    symbol = SYMBOL_MAP[symbol] || symbol;

    const data = await getStockData(symbol);
    if (!data) {
      return res.status(404).json({ error: `Stock data not found for symbol ${symbol}` });
    }
    res.json(data);
  } catch (error) {
    console.error(`Error fetching stock data for ${req.params.symbol}:`, error);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});

// Chat endpoint with stock trading logic
app.post("/api/chat", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    let { messages, userLang } = req.body;

    console.log("📥 Incoming request body:");
    console.dir(req.body, { depth: null });

    if (!Array.isArray(messages)) {
      throw new Error("Invalid messages format.");
    }

    messages = messages
      .filter((msg) => typeof msg?.content === "string" && msg.content.trim() !== "")
      .map((msg) => ({
        role: msg.role || "user",
        content: msg.content.trim(),
      }));

    if (messages.length === 0) {
      throw new Error("No valid messages to process.");
    }

    const latestMessage = messages[messages.length - 1].content;

    if (!userLang || userLang === "auto") {
      userLang = await detectLanguage(latestMessage);
    }

    // Detect if user asks about trading a stock like "trade AAPL"
    const tradeAskMatch = latestMessage.match(/trade\s+([A-Za-z]{1,5})/i);
    if (tradeAskMatch) {
      const symbol = tradeAskMatch[1].toUpperCase();
      const stockData = await getStockData(symbol);
      if (stockData) {
        // Summarize last 30 days closing prices (customizable)
        const last30Days = stockData.history
          .slice(-30)
          .map((day) => `${day.date.split("T")[0]}: close=${day.close.toFixed(2)}`)
          .join("\n");

        // Add system prompt with stock data for AI context
        messages.push({
          role: "system",
          content: `You are a financial assistant. The user wants to know if it's a good time to trade ${symbol} based on recent data.
Here are the last 30 days closing prices:
${last30Days}

Current price: $${stockData.currentPrice.toFixed(2)}

Please provide a brief analysis considering the 6 months price history and current price.`,
        });
      }
    }

    // Translate user messages to English for OpenAI
    const translatedMessages = await Promise.all(
      messages.map(async (msg) => {
        if (msg.role === "user") {
          const translated = await translateText(msg.content, "en");
          return {
            role: msg.role,
            content: translated || msg.content,
          };
        }
        return msg;
      })
    );

    console.log("🧪 Final messages to OpenAI:");
    console.dir(translatedMessages, { depth: null });

    // OpenAI chat completion streaming
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: translatedMessages,
      stream: true,
    });

    let fullResponse = "";

    for await (const part of stream) {
      const content = part.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        // Translate AI response back to user's language
        const translatedChunk = await translateText(content, userLang);
        res.write(translatedChunk || content);
      }
    }
  } catch (error) {
    console.error("❌ OpenAI error:", error);
    res.write("ERROR: " + (error?.message || "Unknown error"));
  } finally {
    res.end();
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server listening on http://localhost:${PORT}`));
