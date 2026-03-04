const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log("Tarayıcı başlatılıyor...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    });

    const page = await browser.newPage();
    let m3u8Url = "";

    // Ağ isteklerini izle
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        // ATV'nin ana yayın link kalıbını yakala
        if (url.includes('atv-overflow') && url.includes('m3u8') && url.includes('st=')) {
            m3u8Url = url;
        }
        request.continue();
    });

    // Kendimizi gerçek bir tarayıcı gibi tanıtalım
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'tr-TR,tr;q=0.9' });

    try {
        console.log("ATV Canlı Yayın sayfası yükleniyor...");
        await page.goto('https://www.atv.com.tr/canli-yayin', { 
            waitUntil: 'networkidle2', 
            timeout: 90000 
        });

        // Player'ın yüklenmesi ve linkin oluşması için 15 saniye bekle
        await new Promise(r => setTimeout(r, 15000));

        if (m3u8Url) {
            console.log("Başarılı! Link bulundu:", m3u8Url);
            fs.writeFileSync('atv_link.txt', m3u8Url);
        } else {
            console.error("Hata: Link bulunamadı. Sayfa yapısı değişmiş veya bot engeline takılmış olabilir.");
            process.exit(1);
        }
    } catch (err) {
        console.error("Bir hata oluştu:", err.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
