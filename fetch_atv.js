const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log("Tarayıcı başlatılıyor (API Modu)...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    let m3u8Url = "";

    // Gerçekçi bir User Agent şart
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Ağ trafiğini dinle ama sadece m3u8 içerenleri logla
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('atv-overflow') && url.includes('m3u8')) {
            m3u8Url = url;
            console.log("Link Yakalandı: ", url);
        }
    });

    try {
        // Doğrudan yayın sayfasını değil, bazen iframe içindeki player'ı hedeflemek gerekir
        // Ama önce ana sayfadan bir kez daha deneyelim
        console.log("Veri çekiliyor...");
        await page.goto('https://www.atv.com.tr/canli-yayin', { 
            waitUntil: 'networkidle0', 
            timeout: 60000 
        });

        // Eğer hala bulunamadıysa, sayfadaki player elementini tetikleyelim
        if (!m3u8Url) {
            console.log("Player tetikleniyor...");
            await page.evaluate(() => {
                const video = document.querySelector('video');
                if (video) video.play();
            });
            await new Promise(r => setTimeout(r, 10000));
        }

        if (m3u8Url) {
            fs.writeFileSync('atv_link.txt', m3u8Url);
            console.log("İşlem Başarılı.");
        } else {
            // Eğer hala bulamazsa, ATV'nin statik API yapısını deneyelim
            console.log("Alternatif metod deneniyor...");
            // Bu kısım ATV'nin arkada kullandığı token servisidir
            // Genelde şu formatta olur: https://trkvz-live.daioncdn.net/atv/atv.m3u8? ...
            // Eğer yakalayamıyorsak GitHub IP'si tamamen yasaklanmış olabilir.
            throw new Error("Link hiçbir şekilde yakalanamadı.");
        }

    } catch (err) {
        console.error("Hata ayrıntısı:", err.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
