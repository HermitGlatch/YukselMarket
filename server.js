const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

// --- IP BAN KONTROLÜ (statik dosyalardan ÖNCE çalışmalı, yoksa banlı IP
// index.html'i statik sunucudan doğrudan alır ve bu kontrole hiç uğramaz) ---
// Admin panelinin kendisi hiçbir zaman engellenmez; aksi halde banlı bir IP
// admin panelini de göremez ve kendi banını kaldıramaz.
const BANDAN_MUAF_ON_EKLER = [
  "/admin.html",
  "/admin.js",
  "/admin-login.html",
  "/api/admin-login",
  "/api/ip-loglari",
  "/api/ip-banla",
  "/api/ip-ban-kaldir",
  "/api/ip-loglarini-temizle",
  "/api/banli-ipler",
  "/api/sistem-durumu",
  "/api/telegram-ayarlari",
];

app.use((req, res, next) => {
  if (BANDAN_MUAF_ON_EKLER.some((yol) => req.path.startsWith(yol))) {
    return next();
  }

  const ipBasligi = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  // IPv6'dan IPv4 çıkarımı (::ffff:127.0.0.1 -> 127.0.0.1) ve olası çoklu IP listesinden ilkini al
  const cleanIp = ipBasligi.split(",")[0].trim().replace("::ffff:", "");
  req.cleanIp = cleanIp;

  db.get(`SELECT * FROM banli_ipler WHERE ip = ?`, [cleanIp], (hata, banli) => {
    if (hata) {
      // Veritabanı sorgusu başarısız olsa bile siteyi tamamen kilitlemeyelim
      console.error("Ban kontrolü sırasında hata:", hata.message);
      return next();
    }

    if (banli) {
      return res
        .status(403)
        .send(
          `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Erişim Engellendi</title>
          <style>body{font-family:'Segoe UI',sans-serif;background:#1f4d36;color:#fbf6ec;display:flex;
          align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px;}
          .kutu{max-width:420px;} h1{font-size:26px;margin-bottom:10px;} p{opacity:0.85;line-height:1.6;}</style>
          </head><body><div class="kutu"><h1>🚫 Erişiminiz Engellendi</h1>
          <p>Bu IP adresi (${cleanIp}) yönetici tarafından banlanmıştır. Bir hata olduğunu düşünüyorsanız
          bizimle iletişime geçin.</p></div></body></html>`,
        );
    }

    // Banlı değilse, sadece ana sayfa ziyaretlerini logla (statik dosya/istek
    // spamiyle log tablosunu şişirmemek için)
    if (req.path === "/" || req.path === "/index.html") {
      const tarih = new Date().toISOString();
      db.run(`INSERT INTO ip_loglari (ip_adresi, tarih) VALUES (?, ?)`, [
        cleanIp,
        tarih,
      ]);
    }

    next();
  });
});

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// --- RESİM YÜKLEME AYARI (MULTER) ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "images/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });
app.use("/images", express.static(path.join(__dirname, "images")));

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
const db = new sqlite3.Database("./Organic.db", (hata) => {
  if (hata) {
    console.error("Veri tabanına bağlanırken hata oluştu:", hata.message);
  } else {
    console.log("Organic.db veri tabanına başarıyla bağlanıldı.");
    db.run("PRAGMA foreign_keys = ON");
    tablolariKur();
  }
});

function tablolariKur() {
  // 1. Admin Kullanıcıları Tablosu
  db.run(
    `CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    )`,
    (err) => {
      if (!err) {
        // Varsayılan admin hesabı ekle (Eğer yoksa)
        db.get(
          `SELECT * FROM admin_users WHERE username = 'YUKSEKMARADMIN35qc45'`,
          [],
          (err, row) => {
            if (!row) {
              db.run(
                `INSERT INTO admin_users (username, password) VALUES ('YUKSEKMARADMIN35qc45', '35qc12ADC56')`,
              );
            }
          },
        );
      }
    },
  );

  // 2. Ürünler Tablosu
  db.run(`CREATE TABLE IF NOT EXISTS urunler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        isim TEXT NOT NULL,
        fiyat REAL NOT NULL,
        gorsel TEXT,
        aciklama TEXT
    )`, () => {
    // Tablo daha önceden (aciklama sütunu olmadan) oluşturulmuş olabilir.
    // Var olan veritabanlarında da çalışması için sütunu sonradan eklemeyi deniyoruz;
    // sütun zaten varsa SQLite hata verir, o hatayı sessizce yok sayıyoruz.
    db.run(`ALTER TABLE urunler ADD COLUMN aciklama TEXT`, () => {});
  });

  // 3. Sistem Ayarları (Telegram) Tablosu
  db.run(
    `CREATE TABLE IF NOT EXISTS sistem_ayarlari (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anahtar TEXT UNIQUE,
        deger TEXT
    )`,
    (err) => {
      if (!err) {
        db.run(
          `INSERT OR IGNORE INTO sistem_ayarlari (anahtar, deger) VALUES ('telegram_token', '8505843688:AAFjnEhPqtd121-ciJGtri_Mw4neX6uX84c')`,
        );
        db.run(
          `INSERT OR IGNORE INTO sistem_ayarlari (anahtar, deger) VALUES ('market_chat_id', '6527242600')`,
        );
        db.run(
          `INSERT OR IGNORE INTO sistem_ayarlari (anahtar, deger) VALUES ('kurye_chat_id', '6527242600')`,
        );
      }
    },
  );

  // 4. IP Logları Tablosu
  db.run(`CREATE TABLE IF NOT EXISTS ip_loglari (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_adresi TEXT,
        tarih TEXT
    )`);

  // 5. Banlı IP'ler Tablosu
  db.run(`CREATE TABLE IF NOT EXISTS banli_ipler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL UNIQUE,
    sebep TEXT,
    tarih TEXT
)`);

  // 6. Kategoriler Tablosu (YENİ)
  db.run(
    `CREATE TABLE IF NOT EXISTS kategoriler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        isim TEXT NOT NULL UNIQUE
    )`,
    (err) => {
      if (!err) {
        // Tablo ilk kurulduğunda boşsa örnek kategoriler eklenir (mevcut kategorilere dokunulmaz)
        const varsayilanKategoriler = ["Süt", "Yoğurt", "Peynir", "Tereyağı", "Yumurta"];
        db.get(`SELECT COUNT(*) as adet FROM kategoriler`, [], (e, row) => {
          if (!e && row && row.adet === 0) {
            varsayilanKategoriler.forEach((isim) => {
              db.run(`INSERT OR IGNORE INTO kategoriler (isim) VALUES (?)`, [isim]);
            });
          }
        });
      }
    },
  );

  // 7. Ürün-Kategori İlişki Tablosu (ÇOK-ÇOKA İLİŞKİ / YENİ)
  // Bir ürün birden fazla kategoriye, bir kategori de birden fazla ürüne sahip olabilir.
  db.run(`CREATE TABLE IF NOT EXISTS urun_kategorileri (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        urun_id INTEGER NOT NULL,
        kategori_id INTEGER NOT NULL,
        UNIQUE(urun_id, kategori_id),
        FOREIGN KEY (urun_id) REFERENCES urunler(id) ON DELETE CASCADE,
        FOREIGN KEY (kategori_id) REFERENCES kategoriler(id) ON DELETE CASCADE
    )`);
}

// --- API ENDPOINTLERİ ---

// 1. Admin Login Kapısı
app.post("/api/admin-login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Lütfen kullanıcı adı ve şifre girin.",
      });
  }

  const query = `SELECT * FROM admin_users WHERE username = ? AND password = ?`;
  db.get(query, [username, password], (err, row) => {
    if (err) {
      return res
        .status(500)
        .json({ success: false, message: "Veritabanı hatası." });
    }
    if (row) {
      // Giriş başarılıysa token fırlatıyoruz
      return res.json({
        success: true,
        message: "Giriş başarılı!",
        token: "secure_admin_token_998877",
      });
    } else {
      return res
        .status(401)
        .json({ success: false, message: "Kullanıcı adı veya şifre hatalı!" });
    }
  });
});

// 2. Sistem Durumu ve IP Logları (Admin Panel Canlı Veri)
app.get("/api/sistem-durumu", (istek, cevap) => {
  db.all(
    `SELECT ip_adresi, tarih FROM ip_loglari ORDER BY id DESC LIMIT 5`,
    [],
    (hata, satirlar) => {
      if (hata) return cevap.status(500).json({ hata: hata.message });
      cevap.json({
        tickRate: currentTickRate,
        sonGirisler: satirlar || [],
      });
    },
  );
});

// 3. Telegram Ayarlarını Çekme
app.get("/api/telegram-ayarlari", (istek, cevap) => {
  db.all(`SELECT * FROM sistem_ayarlari`, [], (hata, satirlar) => {
    if (hata) return cevap.status(500).json({ hata: hata.message });
    const ayarlar = {};
    satirlar.forEach((satir) => {
      ayarlar[satir.anahtar] = satir.deger;
    });
    cevap.json(ayarlar);
  });
});

// [KAPI] Tüm Kategorileri Listele
app.get("/api/kategoriler", (istek, cevap) => {
  db.all(`SELECT * FROM kategoriler ORDER BY isim ASC`, [], (hata, satirlar) => {
    if (hata) return cevap.status(500).json({ durum: "hata", mesaj: hata.message });
    cevap.json(satirlar || []);
  });
});

// [KAPI] Yeni Kategori Ekle
app.post("/api/kategori-ekle", (istek, cevap) => {
  const isim = (istek.body.isim || "").trim();
  if (!isim) {
    return cevap.status(400).json({ durum: "hata", mesaj: "Kategori adı boş olamaz!" });
  }
  db.run(`INSERT INTO kategoriler (isim) VALUES (?)`, [isim], function (hata) {
    if (hata) {
      if (hata.message.includes("UNIQUE")) {
        return cevap.json({ durum: "hata", mesaj: "Bu kategori zaten mevcut!" });
      }
      return cevap.status(500).json({ durum: "hata", mesaj: hata.message });
    }
    cevap.json({ durum: "başarılı", mesaj: "Kategori eklendi!", id: this.lastID, isim });
  });
});

// [KAPI] Kategori Sil
app.delete("/api/kategori-sil/:id", (istek, cevap) => {
  const id = istek.params.id;
  db.run(`DELETE FROM kategoriler WHERE id = ?`, [id], function (hata) {
    if (hata) return cevap.status(500).json({ durum: "hata", mesaj: hata.message });
    // İlişkili ürün-kategori bağlarını da temizle (garanti olsun diye manuel siliyoruz)
    db.run(`DELETE FROM urun_kategorileri WHERE kategori_id = ?`, [id], () => {
      cevap.json({ durum: "başarılı", mesaj: "Kategori silindi!" });
    });
  });
});

// 4. Ürün Ekleme (Görsel Yükleme + Çoklu Kategori Destekli)
app.post("/api/urun-ekle", upload.single("urunResmi"), (istek, cevap) => {
  const isim = (istek.body.isim || "").trim();
  const fiyat = Number(istek.body.fiyat);
  const aciklama = (istek.body.aciklama || "").trim();

  // Eski sürümde burada doğrulama yoktu; isim boş veya fiyat geçersiz gönderilirse
  // veritabanı satırı bozuk ekleniyor ve liste/ekleme akışı şaşırtıcı şekilde bozuluyordu.
  if (!isim || !istek.body.fiyat || isNaN(fiyat)) {
    return cevap
      .status(400)
      .json({ durum: "hata", mesaj: "Ürün adı ve geçerli bir fiyat girilmesi zorunludur!" });
  }

  // Kategoriler client tarafından JSON dizi olarak gönderiliyor, örn: "[1,3,7]"
  let kategoriIdleri = [];
  try {
    kategoriIdleri = JSON.parse(istek.body.kategoriler || "[]");
    if (!Array.isArray(kategoriIdleri)) kategoriIdleri = [];
  } catch (e) {
    kategoriIdleri = [];
  }
  kategoriIdleri = kategoriIdleri
    .map((k) => Number(k))
    .filter((k) => Number.isInteger(k) && k > 0);

  let gorselYolu = "images/default.png";
  if (istek.file) {
    gorselYolu = "images/" + istek.file.filename;
  }

  const sorgu = `INSERT INTO urunler(isim, fiyat, gorsel, aciklama) VALUES (?, ?, ?, ?)`;
  db.run(sorgu, [isim, fiyat, gorselYolu, aciklama], function (hata) {
    if (hata) {
      return cevap.status(500).json({ durum: "hata", mesaj: hata.message });
    }
    const yeniUrunId = this.lastID;

    if (kategoriIdleri.length === 0) {
      return cevap.json({
        durum: "başarılı",
        mesaj: "Ürün başarıyla kaydedildi!",
        id: yeniUrunId,
      });
    }

    // Seçilen tüm kategorilerle bağlantı satırlarını ekle (çok-çoka ilişki)
    const eklemeIslemleri = kategoriIdleri.map(
      (katId) =>
        new Promise((resolve) => {
          db.run(
            `INSERT OR IGNORE INTO urun_kategorileri (urun_id, kategori_id) VALUES (?, ?)`,
            [yeniUrunId, katId],
            () => resolve(),
          );
        }),
    );

    Promise.all(eklemeIslemleri).then(() => {
      cevap.json({
        durum: "başarılı",
        mesaj: "Ürün başarıyla kaydedildi!",
        id: yeniUrunId,
      });
    });
  });
});

// [KAPI] Veritabanındaki Tüm Ürünleri Listeleme Kapısı (Kategorili)
app.get("/api/urunler", (istek, cevap) => {
  // Tek sorguda tüm ürünleri kategorileriyle birlikte getiriyoruz (performans için)
  const sorgu = `
    SELECT
      u.id, u.isim, u.fiyat, u.gorsel, u.aciklama,
      GROUP_CONCAT(k.id) as kategori_idleri,
      GROUP_CONCAT(k.isim, '||') as kategori_isimleri
    FROM urunler u
    LEFT JOIN urun_kategorileri uk ON uk.urun_id = u.id
    LEFT JOIN kategoriler k ON k.id = uk.kategori_id
    GROUP BY u.id
    ORDER BY u.id DESC
  `;
  db.all(sorgu, [], (hata, satirlar) => {
    if (hata) {
      console.error("Ürünler getirilemedi:", hata.message);
      return cevap.status(500).json({ durum: "hata", mesaj: hata.message });
    }
    const sonuc = (satirlar || []).map((satir) => ({
      id: satir.id,
      isim: satir.isim,
      fiyat: satir.fiyat,
      gorsel: satir.gorsel,
      aciklama: satir.aciklama || "",
      kategoriler: satir.kategori_idleri
        ? satir.kategori_idleri.split(",").map(Number)
        : [],
      kategoriIsimleri: satir.kategori_isimleri
        ? satir.kategori_isimleri.split("||")
        : [],
    }));
    cevap.json(sonuc); // Boşsa boş array döner, asla HTML dönmez!
  });
});

// [KAPI] Ürün Silme Kapısı
app.delete("/api/urun-sil/:id", (istek, cevap) => {
  const urunId = istek.params.id;

  // Önce ürün-kategori bağlantılarını temizle, sonra ürünü sil
  db.run(`DELETE FROM urun_kategorileri WHERE urun_id = ?`, [urunId], () => {
    db.run(`DELETE FROM urunler WHERE id = ?`, [urunId], function (hata) {
      if (hata) {
        console.error("Ürün silinirken hata oluştu:", hata.message);
        return cevap.status(500).json({ durum: "hata", mesaj: hata.message });
      }
      cevap.json({
        durum: "başarılı",
        mesaj: "Ürün başarıyla veritabanından silindi!",
      });
    });
  });
});
// --- IP YÖNETİMİ İÇİN ENDPOINT'LER ---

// 1. Tüm IP Loglarını Getir (Admin panel için)
app.get("/api/ip-loglari", (req, res) => {
  db.all(`SELECT * FROM ip_loglari ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ hata: err.message });
    res.json(rows || []);
  });
});

// 2. IP Banla
app.post("/api/ip-banla", (req, res) => {
  const { ip, sebep } = req.body;
  if (!ip)
    return res.status(400).json({ durum: "hata", mesaj: "IP adresi gerekli" });

const tarih = new Date().toISOString();  db.run(
    `INSERT INTO banli_ipler (ip, sebep, tarih) VALUES (?, ?, ?)`,
    [ip, sebep || "Yönetici tarafından banlandı", tarih],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.json({ durum: "hata", mesaj: "Bu IP zaten banlı!" });
        }
        return res.status(500).json({ durum: "hata", mesaj: err.message });
      }
      res.json({ durum: "başarılı", mesaj: "IP başarıyla banlandı!" });
    },
  );
});

// 3. IP Banını Kaldır
app.delete("/api/ip-ban-kaldir/:ip", (req, res) => {
  const ip = req.params.ip;
  db.run(`DELETE FROM banli_ipler WHERE ip = ?`, [ip], function (err) {
    if (err) return res.status(500).json({ durum: "hata", mesaj: err.message });
    if (this.changes === 0) {
      return res.json({ durum: "hata", mesaj: "Bu IP banlı değil!" });
    }
    res.json({ durum: "başarılı", mesaj: "IP banı kaldırıldı!" });
  });
});

// 4. Banlı IP Listesini Getir
app.get("/api/banli-ipler", (req, res) => {
  db.all(`SELECT * FROM banli_ipler ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ hata: err.message });
    res.json(rows || []);
  });
});

// 5. IP Loglarını Temizle
app.delete("/api/ip-loglarini-temizle", (req, res) => {
  db.run(`DELETE FROM ip_loglari`, function (err) {
    if (err) return res.status(500).json({ durum: "hata", mesaj: err.message });
    res.json({ durum: "başarılı", mesaj: "Tüm IP logları temizlendi!" });
  });
});
// Sunucuyu Başlat
app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde aktif!`);
});
