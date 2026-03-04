const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  let m3u8Url = "";

  // Sayfadaki ağ isteklerini dinle
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('atv-overflow') && url.includes('m3u8') && url.includes('st=')) {
      m3u8Url = url;
    }
    request.continue();
  });

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  
  try {
    await page.goto('https://www.atv.com.tr/canli-yayin', { waitUntil: 'networkidle2', timeout: 60000 });
    // Sayfanın biraz yüklenmesini bekle (JS'nin linki oluşturması için)
    await new Promise(r => setTimeout(r, 10000)); 

    if (m3u8Url) {
      console.log("Link bulundu:", m3u8Url);
      fs.writeFileSync('atv_link.txt', m3u8Url);
    } else {
      console.log("Maalesef link bulunamadı.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Hata:", err);
    process.exit(1);
  }

  await browser.close();
})();
