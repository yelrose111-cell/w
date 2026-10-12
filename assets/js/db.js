/**
 * يلوروز | YELLOW ROSE - Database & Storage Layer (v3.0)
 * Manages Albums, Photo names & codes, Site Settings (Announcement Bar & Logo),
 * Secure Backend Auth, and API integrations.
 */

const WHATSAPP_PHONE = "966582739397";

// Legacy CATEGORIES fallback - replaced by API call below.
const DEFAULT_CATEGORIES = {};

class YellowRoseDBManager {
  constructor() {
    // Session state is managed by Backend HttpOnly Cookie, this is just for UI reflection
    this._isAuthenticated = false;
    this.checkAuthStatus();
  }

  // --- Site Settings ---
  async getSiteSettings() {
    const defaultSettings = {
      announcementBarEnabled: true,
      announcementText: "✨ يلوروز | نصنع من كل مناسبة تحفة بصرية استثنائية تعكس ذوقكم الرفيع ✨",
      logoUrl: "assets/logo.png?v=2",
      brandNameAr: "يلوروز",
      brandNameEn: "YELLOW ROSE",
      brandSloganAr: "للورد والمناسبات",
      brandSloganEn: "YELLOW ROSE • LUXURY FLORAL & EVENT DESIGN",
      whatsappMessage: ""
    };

    try {
      const response = await fetch('/api/settings?t=' + Date.now());
      if (response.ok) {
        const data = await response.json();
        if (Object.keys(data).length > 0) {
          return { ...defaultSettings, ...data };
        }
      }
    } catch (e) {
      console.warn("API settings fetch failed:", e);
    }
    
    return defaultSettings;
  }

  async saveSiteSettings(settings) {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings) // Cookie sent automatically
      });
      if (response.ok) {
        await this.syncSiteSettingsToDom();
        return true;
      }
      return false;
    } catch (e) {
      console.error("Error saving site settings:", e);
      return false;
    }
  }

  async syncSiteSettingsToDom() {
    const settings = await this.getSiteSettings();
    window.SITE_SETTINGS = settings; // Cache for synchronous access
    const topBar = document.getElementById("siteAnnouncementBar");
    const topBarText = document.getElementById("siteAnnouncementText");

    const isBarActive = (settings.announcementBarEnabled !== undefined)
      ? !!settings.announcementBarEnabled
      : (settings.announcementActive !== undefined ? !!settings.announcementActive : true);

    if (topBar) {
      topBar.style.display = isBarActive ? "block" : "none";
      if (settings.announcementLink) {
        topBar.style.cursor = "pointer";
        topBar.onclick = () => { window.location.href = settings.announcementLink; };
      } else {
        topBar.style.cursor = "default";
        topBar.onclick = null;
      }
    }
    const annMsg = settings.announcementText || settings.announcement;
    if (topBarText && annMsg) {
      topBarText.textContent = annMsg;
    }

    // Update WhatsApp global phone if set
    const waNum = settings.storeWhatsApp || settings.whatsappNumber;
    if (waNum) {
      window.WHATSAPP_PHONE = waNum;
    }

    // Update all logo images across all views and admin previews
    const logos = document.querySelectorAll(".brand-logo, .hero-logo-img, .footer-logo, .admin-login-logo, .admin-brand img, .preview-logo-box img, .brand-mockup-logo");
    logos.forEach(img => {
      if (settings.logoUrl) img.src = settings.logoUrl;
    });

    // Update Favicon
    const favicon = document.querySelector("link[rel='icon']");
    if (favicon && settings.logoUrl) {
      favicon.href = settings.logoUrl;
    }

    // Update Arabic brand names
    const brandArEls = document.querySelectorAll(".brand-arabic, .footer-brand-ar, .hero-title-gold, .preview-brand-ar, #statBrandName");
    const brandAr = settings.brandNameAr || settings.storeNameAr || settings.siteName;
    if (brandAr) {
      brandArEls.forEach(el => { el.textContent = brandAr; });
    }

    // Update English brand names
    const brandEnEls = document.querySelectorAll(".brand-english, .footer-brand-en, .preview-brand-en");
    const brandEn = settings.brandNameEn || settings.storeNameEn;
    if (brandEn) {
      brandEnEls.forEach(el => { el.textContent = brandEn; });
    }

    // Update Arabic slogan
    const sloganArEls = document.querySelectorAll(".hero-slogan-ar, .preview-slogan-ar");
    const sloganAr = settings.brandSloganAr || settings.sloganAr || settings.siteTagline;
    if (sloganAr) {
      sloganArEls.forEach(el => { el.textContent = sloganAr; });
    }

    // Update English slogan
    const sloganEnEls = document.querySelectorAll(".hero-subtitle-en, .preview-slogan-en");
    const sloganEn = settings.brandSloganEn;
    if (sloganEn) {
      sloganEnEls.forEach(el => { el.textContent = sloganEn; });
    }
  }

  // --- E-Commerce Management ---

  // Categories
  async getCategories() {
    try {
      const res = await fetch('/api/categories?t=' + Date.now());
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Failed fetching categories:", err);
    }
    return [];
  }

  async saveCategory(data) {
    try {
      const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      return res.ok;
    } catch (e) { return false; }
  }

  async deleteCategory(id) {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) { return false; }
  }

  // Subcategories
  async getSubcategories() {
    try {
      const res = await fetch('/api/subcategories?t=' + Date.now());
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Failed fetching subcategories:", err);
    }
    return [];
  }

  async saveSubcategory(data) {
    try {
      const res = await fetch('/api/subcategories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      return res.ok;
    } catch (e) { return false; }
  }

  async deleteSubcategory(id) {
    try {
      const res = await fetch(`/api/subcategories/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) { return false; }
  }

  // Products
  async getProducts() {
    try {
      const res = await fetch('/api/products?t=' + Date.now());
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Failed fetching products:", err);
    }
    return [];
  }

  async getProductById(id) {
    const products = await this.getProducts();
    return products.find(p => p.id === id) || null;
  }

  async saveProduct(data) {
    try {
      const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      return res.ok;
    } catch (e) { return false; }
  }

  async deleteProduct(id) {
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) { return false; }
  }

  // --- Encrypted Admin Auth ---

  async checkAuthStatus() {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        this._isAuthenticated = !!data.authenticated;
      } else {
        this._isAuthenticated = false;
      }
    } catch (e) {
      this._isAuthenticated = false;
    }
    return this._isAuthenticated;
  }

  isAdminAuthenticated() {
    return this._isAuthenticated;
  }

  async loginAdmin(pin) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this._isAuthenticated = true;
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error('Login error', e);
      return false;
    }
  }

  async logoutAdmin() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      this._isAuthenticated = false;
      return true;
    } catch (e) {
      console.error('Logout error', e);
      return false;
    }
  }

  // --- WhatsApp Link Generator ---
  buildWhatsAppUrl(product, photo = null, giftData = null) {
    const catName = window.CATEGORIES && window.CATEGORIES[product.categoryId] ? window.CATEGORIES[product.categoryId].name : "تنسيق زهور";
    const productUrl = `${window.location.origin}/catalog.html?id=${product.id}`;
    
    let text = "";

    if (giftData && giftData.generalOrderId) {
      text += `رقم الطلب المرجعي: ${giftData.generalOrderId}\n\n`;
    }
    
    if (window.SITE_SETTINGS && window.SITE_SETTINGS.whatsappMessage) {
      let customMsg = window.SITE_SETTINGS.whatsappMessage
        .replace(/{product_name}/g, product.title)
        .replace(/{category_name}/g, catName)
        .replace(/{product_url}/g, productUrl);
      if (photo && photo.url) {
        customMsg += `\n\nصورة محددة: ${photo.url}`;
      }
      text += customMsg;
    } else {
      let photoName = photo && photo.name ? photo.name : product.title;
      text += `مرحباً يلوروز 🌸\nأود الاستفسار وحجز المنتج التالي:\n• اسم المنتج: ${photoName}\n• القسم: ${catName}`;
      
      const imgUrl = photo && photo.url ? photo.url : (product.images && product.images.length > 0 ? product.images[0].url : "");
      if (imgUrl && !imgUrl.startsWith("data:")) {
        text += `\n• رابط الصورة: ${imgUrl}`;
      }
      
      if (photo && photo.code) {
         text += `\n• كود المنتج: ${photo.code}`;
      }
      
      if (giftData && giftData.pagerUrl) {
         text += `\n\n📌 *تابع حالة طلبك مباشرة من هنا:*\n${giftData.pagerUrl}`;
      } else {
         text += `\n\nهل هذا المنتج متاح لموعد مناسبتنا؟ شكراً لكم!`;
      }
    }

    const phone = window.SITE_SETTINGS && window.SITE_SETTINGS.whatsappNumber ? window.SITE_SETTINGS.whatsappNumber : "966500000000";

    if (giftData) {
      if (giftData.isGift) {
        text += `\n\n🎁 طلب إهداء لشخص آخر:\n• رقم جوال المهدى إليه: ${giftData.recipientPhone}\n• طريقة الاستلام: ${giftData.deliveryMethod}`;
      } else if (giftData.hasGiftCard) {
        text += `\n\n🎁 إرفاق كرت إهداء مع الطلب (استلام شخصي):`;
      }

      if (giftData.hasGiftCard) {
        text += `\n• نوع الكتابة: ${giftData.giftCardType}`;
        if (giftData.giftCardRecipient) text += `\n• إلى: ${giftData.giftCardRecipient}`;
        if (giftData.giftCardSender) text += `\n• من: ${giftData.giftCardSender}`;
        text += `\n• نص الإهداء:\n"${giftData.giftCardMessage}"`;
        
        if (giftData.printOrderId) {
          text += `\n\n🖨️ [تنبيه للفرع: تم إرسال طلب طباعة للكارت بنفس رقم الطلب المرجعي أعلاه]`;
        }
      }
    }

    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
  }
}

window.hideGlobalPreloader = function() {
  const p = document.getElementById('globalPreloader');
  if (p) {
    p.classList.add('hidden');
    setTimeout(() => p.remove(), 500);
  }
};

window.YellowRoseDB = new YellowRoseDBManager();
window.CATEGORIES = DEFAULT_CATEGORIES; // Will be populated dynamically on load
window.WHATSAPP_PHONE = WHATSAPP_PHONE;
