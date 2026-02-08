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

/* ---------- Convert SvelteKit -> your JSON ---------- */
function convertToSeriesJson(svelteData) {

  if (!svelteData || !svelteData.name || !svelteData.info) {
    throw new Error("Invalid series data extracted");
  }

  const seriesName = svelteData.name
    .replace(/\./g, " ")
    .split("S01")[0]
    .trim();

  const output = {
    series: seriesName,
    info: {}
  };

  for (const key in svelteData.info) {
    const ep = svelteData.info[key];
    if (!ep || !ep.name) continue;

    output.info[key] = {
      name: ep.name.replace(" mkv", ".mkv"),
      streamwish_res: ep.streamwish_res || undefined,
      streamtape_res: ep.streamtape_res || undefined
    };

    // remove empty fields
    Object.keys(output.info[key]).forEach(k => {
      if (!output.info[key][k]) delete output.info[key][k];
    });
  }

  return output;
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

    /* New Series */
    if (!existing) {
      await col.insertOne(finalJson);

      return res.json({
        success: true,
        type: "new",
        addedEpisodes: Object.keys(finalJson.info).length,
        updated: 0
      });
    }

    /* Merge Episodes */
    const merged = { ...existing.info, ...finalJson.info };

    const oldCount = Object.keys(existing.info).length;
    const newCount = Object.keys(merged).length;

    await col.updateOne(
      { series: finalJson.series },
      { $set: { info: merged } }
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
