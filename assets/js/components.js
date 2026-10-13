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
        '58mm': { width: '48mm', cssPage: '58mm auto', fontSize: '11px', name: 'رول حراري 58 ملم' },
        '80mm': { width: '72mm', cssPage: '80mm auto', fontSize: '13px', name: 'رول حراري 80 ملم' },
        'a7-landscape': { width: '105mm', height: '74mm', cssPage: '105mm 74mm landscape', fontSize: '14pt', name: 'كرت A7 أفقي (105×74 ملم)' },
        'a7-portrait': { width: '74mm', height: '105mm', cssPage: '74mm 105mm portrait', fontSize: '14pt', name: 'كرت A7 طولي (74×105 ملم)' },
        'mini-card': { width: '85mm', height: '55mm', cssPage: '85mm 55mm landscape', fontSize: '12pt', name: 'كرت ميني (85×55 ملم)' },
        'a6': { width: '105mm', height: '148mm', cssPage: '105mm 148mm portrait', fontSize: '14pt', name: 'كرت A6 (105×148 ملم)' },
        'a4': { width: '190mm', height: 'auto', cssPage: 'A4 portrait', fontSize: '13px', name: 'ورقة A4' },
        'card': { width: '105mm', height: '74mm', cssPage: '105mm 74mm landscape', fontSize: '14pt', name: 'كرت إهداء' }
      };
    }

    /**
     * طباعة محتوى HTML عبر نافذة طباعة مؤمنة أو iframe بمعايرة دقيقة لأبعاد الطابعة
     */
    printContent(htmlContent, title = 'طباعة يلوروز', paperSize = '80mm') {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const sizeConfig = this.paperSizes[paperSize] || this.paperSizes['80mm'];
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            @page {
              size: ${sizeConfig.cssPage};
              margin: 0;
            }
            @page :first { margin: 0; }
            *, *::before, *::after {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              font-family: 'Tajawal', sans-serif, -apple-system;
              margin: 0;
              padding: 4px;
              width: ${sizeConfig.width};
              font-size: ${sizeConfig.fontSize};
              color: #000;
              background: #fff;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
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
        }, 3000);
      }, 500);
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
  // 8. فئة بطاقة الطلب الكائنية (OrderCardComponent)
  // ============================================================
  class OrderCardComponent extends BaseComponent {
    constructor(order, options = {}) {
      super(options);
      this.order = order || {};
      this.isAdmin = options.isAdmin || false;
    }

    getStatusConfig() {
      const statusMap = {
        pending: { label: 'قيد الانتظار', cls: 'badge-pending' },
        preparing: { label: 'جاري التجهيز', cls: 'badge-preparing' },
        printed: { label: 'مطبوع الكرت', cls: 'badge-printed' },
        ready: { label: 'جاهز للاستلام', cls: 'badge-ready' },
        completed: { label: 'مكتمل', cls: 'badge-completed' }
      };
      return statusMap[this.order.status] || statusMap.pending;
    }

    renderCardSnippet() {
      const card = this.order.cardData;
      if (!card || (!card.message && !card.recipient)) return '';
      return `
        <div class="order-card-box">
          <div class="title"><i class="fas fa-envelope-open-text"></i> كرت إهداء</div>
          ${card.recipient ? `<div><strong>إلى:</strong> ${this.escapeHtml(card.recipient)}</div>` : ''}
          ${card.message ? `<div style="color: var(--text-main); margin-top: 2px;">"${this.escapeHtml(card.message)}"</div>` : ''}
          ${card.sender ? `<div style="margin-top: 2px;"><strong>من:</strong> ${this.escapeHtml(card.sender)}</div>` : ''}
        </div>
      `;
    }

    renderReviewSnippet() {
      const rev = this.order.review;
      if (!rev || !rev.rating) return '';
      return `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.8rem;">
          <div style="color: #6ee7b7; font-weight: 700;"><i class="fas fa-star text-gold"></i> تقييم العميل: ${'⭐'.repeat(Math.min(5, rev.rating))}</div>
          ${rev.comment ? `<div style="color: var(--text-main); margin-top: 2px;">"${this.escapeHtml(rev.comment)}"</div>` : ''}
        </div>
      `;
    }

    render() {
      const ord = this.order;
      const safeId = this.escapeHtml(ord.orderId);
      const safeName = this.escapeHtml(ord.customerName || 'عميل المتجر');
      const safePhone = this.escapeHtml(ord.customerPhone || '---');
      const safeProd = this.escapeHtml(ord.productTitle || 'تنسيق ورد فاخر');
      const st = this.getStatusConfig();

      const timeStr = ord.createdAt && window.YRUtils ? window.YRUtils.formatDateArabic(ord.createdAt) : '';
      const hasRecentCall = ord.lastCallAt && (Date.now() - new Date(ord.lastCallAt).getTime() < 30 * 60 * 1000);
      const callTypeLabels = {
        arrived: 'العميل وصل للفرع (عند الباب)',
        help: 'العميل يطلب مساعدة الموظف',
        ontheway: 'العميل في الطريق للاستلام'
      };
      const callMsg = hasRecentCall ? (callTypeLabels[ord.callType] || 'نداء جديد من العميل!') : '';

      const card = this.createElement('article', `order-card ${hasRecentCall ? 'has-call' : ''}`);
      card.id = `card-${safeId}`;

      const waMsg = window.PortalApp && window.PortalApp.buildCustomerWhatsAppMessage 
        ? window.PortalApp.buildCustomerWhatsAppMessage(ord) 
        : `مرحباً بك عميلنا العزيز في Yellow Rose 💛`;
      const waPhone = window.YRUtils ? window.YRUtils.formatWhatsAppPhone(ord.customerPhone) : '966582739397';

      card.innerHTML = `
        ${hasRecentCall ? `
          <div class="call-alert-banner">
            <i class="fas fa-exclamation-triangle"></i>
            <span>🚨 ${callMsg}</span>
          </div>
        ` : ''}

        <div class="order-card-header">
          <div>
            <div class="order-num">${safeId}</div>
            <div class="order-time">${timeStr}</div>
          </div>
          <span class="order-badge ${st.cls}">${st.label}</span>
        </div>

        <div class="order-info-list">
          <div class="order-info-row">
            <i class="fas fa-user"></i>
            <span class="info-lbl">العميل:</span>
            <span class="info-val">${safeName}</span>
          </div>
          <div class="order-info-row">
            <i class="fas fa-phone-alt"></i>
            <span class="info-lbl">الجوال:</span>
            <span class="info-val">${safePhone}</span>
          </div>
          <div class="order-info-row">
            <i class="fas fa-spa"></i>
            <span class="info-lbl">المنتج:</span>
            <span class="info-val">${safeProd}</span>
          </div>
        </div>

        ${this.renderCardSnippet()}
        ${this.renderReviewSnippet()}

        <div class="order-actions">
          <select class="status-dropdown" onchange="window.PortalApp.updateOrderStatus('${safeId}', this.value)">
            <option value="pending" ${ord.status === 'pending' ? 'selected' : ''}>⏳ قيد الانتظار</option>
            <option value="preparing" ${ord.status === 'preparing' ? 'selected' : ''}>⚙️ جاري التجهيز</option>
            <option value="printed" ${ord.status === 'printed' ? 'selected' : ''}>🖨️ تم طبع الكرت</option>
            <option value="ready" ${ord.status === 'ready' ? 'selected' : ''}>✅ جاهز للاستلام</option>
            <option value="completed" ${ord.status === 'completed' ? 'selected' : ''}>🏁 مكتمل ومسلّم</option>
          </select>

          <button class="btn-card-act print" onclick="window.PortalApp.quickPrintCard('${safeId}')" title="طباعة كرت الإهداء بالمقاس المحدد">
            <i class="fas fa-print"></i> كرت ${ord.cardData && ord.cardData.message ? 'إهداء' : ''}
          </button>

          <button class="btn-card-act receipt-act" onclick="window.PortalApp.quickPrintReceipt('${safeId}')" title="طباعة فاتورة وتذكرة التجهيز 80mm">
            <i class="fas fa-receipt"></i> فاتورة 80mm
          </button>

          <button class="btn-card-act" onclick="window.PortalApp.loadOrderIntoPrintStudio('${safeId}')" title="فتح الكرت في محطة الطباعة للتعديل">
            <i class="fas fa-sliders-h"></i> تخصيص
          </button>

          ${ord.pagerToken ? `
            <button class="btn-card-act" onclick="window.PortalApp.openQrModal('${ord.pagerToken}', '${safeId}', '${safePhone}', '${safeName}')" title="عرض الباركود ومشاركة الرابط">
              <i class="fas fa-qrcode"></i> باركود
            </button>
          ` : ''}

          ${ord.pagerToken && ord.status === 'ready' ? `
            <button class="btn-card-act ping" onclick="window.PortalApp.pingCustomer('${safeId}')" title="رنين هاتف العميل للتنبيه">
              <i class="fas fa-bell"></i> رنين
            </button>
          ` : ''}

          <a class="btn-card-act wa" href="https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}" target="_blank" rel="noopener">
            <i class="fab fa-whatsapp"></i> واتساب
          </a>

          ${this.isAdmin ? `
            <button class="btn-card-act delete-order-btn" onclick="window.PortalApp.confirmDeleteOrder('${safeId}')" title="حذف الطلب نهائياً من قاعدة البيانات (صلاحية المدير)">
              <i class="fas fa-trash-alt"></i> حذف
            </button>
          ` : ''}
        </div>
      `;
      return card;
    }
  }

  // ============================================================
  // 9. فئة بطاقة العميل الكائنية (CustomerCardComponent)
  // ============================================================
  class CustomerCardComponent extends BaseComponent {
    constructor(customer, options = {}) {
      super(options);
      this.customer = customer || {};
    }

    isVip() {
      const count = this.customer.ordersCount || (this.customer.orders ? this.customer.orders.length : 0);
      const tags = Array.isArray(this.customer.tags) ? this.customer.tags : [];
      return count >= 3 || tags.includes('VIP') || tags.includes('عميل مميز');
    }

    formatWhatsAppPhone() {
      const raw = (this.customer.phone || '').replace(/[^0-9]/g, '');
      if (raw.startsWith('0')) return '966' + raw.slice(1);
      return raw;
    }

    render() {
      const c = this.customer;
      const safePhone = this.escapeHtml(c.phone || '');
      const safeName = this.escapeHtml(c.name || 'عميل');
      const ordersCount = c.ordersCount || (c.orders ? c.orders.length : 0);
      const lastOrderDate = c.lastOrderAt && window.YRUtils ? window.YRUtils.formatDateArabic(c.lastOrderAt) : (c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('ar-SA') : 'غير محدد');
      const notes = (c.notes || '').trim();
      const tags = Array.isArray(c.tags) ? c.tags : [];
      const isVip = this.isVip();

      const fullWaPhone = this.formatWhatsAppPhone();
      const defaultWaMsg = `مرحباً بك عميلنا العزيز ${safeName}، يسعدنا تواصلك دائماً مع متجر Yellow Rose 💛`;

      const card = this.createElement('article', 'customer-card');
      card.id = `cust-card-${safePhone}`;

      card.innerHTML = `
        <div class="customer-card-header">
          <div class="customer-name-wrapper">
            <span class="customer-name">${safeName}</span>
            ${isVip ? `<span class="customer-tag vip"><i class="fas fa-crown"></i> VIP</span>` : ''}
            ${tags.map(t => `<span class="customer-tag">${this.escapeHtml(t)}</span>`).join('')}
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">
            <i class="fas fa-calendar-alt"></i> ${lastOrderDate}
          </div>
        </div>

        <div class="customer-phone-row">
          <i class="fas fa-phone-alt"></i>
          <span dir="ltr">${safePhone}</span>
        </div>

        <div class="customer-stats-box">
          <div class="customer-mini-stat">
            <span class="lbl">إجمالي الطلبات</span>
            <span class="val">${ordersCount} طلب${ordersCount > 2 && ordersCount < 11 ? 'ات' : ''}</span>
          </div>
          <div class="customer-mini-stat">
            <span class="lbl">فئة العميل</span>
            <span class="val" style="color: ${ordersCount > 1 ? 'var(--green)' : 'var(--text-muted)'};">
              ${ordersCount > 1 ? 'عميل دائم' : 'طلب جديد'}
            </span>
          </div>
        </div>

        ${notes ? `
          <div class="customer-notes-display">
            <i class="fas fa-info-circle text-gold"></i> ${this.escapeHtml(notes)}
          </div>
        ` : ''}

        <div class="customer-actions-row">
          ${safePhone && safePhone !== '0000000000' ? `
            <a class="btn-cust-act wa" href="https://wa.me/${fullWaPhone}?text=${encodeURIComponent(defaultWaMsg)}" target="_blank" rel="noopener" title="محادثة واتساب">
              <i class="fab fa-whatsapp"></i> واتساب
            </a>
            <a class="btn-cust-act call" href="tel:${safePhone}" title="اتصال هاتفي">
              <i class="fas fa-phone"></i> اتصال
            </a>
          ` : ''}

          <button class="btn-cust-act orders-btn" onclick="window.PortalApp.openCustomerOrdersModal('${safePhone}')" title="عرض تفاصيل وسجل الطلبات">
            <i class="fas fa-history"></i> الطلبات (${ordersCount})
          </button>

          <button class="btn-cust-act edit-notes-btn" onclick="window.PortalApp.openCustomerEditModal('${safePhone}')" title="تعديل الملاحظات والاسم">
            <i class="fas fa-edit"></i> ملاحظات
          </button>

          <button class="btn-cust-act delete-cust-btn" onclick="window.PortalApp.confirmDeleteCustomer('${safePhone}')" title="حذف العميل من قاعدة البيانات">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
      return card;
    }
  }

  // ============================================================
  // 10. خدمة إدارة وقاعدة بيانات العملاء الكائنية (CustomerCrmService)
  // ============================================================
  class CustomerCrmService {
    async fetchCustomers(sort = 'lastOrderAt', query = '') {
      const url = `/api/customers?sort=${encodeURIComponent(sort)}${query ? `&search=${encodeURIComponent(query)}` : ''}`;
      const res = await fetch(url);
      return await res.json();
    }

    async fetchCustomer(phone) {
      const res = await fetch(`/api/customers/${encodeURIComponent(phone)}`);
      return await res.json();
    }

    async updateCustomer(phone, payload) {
      const res = await fetch(`/api/customers/${encodeURIComponent(phone)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    }

    async deleteCustomer(phone) {
      const res = await fetch(`/api/customers/${encodeURIComponent(phone)}`, {
        method: 'DELETE'
      });
      return await res.json();
    }

    async syncFromOrders() {
      const res = await fetch('/api/customers/sync', { method: 'POST' });
      return await res.json();
    }
  }

  // ============================================================
  // 11. تصدير الواجهة العامة (Public API & Backward Compatibility)
  // ============================================================
  const YellowRoseComponents = {
    BaseComponent,
    BaseProductCard,
    HomeProductCard,
    CatalogProductCard,
    PortalProductCard,
    OrderCardComponent,
    CustomerCardComponent,
    ThermalPrinterService: new ThermalPrinterService(),
    PagerNotifierService: new PagerNotifierService(),
    CustomerCrmService: new CustomerCrmService(),

    // دالة مساعدة لإنشاء بطاقة المتجر الرئيسية
    createProductCard: (product, options) => {
      const card = new HomeProductCard(product, options);
      return card.render();
    },

    // دالة مساعدة لإنشاء بطاقة الكتالوج
    createCatalogCard: (product, options) => {
      const card = new CatalogProductCard(product, options);
      return card.render();
    },

    // دالة مساعدة لإنشاء بطاقة الطلب الكائنية
    createOrderCard: (order, options) => {
      const card = new OrderCardComponent(order, options);
      return card.render();
    },

    // دالة مساعدة لإنشاء بطاقة العميل الكائنية
    createCustomerCard: (customer, options) => {
      const card = new CustomerCardComponent(customer, options);
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

