const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// --- RESİM YÜKLEME AYARI (MULTER) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'images/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });
app.use('/images', express.static(path.join(__dirname, 'images')));

// --- TICK RATE HESAPLAMA ---
let tickCount = 0;
let currentTickRate = 0;
let lastTickTime = Date.now();
setInterval(() => {
    tickCount++;
    const simdi = Date.now();
    if (simdi - lastTickTime >= 1000) {
        currentTickRate = tickCount;
        tickCount = 0;
        lastTickTime = simdi;
    }
}, 1);

// --- VERİTABANI BAĞLANTI VE TABLO KURUMLARI ---
const db = new sqlite3.Database('./Organic.db', (hata) => {
    if (hata) {
        console.error("Veri tabanına bağlanırken hata oluştu:", hata.message);
    } else {
        console.log("Organic.db veri tabanına başarıyla bağlanıldı.");
        tablolariKur();
    }
});

function tablolariKur() {
    // 1. Admin Kullanıcıları Tablosu
    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    )`, (err) => {
        if (!err) {
            // Varsayılan admin hesabı ekle (Eğer yoksa)
            db.get(`SELECT * FROM admin_users WHERE username = 'admin'`, [], (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO admin_users (username, password) VALUES ('admin', 'admin123')`);
                }
            });
        }
    });

    // 2. Ürünler Tablosu
    db.run(`CREATE TABLE IF NOT EXISTS urunler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        isim TEXT NOT NULL,
        fiyat REAL NOT NULL,
        gorsel TEXT
    )`);

    // 3. Sistem Ayarları (Telegram) Tablosu
    db.run(`CREATE TABLE IF NOT EXISTS sistem_ayarlari (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anahtar TEXT UNIQUE,
        deger TEXT
    )`, (err) => {
        if (!err) {
            db.run(`INSERT OR IGNORE INTO sistem_ayarlari (anahtar, deger) VALUES ('telegram_token', '8505843688:AAFjnEhPqtd121-ciJGtri_Mw4neX6uX84c')`);
            db.run(`INSERT OR IGNORE INTO sistem_ayarlari (anahtar, deger) VALUES ('market_chat_id', '6527242600')`);
            db.run(`INSERT OR IGNORE INTO sistem_ayarlari (anahtar, deger) VALUES ('kurye_chat_id', '6527242600')`);
        }
    });

    // 4. IP Logları Tablosu
    db.run(`CREATE TABLE IF NOT EXISTS ip_loglari (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_adresi TEXT,
        tarih TEXT
    )`);
}

// --- API ENDPOINTLERİ ---

// 1. Admin Login Kapısı
app.post('/api/admin-login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Lütfen kullanıcı adı ve şifre girin.' });
    }

    const query = `SELECT * FROM admin_users WHERE username = ? AND password = ?`;
    db.get(query, [username, password], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        }
        if (row) {
            // Giriş başarılıysa token fırlatıyoruz
            return res.json({ 
                success: true, 
                message: 'Giriş başarılı!', 
                token: 'secure_admin_token_998877' 
            });
        } else {
            return res.status(401).json({ success: false, message: 'Kullanıcı adı veya şifre hatalı!' });
        }
    });
});

// 2. Sistem Durumu ve IP Logları (Admin Panel Canlı Veri)
app.get('/api/sistem-durumu', (istek, cevap) => {
    db.all(`SELECT ip_adresi, tarih FROM ip_loglari ORDER BY id DESC LIMIT 5`, [], (hata, satirlar) => {
        if (hata) return cevap.status(500).json({ hata: hata.message });
        cevap.json({
            tickRate: currentTickRate,
            sonGirisler: satirlar || []
        });
    });
});

// 3. Telegram Ayarlarını Çekme
app.get('/api/telegram-ayarlari', (istek, cevap) => {
    db.all(`SELECT * FROM sistem_ayarlari`, [], (hata, satirlar) => {
        if (hata) return cevap.status(500).json({ hata: hata.message });
        const ayarlar = {};
        satirlar.forEach(satir => { ayarlar[satir.anahtar] = satir.deger; });
        cevap.json(ayarlar);
    });
});

// 4. Ürün Ekleme (Görsel Yükleme Destekli)
app.post('/api/urun-ekle', upload.single('urunResmi'), (istek, cevap) => {
    const { isim, fiyat } = istek.body;
    let gorselYolu = "images/default.png"; 
    if (istek.file) {
        gorselYolu = "images/" + istek.file.filename;
    }

    const sorgu = `INSERT INTO urunler(isim, fiyat, gorsel) VALUES (?, ?, ?)`;
    db.run(sorgu, [isim, fiyat, gorselYolu], function (hata) {
        if (hata) {
            return cevap.status(500).json({ durum: "hata", mesaj: hata.message });
        }
        cevap.json({ durum: "başarılı", mesaj: "Ürün başarıyla kaydedildi!", id: this.lastID });
    });
});

// [KAPI] Veritabanındaki Tüm Ürünleri Listeleme Kapısı
app.get('/api/urunler', (istek, cevap) => {
    const sorgu = `SELECT * FROM urunler ORDER BY id DESC`;
    db.all(sorgu, [], (hata, satirlar) => {
        if (hata) {
            console.error("Ürünler getirilemedi:", hata.message);
            return cevap.status(500).json({ durum: "hata", mesaj: hata.message });
        }
        cevap.json(satirlar || []); // Boşsa boş array döner, asla HTML dönmez!
    });
});

// [KAPI] Ürün Silme Kapısı
app.delete('/api/urun-sil/:id', (istek, cevap) => {
    const urunId = istek.params.id;
    const sorgu = `DELETE FROM urunler WHERE id = ?`;

    db.run(sorgu, [urunId], function (hata) {
        if (hata) {
            console.error("Ürün silinirken hata oluştu:", hata.message);
            return cevap.status(500).json({ durum: "hata", mesaj: hata.message });
        }
        cevap.json({ durum: "başarılı", mesaj: "Ürün başarıyla veritabanından silindi!" });
    });
});

// Sunucuyu Başlat
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde aktif!`);
});