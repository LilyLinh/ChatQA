import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import NodeCache from "node-cache";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const cache = new NodeCache({ stdTTL: 3600 });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Dublin districts list for simple validation / normalization
const DUBLIN_DISTRICTS = Array.from({ length: 24 }, (_, i) => `Dublin ${i + 1}`);

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

// Simple helper to validate/normalize area names
function normalizeArea(area) {
  if (!area) return "Dublin 1";
  const trimmed = String(area).trim();
  if (DUBLIN_DISTRICTS.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
    const num = parseInt(trimmed.replace(/[^0-9]/g, ""), 10);
    return `Dublin ${isNaN(num) ? 1 : num}`;
  }
  // Fallback to capitalized free text, but keep "Dublin" in name
  return trimmed.toLowerCase().includes("dublin") ? trimmed : `${trimmed}, Dublin`;
}

// Geocode via OpenStreetMap Nominatim
async function geocodeQuery(query, limit = 10) {
  const q = String(query || "Dublin, Ireland");
  const cacheKey = `geocode:${q}:${limit}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(
    q
  )}&limit=${limit}`;
  const res = await axios.get(url, {
    headers: { "User-Agent": "chatQA-travel-bot/1.0 (demo)" },
  });
  cache.set(cacheKey, res.data);
  return res.data;
}

// Chat endpoint: Ireland travel concierge
app.post("/api/chat", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    let { messages, userLang, area } = req.body;

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

    const normalizedArea = normalizeArea(area || "Dublin");

    // Prepend a system instruction to be an Ireland travel concierge
    const systemInstruction = {
      role: "system",
      content:
        `You are "Ireland Travel Concierge", a friendly, QUICK and concise assistant focused ONLY on travel in Ireland. ` +
        `Default location is ${normalizedArea}. If the user mentions Dublin districts (Dublin 1..24), tailor results to that district.\n\n` +
        `IMPORTANT: Be FAST and CONCISE. Give direct, actionable answers.\n\n` +
        `Guidelines:\n` +
        `- Provide curated lists for: hotels, restaurants, pubs/nightlife, attractions, day trips, and events.\n` +
        `- Keep each item SHORT: name, 1-line reason, and link. Use Google Maps or official sites.\n` +
        `- For lists, provide exactly 5-8 items maximum.\n` +
        `- Use bullet points for quick scanning.\n` +
        `- Include handy quick links when relevant: \n` +
        `  Hotels: https://www.booking.com/searchresults.html?ss=${encodeURIComponent(normalizedArea + ", Ireland")} \n` +
        `  Things to do: https://www.getyourguide.com/s/?q=${encodeURIComponent(normalizedArea)}&lc=l184 \n` +
        `  Food delivery: https://www.just-eat.ie/ or https://deliveroo.ie/ \n` +
        `  Transport: https://www.transportforireland.ie/plan-a-journey/ \n` +
        `- Refuse non-Ireland travel topics.\n` +
        `- Be unbiased and don't fabricate prices. When unsure, provide search links.`,
    };

    messages = [systemInstruction, ...messages];

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

    // OpenAI chat completion streaming - optimized for speed
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Faster model for quicker responses
      messages: translatedMessages,
      stream: true,
      max_tokens: 800, // Limit response length for faster generation
      temperature: 0.7, // Balanced creativity and consistency
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

// Structured itinerary generation
app.post("/api/itinerary", async (req, res) => {
  try {
    const { area, days = 3, startDate, preferences = {}, userLang = "en" } = req.body || {};
    const normalizedArea = normalizeArea(area || "Dublin");

    const sys = {
      role: "system",
      content:
        `You are a meticulous Ireland trip planner. Create a JSON itinerary only, no extra text. ` +
        `Focus on ${normalizedArea}. Use walking/public transport by default. Avoid exact prices.`,
    };
    const user = {
      role: "user",
      content:
        `Please create a ${days}-day itinerary starting ${startDate || "soon"} for ${normalizedArea}.\n` +
        `Preferences: ${JSON.stringify(preferences)}\n` +
        `Respond with STRICT JSON matching this TypeScript type:\n` +
        `type Itinerary = {\n` +
        `  title: string;\n` +
        `  summary: string;\n` +
        `  days: Array<{ day: number; title: string; description: string; items: Array<{ time?: string; name: string; note?: string; address?: string; map_url?: string; official_url?: string; }> }>;\n` +
        `  booking_suggestions: Array<{ label: string; url: string }>;\n` +
        `};\n` +
        `Rules: Provide valid JSON only. Do not include markdown fences. Use Google Maps links for map_url when possible. Use official URLs if known, otherwise omit.`,
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [sys, user],
      temperature: 0.7,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";

    let json = null;
    try {
      json = JSON.parse(raw);
    } catch {
      // Attempt to extract JSON block if model added text
      const match = raw.match(/\{[\s\S]*\}$/);
      if (match) {
        json = JSON.parse(match[0]);
      }
    }

    if (!json) {
      return res.status(200).json({ raw });
    }

    // Optional translate title/summary for user language
    if (userLang && userLang !== "en") {
      try {
        json.title = (await translateText(json.title, userLang)) || json.title;
        json.summary = (await translateText(json.summary, userLang)) || json.summary;
      } catch {}
    }

    res.json(json);
  } catch (err) {
    console.error("/api/itinerary error", err);
    res.status(500).json({ error: "Failed to generate itinerary" });
  }
});

// Simple geocode proxy
app.get("/api/geo/geocode", async (req, res) => {
  try {
    const q = req.query.q || "Dublin, Ireland";
    const results = await geocodeQuery(q, Number(req.query.limit) || 10);
    res.json(results);
  } catch (err) {
    console.error("/api/geo/geocode error", err);
    res.status(500).json({ error: "Failed to geocode" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server listening on http://localhost:${PORT}`));
