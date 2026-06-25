// admin.js - TAM DÜZELTİLMİŞ VERSİYON
document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("admin_token") !== "secure_admin_token_998877") {
        alert("Yetkisiz erişim! Lütfen giriş yapın.");
        window.location.href = "admin-login.html";
        return;
    }

    document.getElementById("adminBody").style.display = "block";
    telegramAyarlariniGetir();
    urunleriListele();
    setInterval(sistemDurumunuGuncelle, 1000);
    sistemDurumunuGuncelle();
});

function telegramAyarlariniGetir() {
    fetch('/api/telegram-ayarlari')
        .then(res => res.json())
        .then(data => {
            document.getElementById("keyToken").innerText = data.telegram_token || "Bulunamadı";
            document.getElementById("keyMarket").innerText = data.market_chat_id || "Bulunamadı";
            document.getElementById("keyKurye").innerText = data.kurye_chat_id || "Bulunamadı";
        })
        .catch(err => console.error("Ayarlar çekilemedi:", err));
}

function sistemDurumunuGuncelle() {
    fetch('/api/sistem-durumu')
        .then(res => res.json())
        .then(data => {
            const tickRateEl = document.getElementById("tickRate");
            if (tickRateEl) {
                tickRateEl.innerText = data.tickRate + " Hz";
            }
        })
        .catch(err => console.error("Sistem durumu güncellenemedi:", err));
}

function urunEkle() {
    const urunAdi = document.getElementById("productName").value;
    const urunFiyati = document.getElementById("productValue").value;
    const dosyaGirdisi = document.getElementById("productImage");

    if (!urunAdi || !urunFiyati) {
        alert("Lütfen ürün adı ve fiyat alanlarını doldurun!");
        return;
    }

    const formData = new FormData();
    formData.append("isim", urunAdi);
    formData.append("fiyat", Number(urunFiyati));
    
    if (dosyaGirdisi.files.length > 0) {
        formData.append("urunResmi", dosyaGirdisi.files[0]);
    }

    fetch('/api/urun-ekle', {
        method: 'POST',
        body: formData
    })  
    .then(cevap => cevap.json())
    .then(data => {
        alert("Ürün başarıyla eklendi!");
        document.getElementById("productName").value = "";
        document.getElementById("productValue").value = "";
        dosyaGirdisi.value = "";
        urunleriListele();
    })
    .catch(hata => {
        console.error("Hata:", hata);
        alert("Sistem hatası!");
    });
}

function urunleriListele() {
    const tbody = document.getElementById("urunListesi");
    if (!tbody) return;
    
    fetch('/api/urunler')
        .then(res => res.json())
        .then(urunler => {
            tbody.innerHTML = "";
            if (urunler.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="padding: 15px; text-align: center; color: #888;">Henüz ürün eklenmemiş.</td></tr>`;
                return;
            }
            urunler.forEach(urun => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><img src="${urun.gorsel || 'images/default.png'}" alt="${urun.isim}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;" onerror="this.src='images/default.png'"></td>
                    <td style="font-weight:600;">${urun.isim}</td>
                    <td style="font-weight:bold;color:#1a5f3c;">${urun.fiyat} TL</td>
                    <td><button onclick="urunSil(${urun.id})" style="background:#a94442;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Sil</button></td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => {
            console.error("Ürün listesi hatası:", err);
            tbody.innerHTML = `<tr><td colspan="4" style="padding:15px;text-align:center;color:red;">Ürünler yüklenirken hata oluştu.</td></tr>`;
        });
}

function urunSil(id) {
    if (!confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
    fetch(`/api/urun-sil/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            alert(data.mesaj);
            urunleriListele();
        })
        .catch(err => {
            console.error("Silme hatası:", err);
            alert("Sunucu hatası!");
        });
}