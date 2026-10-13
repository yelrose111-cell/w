/**
 * ============================================================
 * Yellow Rose Web Components & Services (ES6 OOP Architecture)
 * ============================================================
 * كود المكونات الكائنية التوجه لمشروع يلوروز
 * كود Vanilla JS نقي وخفيف، بدون أي مكتبات خارجية
 * ============================================================
 */

(function (window) {
  'use strict';

  // ============================================================
  // 1. الفئة الأم لجميع مكونات الواجهة (BaseComponent)
  // ============================================================
  class BaseComponent {
    constructor(options = {}) {
      this.options = options;
    }

    /**
     * تعقيم النصوص وحمايتها من ثغرات XSS
     */
    escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    /**
     * إنشاء عنصر DOM جديد بكفاءة
     */
    createElement(tag = 'div', className = '', innerHTML = '') {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (innerHTML) el.innerHTML = innerHTML;
      return el;
    }

    /**
     * إدراج المكون في الحاوية المستهدفة
     */
    mount(parent) {
      const container = typeof parent === 'string' ? document.querySelector(parent) : parent;
      if (!container) return null;
      const element = this.render();
      if (element) container.appendChild(element);
      return element;
    }

    /**
     * دالة الرسم الأساسية (يتم تجاوزها في الفئات الفرعية)
     */
    render() {
      return this.createElement('div', 'yr-component');
    }
  }

  // ============================================================
  // 2. الفئة الأب لبطاقات المنتجات (BaseProductCard)
  // ============================================================
  class BaseProductCard extends BaseComponent {
    constructor(product, options = {}) {
      super(options);
      this.product = product || {};
    }

    /**
     * الحصول على اسم التصنيف المرتبط بالمنتج
     */
    getCategoryName() {
      if (this.options.categoryName) return this.options.categoryName;
      const catId = this.product.categoryId;
      if (window.CATEGORIES && window.CATEGORIES[catId]?.name) {
        return window.CATEGORIES[catId].name;
      }
      return 'تنسيق فاخر';
    }

    /**
     * استخراج صورة الغلاف الرئيسية مع فحص البدائل وسلاسل النصوص والكائنات
     */
    getCoverImage() {
      const p = this.product;
      if (p.coverUrl && typeof p.coverUrl === 'string' && p.coverUrl.trim()) {
        return p.coverUrl;
      }
      if (Array.isArray(p.images) && p.images.length > 0) {
        const first = p.images[0];
        if (typeof first === 'string' && first.trim()) {
          return first;
        }
        if (first && typeof first === 'object') {
          return first.thumbnailUrl || first.url || '/assets/logo.png';
        }
      }
      return '/assets/logo.png';
    }

    /**
     * توليد رابط الواتساب المخصص للطلب
     */
    getWhatsAppUrl() {
      if (window.YellowRoseDB && typeof window.YellowRoseDB.buildWhatsAppUrl === 'function') {
        return window.YellowRoseDB.buildWhatsAppUrl(this.product);
      }
      const title = this.product.title || 'تنسيق ورد';
      const msg = encodeURIComponent(`مرحباً يلوروز، أود الاستفسار والطلب بخصوص: ${title}`);
      return `https://wa.me/966582739397?text=${msg}`;
    }

    /**
     * توليد شارة السعر مع احترام إعداد إخفاء/إظهار السعر والأسعار الصفرية
     */
    renderPriceBadge() {
      const p = this.product;
      // التحقق من خيار إخفاء السعر (إذا كان false يتم إخفاؤه تماماً)
      if (p.showPrice === false) return '';

      const hasPriceVal = p.price !== undefined && p.price !== null && p.price !== '';
      const hasPriceText = p.priceText !== undefined && p.priceText !== null && p.priceText !== '';
      if (!hasPriceVal && !hasPriceText) return '';

      const displayLabel = hasPriceText
        ? this.escapeHtml(p.priceText)
        : `${this.escapeHtml(p.price)} ر.س`;

      const origHtml = (p.originalPrice !== undefined && p.originalPrice !== null && p.originalPrice !== '')
        ? `<del class="price-original-badge">${this.escapeHtml(p.originalPrice)} ر.س</del>`
        : '';

      return `
        <div class="card-price-badge">
          <span class="price-badge-icon"><i class="fas fa-tag"></i></span>
          <span class="price-badge-text">${displayLabel}</span>
          ${origHtml}
        </div>
      `;
    }

    /**
     * شارات إضافية تظهر فوق صورة الغلاف (يتم تخصيصها بالأبناء)
     */
    renderExtraMediaBadges() {
      return '';
    }

    /**
     * صندوق الوسائط (الصورة، التصنيف، الروابط)
     */
    renderMediaBox() {
      const cover = this.getCoverImage();
      const catName = this.getCategoryName();
      const prodId = this.escapeHtml(this.product.id);
      const title = this.escapeHtml(this.product.title);

      return `
        <div class="card-media-box">
          <a href="catalog.html?id=${prodId}">
            <img src="${this.escapeHtml(cover)}" alt="${title}" class="card-media-img" loading="lazy" onerror="this.src='/assets/logo.png';">
          </a>
          <span class="card-category-tag"><i class="fas fa-gem"></i> ${this.escapeHtml(catName)}</span>
          ${this.renderExtraMediaBadges()}
        </div>
      `;
    }

    /**
     * صندوق التفاصيل (العنوان، السعر، الوصف، أزرار الإجراءات)
     */
    renderDetailsBox() {
      const prodId = this.escapeHtml(this.product.id);
      const title = this.escapeHtml(this.product.title);
      const desc = this.escapeHtml(this.product.description) || 'تنسيق متقن يعكس فخامة وأناقة مناسباتكم الراقية.';
      const priceHtml = this.renderPriceBadge();
      const waUrl = this.getWhatsAppUrl();

      return `
        <div class="card-details-box">
          <h4 class="card-product-title">
            <a href="catalog.html?id=${prodId}">${title}</a>
          </h4>
          ${priceHtml}
          <p class="card-product-desc">${desc}</p>
          
          <div class="card-dual-actions">
            <a href="catalog.html?id=${prodId}" class="btn-card-view">
              <i class="fas fa-eye"></i> تفاصيل العمل
            </a>
            <a href="${waUrl}" target="_blank" rel="noopener" class="btn-card-order">
              <i class="fab fa-whatsapp"></i> طلب بالواتساب
            </a>
          </div>
        </div>
      `;
    }

    /**
     * بناء عنصر بطاقة المنتج الكاملة
     */
    render() {
      const card = this.createElement('div', 'modern-showcase-card');
      card.innerHTML = `
        ${this.renderMediaBox()}
        ${this.renderDetailsBox()}
      `;
      return card;
    }
  }

  // ============================================================
  // 3. بطاقة الصفحة الرئيسية (HomeProductCard)
  // ============================================================
  class HomeProductCard extends BaseProductCard {
    render() {
      const card = super.render();
      if (this.options.gridMode) {
        card.style.flex = 'none';
        card.style.width = '100%';
      }
      return card;
    }
  }

  // ============================================================
  // 4. بطاقة الكتالوج (CatalogProductCard)
  // ============================================================
  class CatalogProductCard extends BaseProductCard {
    renderExtraMediaBadges() {
      if (this.product.featured) {
        return '<div class="gallery-featured-badge" style="top:auto;bottom:12px;right:12px;"><i class="fas fa-star"></i> مميز</div>';
      }
      return '';
    }

    render() {
      const card = super.render();
      card.style.flex = 'none';
      card.style.width = '100%';
      return card;
    }
  }

  // ============================================================
  // 5. بطاقة العرض الخاصة بلوحة العمليات (PortalProductCard)
  // ============================================================
  class PortalProductCard extends BaseProductCard {
    renderExtraMediaBadges() {
      const isHidden = this.product.hidden ? '<span class="badge badge-warning" style="position:absolute;top:10px;left:10px;z-index:2;">مخفي</span>' : '';
      return isHidden;
    }
  }

  // ============================================================
  // 6. خدمة الطابعة الحرارية الموحدة (ThermalPrinterService)
  // ============================================================
  class ThermalPrinterService {
    constructor() {
      this.paperSizes = {
        '58mm': { width: '48mm', fontSize: '11px' },
        '80mm': { width: '72mm', fontSize: '13px' },
        'card': { width: '90mm', fontSize: '14px' }
      };
    }

    /**
     * طباعة محتوى HTML عبر نافذة طباعة مؤمنة أو iframe
     */
    printContent(htmlContent, title = 'طباعة يلوروز', paperSize = '58mm') {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const sizeConfig = this.paperSizes[paperSize] || this.paperSizes['58mm'];
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            @page { margin: 0; size: auto; }
            body {
              font-family: 'Tajawal', sans-serif, -apple-system;
              margin: 0;
              padding: 8px;
              width: ${sizeConfig.width};
              font-size: ${sizeConfig.fontSize};
              color: #000;
              background: #fff;
            }
            img { max-width: 100%; height: auto; }
            .text-center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            @media print {
              body { width: 100%; }
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          if (iframe.parentNode) document.body.removeChild(iframe);
        }, 2000);
      }, 400);
    }
  }

  // ============================================================
  // 7. خدمة البيجر والتنبيه الصوتي (PagerNotifierService)
  // ============================================================
  class PagerNotifierService {
    constructor() {
      this.audioCtx = null;
    }

    getAudioContext() {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    }

    /**
     * تشغيل نغمة بيجر فاخرة بدون ملفات صوت خارجية
     */
    playChime(type = 'ready') {
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        if (type === 'ready') {
          // نغمة جاهزية راقية نغمتين متتاليتين
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5
          gain.gain.setValueAtTime(0.35, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        } else {
          // نغمة تنبيه سريعة
          osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        }
      } catch (e) {
        // Safe fallback
      }
    }

    /**
     * تفعيل اهتزاز الهاتف عبر Vibration API
     */
    vibrate(pattern = [250, 100, 250]) {
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(pattern);
        } catch (e) {}
      }
    }
  }

  // ============================================================
  // 8. تصدير الواجهة العامة (Public API & Backward Compatibility)
  // ============================================================
  const YellowRoseComponents = {
    BaseComponent,
    BaseProductCard,
    HomeProductCard,
    CatalogProductCard,
    PortalProductCard,
    ThermalPrinterService: new ThermalPrinterService(),
    PagerNotifierService: new PagerNotifierService(),

    // دالة مساعدة لإنشاء بطاقة المتجر الرئيسية
    createProductCard: (product, options) => {
      const card = new HomeProductCard(product, options);
      return card.render();
    },

    // دالة مساعدة لإنشاء بطاقة الكتالوج
    createCatalogCard: (product, options) => {
      const card = new CatalogProductCard(product, options);
      return card.render();
    }
  };

  // تسجيل الواجهة على window
  window.YellowRoseComponents = YellowRoseComponents;

  // توفير التوافقية الرجعية الكاملة للدوال السابقة
  if (!window.createProductCard) {
    window.createProductCard = YellowRoseComponents.createProductCard;
  }

})(window);
