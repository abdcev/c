const express = require("express");
const puppeteer = require("puppeteer");
const app = express();

let currentM3U8 = null;

async function fetchM3U8() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto("https://www.atv.com.tr/canli-yayin", { waitUntil: "networkidle2" });

  const m3u8Link = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll("script"));
    for (let script of scripts) {
      if (script.textContent.includes(".m3u8")) {
        const match = script.textContent.match(/https:\/\/[^"]+\.m3u8[^"]*/);
        if (match) return match[0];
      }
    }
    return null;
  });

  await browser.close();
  if (m3u8Link) currentM3U8 = m3u8Link;
}

setInterval(fetchM3U8, 5 * 60 * 1000);
fetchM3U8();

app.get("/stream.m3u8", (req, res) => {
  if (!currentM3U8) return res.status(503).send("Not ready.");
  res.redirect(currentM3U8);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
