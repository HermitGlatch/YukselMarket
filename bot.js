// === TELEGRAM API CONFIG ===
const TELEGRAM_BOT_TOKEN = "8505843688:AAFjnEhPqtd121-ciJGtri_Mw4neX6uX84c";
const MARKET_CHAT_ID = "6527242600";
const KURYE_CHAT_ID = "6527242600";

let cart = JSON.parse(localStorage.getItem('cart')) || [];
const chatMessages = document.getElementById('chatMessages');
let step = 0;
let userData = { name: '', phone: '', address: '', payment: '', lat: '38.6140', lng: '27.4244' };
let isOrderCompleted = false; // Sipariş bitti mi kontrolü

const regionData = {
    "Manisa": {
        "Yunusemre": ["Atatürk Mahallesi", "Uncubozköy Mahallesi", "Güzelyurt Mahallesi", "75. Yıl Mahallesi", "Muradiye Mahallesi"],
        "Şehzadeler": ["Alaybey Mahallesi", "Anafartalar Mahallesi", "Nurlupınar Mahallesi", "Peker Mahallesi", "Ege Mahallesi"]
    },
    "İzmir": {
        "Bornova": ["Kazımdirik Mahallesi", "Özkanlar Mahallesi", "Erzene Mahallesi", "Mevlana Mahallesi"],
        "Karşıyaka": ["Bostanlı Mahallesi", "Mavişehir Mahallesi", "Bahçelievler Mahallesi", "Alaybey Mahallesi"]
    }
};

let isGpsAwaitingConfirm = false;

function addMessage(text, sender, isHTML = false) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    if (isHTML) {
        msgDiv.innerHTML = text;
    } else {
        msgDiv.textContent = text;
    }
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function initBot() {
    if (cart.length === 0) {
        addMessage("Sepetiniz boş görünüyor. Lütfen ana sayfadan ürün ekleyin.", "bot");
        document.getElementById('userInput').disabled = true;
        document.getElementById('btnSend').disabled = true;
        return;
    }

    addMessage("Merhaba! 👋 Doğal Çiftlik sipariş asistanına hoş geldiniz. Sepetinizdeki ürünleri kontrol ediyorum...", "bot");
    
    setTimeout(() => {
        let summary = "🛒 **Sepetinizdeki Ürünler:**\n";
        let total = 0;
        cart.forEach(item => {
            summary += `- ${item.name} (${item.quantity} Adet) - ${(item.price * item.quantity)} TL\n`;
            total += item.price * item.quantity;
        });
        summary += `\n💰 **Toplam Tutar:** ${total} TL`;
        
        addMessage(summary.replace(/\n/g, '<br>'), "bot", true);
        
        setTimeout(() => {
            addMessage("İşlemleri tamamlamak için lütfen **Adınızı ve Soyadınızı** yazın:", "bot");
            step = 1;
        }, 1000);
    }, 1200);
}

function sendMessage() {
    if (isOrderCompleted) return; // Sipariş bittiyse mesaj gönderilemez

    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (!text) return;

    if (step === 1) {
        if (text.length < 3 || !isNaN(text)) {
            addMessage(text, "user");
            addMessage("⚠️ Lütfen geçerli bir isim ve soyisim giriniz (En az 3 harf).", "bot");
            input.value = '';
            return;
        }
        addMessage(text, "user");
        userData.name = text;
        addMessage(`Memnun oldum ${userData.name}. Lütfen size ulaşabileceğimiz **Telefon Numaranızı** giriniz (Örn: 05xx xxx xx xx):`, "bot");
        step = 2;
        input.value = '';
    } else if (step === 2) {
        let cleanPhone = text.replace(/\s+/g, '');
        if (cleanPhone.length < 10 || isNaN(cleanPhone)) {
            addMessage(text, "user");
            addMessage("⚠️ Geçersiz telefon numarası. Lütfen başında sıfır olacak şekilde 11 haneli numaranızı girin.", "bot");
            input.value = '';
            return;
        }
        addMessage(text, "user");
        userData.phone = text;
        addMessage("Harika. Son aşama olarak lütfen aşağıdan size en kolay gelen teslimat yöntemini seçin:", "bot");
        
        setTimeout(() => {
            document.getElementById('addressForm').style.display = 'flex';
            document.getElementById('userInput').disabled = true;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 600);
        input.value = '';
    }
}

// 3 ADRES SEÇENEĞİ
function selectMethod(method) {
    document.getElementById('mainMethodButtons').style.display = 'none';
    document.getElementById('btnBackToMethods').style.display = 'block';

    if (method === 'gps') {
        document.getElementById('gpsSubArea').style.display = 'block';
        startGpsTracking();
    } else if (method === 'list') {
        document.getElementById('listSubArea').style.display = 'block';
    } else if (method === 'manual') {
        document.getElementById('manualSubArea').style.display = 'block';
    }
}

function resetToMainOptions() {
    document.getElementById('gpsSubArea').style.display = 'none';
    document.getElementById('listSubArea').style.display = 'none';
    document.getElementById('manualSubArea').style.display = 'none';
    document.getElementById('btnBackToMethods').style.display = 'none';
    document.getElementById('mainMethodButtons').style.display = 'flex';
    isGpsAwaitingConfirm = false;
}

// METHOD 1: GPS
function startGpsTracking() {
    const statusText = document.getElementById('gpsStatusText');
    const confirmBox = document.getElementById('gpsConfirmationBox');
    
    statusText.style.display = 'block';
    confirmBox.style.display = 'none';

    if (!navigator.geolocation) {
        statusText.innerHTML = "⚠️ Cihazınız konum paylaşımını desteklemiyor.";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function (position) {
            let lat = position.coords.latitude;
            let lng = position.coords.longitude;
            userData.lat = lat.toFixed(6);
            userData.lng = lng.toFixed(6);

            fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
                .then(res => res.json())
                .then(data => {
                    statusText.style.display = 'none';
                    confirmBox.style.display = 'block';
                    let fullAddr = data.display_name || `Koordinat Alanı (${userData.lat}, ${userData.lng})`;
                    document.getElementById('foundAddressPreview').innerText = fullAddr;
                    userData.address = fullAddr;
                    isGpsAwaitingConfirm = true;
                })
                .catch(() => {
                    statusText.style.display = 'none';
                    confirmBox.style.display = 'block';
                    let fallback = `Net konum alındı. Koordinat: ${userData.lat}, ${userData.lng}`;
                    document.getElementById('foundAddressPreview').innerText = fallback;
                    userData.address = fallback;
                    isGpsAwaitingConfirm = true;
                });
        },
        function (error) {
            statusText.innerHTML = "⚠️ Cihazınızdan konum izni alınamadı.";
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
}

function confirmGps(isApproved) {
    if (isApproved) {
        isGpsAwaitingConfirm = false;
        openPaymentForm("📍 Otomatik GPS Konumu ile Onaylandı.");
    } else {
        resetToMainOptions();
    }
}

// METHOD 2: LISTE
function handleIlChange() {
    const il = document.getElementById('selectIl').value;
    const ilceSelect = document.getElementById('selectIlce');
    const mahalleSelect = document.getElementById('selectMahalle');
    const buildingGroup = document.getElementById('buildingDetailsGroup');

    ilceSelect.innerHTML = '<option value="">-- İlçe Seçin --</option>';
    mahalleSelect.innerHTML = '<option value="">-- Önce İlçe Seçin --</option>';
    ilceSelect.disabled = true;
    mahalleSelect.disabled = true;
    buildingGroup.style.display = 'none';

    if (il && regionData[il]) {
        ilceSelect.disabled = false;
        Object.keys(regionData[il]).forEach(ilce => {
            ilceSelect.innerHTML += `<option value="${ilce}">${ilce}</option>`;
        });
    }
}

function handleIlceChange() {
    const il = document.getElementById('selectIl').value;
    const ilce = document.getElementById('selectIlce').value;
    const mahalleSelect = document.getElementById('selectMahalle');
    const buildingGroup = document.getElementById('buildingDetailsGroup');

    mahalleSelect.innerHTML = '<option value="">-- Mahalle Seçin --</option>';
    mahalleSelect.disabled = true;
    buildingGroup.style.display = 'none';

    if (il && ilce && regionData[il][ilce]) {
        mahalleSelect.disabled = false;
        regionData[il][ilce].forEach(mahalle => {
            mahalleSelect.innerHTML += `<option value="${mahalle}">${mahalle}</option>`;
        });
    }
}

function handleMahalleChange() {
    const mahalle = document.getElementById('selectMahalle').value;
    const buildingGroup = document.getElementById('buildingDetailsGroup');
    if (mahalle) buildingGroup.style.display = 'block';
    else buildingGroup.style.display = 'none';
}

// LISTE KAYDETME
function saveListAddress() {
    const il = document.getElementById('selectIl').value;
    const ilce = document.getElementById('selectIlce').value;
    const mahalle = document.getElementById('selectMahalle').value;
    const detay = document.getElementById('listBuildingDetails').value.trim();

    if (!il || !ilce || !mahalle || detay.length < 5) {
        alert("Lütfen tüm alanları eksiksiz doldurun.");
        return;
    }
    userData.address = `${mahalle}, ${detay} - ${ilce} / ${il}`;
    openPaymentForm("🏢 Listeden Seçmeli Adres Tanımlandı.");
}

// METHOD 3: MANUEL KAYDETME
function saveManualAddress() {
    const text = document.getElementById('manualAddressInput').value.trim();
    if (text.length < 15) {
        alert("Lütfen tam açık adresinizi yazın.");
        return;
    }
    userData.address = text;
    openPaymentForm("✍️ Manuel Yazılı Adres Tanımlandı.");
}

// ================= ADRESTEN SONRA ÖDEME EKRANINI AÇMA =================
function openPaymentForm(displayMsg) {
    document.getElementById('addressForm').style.display = 'none';
    addMessage(displayMsg, "user");
    
    setTimeout(() => {
        addMessage("Son olarak lütfen kapıda kullanmak istediğiniz **Ödeme Yöntemini** seçin:", "bot");
        document.getElementById('paymentForm').style.display = 'flex';
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 600);
}

// ÖDEME SEÇİMİ VE BİTİRİŞ
function selectPayment(type) {
    userData.payment = type;
    document.getElementById('paymentForm').style.display = 'none';
    addMessage(`💳 Ödeme Yöntemi: ${type}`, "user");
    addMessage("Harika! Sipariş verileriniz oluşturuldu. Sistem yetkililerine aktarılıyor...", "bot");
    
    setTimeout(() => {
        completeOrderAutomated();
    }, 1000);
}

// ================= TELGRAMA GÖNDERME VE TAM KAPATMA =================
function completeOrderAutomated() {
    let total = 0;
    let urunDetaylariText = "";
    
    cart.forEach(item => {
        urunDetaylariText += `• ${item.name} (${item.quantity} Adet) - ${item.price * item.quantity} TL\n`;
        total += item.price * item.quantity;
    });

    let marketTelegramMsg = `🏪 YENİ SİPARİŞ GELDİ (MARKET)\n\n👤 Müşteri: ${userData.name}\n📞 Telefon: ${userData.phone}\n📍 Teslimat Adresi: ${userData.address}\n💳 Ödeme Türü: ${userData.payment}\n🌐 GPS Konumu: https://www.google.com/maps?q=${userData.lat},${userData.lng}\n\n📦 Ürünler:\n${urunDetaylariText}\n💰 Toplam Tutar: ${total} TL\n---`;
    let kuryeTelegramMsg = `🚴 YENİ TESLİMAT GÖREVİ (KURYE)\n\n👤 Alıcı: ${userData.name}\n📞 Telefon: ${userData.phone}\n📍 Adres Tarifi: ${userData.address}\n💳 Ödeme Alımı: ${userData.payment}\n🗺️ Kurye Linki: https://www.google.com/maps?q=${userData.lat},${userData.lng}\n\n💰 Kapıda Tahsil Edilecek: ${total} TL\n---`;

    let cleanToken = TELEGRAM_BOT_TOKEN.trim();
    let baseUrl = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

    let marketURL = `${baseUrl}?chat_id=${MARKET_CHAT_ID}&text=${encodeURIComponent(marketTelegramMsg)}`;
    let kuryeURL = `${baseUrl}?chat_id=${KURYE_CHAT_ID}&text=${encodeURIComponent(kuryeTelegramMsg)}`;

    Promise.all([fetch(marketURL, { mode: 'no-cors' }), fetch(kuryeURL, { mode: 'no-cors' })])
        .then(() => {
            setTimeout(() => {
                addMessage("🎉 Siparişiniz Başarıyla Alındı ve Onaylandı!", "bot");
                addMessage("Sipariş detaylarınız iletildi. En kısa sürede kapınızdayız! 🥛✨\n\n🔴 [İŞLEM TAMAMLANDI] Ana sayfaya dönmek için klavyeden bir tuşa basın veya ekranda herhangi bir yere tıklayın.", "bot");
                
                // SİSTEMİ TAMAMEN KİLİTLE VE BAYRAĞI DOĞRULA
                isOrderCompleted = true;
                document.getElementById('userInput').disabled = true;
                document.getElementById('userInput').placeholder = "Sipariş tamamlandı. Yönlendiriliyorsunuz...";
                document.getElementById('btnSend').disabled = true;
                
                // GENEL DİNLEYİCİLERİ BAŞLAT (TIKLAMA VE KLAVYE)
                document.addEventListener('click', clearCartAndRedirect);
                document.addEventListener('keydown', clearCartAndRedirect);
            }, 1500);
        })
        .catch(() => {
            addMessage("⚠️ Bildirim gönderilirken bir sorun oluştu.", "bot");
        });
}

// SEPETİ TEMİZLEYİP YÖNLENDİREN ORTAK FONKSİYON
function clearCartAndRedirect() {
    if (isOrderCompleted) {
        localStorage.removeItem('cart'); // Sepeti temizle
    }
}

function handleKeyPress(e) {
    if (isOrderCompleted) {
        clearCartAndRedirect();
        return;
    }
    
    if (e.key === 'Enter') {
        if (isGpsAwaitingConfirm) {
            confirmGps(true);
        } else {
            sendMessage();
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initBot();
});