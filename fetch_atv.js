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
            '--disable-web-security', // CORS engellerini aşmak için
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });

    const page = await browser.newPage();
    let m3u8Url = "";

    // Daha gerçekçi bir ekran çözünürlüğü
    await page.setViewport({ width: 1920, height: 1080 });

    // İstekleri dinle
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        if (url.includes('atv-overflow') && url.includes('m3u8')) {
            m3u8Url = url;
            console.log("Yakalanan Link:", url);
        }
        request.continue();
    });

    // Gerçekçi User Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        console.log("ATV Canlı Yayın sayfası yükleniyor...");
        // Referer ekleyerek gitmek bot korumasını bazen şaşırtır
        await page.goto('https://www.atv.com.tr/canli-yayin', { 
            waitUntil: 'networkidle2', 
            timeout: 90000,
            referer: 'https://www.google.com/' 
        });

        console.log("Sayfa etkileşimi simüle ediliyor...");
        // Sayfayı biraz aşağı kaydır (bazı player'lar görünür olunca yüklenir)
        await page.evaluate(() => window.scrollBy(0, 500));
        
        // 20 saniye boyunca linkin düşmesini bekle
        let checkCount = 0;
        while (!m3u8Url && checkCount < 20) {
            await new Promise(r => setTimeout(r, 1000));
            checkCount++;
        }

        if (m3u8Url) {
            console.log("Başarılı! Link kaydediliyor...");
            fs.writeFileSync('atv_link.txt', m3u8Url);
        } else {
            // Hata anında ekran görüntüsü alalım (Neden açılmadığını anlamak için repo'ya kaydedilir)
            await page.screenshot({ path: 'error_screenshot.png' });
            console.error("Link bulunamadı. Ekran görüntüsü alındı.");
            process.exit(1);
        }
    } catch (err) {
        console.error("Hata:", err.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
