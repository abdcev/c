// server.js
const express = require("express");
const axios = require("axios");

const app = express();

app.get("/yt.php", async (req, res) => {
  try {
    const videoId = req.query.v;
    const channelId = req.query.c;

    let watchUrl = "";

    if (videoId) {
      watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    } else {
      // 1) CANLI ID’Yİ BULALIM
      const liveUrl = `https://www.youtube.com/channel/${channelId}/live`;
      console.log("Fetching LIVE page:", liveUrl);

      const html = await axios.get(liveUrl, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      // "videoId":"xxxxx"
      const idMatch = html.data.match(/"videoId":"([^"]+)"/);

      if (!idMatch) {
        console.log("No videoId found in LIVE page.");
        return res.status(404).send("NoLiveStream");
      }

      const realVideoId = idMatch[1];
      console.log("FOUND LIVE VIDEO ID:", realVideoId);

      watchUrl = `https://www.youtube.com/watch?v=${realVideoId}`;
    }

    // 2) Gerçek video sayfasını indir
    console.log("Fetching WATCH page:", watchUrl);

    const watchHtml = await axios.get(watchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    // hlsManifestUrl’i bulalım
    const regex = /"hlsManifestUrl":"(https:[^"]+?\\.m3u8[^"]*)"/;
    const m3 = watchHtml.data.match(regex);

    if (!m3) {
      return res.status(404).send("NoLiveStream");
    }

    const manifest = m3[1].replace(/\\u0026/g, "&");

    // 3) M3U8 indir
    const m3u8 = await axios.get(manifest, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    return res.send(m3u8.data);

  } catch (err) {
    console.error(err);
    return res.status(500).send("ServerError");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Running on", PORT));
