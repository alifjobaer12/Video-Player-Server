import { MongoClient } from "mongodb";
import { request } from "undici";
import * as cheerio from "cheerio";

let cachedClient = null;

/* MongoDB connection (important for Vercel) */
async function connectDB() {
  if (cachedClient) return cachedClient;

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  cachedClient = client;
  return client;
}

/* Convert SvelteKit → your JSON format */
function convertToSeriesJson(svelteData) {

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

    output.info[key] = {
      name: ep.name.replace(" mkv", ".mkv"),
      streamwish_res: ep.streamwish_res || undefined,
      streamtape_res: ep.streamtape_res || undefined
    };

    // remove empty
    Object.keys(output.info[key]).forEach(k => {
      if (!output.info[key][k]) delete output.info[key][k];
    });
  }

  return output;
}

/* MAIN API */
export default async function handler(req, res) {

  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  try {

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No URL provided" });

    /* Fetch webpage (Cloudflare bypass) */
    const { body } = await request(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html"
      }
    });

    const html = await body.text();

    /* Extract script */
    const $ = cheerio.load(html);
    let scriptContent = "";

    $("script").each((i, el) => {
      const text = $(el).html();
      if (text && text.includes("__sveltekit_73wkah.resolve"))
        scriptContent = text;
    });

    if (!scriptContent)
      return res.status(404).json({ error: "SvelteKit script not found" });

    /* Extract JSON */
    const match = scriptContent.match(/data:(\{[\s\S]*?\}),error/);
    if (!match)
      return res.status(500).json({ error: "Parse failed" });

    const svelteData = eval("(" + match[1] + ")");
    const finalJson = convertToSeriesJson(svelteData);

    /* Save to MongoDB */
    const client = await connectDB();
    const db = client.db("streaming");
    const collection = db.collection("series");

    const existing = await collection.findOne({ series: finalJson.series });

    // New series
    if (!existing) {
      await collection.insertOne(finalJson);
      return res.json({ success: true, type: "new" });
    }

    // Merge episodes
    const merged = { ...existing.info, ...finalJson.info };

    await collection.updateOne(
      { series: finalJson.series },
      { $set: { info: merged } }
    );

    res.json({ success: true, type: "updated" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Import failed" });
  }
}
