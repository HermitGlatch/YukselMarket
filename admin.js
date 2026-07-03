// admin.js - KATEGORİ DESTEKLİ TAM SÜRÜM
let tumKategoriler = []; // Sunucudan çekilen tüm kategoriler (cache)
let tumUrunler = []; // Sunucudan çekilen tüm ürünler (cache) - filtre client-side çalışır
let adminSecilenFiltreler = []; // Ürün tablosu için seçili kategori id'leri (admin filtresi)
let yeniUrunSecilenKategoriler = []; // Yeni ürün eklerken işaretlenen kategori id'leri

document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("admin_token") !== "secure_admin_token_998877") {
    alert("Yetkisiz erişim! Lütfen giriş yapın.");
    window.location.href = "admin-login.html";
    return;
  }

  document.getElementById("adminBody").style.display = "block";
  telegramAyarlariniGetir();
  kategorileriGetir().then(() => {
    urunleriListele();
  });
  setInterval(sistemDurumunuGuncelle, 1000);
  sistemDurumunuGuncelle();
  // IP yönetim fonksiyonlarını da çağır
  ipLoglariniGetir();
  banliIpleriGetir();
});

function telegramAyarlariniGetir() {
  fetch("/api/telegram-ayarlari")
    .then((res) => res.json())
    .then((data) => {
      document.getElementById("keyToken").innerText =
        data.telegram_token || "Bulunamadı";
      document.getElementById("keyMarket").innerText =
        data.market_chat_id || "Bulunamadı";
      document.getElementById("keyKurye").innerText =
        data.kurye_chat_id || "Bulunamadı";
    })
    .catch((err) => console.error("Ayarlar çekilemedi:", err));
}

function sistemDurumunuGuncelle() {
  fetch("/api/sistem-durumu")
    .then((res) => res.json())
    .then((data) => {
      const tickRateEl = document.getElementById("tickRate");
      if (tickRateEl) {
        tickRateEl.innerText = data.tickRate + " Hz";
      }
    })
    .catch((err) => console.error("Sistem durumu güncellenemedi:", err));
}

// === KATEGORİ YÖNETİMİ ===

function kategorileriGetir() {
  return fetch("/api/kategoriler")
    .then((res) => res.json())
    .then((data) => {
      tumKategoriler = data || [];
      kategoriListesiniCiz();
      urunEkleKategoriKutulariniCiz();
      adminFiltreKutulariniCiz();
    })
    .catch((err) => {
      console.error("Kategoriler alınamadı:", err);
    });
}

function kategoriListesiniCiz() {
  const container = document.getElementById("kategoriListesi");
  if (!container) return;

  if (tumKategoriler.length === 0) {
    container.innerHTML = `<p style="color:#999;">Henüz kategori eklenmemiş. Yukarıdan ekleyin.</p>`;
    return;
  }

  container.innerHTML = tumKategoriler
    .map(
      (kat) => `
                <span class="kategori-tag" style="cursor:default;">
                    ${kat.isim}
                    <span class="sil-x" onclick="kategoriSil(${kat.id}, '${kat.isim.replace(/'/g, "\\'")}')" title="Kategoriyi Sil">&times;</span>
                </span>
            `,
    )
    .join("");
}

function kategoriEkle() {
  const input = document.getElementById("yeniKategoriAdi");
  const isim = input.value.trim();
  if (!isim) {
    alert("Lütfen bir kategori adı girin!");
    return;
  }

  fetch("/api/kategori-ekle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isim }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.durum === "başarılı") {
        input.value = "";
        kategorileriGetir();
      } else {
        alert("❌ " + data.mesaj);
      }
    })
    .catch((err) => {
      console.error("Kategori eklenemedi:", err);
      alert("❌ Sunucu hatası!");
    });
}

function kategoriSil(id, isim) {
  if (
    !confirm(
      `"${isim}" kategorisini silmek istediğinize emin misiniz?\nBu kategoriye ait ürün etiketleri de kaldırılacak (ürünler silinmez).`,
    )
  )
    return;

  fetch(`/api/kategori-sil/${id}`, { method: "DELETE" })
    .then((res) => res.json())
    .then((data) => {
      if (data.durum === "başarılı") {
        adminSecilenFiltreler = adminSecilenFiltreler.filter((k) => k !== id);
        kategorileriGetir().then(() => urunleriListele());
      } else {
        alert("❌ " + data.mesaj);
      }
    })
    .catch((err) => {
      console.error("Kategori silinemedi:", err);
      alert("❌ Sunucu hatası!");
    });
}

// === ÜRÜN EKLEME FORMU - KATEGORİ CHECKBOX'LARI ===

function urunEkleKategoriKutulariniCiz() {
  const container = document.getElementById("productCategoryCheckboxes");
  if (!container) return;

  if (tumKategoriler.length === 0) {
    container.innerHTML = `<p style="color:#999; margin:0;">Önce "Kategori Yönetimi" bölümünden kategori ekleyin.</p>`;
    return;
  }

  container.innerHTML = tumKategoriler
    .map(
      (kat) => `
                <label class="checkbox-kategori">
                    <input type="checkbox" value="${kat.id}" ${yeniUrunSecilenKategoriler.includes(kat.id) ? "checked" : ""} onchange="yeniUrunKategoriToggle(${kat.id}, this.checked)">
                    ${kat.isim}
                </label>
            `,
    )
    .join("");
}

function yeniUrunKategoriToggle(id, seciliMi) {
  if (seciliMi) {
    if (!yeniUrunSecilenKategoriler.includes(id)) {
      yeniUrunSecilenKategoriler.push(id);
    }
  } else {
    yeniUrunSecilenKategoriler = yeniUrunSecilenKategoriler.filter((k) => k !== id);
  }
}

// === ÜRÜN EKLEME ===

function urunEkle() {
  const urunAdi = document.getElementById("productName").value.trim();
  const urunFiyati = document.getElementById("productValue").value;
  const urunAciklamasi = document.getElementById("productDescription").value.trim();
  const dosyaGirdisi = document.getElementById("productImage");

  if (!urunAdi || !urunFiyati) {
    alert("Lütfen ürün adı ve fiyat alanlarını doldurun!");
    return;
  }

  const formData = new FormData();
  formData.append("isim", urunAdi);
  formData.append("fiyat", Number(urunFiyati));
  formData.append("aciklama", urunAciklamasi);
  // Seçilen kategoriler JSON dizi olarak tek bir alanda gönderiliyor.
  // (Aynı isimde birden fazla form alanı göndermek tarayıcıya/sunucuya göre farklı
  // ayrıştırılabiliyordu, bu da "bişey değiştirince ekleme bozuluyor" sorununun
  // olası sebeplerinden biriydi. JSON ile bu belirsizlik ortadan kalkıyor.)
  formData.append("kategoriler", JSON.stringify(yeniUrunSecilenKategoriler));

  if (dosyaGirdisi.files.length > 0) {
    formData.append("urunResmi", dosyaGirdisi.files[0]);
  }

  fetch("/api/urun-ekle", {
    method: "POST",
    body: formData,
  })
    .then((cevap) => {
      if (!cevap.ok) {
        return cevap.json().then((hataData) => {
          throw new Error(hataData.mesaj || `Sunucu hatası (${cevap.status})`);
        });
      }
      return cevap.json();
    })
    .then((data) => {
      alert("Ürün başarıyla eklendi!");
      document.getElementById("productName").value = "";
      document.getElementById("productValue").value = "";
      document.getElementById("productDescription").value = "";
      dosyaGirdisi.value = "";
      yeniUrunSecilenKategoriler = [];
      urunEkleKategoriKutulariniCiz();
      urunleriListele();
    })
    .catch((hata) => {
      console.error("Hata:", hata);
      alert("Sistem hatası: " + hata.message);
    });
}

// === ÜRÜN LİSTELEME + ADMIN KATEGORİ FİLTRESİ ===

function urunleriListele() {
  const tbody = document.getElementById("urunListesi");
  if (!tbody) return;

  fetch("/api/urunler")
    .then((res) => res.json())
    .then((urunler) => {
      tumUrunler = urunler || [];
      urunTablosunuCiz();
    })
    .catch((err) => {
      console.error("Ürün listesi hatası:", err);
      tbody.innerHTML = `<tr><td colspan="5" style="padding:15px;text-align:center;color:red;">Ürünler yüklenirken hata oluştu.</td></tr>`;
    });
}

function adminFiltreKutulariniCiz() {
  const container = document.getElementById("adminKategoriFiltre");
  if (!container) return;

  if (tumKategoriler.length === 0) {
    container.innerHTML = `<p style="color:#999;">Filtrelenecek kategori yok.</p>`;
    return;
  }

  const tumuButonu = `<span class="kategori-tag ${adminSecilenFiltreler.length === 0 ? "secili" : ""}" onclick="adminFiltreTumunuTemizle()"><i class="fas fa-layer-group"></i> Tümü</span>`;

  const kategoriButonlari = tumKategoriler
    .map(
      (kat) =>
        `<span class="kategori-tag ${adminSecilenFiltreler.includes(kat.id) ? "secili" : ""}" onclick="adminFiltreToggle(${kat.id})">${kat.isim}</span>`,
    )
    .join("");

  container.innerHTML = tumuButonu + kategoriButonlari;
}

function adminFiltreToggle(id) {
  if (adminSecilenFiltreler.includes(id)) {
    adminSecilenFiltreler = adminSecilenFiltreler.filter((k) => k !== id);
  } else {
    adminSecilenFiltreler.push(id);
  }
  adminFiltreKutulariniCiz();
  urunTablosunuCiz(); // Yeniden sunucuya istek atmadan, cache üzerinden anında filtreler
}

function adminFiltreTumunuTemizle() {
  adminSecilenFiltreler = [];
  adminFiltreKutulariniCiz();
  urunTablosunuCiz();
}

// Seçili kategori filtresine göre (client-side, hızlı) ürün tablosunu çizer.
// Bir ürün seçilen kategorilerden HERHANGİ birine sahipse listede görünür.
function urunTablosunuCiz() {
  const tbody = document.getElementById("urunListesi");
  if (!tbody) return;

  const gosterilecekUrunler =
    adminSecilenFiltreler.length === 0
      ? tumUrunler
      : tumUrunler.filter((urun) =>
          (urun.kategoriler || []).some((katId) => adminSecilenFiltreler.includes(katId)),
        );

  if (gosterilecekUrunler.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: 15px; text-align: center; color: #888;">${tumUrunler.length === 0 ? "Henüz ürün eklenmemiş." : "Bu kategoride ürün bulunamadı."}</td></tr>`;
    return;
  }

  tbody.innerHTML = gosterilecekUrunler
    .map((urun) => {
      const kategoriEtiketleri =
        (urun.kategoriIsimleri || []).length > 0
          ? urun.kategoriIsimleri.map((isim) => `<span class="kategori-badge">${isim}</span>`).join("")
          : `<span style="color:#aaa; font-size:12px;">Kategorisiz</span>`;

      return `
                <tr>
                    <td><img src="${urun.gorsel || "images/default.png"}" alt="${urun.isim}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;" onerror="this.src='images/default.png'"></td>
                    <td style="font-weight:600;">${urun.isim}</td>
                    <td>${kategoriEtiketleri}</td>
                    <td style="font-weight:bold;color:#1f4d36;">${urun.fiyat} TL</td>
                    <td><button onclick="urunSil(${urun.id})" style="background:#a94442;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Sil</button></td>
                </tr>
            `;
    })
    .join("");
}

function urunSil(id) {
  if (!confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
  fetch(`/api/urun-sil/${id}`, { method: "DELETE" })
    .then((res) => res.json())
    .then((data) => {
      alert(data.mesaj);
      urunleriListele();
    })
    .catch((err) => {
      console.error("Silme hatası:", err);
      alert("Sunucu hatası!");
    });
}

// === TARİH FORMATLAMA FONKSİYONU ===
function formatTarih(tarihStr) {
  if (!tarihStr) return "-";
  try {
    const date = new Date(tarihStr);
    return date.toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return tarihStr;
  }
}
// === IP YÖNETİM FONKSİYONLARI (GÜNCELLENMİŞ) ===

// IP Loglarını Getir
function ipLoglariniGetir() {
  fetch("/api/ip-loglari")
    .then((res) => res.json())
    .then((data) => {
      const container = document.getElementById("ipLogListesi");
      const sayac = document.getElementById("ipLogSayisi");
      if (!container) return;

      if (!data || data.length === 0) {
        container.innerHTML = `
                    <div style="text-align:center; padding:30px 0; color:#aaa;">
                        <i class="fas fa-inbox" style="font-size:24px; display:block; margin-bottom:8px;"></i>
                        Henüz IP kaydı yok
                    </div>
                `;
        if (sayac) sayac.textContent = "0";
        return;
      }

      if (sayac) sayac.textContent = data.length;

      container.innerHTML = data
        .map(
          (log, index) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; 
                            border-bottom:1px solid #f0f0f0; transition:0.2s; ${index % 2 === 0 ? "background:white;" : "background:#f8f9fa;"}"
                     onmouseover="this.style.background='#e8f5e9'"
                     onmouseout="this.style.background='${index % 2 === 0 ? "white" : "#f8f9fa"}'">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-weight:600; font-size:13px; color:#333;">${log.ip_adresi}</span>
<span>${formatTarihBasit(log.tarih)}</span>

                    </div>
                    <button onclick="ipBanlaDirekt('${log.ip_adresi}')" 
                            style="background:#dc3545; color:white; border:none; padding:3px 12px; border-radius:4px; cursor:pointer; font-size:11px; transition:0.2s;"
                            onmouseover="this.style.background='#c82333'"
                            onmouseout="this.style.background='#dc3545'">
                        <i class="fas fa-ban"></i> Banla
                    </button>
                </div>
            `,
        )
        .join("");
    })
    .catch((err) => {
      console.error("IP logları alınamadı:", err);
      document.getElementById("ipLogListesi").innerHTML = `
                <div style="text-align:center; padding:20px; color:#dc3545;">
                    <i class="fas fa-exclamation-triangle"></i> Yüklenemedi!
                </div>
            `;
    });
}

// Banlı IP'leri Getir
function banliIpleriGetir() {
  fetch("/api/banli-ipler")
    .then((res) => res.json())
    .then((data) => {
      const container = document.getElementById("banliIpListesi");
      const sayac = document.getElementById("banliIpSayisi");
      if (!container) return;

      if (!data || data.length === 0) {
        container.innerHTML = `
                    <div style="text-align:center; padding:30px 0; color:#aaa;">
                        <i class="fas fa-check-circle" style="font-size:24px; display:block; margin-bottom:8px; color:#28a745;"></i>
                        Banlı IP yok
                    </div>
                `;
        if (sayac) sayac.textContent = "0";
        return;
      }

      if (sayac) sayac.textContent = data.length;

      container.innerHTML = data
        .map(
          (ban, index) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; 
                            border-bottom:1px solid #f0f0f0; ${index % 2 === 0 ? "background:#fff5f5;" : "background:#fef0f0;"}"
                     onmouseover="this.style.background='#ffe0e0'"
                     onmouseout="this.style.background='${index % 2 === 0 ? "#fff5f5" : "#fef0f0"}'">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span style="font-weight:600; font-size:13px; color:#dc3545;">${ban.ip}</span>
                        <span style="color:#888; font-size:11px;">
                            <i class="fas fa-info-circle"></i> ${ban.sebep || "Sebep belirtilmemiş"}
                        </span>
                        <span style="color:#999; font-size:10px;">
<span>${formatTarihBasit(ban.tarih)}</span>
                        </span>
                    </div>
                    <button onclick="ipBanKaldir('${ban.ip}')" 
                            style="background:#28a745; color:white; border:none; padding:4px 14px; border-radius:4px; cursor:pointer; font-size:11px; transition:0.2s;"
                            onmouseover="this.style.background='#218838'"
                            onmouseout="this.style.background='#28a745'">
                        <i class="fas fa-check"></i> Kaldır
                    </button>
                </div>
            `,
        )
        .join("");
    })
    .catch((err) => {
      console.error("Banlı IP listesi alınamadı:", err);
      document.getElementById("banliIpListesi").innerHTML = `
                <div style="text-align:center; padding:20px; color:#dc3545;">
                    <i class="fas fa-exclamation-triangle"></i> Yüklenemedi!
                </div>
            `;
    });
}

// IP Banla (Input'dan)
function ipBanla() {
  const input = document.getElementById("banIpInput");
  const ip = input.value.trim();
  if (!ip) {
    // Input'u kırmızı yaparak uyar
    input.style.borderColor = "#dc3545";
    input.style.background = "#fff0f0";
    setTimeout(() => {
      input.style.borderColor = "#ddd";
      input.style.background = "white";
    }, 2000);
    alert("Lütfen bir IP adresi girin!");
    return;
  }

  // IP format kontrolü
  if (!ip.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
    alert("❌ Geçersiz IP formatı!\nÖrnek: 192.168.1.1");
    return;
  }

  const sebep = prompt("📝 Ban sebebi (isteğe bağlı):");
  ipBanlaAPI(ip, sebep);
}

// IP Banla (Direkt log'dan)
function ipBanlaDirekt(ip) {
  if (!confirm(`⚠️ "${ip}" adresini banlamak istediğinize emin misiniz?`))
    return;
  const sebep = prompt("📝 Ban sebebi (isteğe bağlı):");
  ipBanlaAPI(ip, sebep);
}

// IP Banla API çağrısı
function ipBanlaAPI(ip, sebep) {
  fetch("/api/ip-banla", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ip,
      sebep: sebep || "Yönetici tarafından banlandı",
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.durum === "başarılı") {
        // Başarılı mesajı göster
        const msg = document.createElement("div");
        msg.style.cssText =
          "position:fixed; top:20px; right:20px; background:#28a745; color:white; padding:15px 25px; border-radius:8px; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.2); animation: slideIn 0.3s ease;";
        msg.innerHTML = `<i class="fas fa-check-circle"></i> ${data.mesaj}`;
        document.body.appendChild(msg);
        setTimeout(() => {
          msg.style.animation = "slideOut 0.3s ease";
          setTimeout(() => msg.remove(), 300);
        }, 3000);

        document.getElementById("banIpInput").value = "";
        ipLoglariniGetir();
        banliIpleriGetir();
      } else {
        alert("❌ " + data.mesaj);
      }
    })
    .catch((err) => {
      console.error("Banlama hatası:", err);
      alert("❌ Sunucu hatası!");
    });
}

// IP Banını Kaldır
function ipBanKaldir(ip) {
  if (
    !confirm(`⚠️ "${ip}" adresinin banını kaldırmak istediğinize emin misiniz?`)
  )
    return;

  fetch(`/api/ip-ban-kaldir/${ip}`, {
    method: "DELETE",
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.durum === "başarılı") {
        alert("✅ " + data.mesaj);
        banliIpleriGetir();
        ipLoglariniGetir();
      } else {
        alert("❌ " + data.mesaj);
      }
    })
    .catch((err) => {
      console.error("Ban kaldırma hatası:", err);
      alert("❌ Sunucu hatası!");
    });
}

// IP Loglarını Temizle
function ipLoglariniTemizle() {
  if (
    !confirm(
      "⚠️ Tüm IP loglarını silmek istediğinize emin misiniz?\nBu işlem geri alınamaz!",
    )
  )
    return;

  fetch("/api/ip-loglarini-temizle", {
    method: "DELETE",
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.durum === "başarılı") {
        alert("✅ " + data.mesaj);
        ipLoglariniGetir();
      } else {
        alert("❌ " + data.mesaj);
      }
    })
    .catch((err) => {
      console.error("Log temizleme hatası:", err);
      alert("❌ Sunucu hatası!");
    });
}
// Çok basit tarih formatlayıcı (SQLite'dan gelen her formatta çalışır)
function formatTarihBasit(tarihStr) {
  if (!tarihStr) return "-";

  // Eğer zaten formatlanmış bir string ise direkt döndür
  if (tarihStr.includes("/") && !tarihStr.includes("Invalid")) {
    return tarihStr;
  }

  try {
    const d = new Date(tarihStr);
    if (isNaN(d.getTime())) return tarihStr;

    const gun = String(d.getDate()).padStart(2, "0");
    const ay = String(d.getMonth() + 1).padStart(2, "0");
    const yil = d.getFullYear();
    const saat = String(d.getHours()).padStart(2, "0");
    const dakika = String(d.getMinutes()).padStart(2, "0");

    return `${gun}/${ay}/${yil} ${saat}:${dakika}`;
  } catch {
    return tarihStr;
  }
}
