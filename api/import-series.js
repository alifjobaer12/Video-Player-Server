import { MongoClient } from "mongodb";
import { request } from "undici";
import * as cheerio from "cheerio";

let cachedClient = null;

async function connectDB() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

function convertToSeriesJson(svelteData) {
  if (!svelteData?.name || !svelteData?.info) {
    throw new Error("Invalid SvelteKit data");
  }

  const seriesName = svelteData.name
    .replace(/\./g, " ")
    .split("S01")[0]
    .trim();

  const output = { series: seriesName, info: {} };

  for (const key in svelteData.info) {
    const ep = svelteData.info[key];
    if (!ep?.name) continue;

    output.info[key] = {
      name: ep.name.replace(" mkv", ".mkv"),
      streamwish_res: ep.streamwish_res || undefined,
      streamtape_res: ep.streamtape_res || undefined,
    };

    Object.keys(output.info[key]).forEach(k => {
      if (!output.info[key][k]) delete output.info[key][k];
    });
  }

  return output;
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No URL provided" });

    // 1️⃣ Fetch page (browser-like headers)
    const { body } = await request(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });

    const html = await body.text();

    // 2️⃣ Parse HTML
    const $ = cheerio.load(html);
    let scriptContent = "";

    $("script").each((_, el) => {
      const t = $(el).html();
      if (t && t.includes("__sveltekit_")) {
        scriptContent = t;
      }
    });

    if (!scriptContent)
      return res.status(500).json({
        error: "Player data not found (Cloudflare / blocked)",
      });

    // 3️⃣ Extract JSON safely
    const match = scriptContent.match(/data:(\{[\s\S]*?\}),error/);
    if (!match)
      return res.status(500).json({ error: "Parse failed" });

    let svelteData;
    try {
      svelteData = eval("(" + match[1] + ")");
    } catch {
      return res.status(500).json({ error: "Eval failed" });
    }

    const finalJson = convertToSeriesJson(svelteData);

    // 4️⃣ Save to MongoDB
    const client = await connectDB();
    const col = client.db("streaming").collection("series");

    const existing = await col.findOne({ series: finalJson.series });

    if (!existing) {
      await col.insertOne(finalJson);
      return res.json({
        success: true,
        type: "new",
        addedEpisodes: Object.keys(finalJson.info).length,
        updated: 0,
      });
    }

    const merged = { ...existing.info, ...finalJson.info };
    const oldCount = Object.keys(existing.info).length;
    const newCount = Object.keys(merged).length;

    await col.updateOne(
      { series: finalJson.series },
      { $set: { info: merged } },
    );

    res.json({
      success: true,
      type: "updated",
      addedEpisodes: newCount - oldCount,
      updated: newCount,
    });

  } catch (err) {
    console.error("IMPORT ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
}
