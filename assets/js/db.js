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
      brandSloganEn: "YELLOW ROSE • LUXURY FLORAL & EVENT DESIGN"
    };

    try {
      const response = await fetch('/api/settings');
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
    const topBar = document.getElementById("siteAnnouncementBar");
    const topBarText = document.getElementById("siteAnnouncementText");

    if (topBar) {
      topBar.style.display = settings.announcementBarEnabled ? "block" : "none";
    }
    if (topBarText && settings.announcementText) {
      topBarText.textContent = settings.announcementText;
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
    brandArEls.forEach(el => {
      if (settings.brandNameAr) el.textContent = settings.brandNameAr;
    });

    // Update English brand names
    const brandEnEls = document.querySelectorAll(".brand-english, .footer-brand-en, .preview-brand-en");
    brandEnEls.forEach(el => {
      if (settings.brandNameEn) el.textContent = settings.brandNameEn;
    });

    // Update Arabic slogan
    const sloganArEls = document.querySelectorAll(".hero-slogan-ar, .preview-slogan-ar");
    sloganArEls.forEach(el => {
      if (settings.brandSloganAr) el.textContent = settings.brandSloganAr;
    });

    // Update English slogan
    const sloganEnEls = document.querySelectorAll(".hero-subtitle-en, .preview-slogan-en");
    sloganEnEls.forEach(el => {
      if (settings.brandSloganEn) el.textContent = settings.brandSloganEn;
    });
  }

  // --- E-Commerce Management ---

  // Categories
  async getCategories() {
    try {
      const res = await fetch('/api/categories');
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
      const res = await fetch('/api/subcategories');
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
      const res = await fetch('/api/products');
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
  buildWhatsAppUrl(product) {
    const catName = window.CATEGORIES && window.CATEGORIES[product.categoryId] ? window.CATEGORIES[product.categoryId].name : "تنسيق زهور";
    let text = `مرحباً يلوروز 🌸\nأود الاستفسار وحجز المنتج التالي:\n• اسم المنتج: ${product.title}\n• القسم: ${catName}`;

    if (product.images && product.images.length > 0 && product.images[0].url && !product.images[0].url.startsWith("data:")) {
      text += `\n• رابط الصورة: ${product.images[0].url}`;
    }

    text += `\n\nهل هذا المنتج متاح لموعد مناسبتنا؟ شكراً لكم!`;
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
  }
}

window.YellowRoseDB = new YellowRoseDBManager();
window.CATEGORIES = DEFAULT_CATEGORIES; // Will be populated dynamically on load
window.WHATSAPP_PHONE = WHATSAPP_PHONE;
