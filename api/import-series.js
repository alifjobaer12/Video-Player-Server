import { MongoClient } from "mongodb";
import { request } from "undici";
import * as cheerio from "cheerio";

/* ---------- GLOBAL CACHE ---------- */
let cachedClient = null;
let lastRequestTime = 0;

/* ---------- MongoDB connection ---------- */
async function connectDB() {
  if (cachedClient) return cachedClient;

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  cachedClient = client;
  return client;
}

/* ---------- Extract Episode Number ---------- */
function getEpNumber(name) {
  const match = name.match(/\b(?:e|ep|episode)\s?(\d+)\b/i);
  return match ? parseInt(match[1], 10) : 0;
}

/* ---------- Convert SvelteKit -> JSON (SORTED) ---------- */
function convertToSeriesJson(svelteData) {
  if (!svelteData || !svelteData.name || !svelteData.info) {
    throw new Error("Invalid series data extracted");
  }

  const seriesName = svelteData.name
    .replace(/\./g, " ")
    .split("S01")[0]
    .trim();

  /* Convert → Array */
  const episodesArray = Object.entries(svelteData.info)
    .map(([key, ep]) => {
      if (!ep || !ep.name) return null;

      return {
        epKey: key,
        epNum: getEpNumber(ep.name),
        data: {
          name: ep.name.replace(" mkv", ".mkv"),
          streamwish_res: ep.streamwish_res || undefined,
          streamtape_res: ep.streamtape_res || undefined
        }
      };
    })
    .filter(Boolean);

  /* Sort ASC */
  episodesArray.sort((a, b) => a.epNum - b.epNum);

  /* Back → Object */
  const sortedInfo = {};

  for (const item of episodesArray) {
    Object.keys(item.data).forEach(k => {
      if (!item.data[k]) delete item.data[k];
    });

    sortedInfo[item.epKey] = item.data;
  }

  return {
    series: seriesName,
    info: sortedInfo
  };
}

/* ---------- MAIN API HANDLER ---------- */
export default async function handler(req, res) {

  /* 🔒 ADMIN SECURITY */
  const adminKey = req.headers["x-admin-key"];
  const routeToken = req.headers["x-route-token"];

  if (
    adminKey !== process.env.ADMIN_SECRET ||
    routeToken !== process.env.ADMIN_ROUTE_TOKEN
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  /* Only POST allowed */
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  /* ⛔ RATE LIMIT (4 sec) */
  if (Date.now() - lastRequestTime < 4000) {
    return res.status(429).json({
      error: "Please wait 4 seconds before next import"
    });
  }
  lastRequestTime = Date.now();

  try {
    const { url } = req.body;
    if (!url)
      return res.status(400).json({ error: "No URL provided" });

    /* ---------- Fetch webpage ---------- */
    const { body } = await request(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    const html = await body.text();

    /* ---------- Extract SvelteKit script ---------- */
    const $ = cheerio.load(html);
    let scriptContent = "";

    $("script").each((_, el) => {
      const text = $(el).html();
      if (text && text.includes("__sveltekit_"))
        scriptContent = text;
    });

    if (!scriptContent)
      return res.status(500).json({
        error: "Player data not found (site blocked request)"
      });

    /* ---------- Extract JSON ---------- */
    const match = scriptContent.match(/data:(\{[\s\S]*?\}),error/);
    if (!match)
      return res.status(500).json({ error: "Parse failed" });

    let svelteData;
    try {
      svelteData = eval("(" + match[1] + ")");
    } catch {
      return res.status(500).json({ error: "Data extraction failed" });
    }

    const finalJson = convertToSeriesJson(svelteData);

    /* ---------- Save to MongoDB ---------- */
    const client = await connectDB();
    const col = client.db("streaming").collection("series");

    const existing = await col.findOne({ series: finalJson.series });

    /* ---------- NEW SERIES ---------- */
    if (!existing) {
      await col.insertOne(finalJson);

      return res.json({
        success: true,
        type: "new",
        addedEpisodes: Object.keys(finalJson.info).length,
        updated: 0
      });
    }

    /* ---------- MERGE + SORT AGAIN ---------- */
    const combined = { ...existing.info, ...finalJson.info };

    const mergedArray = [];

    for (const key in combined) {
      const ep = combined[key];

      mergedArray.push({
        key,
        epNum: getEpNumber(ep.name),
        data: ep
      });
    }

    /* Sort ASC again */
    mergedArray.sort((a, b) => a.epNum - b.epNum);

    /* Rebuild object */
    const mergedSorted = {};
    mergedArray.forEach(item => {
      mergedSorted[item.key] = item.data;
    });

    const oldCount = Object.keys(existing.info).length;
    const newCount = Object.keys(mergedSorted).length;

    await col.updateOne(
      { series: finalJson.series },
      { $set: { info: mergedSorted } }
    );

    return res.json({
      success: true,
      type: "updated",
      addedEpisodes: newCount - oldCount,
      updated: newCount
    });

  } catch (err) {
    console.error("IMPORT ERROR:", err.message);
    return res.status(500).json({ error: "Import failed" });
  }
}