/**
 * يلوروز | YELLOW ROSE - Database & Storage Layer (v3.0)
 * Manages Albums, Photo names & codes, Site Settings (Announcement Bar & Logo),
 * Secure Backend Auth, and API integrations.
 */

const WHATSAPP_PHONE = "966582739397";

// 12 Specialized Floral & Event Categories
const CATEGORIES = {
  bouquets: { id: "bouquets", name: "باقات ورد", icon: "fa-seedling" },
  vases: { id: "vases", name: "فازات وتنسيقات طاولة", icon: "fa-wine-bottle" },
  bridal: { id: "bridal", name: "مسكات عرائس", icon: "fa-female" },
  entrance_tables: { id: "entrance_tables", name: "طاولات مداخل واستقبال", icon: "fa-archway" },
  balloon_arch: { id: "balloon_arch", name: "أقواس وديكور بالونات", icon: "fa-circle-notch" },
  marriage_contracts: { id: "marriage_contracts", name: "عقود زواج وقران", icon: "fa-file-signature" },
  flower_corners: { id: "flower_corners", name: "ركنيات ورد وزوايا تصوير", icon: "fa-vector-square" },
  coffee_corners: { id: "coffee_corners", name: "ركن قهوة وضيافة", icon: "fa-coffee" },
  engagement: { id: "engagement", name: "شبكات وهدايا خطوبة", icon: "fa-ring" },
  car_decor: { id: "car_decor", name: "تشريع وزينة سيارات", icon: "fa-car-side" },
  special_events: { id: "special_events", name: "احتفالات خاصة وتخرج", icon: "fa-glass-cheers" },
  other: { id: "other", name: "تنسيقات حصرية وأخرى", icon: "fa-ellipsis-h" }
};

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

  // --- Albums Management ---

  normalizeAlbum(album) {
    if (!album) return null;
    const catCode = (album.category || "AL").substring(0, 2).toUpperCase();
    const numPart = String(album.id || "").replace(/\D/g, "").slice(-2) || "01";

    let images = [];
    if (Array.isArray(album.images) && album.images.length > 0) {
      images = album.images.map((img, idx) => {
        if (typeof img === "string") {
          return {
            url: img,
            name: `${album.title} (لقطة #${idx + 1})`,
            code: `#YR-${catCode}${numPart}-${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}`
          };
        }
        return {
          url: img.url || album.coverUrl,
          thumbnailUrl: img.thumbnailUrl || img.url,
          publicId: img.publicId,
          name: img.name || `${album.title} (لقطة #${idx + 1})`,
          code: img.code || `#YR-${catCode}${numPart}-${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}`
        };
      });
    } else {
      images = [
        {
          url: album.coverUrl || "assets/logo.png",
          name: album.title,
          code: `#YR-${catCode}${numPart}-01`
        }
      ];
    }

    return {
      ...album,
      coverUrl: album.coverUrl || images[0].url,
      images: images
    };
  }

  async getAlbums() {
    try {
      const response = await fetch('/api/albums');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          return data.map(a => this.normalizeAlbum(a));
        }
      }
    } catch (err) {
      console.warn("Failed fetching from API:", err);
    }
    return [];
  }

  async getAlbumById(id) {
    const albums = await this.getAlbums();
    return albums.find(a => a.id === id) || null;
  }

  async saveAlbum(albumData) {
    const normalized = this.normalizeAlbum(albumData);
    
    try {
      const response = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized)
      });
      if (!response.ok) throw new Error("API Save Failed");
      return true;
    } catch (err) {
      console.error("Failed saving to API", err);
      return false;
    }
  }

  async deleteAlbum(id) {
    try {
      const response = await fetch(`/api/albums/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("API Delete Failed");
      return true;
    } catch (err) {
      console.error("Failed deleting from API", err);
      return false;
    }
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
  buildWhatsAppUrl(album, photoItem = null) {
    const catName = CATEGORIES[album.category]?.name || album.categoryName || "تنسيق زهور";
    let text = `مرحباً يلوروز 🌸\nأود الاستفسار وحجز التنسيق التالي:\n• الألبوم: ${album.title}\n• التصنيف: ${catName}`;

    if (photoItem) {
      if (photoItem.name) {
        text += `\n• اسم الصورة/النموذج: ${photoItem.name}`;
      }
      if (photoItem.code) {
        text += `\n• كود التنسيق: ${photoItem.code}`;
      }
      if (photoItem.url && !photoItem.url.startsWith("data:")) {
        text += `\n• رابط الصورة: ${photoItem.url}`;
      }
    } else if (album.coverUrl && !album.coverUrl.startsWith("data:")) {
      text += `\n• رابط التنسيق: ${album.coverUrl}`;
    }

    text += `\n\nهل هذا النموذج متاح لموعد مناسبتنا؟ شكراً لكم!`;
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
  }
}

// Global DB instance
window.YellowRoseDB = new YellowRoseDBManager();
window.CATEGORIES = CATEGORIES;
window.WHATSAPP_PHONE = WHATSAPP_PHONE;
