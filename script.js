// === KONFİGÜRASYON ===
const WHATSAPP_NUMBER = "905356304945";

// NOT: Eski statik ürün dizisi kaldırıldı. Sistem tamamen veritabanından çalışıyor.
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// === ÜRÜNLERİ VERİTABANINDAN (API) ÇEKİP LİSTELEME ===
function renderProducts() {
  const productGrid = document.getElementById("productGrid");
  if (!productGrid) return;

  // Admin panelinden eklenen SQLite veritabanındaki ürünleri çekiyoruz
  fetch("/api/urunler")
    .then((res) => {
      if (!res.ok) throw new Error("Sunucu hatası: " + res.status);
      return res.json();
    })
    .then((urunler) => {
      if (!urunler || urunler.length === 0) {
        productGrid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                        <p>Henüz taze ürünümüz eklenmemiştir. Yönetim panelinden ürün ekleyin! 🥛</p>
                    </div>
                `;
        return;
      }

      // Gelen veritabanı ürünlerini orijinal HTML şablonuna döküyoruz
      productGrid.innerHTML = urunler
        .map((product) => {
          const id = product.id;
          const name = product.isim;
          const price = Number(product.fiyat);
          // Eğer görsel yolu bozuksa veya null ise varsayılan görseli göstererek 404 hatasını önleriz
          const image =
            product.gorsel &&
            product.gorsel.trim() !== "" &&
            !product.gorsel.includes("photo-")
              ? product.gorsel
              : "images/default.png";
          return `
                    <div class="product-card">
                        <span class="product-tag">Taze Ürün</span>
                        <div class="product-image">
                            <img src="${image}" alt="${name}" onerror="this.src='images/default.png'">
                        </div>
                        <div class="product-info">
                            <h3 class="product-title">${name}</h3>
                            <p class="product-desc">Çiftliğimizden günlük, tamamen doğal ve katkısız üretim.</p>
                            <div class="product-meta">
                                <span class="product-size"><i class="fas fa-balance-scale"></i> Standart</span>
                            </div>
                            <div class="product-footer">
                                <span class="product-price">${price.toLocaleString("tr-TR")} TL</span>
                                <button class="add-to-cart-btn" onclick="addToCart(${id}, '${name.replace(/'/g, "\\'")}', ${price}, '${image}')">
                                    <i class="fas fa-plus"></i> Sepete Ekle
                                </button>
                            </div>
                        </div>
                    </div>
                `;
        })
        .join("");
    })
    .catch((err) => {
      console.error("Ürünler yüklenirken hata oluştu:", err);
      productGrid.innerHTML =
        "<p style='grid-column:1/-1; text-align:center; color:red; padding: 20px;'>Ürünler şu an yüklenemedi. Sunucunun açık olduğundan emin olun.</p>";
    });
}

// === SEPETE EKLEME MEKANİZMASI (TAMAMEN DİNAMİK YAPILDI) ===
function addToCart(id, name, price, image) {
  // ID kontrolünü sepet içerisinde aratıyoruz
  const existingItem = cart.find((item) => item.id === id);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: id,
      name: name,
      price: Number(price),
      image: image,
      quantity: 1,
    });
  }

  saveCart();
  updateCartUI();

  // Sepet açıldığında paneli otomatik gösterir
  const sidebar = document.getElementById("cartSidebar");
  if (sidebar) sidebar.classList.add("open");
}

function removeFromCart(id) {
  cart = cart.filter((item) => item.id !== id);
  saveCart();
  updateCartUI();
}

function updateQuantity(id, change) {
  const item = cart.find((item) => item.id === id);
  if (!item) return;

  item.quantity += change;
  if (item.quantity <= 0) {
    removeFromCart(id);
  } else {
    saveCart();
    updateCartUI();
  }
}

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function updateCartUI() {
  const cartItems = document.getElementById("cartItems");
  const cartBadge = document.getElementById("cartBadge");
  const cartTotal = document.getElementById("cartTotal");

  if (!cartItems) return;

  let totalItems = 0;
  let totalPrice = 0;

  cartItems.innerHTML = "";

  if (cart.length === 0) {
    cartItems.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-basket"></i>
                <p>Sepetiniz boş</p>
            </div>
        `;
  } else {
    cart.forEach((item) => {
      totalItems += item.quantity;
      totalPrice += item.price * item.quantity;

      const cartItem = document.createElement("div");
      cartItem.classList.add("cart-item");
      cartItem.innerHTML = `
                <img src="${item.image}" alt="${item.name}" onerror="this.src='images/default.png'">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>${item.price.toLocaleString("tr-TR")} TL</p>
                    <div class="quantity-controls">
                        <button onclick="updateQuantity(${item.id}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="updateQuantity(${item.id}, 1)">+</button>
                    </div>
                </div>
                <button class="remove-item" onclick="removeFromCart(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            `;
      cartItems.appendChild(cartItem);
    });
  }

  if (cartBadge) cartBadge.textContent = totalItems;
  if (cartTotal)
    cartTotal.textContent = `${totalPrice.toLocaleString("tr-TR")} TL`;
}

function toggleCart() {
  const sidebar = document.getElementById("cartSidebar");
  if (sidebar) sidebar.classList.toggle("open");
}

// === TELEGRAM BOT SAYFASINA SÜRÜKLEYEN MODAL TETİKLEYİCİSİ ===
function openOrderModal() {
  if (cart.length === 0) return;
  saveCart();
  // Sipariş bilgileri localStorage'da tutulurken bot.html sayfasına yönleniyor
  window.location.href = "bot.html";
}

function closeOrderModal() {
  const modal = document.getElementById("orderModal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

// === SAYFA İLK AÇILDIĞINDA ===
document.addEventListener("DOMContentLoaded", () => {
  renderProducts();
  updateCartUI();
});

// ESC Tuş Kombinasyonu ile Kapatma
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeOrderModal();
    const sidebar = document.getElementById("cartSidebar");
    if (sidebar) sidebar.classList.remove("open");
  }
});
