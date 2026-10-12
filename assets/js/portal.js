/**
 * Yellow Rose - Unified Operations Portal (portal.js)
 * High-performance controller for Orders, Print Station, Catalog, Reviews, Push, and Dynamic PINs
 */

(function() {
  'use strict';

  const PortalApp = {
    state: {
      role: null, // 'admin' | 'employee'
      orders: [],
      categories: [],
      subcategories: [],
      products: [],
      settings: {},
      currentProductImages: [],
      selectedCoverUrl: '',
      productSearchQuery: '',
      productCategoryFilter: '',
      activeFilter: 'all',
      searchQuery: '',
      audioEnabled: true,
      lastKnownOrderCount: 0,
      pollingTimer: null,
      currentPrintOrder: null,
      pingCooldowns: new Map()
    },

    // =========================================
    // INITIALIZATION & AUTH
    // =========================================
    async init() {
      this.bindEvents();
      await this.checkAuth();
    },

    bindEvents() {
      // Sidebar Tab Switching
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.addEventListener('click', () => {
          const tabId = item.dataset.tab;
          if (tabId) this.switchTab(tabId);
        });
      });

      // Mobile Menu Toggle
      const mobileBtn = document.getElementById('mobileMenuBtn');
      if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
          document.getElementById('sidebar').classList.toggle('open');
        });
      }

      // Close mobile sidebar on outside click
      document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const mobileBtn = document.getElementById('mobileMenuBtn');
        if (sidebar && sidebar.classList.contains('open')) {
          if (!sidebar.contains(e.target) && !mobileBtn.contains(e.target)) {
            sidebar.classList.remove('open');
          }
        }
      });

      // Logout buttons
      const logoutBtn = document.getElementById('sidebarLogoutBtn');
      if (logoutBtn) logoutBtn.addEventListener('click', () => this.handleLogout());

      // Audio Toggle
      const audioBtn = document.getElementById('audioToggleBtn');
      if (audioBtn) audioBtn.addEventListener('click', () => this.toggleAudio());

      // Quick Order Modal
      const quickOrderBtn = document.getElementById('btnQuickNewOrder');
      if (quickOrderBtn) quickOrderBtn.addEventListener('click', () => this.openNewOrderModal());

      // Order Filter Pills
      document.querySelectorAll('#orderFilterPills .filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          document.querySelectorAll('#orderFilterPills .filter-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.state.activeFilter = pill.dataset.filter || 'all';
          this.renderOrders();
        });
      });

      // Order Search Input
      const searchInput = document.getElementById('orderSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.state.searchQuery = e.target.value.trim().toLowerCase();
          this.renderOrders();
        });
      }

      // Print Studio inputs live updating canvas
      ['inputCardRecipient', 'inputCardMessage', 'inputCardSender'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => this.syncCanvasFromInputs());
      });
      ['selectCardFont', 'selectCardFontSize', 'selectCardAlign', 'selectCardFrameStyle'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => this.syncCanvasFromInputs());
      });

      // Print Studio Execution Buttons
      const printExecBtn = document.getElementById('btnExecutePrint');
      if (printExecBtn) printExecBtn.addEventListener('click', () => this.executePrint());

      const markPrintedBtn = document.getElementById('btnMarkOrderPrinted');
      if (markPrintedBtn) markPrintedBtn.addEventListener('click', () => this.markCurrentOrderPrinted());

      const markReadyBtn = document.getElementById('btnMarkOrderReadyFromPrint');
      if (markReadyBtn) markReadyBtn.addEventListener('click', () => this.markCurrentOrderReady());

      // Print Studio: Reset card to write a new one on-the-spot without annoying modals
      const resetCardBtn = document.getElementById('btnResetPrintInputs');
      if (resetCardBtn) resetCardBtn.addEventListener('click', () => this.clearPrintInputs());

      // Catalog Management: Categories & Subcategories & Products
      const btnNewCat = document.getElementById('btnOpenNewCategoryModal');
      if (btnNewCat) btnNewCat.addEventListener('click', () => this.openNewCategoryModal());

      const btnNewSubcat = document.getElementById('btnOpenNewSubcategoryModal');
      if (btnNewSubcat) btnNewSubcat.addEventListener('click', () => this.openNewSubcategoryModal());

      const btnNewProd = document.getElementById('btnOpenNewProductModal');
      if (btnNewProd) btnNewProd.addEventListener('click', () => this.openNewProductModal());

      // Cloudinary File Uploads
      const catFile = document.getElementById('catModalFileInput');
      if (catFile) {
        catFile.addEventListener('change', (e) => {
          if (e.target.files[0]) this.uploadSingleImage(e.target.files[0], 'catModalCoverUrl', 'catModalUploadStatus', 'yellowrose/categories');
        });
      }

      const subcatFile = document.getElementById('subcatModalFileInput');
      if (subcatFile) {
        subcatFile.addEventListener('change', (e) => {
          if (e.target.files[0]) this.uploadSingleImage(e.target.files[0], 'subcatModalCoverUrl', 'subcatModalUploadStatus', 'yellowrose/categories');
        });
      }

      const brandLogoFile = document.getElementById('brandLogoFileInput');
      if (brandLogoFile) {
        brandLogoFile.addEventListener('change', (e) => {
          if (e.target.files[0]) {
            this.uploadSingleImage(e.target.files[0], 'cfgBrandLogoUrl', 'brandLogoUploadStatus', 'yellowrose', (url) => {
              this.updateLogoPreview(url);
            });
          }
        });
      }

      const prodFiles = document.getElementById('prodModalFileInput');
      if (prodFiles) {
        prodFiles.addEventListener('change', (e) => {
          if (e.target.files && e.target.files.length > 0) {
            this.handleProductFilesUpload(Array.from(e.target.files));
          }
        });
      }

      const btnAddDirect = document.getElementById('btnAddDirectUrl');
      if (btnAddDirect) btnAddDirect.addEventListener('click', () => this.addDirectImageUrl());

      // Product Category Select -> Updates Subcategories dropdown
      const prodCatSelect = document.getElementById('prodModalCategory');
      if (prodCatSelect) {
        prodCatSelect.addEventListener('change', (e) => {
          this.populateProductSubcategoriesDropdown(e.target.value);
        });
      }

      // Catalog Filters
      const filterCat = document.getElementById('filterProductCategorySelect');
      if (filterCat) {
        filterCat.addEventListener('change', (e) => {
          this.state.productCategoryFilter = e.target.value;
          this.renderProductsTable();
        });
      }

      const searchProd = document.getElementById('searchProductInput');
      if (searchProd) {
        searchProd.addEventListener('input', (e) => {
          this.state.productSearchQuery = e.target.value.trim().toLowerCase();
          this.renderProductsTable();
        });
      }

      // Brand & WhatsApp Save Button
      const saveBrandWaBtn = document.getElementById('btnSaveBrandAndWhatsapp');
      if (saveBrandWaBtn) saveBrandWaBtn.addEventListener('click', () => this.saveBrandAndWhatsappSettings());

      // Live Brand Previews on input
      const logoUrlInput = document.getElementById('cfgBrandLogoUrl');
      if (logoUrlInput) logoUrlInput.addEventListener('input', (e) => this.updateLogoPreview(e.target.value));

      const brandArInput = document.getElementById('cfgBrandNameAr');
      if (brandArInput) {
        brandArInput.addEventListener('input', (e) => {
          const el = document.getElementById('previewBrandArText');
          if (el) el.textContent = e.target.value || 'يلوروز';
        });
      }

      const brandEnInput = document.getElementById('cfgBrandNameEn');
      if (brandEnInput) {
        brandEnInput.addEventListener('input', (e) => {
          const el = document.getElementById('previewBrandEnText');
          if (el) el.textContent = e.target.value || 'YELLOW ROSE';
        });
      }

      const brandSloganInput = document.getElementById('cfgBrandSloganAr');
      if (brandSloganInput) {
        brandSloganInput.addEventListener('input', (e) => {
          const el = document.getElementById('previewBrandSloganText');
          if (el) el.textContent = e.target.value || 'للورد والمناسبات';
        });
      }
    },

    async checkAuth() {
      try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        if (data.authenticated && data.role) {
          this.onLoginSuccess(data.role);
        } else {
          this.showLoginOverlay();
        }
      } catch (e) {
        console.error('Auth check error:', e);
        this.showLoginOverlay();
      }
    },

    async handleLogin() {
      const pinInput = document.getElementById('loginPinInput');
      const errorMsg = document.getElementById('loginErrorMsg');
      const submitBtn = document.getElementById('loginBtn');
      const pin = (pinInput ? pinInput.value : '').trim();

      if (!pin) return;

      errorMsg.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        const data = await res.json();

        if (data.success && data.role) {
          pinInput.value = '';
          this.onLoginSuccess(data.role);
          this.showToast('تم تسجيل الدخول بنجاح ✓');
        } else {
          errorMsg.textContent = data.error || 'رمز الدخول غير صحيح';
          errorMsg.style.display = 'block';
        }
      } catch (err) {
        errorMsg.textContent = 'تعذر الاتصال بالخادم';
        errorMsg.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-key"></i> دخول للمنصة';
      }
    },

    onLoginSuccess(role) {
      this.state.role = role;
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('appLayout').style.display = 'flex';

      // Update role badges & styling
      const roleDot = document.getElementById('roleIndicatorDot');
      const roleText = document.getElementById('roleLabelText');

      if (role === 'admin') {
        document.body.classList.remove('is-employee');
        if (roleDot) roleDot.className = 'role-indicator admin';
        if (roleText) roleText.textContent = 'مشرف عام (المدير)';
      } else {
        document.body.classList.add('is-employee');
        if (roleDot) roleDot.className = 'role-indicator employee';
        if (roleText) roleText.textContent = 'فريق العمل (الموظف)';
      }

      this.startPolling();
      this.fetchOrders();

      if (role === 'admin') {
        this.loadCategoriesAndProducts();
        this.loadMarketingStats();
        this.loadSettings();
      }
    },

    async handleLogout() {
      this.stopPolling();
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (e) {}
      this.state.role = null;
      this.state.orders = [];
      this.showLoginOverlay();
      this.showToast('تم تسجيل الخروج');
    },

    showLoginOverlay() {
      this.stopPolling();
      document.getElementById('appLayout').style.display = 'none';
      document.getElementById('loginOverlay').style.display = 'flex';
      const pinInput = document.getElementById('loginPinInput');
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    },

    switchTab(tabId) {
      // Check admin restrictions
      if (this.state.role !== 'admin' && ['products', 'reviews', 'marketing', 'whatsapp', 'settings'].includes(tabId)) {
        this.showToast('هذا القسم مخصص للمشرف العام فقط');
        return;
      }

      // Update active nav
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        if (item.dataset.tab === tabId) item.classList.add('active');
        else item.classList.remove('active');
      });

      // Update active tab section
      document.querySelectorAll('.tab-section').forEach(sec => {
        if (sec.id === `tabSection-${tabId}`) sec.classList.add('active');
        else sec.classList.remove('active');
      });

      // Update Topbar Title
      const titles = {
        orders: 'مركز الطلبات والبيجر',
        print: 'محطة الطباعة لكروت الإهداء A7',
        products: 'إدارة المنتجات والأقسام',
        reviews: 'تقييمات وآراء العملاء',
        marketing: 'حملات الإشعارات الترويجية',
        whatsapp: 'تخصيص رسائل الواتساب وهوية المتجر',
        settings: 'إدارة الرموز والأمان'
      };
      const titleEl = document.getElementById('topbarTitle');
      if (titleEl && titles[tabId]) titleEl.textContent = titles[tabId];

      // Close mobile sidebar if open
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');

      if (tabId === 'reviews') this.renderReviews();
      if (tabId === 'whatsapp') this.loadSettings();
      if (tabId === 'marketing') this.loadMarketingStats();
      if (tabId === 'products') this.loadCategoriesAndProducts();
    },

    // =========================================
    // ORDERS POLLING & RENDERING
    // =========================================
    startPolling() {
      this.stopPolling();
      this.state.pollingTimer = setInterval(() => {
        this.fetchOrders(true);
      }, 7000);
    },

    stopPolling() {
      if (this.state.pollingTimer) {
        clearInterval(this.state.pollingTimer);
        this.state.pollingTimer = null;
      }
    },

    async fetchOrders(isBackground = false) {
      try {
        const res = await fetch('/api/orders');
        if (res.status === 401 || res.status === 403) {
          this.handleLogout();
          return;
        }

        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          const fetchedOrders = data.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
          // Detect new orders for sound chime
          if (this.state.lastKnownOrderCount > 0 && fetchedOrders.length > this.state.lastKnownOrderCount) {
            this.playNotificationChime();
            this.showToast('🔔 وصل طلب جديد للتو!');
          }

          // Detect new reverse call
          const hadNewCall = fetchedOrders.some(o => {
            if (!o.lastCallAt) return false;
            const diff = Date.now() - new Date(o.lastCallAt).getTime();
            return diff < 15000; // call within last 15 seconds
          });
          if (hadNewCall && isBackground) {
            this.playCallAlertChime();
          }

          this.state.lastKnownOrderCount = fetchedOrders.length;
          this.state.orders = fetchedOrders;

          this.updateMetrics();
          this.renderOrders();
        }
      } catch (err) {
        if (!isBackground) this.showToast('خطأ في استرجاع الطلبات');
      }
    },

    updateMetrics() {
      const orders = this.state.orders;
      const total = orders.length;
      const pending = orders.filter(o => o.status === 'pending').length;
      const preparing = orders.filter(o => o.status === 'preparing').length;
      const ready = orders.filter(o => o.status === 'ready').length;

      const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      setEl('metricTotal', total);
      setEl('metricPending', pending);
      setEl('metricPreparing', preparing);
      setEl('metricReady', ready);
      setEl('navOrdersBadge', pending);
    },

    renderOrders() {
      const container = document.getElementById('ordersGrid');
      if (!container) return;

      const filter = this.state.activeFilter;
      const query = this.state.searchQuery;

      const filtered = this.state.orders.filter(order => {
        // Status filter
        if (filter !== 'all' && order.status !== filter) return false;

        // Search query
        if (query) {
          const matchId = (order.orderId || '').toLowerCase().includes(query);
          const matchCust = (order.customerName || '').toLowerCase().includes(query);
          const matchProd = (order.productTitle || '').toLowerCase().includes(query);
          const matchPhone = (order.customerPhone || '').includes(query);
          if (!matchId && !matchCust && !matchProd && !matchPhone) return false;
        }

        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
            <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; color: rgba(212,175,55,0.3);"></i>
            <p>لا توجد طلبات مطابقة حالياً.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(order => this.renderOrderCardHtml(order)).join('');
    },

    renderOrderCardHtml(order) {
      const escape = window.YRUtils ? window.YRUtils.escapeHtml : (str => str || '');
      const safeId = escape(order.orderId);
      const safeName = escape(order.customerName || 'عميل المتجر');
      const safePhone = escape(order.customerPhone || '---');
      const safeProd = escape(order.productTitle || 'تنسيق ورد فاخر');

      // Status labels & badges
      const statusMap = {
        pending: { label: 'قيد الانتظار', cls: 'badge-pending' },
        preparing: { label: 'جاري التجهيز', cls: 'badge-preparing' },
        printed: { label: 'مطبوع الكرت', cls: 'badge-printed' },
        ready: { label: 'جاهز للاستلام', cls: 'badge-ready' },
        completed: { label: 'مكتمل', cls: 'badge-completed' }
      };
      const st = statusMap[order.status] || statusMap.pending;

      // Time formatted
      const timeStr = order.createdAt ? (window.YRUtils ? window.YRUtils.formatDateArabic(order.createdAt) : '') : '';

      // Check reverse call alert (within last 30 minutes)
      const hasRecentCall = order.lastCallAt && (Date.now() - new Date(order.lastCallAt).getTime() < 30 * 60 * 1000);
      const callTypeLabels = {
        arrived: 'العميل وصل للفرع (عند الباب)',
        help: 'العميل يطلب مساعدة الموظف',
        ontheway: 'العميل في الطريق للاستلام'
      };
      const callMsg = hasRecentCall ? (callTypeLabels[order.callType] || 'نداء جديد من العميل!') : '';

      // Card snippet
      let cardSnippet = '';
      if (order.cardData && (order.cardData.message || order.cardData.recipient)) {
        cardSnippet = `
          <div class="order-card-box">
            <div class="title"><i class="fas fa-envelope-open-text"></i> كرت إهداء</div>
            ${order.cardData.recipient ? `<div><strong>إلى:</strong> ${escape(order.cardData.recipient)}</div>` : ''}
            ${order.cardData.message ? `<div style="color: var(--text-main); margin-top: 2px;">"${escape(order.cardData.message)}"</div>` : ''}
            ${order.cardData.sender ? `<div style="margin-top: 2px;"><strong>من:</strong> ${escape(order.cardData.sender)}</div>` : ''}
          </div>
        `;
      }

      // Review snippet
      let reviewSnippet = '';
      if (order.review && order.review.rating) {
        reviewSnippet = `
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.8rem;">
            <div style="color: #6ee7b7; font-weight: 700;"><i class="fas fa-star text-gold"></i> تقييم العميل: ${'⭐'.repeat(Math.min(5, order.review.rating))}</div>
            ${order.review.comment ? `<div style="color: var(--text-main); margin-top: 2px;">"${escape(order.review.comment)}"</div>` : ''}
          </div>
        `;
      }

      // Action buttons
      return `
        <article class="order-card ${hasRecentCall ? 'has-call' : ''}" id="card-${safeId}">
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

          ${cardSnippet}
          ${reviewSnippet}

          <div class="order-actions">
            <select class="status-dropdown" onchange="window.PortalApp.updateOrderStatus('${safeId}', this.value)">
              <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>⏳ قيد الانتظار</option>
              <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>⚙️ جاري التجهيز</option>
              <option value="printed" ${order.status === 'printed' ? 'selected' : ''}>🖨️ تم طبع الكرت</option>
              <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>✅ جاهز للاستلام</option>
              <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>🏁 مكتمل ومسلّم</option>
            </select>

            <button class="btn-card-act print" onclick="window.PortalApp.loadOrderIntoPrintStudio('${safeId}')" title="فتح الكرت في محطة الطباعة">
              <i class="fas fa-print"></i> كرت A7
            </button>

            ${order.pagerToken ? `
              <button class="btn-card-act" onclick="window.PortalApp.openQrModal('${order.pagerToken}', '${safeId}', '${safePhone}', '${safeName}')" title="عرض الباركود ومشاركة الرابط">
                <i class="fas fa-qrcode"></i> باركود
              </button>
            ` : ''}

            ${order.pagerToken && order.status === 'ready' ? `
              <button class="btn-card-act ping" onclick="window.PortalApp.pingCustomer('${safeId}')" title="رنين هاتف العميل للتنبيه">
                <i class="fas fa-bell"></i> رنين
              </button>
            ` : ''}

            <a class="btn-card-act wa" href="https://wa.me/${window.YRUtils ? window.YRUtils.formatWhatsAppPhone(order.customerPhone) : '966582739397'}?text=${encodeURIComponent(this.buildCustomerWhatsAppMessage(order))}" target="_blank" rel="noopener">
              <i class="fab fa-whatsapp"></i> واتساب
            </a>
          </div>
        </article>
      `;
    },

    buildCustomerWhatsAppMessage(order) {
      const orderId = order.orderId || 'طلبك';
      const custName = order.customerName && order.customerName !== 'عميل عبر الواتساب' ? order.customerName : 'عميلنا العزيز';
      const pagerUrl = window.location.origin + '/p/' + (order.pagerToken || order.orderId);
      const ratingUrl = window.location.origin + '/rating.html?token=' + (order.pagerToken || order.orderId);

      // 1. If status is completed -> send rating review template
      if (order.status === 'completed' && this.state.settings && this.state.settings.whatsappRatingMessage) {
        return this.state.settings.whatsappRatingMessage
          .replace(/{order_id}/g, orderId)
          .replace(/{customer_name}/g, custName)
          .replace(/{rating_url}/g, ratingUrl);
      }

      // 2. If status is ready -> send ready notification template
      if (order.status === 'ready' && this.state.settings && this.state.settings.whatsappReadyMessage) {
        return this.state.settings.whatsappReadyMessage
          .replace(/{order_id}/g, orderId)
          .replace(/{customer_name}/g, custName)
          .replace(/{pager_url}/g, pagerUrl);
      }

      // 3. Otherwise -> send order confirmation / pager link template
      if (this.state.settings && this.state.settings.whatsappConfirmMessage) {
        return this.state.settings.whatsappConfirmMessage
          .replace(/{order_id}/g, orderId)
          .replace(/{customer_name}/g, custName)
          .replace(/{pager_url}/g, pagerUrl);
      }

      return `مرحباً بك عميلنا العزيز ${custName}، يسعدنا ونتشرف بخدمتك في Yellow Rose 💛\n\nتم استلام طلبك وبدأنا في تجهيزه بكل عناية برقم:\n🔢 *${orderId}*\n\n📱 يمكنك متابعة حالة طلبك وتجهيزه مباشرة عبر الرابط التالي:\n${pagerUrl}\n\nشاكرين وممتنين لاختيارك لنا ✨`;
    },

    async updateOrderStatus(orderId, newStatus) {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (data.success) {
          const item = this.state.orders.find(o => o.orderId === orderId);
          if (item) item.status = newStatus;
          this.updateMetrics();
          this.renderOrders();
          this.showToast(`تم تحديث الطلب ${orderId} إلى: ${newStatus} ✓`);
        } else {
          this.showToast(data.error || 'فشل تحديث الحالة');
          this.fetchOrders();
        }
      } catch (err) {
        this.showToast('تعذر الاتصال بالخادم');
      }
    },

    async pingCustomer(orderId) {
      const lastPing = this.state.pingCooldowns.get(orderId) || 0;
      if (Date.now() - lastPing < 3000) {
        this.showToast('يرجى الانتظار قليلاً قبل إعادة الرنين ⏱️');
        return;
      }

      this.state.pingCooldowns.set(orderId, Date.now());
      this.showToast('جاري إرسال التنبيه لهاتف العميل...');

      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          this.showToast('تم إرسال نداء التنبيه لهاتف العميل بنجاح 🔔');
        } else {
          this.showToast(data.error || 'تعذر إرسال التنبيه');
        }
      } catch (err) {
        this.showToast('فشل الاتصال بالخادم');
      }
    },

    // =========================================
    // TAB 2: A7 PRINT STUDIO LOGIC
    // =========================================
    loadOrderIntoPrintStudio(orderId) {
      const order = this.state.orders.find(o => o.orderId === orderId);
      if (!order) return;

      this.state.currentPrintOrder = order;

      const cd = order.cardData || {};
      const rec = cd.recipient || '';
      const msg = cd.message || order.notes || '';
      const snd = cd.sender || '';

      document.getElementById('inputCardRecipient').value = rec;
      document.getElementById('inputCardMessage').value = msg;
      document.getElementById('inputCardSender').value = snd;

      if (cd.fontFamily) document.getElementById('selectCardFont').value = cd.fontFamily;
      if (cd.fontSize) document.getElementById('selectCardFontSize').value = cd.fontSize;
      if (cd.textAlign) document.getElementById('selectCardAlign').value = cd.textAlign;

      this.syncCanvasFromInputs();
      this.switchTab('print');
      this.showToast(`تم تحميل كرت الطلب ${orderId}`);
    },

    syncCanvasFromInputs() {
      const rec = document.getElementById('inputCardRecipient').value.trim();
      const msg = document.getElementById('inputCardMessage').value.trim();
      const snd = document.getElementById('inputCardSender').value.trim();

      const font = document.getElementById('selectCardFont').value;
      const size = document.getElementById('selectCardFontSize').value;
      const align = document.getElementById('selectCardAlign').value;
      const frame = document.getElementById('selectCardFrameStyle').value;

      const canvas = document.getElementById('a7CanvasTarget');
      const recEl = document.getElementById('canvasRecipientText');
      const msgEl = document.getElementById('canvasMessageText');
      const sndEl = document.getElementById('canvasSenderText');

      if (recEl) recEl.textContent = rec ? `إلى: ${rec}` : '';
      if (msgEl) {
        msgEl.textContent = msg || 'أجمل التهاني وأصدق التبريكات ✨';
        msgEl.style.fontFamily = font;
        msgEl.style.fontSize = size;
        msgEl.style.textAlign = align;
      }
      if (sndEl) sndEl.textContent = snd ? `من: ${snd}` : '';

      if (canvas) {
        canvas.className = `a7-canvas-wrapper ${frame}`;
      }
    },

    async executePrint() {
      window.print();
      if (this.state.currentPrintOrder && this.state.currentPrintOrder.status === 'pending') {
        await this.markCurrentOrderPrinted();
      }
    },

    async markCurrentOrderPrinted() {
      if (!this.state.currentPrintOrder) return;
      const orderId = this.state.currentPrintOrder.orderId;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/print`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          this.showToast(`تم تعيين حالة الطلب ${orderId} إلى: مطبوع ✓`);
          this.fetchOrders(true);
        }
      } catch (err) {}
    },

    async markCurrentOrderReady() {
      if (!this.state.currentPrintOrder) return;
      await this.updateOrderStatus(this.state.currentPrintOrder.orderId, 'ready');
    },

    clearPrintInputs() {
      const rec = document.getElementById('inputCardRecipient');
      const msg = document.getElementById('inputCardMessage');
      const snd = document.getElementById('inputCardSender');
      if (rec) rec.value = '';
      if (msg) msg.value = '';
      if (snd) snd.value = '';

      this.state.currentPrintOrder = null;
      this.syncCanvasFromInputs();
      if (rec) rec.focus();
      this.showToast('تم تفريغ الحقول وتجهيز كرت فوري جديد ✨');
    },

    // =========================================
    // MODALS: QR SHARE & NEW ORDER
    // =========================================
    openQrModal(token, orderId, phone, name) {
      const modal = document.getElementById('modalQrShare');
      const orderNumEl = document.getElementById('qrModalOrderNum');
      const custNameEl = document.getElementById('qrModalCustomerName');
      const qrCanvas = document.getElementById('qrCanvas');
      const waBtn = document.getElementById('qrBtnWhatsApp');
      const copyBtn = document.getElementById('qrBtnCopyLink');

      const fullUrl = window.location.origin + '/p/' + encodeURIComponent(token || orderId);

      if (orderNumEl) orderNumEl.textContent = orderId || 'YR-000000';
      if (custNameEl) custNameEl.textContent = name ? `العميل: ${name}` : '';

      // Generate QR Code
      if (window.QRious && qrCanvas) {
        new window.QRious({
          element: qrCanvas,
          value: fullUrl,
          size: 220,
          background: 'white',
          foreground: 'black'
        });
      }

      // WhatsApp Share Link
      if (waBtn) {
        const waPhone = window.YRUtils ? window.YRUtils.formatWhatsAppPhone(phone) : '966582739397';
        const msg = `مرحباً بك عميلنا العزيز ${name || ''} في Yellow Rose 💛\nيمكنك متابعة حالة طلبك وتجهيزه مباشرة عبر الرابط:\n${fullUrl}`;
        waBtn.href = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
      }

      // Copy Link Button
      if (copyBtn) {
        copyBtn.onclick = async () => {
          if (window.YRUtils) {
            await window.YRUtils.copyToClipboard(fullUrl);
            this.showToast('تم نسخ الرابط للحافظة بنجاح ✓');
          }
        };
      }

      modal.classList.add('active');
    },

    openNewOrderModal() {
      document.getElementById('modalNewOrder').classList.add('active');
      const nameInput = document.getElementById('noCustName');
      if (nameInput) nameInput.focus();
    },

    closeModals() {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    },

    async submitNewOrder() {
      const name = document.getElementById('noCustName').value.trim();
      const phone = document.getElementById('noCustPhone').value.trim() || '0500000000';
      const prod = document.getElementById('noProdTitle').value.trim();
      const notes = document.getElementById('noNotes').value.trim();
      const needsPrint = document.getElementById('noNeedsPrint').checked;
      const btn = document.getElementById('btnSubmitNewOrder');

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: name,
            customerPhone: phone,
            productTitle: prod,
            notes: notes,
            needsPrint: needsPrint,
            status: 'pending'
          })
        });
        const data = await res.json();
        if (data.success && data.order) {
          this.closeModals();
          document.getElementById('newOrderForm').reset();
          this.showToast(`تم إنشاء الطلب ${data.order.orderId} بنجاح ✓`);
          await this.fetchOrders();

          if (data.order.pagerToken) {
            this.openQrModal(data.order.pagerToken, data.order.orderId, phone, name);
          }
        } else {
          this.showToast(data.error || 'فشل إنشاء الطلب');
        }
      } catch (err) {
        this.showToast('تعذر الاتصال بالخادم');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> حفظ وإنشاء الطلب والبيجر';
      }
    },

    // =========================================
    // TAB 3: PRODUCTS & CATEGORIES (ADMIN)
    // =========================================
    async loadCategoriesAndProducts() {
      try {
        const [catsRes, subcatsRes, prodsRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/subcategories'),
          fetch('/api/products')
        ]);

        if (catsRes.ok) this.state.categories = await catsRes.json();
        if (subcatsRes.ok) this.state.subcategories = await subcatsRes.json();
        if (prodsRes.ok) this.state.products = await prodsRes.json();

        this.populateCategoryFilterDropdown();
        this.renderCategoriesList();
        this.renderProductsTable();
      } catch (err) {
        console.error('Error loading catalog data:', err);
      }
    },

    populateCategoryFilterDropdown() {
      const select = document.getElementById('filterProductCategorySelect');
      if (!select) return;
      const cats = this.state.categories || [];
      const currentVal = this.state.productCategoryFilter || '';

      let html = '<option value="">جميع الأقسام</option>';
      cats.forEach(c => {
        html += `<option value="${c.id}" ${c.id === currentVal ? 'selected' : ''}>${window.YRUtils.escapeHtml(c.name)} (${c.prefix || 'YR'})</option>`;
      });
      select.innerHTML = html;
    },

    renderCategoriesList() {
      const container = document.getElementById('categoryTreeList');
      if (!container) return;
      const cats = this.state.categories || [];
      const subcats = this.state.subcategories || [];

      if (cats.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:1rem; text-align:center;">لا توجد أقسام مسجلة حتى الآن.</p>';
        return;
      }

      container.innerHTML = cats.map(c => {
        const childSubcats = subcats.filter(s => s.categoryId === c.id);
        const childProductsCount = (this.state.products || []).filter(p => p.categoryId === c.id).length;

        let subcatsHtml = '';
        if (childSubcats.length > 0) {
          subcatsHtml = `
            <div style="margin-right: 1.25rem; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; border-right: 2px dashed rgba(212,175,55,0.25); padding-right: 0.75rem;">
              ${childSubcats.map(s => `
                <div class="subcat-tree-item">
                  <div style="display:flex; align-items:center; gap:0.4rem;">
                    <i class="fas fa-angle-left" style="font-size:0.75rem; color:var(--gold);"></i>
                    <span style="font-size:0.85rem; font-weight:600;">${window.YRUtils.escapeHtml(s.name)}</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:0.3rem;">
                    <button type="button" class="btn-mini-act edit" onclick="window.PortalApp.editSubcategory('${s.id}')" title="تعديل القسم الفرعي">
                      <i class="fas fa-pen"></i>
                    </button>
                    <button type="button" class="btn-mini-act del" onclick="window.PortalApp.deleteSubcategory('${s.id}')" title="حذف القسم الفرعي">
                      <i class="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        }

        return `
          <div class="category-tree-item" style="flex-direction: column; align-items: stretch;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <div style="width:36px; height:36px; border-radius:8px; background:rgba(212,175,55,0.1); border:1px solid rgba(212,175,55,0.3); display:flex; align-items:center; justify-content:center; color:var(--gold-light); font-size:1rem; overflow:hidden;">
                  ${c.coverUrl ? `<img src="${c.coverUrl}" style="width:100%; height:100%; object-fit:cover;" alt="Cover">` : (c.icon ? `<i class="${c.icon}"></i>` : '<i class="fas fa-folder"></i>')}
                </div>
                <div>
                  <div style="font-weight: 700; color: var(--gold-light); font-size: 0.95rem;">${window.YRUtils.escapeHtml(c.name)}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); display:flex; gap:0.5rem; margin-top:2px;">
                    <span>كود: <strong>${c.prefix || 'YR'}</strong></span>
                    <span>• ${childSubcats.length} أقسام فرعية</span>
                    <span>• ${childProductsCount} أعمال</span>
                  </div>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <button type="button" class="btn-mini-act add" onclick="window.PortalApp.openNewSubcategoryModal('${c.id}')" title="إضافة قسم فرعي داخل هذا القسم">
                  <i class="fas fa-plus"></i> فرعي
                </button>
                <button type="button" class="btn-mini-act edit" onclick="window.PortalApp.editCategory('${c.id}')" title="تعديل بيانات القسم">
                  <i class="fas fa-pen"></i>
                </button>
                <button type="button" class="btn-mini-act del" onclick="window.PortalApp.deleteCategory('${c.id}')" title="حذف القسم بالكامل">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
            </div>

            ${subcatsHtml}
          </div>
        `;
      }).join('');
    },

    // --- CATEGORY CRUD ---
    openNewCategoryModal() {
      const form = document.getElementById('categoryModalForm') || document.getElementById('categoryForm');
      if (form) form.reset();
      const idInput = document.getElementById('catModalId');
      if (idInput) idInput.value = '';
      const orderInput = document.getElementById('catModalOrder');
      if (orderInput) orderInput.value = (this.state.categories ? this.state.categories.length * 10 : 0);
      const titleEl = document.getElementById('categoryModalTitle') || document.getElementById('modalCategoryTitle');
      if (titleEl) titleEl.innerHTML = '<i class="fas fa-folder-plus text-gold"></i> إضافة قسم رئيسي جديد';
      const modal = document.getElementById('modalCategory');
      if (modal) modal.classList.add('active');
      const nameInput = document.getElementById('catModalName');
      if (nameInput) nameInput.focus();
    },

    editCategory(id) {
      const cat = (this.state.categories || []).find(c => c.id === id);
      if (!cat) return;

      const idEl = document.getElementById('catModalId');
      const nameEl = document.getElementById('catModalName');
      const prefixEl = document.getElementById('catModalPrefix');
      const iconEl = document.getElementById('catModalIcon');
      const coverEl = document.getElementById('catModalCoverUrl') || document.getElementById('catModalCover');
      const orderEl = document.getElementById('catModalOrder');

      if (idEl) idEl.value = cat.id || '';
      if (nameEl) nameEl.value = cat.name || '';
      if (prefixEl) prefixEl.value = cat.prefix || '';
      if (iconEl) iconEl.value = cat.icon || '';
      if (coverEl) coverEl.value = cat.coverUrl || '';
      if (orderEl) orderEl.value = cat.order !== undefined ? cat.order : 0;

      const titleEl = document.getElementById('categoryModalTitle') || document.getElementById('modalCategoryTitle');
      if (titleEl) titleEl.innerHTML = `<i class="fas fa-pen text-gold"></i> تعديل قسم: ${window.YRUtils.escapeHtml(cat.name)}`;
      const modal = document.getElementById('modalCategory');
      if (modal) modal.classList.add('active');
    },

    async deleteCategory(id) {
      const cat = (this.state.categories || []).find(c => c.id === id);
      const name = cat ? cat.name : id;
      if (!confirm(`هل أنت متأكد تماماً من حذف القسم: "${name}"؟\nسيتم حذف جميع الأقسام الفرعية والمنتجات المرتبطة به!`)) return;

      try {
        const res = await fetch(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success || res.ok) {
          this.showToast('تم حذف القسم بنجاح ✓');
          this.loadCategoriesAndProducts();
        } else {
          this.showToast(data.error || 'تعذر حذف القسم');
        }
      } catch (e) {
        this.showToast('فشل حذف القسم');
      }
    },

    async submitCategoryForm(e) {
      if (e) e.preventDefault();
      const id = (document.getElementById('catModalId')?.value || '').trim();
      const name = (document.getElementById('catModalName')?.value || '').trim();
      const prefix = (document.getElementById('catModalPrefix')?.value || '').trim().toUpperCase() || 'YR';
      const icon = (document.getElementById('catModalIcon')?.value || '').trim();
      const coverUrl = (document.getElementById('catModalCoverUrl')?.value || document.getElementById('catModalCover')?.value || '').trim();
      const order = parseInt(document.getElementById('catModalOrder')?.value, 10) || 0;
      const btn = document.getElementById('btnSubmitCategory');

      if (!name) {
        this.showToast('يرجى إدخال اسم القسم');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

      try {
        const payload = { name, prefix, icon, coverUrl, order };
        if (id) payload.id = id;

        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success || res.ok) {
          this.showToast(id ? 'تم تعديل القسم بنجاح ✓' : 'تمت إضافة القسم الجديد بنجاح ✓');
          this.closeModals();
          this.loadCategoriesAndProducts();
        } else {
          this.showToast(data.error || 'فشل حفظ القسم');
        }
      } catch (err) {
        this.showToast('تعذر الاتصال بالخادم');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> حفظ القسم';
      }
    },

    // --- SUBCATEGORY CRUD ---
    openNewSubcategoryModal(parentCategoryId = null) {
      const form = document.getElementById('subcategoryModalForm') || document.getElementById('subcategoryForm');
      if (form) form.reset();
      const idInput = document.getElementById('subcatModalId');
      if (idInput) idInput.value = '';
      this.populateSubcategoryParentsDropdown(parentCategoryId);
      const titleEl = document.getElementById('subcategoryModalTitle') || document.getElementById('modalSubcategoryTitle');
      if (titleEl) titleEl.innerHTML = '<i class="fas fa-tags text-gold"></i> إضافة قسم فرعي جديد';
      const modal = document.getElementById('modalSubcategory');
      if (modal) modal.classList.add('active');
      const nameInput = document.getElementById('subcatModalName');
      if (nameInput) nameInput.focus();
    },

    populateSubcategoryParentsDropdown(selectedId = null) {
      const select = document.getElementById('subcatModalParentId') || document.getElementById('subcatModalParent');
      if (!select) return;
      const cats = this.state.categories || [];
      select.innerHTML = '<option value="">-- اختر القسم الرئيسي --</option>' + cats.map(c => `
        <option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${window.YRUtils.escapeHtml(c.name)} (${c.prefix || 'YR'})</option>
      `).join('');
    },

    editSubcategory(id) {
      const sub = (this.state.subcategories || []).find(s => s.id === id);
      if (!sub) return;

      const idEl = document.getElementById('subcatModalId');
      const nameEl = document.getElementById('subcatModalName');
      const iconEl = document.getElementById('subcatModalIcon');
      const coverEl = document.getElementById('subcatModalCoverUrl');
      const orderEl = document.getElementById('subcatModalOrder');

      if (idEl) idEl.value = sub.id || '';
      if (nameEl) nameEl.value = sub.name || '';
      if (iconEl) iconEl.value = sub.icon || '';
      if (coverEl) coverEl.value = sub.coverUrl || '';
      if (orderEl) orderEl.value = sub.order !== undefined ? sub.order : 0;
      this.populateSubcategoryParentsDropdown(sub.categoryId);

      const titleEl = document.getElementById('subcategoryModalTitle') || document.getElementById('modalSubcategoryTitle');
      if (titleEl) titleEl.innerHTML = `<i class="fas fa-pen text-gold"></i> تعديل قسم فرعي: ${window.YRUtils.escapeHtml(sub.name)}`;
      const modal = document.getElementById('modalSubcategory');
      if (modal) modal.classList.add('active');
    },

    async deleteSubcategory(id) {
      const sub = (this.state.subcategories || []).find(s => s.id === id);
      const name = sub ? sub.name : id;
      if (!confirm(`هل أنت متأكد من حذف القسم الفرعي: "${name}"؟`)) return;

      try {
        const res = await fetch(`/api/subcategories/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success || res.ok) {
          this.showToast('تم حذف القسم الفرعي بنجاح ✓');
          this.loadCategoriesAndProducts();
        } else {
          this.showToast(data.error || 'تعذر حذف القسم الفرعي');
        }
      } catch (e) {
        this.showToast('فشل حذف القسم الفرعي');
      }
    },

    async submitSubcategoryForm(e) {
      if (e) e.preventDefault();
      const id = (document.getElementById('subcatModalId')?.value || '').trim();
      const name = (document.getElementById('subcatModalName')?.value || '').trim();
      const categoryId = (document.getElementById('subcatModalParentId')?.value || document.getElementById('subcatModalParent')?.value || '').trim();
      const icon = (document.getElementById('subcatModalIcon')?.value || '').trim();
      const coverUrl = (document.getElementById('subcatModalCoverUrl')?.value || '').trim();
      const order = parseInt(document.getElementById('subcatModalOrder')?.value, 10) || 0;
      const btn = document.getElementById('btnSubmitSubcategory');

      if (!name || !categoryId) {
        this.showToast('يرجى تحديد القسم الرئيسي وكتابة اسم القسم الفرعي');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

      try {
        const payload = { name, categoryId, icon, coverUrl, order };
        if (id) payload.id = id;

        const res = await fetch('/api/subcategories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success || res.ok) {
          this.showToast(id ? 'تم تعديل القسم الفرعي بنجاح ✓' : 'تمت إضافة القسم الفرعي بنجاح ✓');
          this.closeModals();
          this.loadCategoriesAndProducts();
        } else {
          this.showToast(data.error || 'فشل حفظ القسم الفرعي');
        }
      } catch (err) {
        this.showToast('تعذر الاتصال بالخادم');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> حفظ القسم الفرعي';
      }
    },

    // --- PRODUCTS MANAGEMENT ---
    renderProductsTable() {
      const tbody = document.getElementById('productsTableBody');
      if (!tbody) return;

      let prods = this.state.products || [];
      const catFilter = this.state.productCategoryFilter;
      const query = this.state.productSearchQuery;

      // Filter by category
      if (catFilter) {
        prods = prods.filter(p => p.categoryId === catFilter);
      }

      // Filter by search query
      if (query) {
        prods = prods.filter(p => {
          const t = (p.title || '').toLowerCase();
          const c = (p.productCode || '').toLowerCase();
          const d = (p.description || '').toLowerCase();
          return t.includes(query) || c.includes(query) || d.includes(query);
        });
      }

      if (prods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:3rem;">لا توجد منتجات مطابقة في هذا التصنيف.</td></tr>';
        return;
      }

      tbody.innerHTML = prods.map(p => {
        const cat = (this.state.categories || []).find(c => c.id === p.categoryId);
        const sub = (this.state.subcategories || []).find(s => s.id === p.subcategoryId);
        let categoryDisplay = cat ? window.YRUtils.escapeHtml(cat.name) : (p.categoryName || '---');
        if (sub) {
          categoryDisplay += ` <span style="font-size:0.75rem; color:var(--text-muted);">&gt; ${window.YRUtils.escapeHtml(sub.name)}</span>`;
        }

        const cover = p.coverUrl || (p.images && p.images[0] ? (p.images[0].url || p.images[0]) : '/assets/logo.png');
        const inStockBadge = p.inStock !== false
          ? '<span class="order-badge badge-ready">متوفر</span>'
          : '<span class="order-badge" style="background:rgba(239,68,68,0.15); color:var(--red); border-color:var(--red);">نفذ</span>';

        return `
          <tr>
            <td>
              <div style="position:relative; width:46px; height:46px; border-radius:8px; overflow:hidden; border:1px solid rgba(212,175,55,0.3); background:#000;">
                <img src="${cover}" class="table-thumb" style="width:100%; height:100%; object-fit:cover;" alt="Product">
                ${p.isFeatured ? '<span style="position:absolute; top:2px; right:2px; font-size:0.65rem;" title="مميز">⭐</span>' : ''}
              </div>
            </td>
            <td><strong style="color:var(--gold-light); letter-spacing:0.5px;">${p.productCode || 'YR-00'}</strong></td>
            <td>
              <div style="font-weight:600; color:var(--text-main);">${window.YRUtils.escapeHtml(p.title)}</div>
              <div style="font-size:0.78rem; color:var(--gold); font-weight:700;">${p.price || 0} ر.س</div>
            </td>
            <td>${categoryDisplay}</td>
            <td>${inStockBadge}</td>
            <td>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <button type="button" class="btn-mini-act edit" onclick="window.PortalApp.editProduct('${p.id}')" title="تعديل بيانات المنتج">
                  <i class="fas fa-pen"></i>
                </button>
                <button type="button" class="btn-mini-act del" onclick="window.PortalApp.deleteProduct('${p.id}')" title="حذف المنتج">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    },

    openNewProductModal() {
      const form = document.getElementById('productModalForm');
      if (form) form.reset();
      document.getElementById('prodModalId').value = '';
      document.getElementById('prodModalCode').value = '';
      document.getElementById('prodModalFeatured').checked = false;
      document.getElementById('prodModalInStock').checked = true;

      this.populateProductCategoriesDropdown();
      const firstCatId = (this.state.categories && this.state.categories[0]) ? this.state.categories[0].id : '';
      this.populateProductSubcategoriesDropdown(firstCatId);

      this.state.currentProductImages = [];
      this.state.selectedCoverUrl = '';
      this.renderProductImagesPreview();

      document.getElementById('modalProductTitle').textContent = 'إضافة منتج أو عمل جديد';
      document.getElementById('modalProduct').classList.add('active');
      const titleInput = document.getElementById('prodModalTitle');
      if (titleInput) titleInput.focus();
    },

    populateProductCategoriesDropdown(selectedId = null) {
      const select = document.getElementById('prodModalCategory');
      if (!select) return;
      const cats = this.state.categories || [];
      select.innerHTML = cats.map(c => `
        <option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${window.YRUtils.escapeHtml(c.name)} (${c.prefix || 'YR'})</option>
      `).join('');
    },

    populateProductSubcategoriesDropdown(categoryId, selectedSubcatId = null) {
      const select = document.getElementById('prodModalSubcategory');
      if (!select) return;
      const subcats = (this.state.subcategories || []).filter(s => s.categoryId === categoryId);
      let html = '<option value="">(بدون قسم فرعي)</option>';
      subcats.forEach(s => {
        html += `<option value="${s.id}" ${s.id === selectedSubcatId ? 'selected' : ''}>${window.YRUtils.escapeHtml(s.name)}</option>`;
      });
      select.innerHTML = html;
    },

    editProduct(id) {
      const p = (this.state.products || []).find(x => x.id === id);
      if (!p) return;

      document.getElementById('prodModalId').value = p.id || '';
      document.getElementById('prodModalCode').value = p.productCode || '';
      document.getElementById('prodModalTitle').value = p.title || '';
      document.getElementById('prodModalPrice').value = p.price !== undefined ? p.price : '';
      document.getElementById('prodModalOriginalPrice').value = p.originalPrice || '';
      document.getElementById('prodModalDesc').value = p.description || '';
      document.getElementById('prodModalFeatured').checked = !!p.isFeatured;
      document.getElementById('prodModalInStock').checked = p.inStock !== false;

      this.populateProductCategoriesDropdown(p.categoryId);
      this.populateProductSubcategoriesDropdown(p.categoryId, p.subcategoryId);

      // Load images
      this.state.currentProductImages = [];
      if (Array.isArray(p.images) && p.images.length > 0) {
        this.state.currentProductImages = p.images.map((img, idx) => {
          if (typeof img === 'string') return { url: img, code: p.productCode ? `${p.productCode}-${idx + 1}` : '' };
          return { url: img.url || '', code: img.code || '' };
        });
      } else if (p.coverUrl) {
        this.state.currentProductImages = [{ url: p.coverUrl, code: p.productCode || '' }];
      }

      this.state.selectedCoverUrl = p.coverUrl || (this.state.currentProductImages[0] ? this.state.currentProductImages[0].url : '');
      this.renderProductImagesPreview();

      document.getElementById('modalProductTitle').textContent = `تعديل منتج: ${p.title}`;
      document.getElementById('modalProduct').classList.add('active');
    },

    async deleteProduct(id) {
      const p = (this.state.products || []).find(x => x.id === id);
      const title = p ? p.title : id;
      if (!confirm(`هل أنت متأكد من حذف المنتج: "${title}" نهائياً؟`)) return;

      try {
        const res = await fetch(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success || res.ok) {
          this.showToast('تم حذف المنتج بنجاح ✓');
          this.loadCategoriesAndProducts();
        } else {
          this.showToast(data.error || 'تعذر حذف المنتج');
        }
      } catch (e) {
        this.showToast('فشل حذف المنتج');
      }
    },

    async submitProductForm(e) {
      if (e) e.preventDefault();
      const id = document.getElementById('prodModalId').value.trim();
      const productCode = document.getElementById('prodModalCode').value.trim();
      const title = document.getElementById('prodModalTitle').value.trim();
      const price = parseFloat(document.getElementById('prodModalPrice').value);
      const originalPriceVal = document.getElementById('prodModalOriginalPrice').value.trim();
      const originalPrice = originalPriceVal ? parseFloat(originalPriceVal) : undefined;
      const categoryId = document.getElementById('prodModalCategory').value.trim();
      const subcategoryId = document.getElementById('prodModalSubcategory').value.trim();
      const description = document.getElementById('prodModalDesc').value.trim();
      const isFeatured = document.getElementById('prodModalFeatured').checked;
      const inStock = document.getElementById('prodModalInStock').checked;
      const btn = document.getElementById('btnSubmitProduct');

      if (!title || isNaN(price) || !categoryId) {
        this.showToast('يرجى كتابة اسم المنتج، تحديد السعر، واختيار القسم الرئيسي');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري حفظ المنتج...';

      try {
        const cat = (this.state.categories || []).find(c => c.id === categoryId);
        const images = this.state.currentProductImages || [];
        const coverUrl = this.state.selectedCoverUrl || (images[0] ? images[0].url : '');

        const payload = {
          title,
          price,
          originalPrice,
          categoryId,
          subcategoryId: subcategoryId || undefined,
          categoryName: cat ? cat.name : '',
          description,
          isFeatured,
          inStock,
          images,
          coverUrl
        };
        if (id) payload.id = id;
        if (productCode) payload.productCode = productCode;

        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success || res.ok) {
          this.showToast(id ? 'تم تعديل المنتج بنجاح ✓' : 'تمت إضافة المنتج بنجاح ✓');
          this.closeModals();
          this.loadCategoriesAndProducts();
        } else {
          this.showToast(data.error || 'فشل حفظ المنتج');
        }
      } catch (err) {
        this.showToast('تعذر الاتصال بالخادم');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> حفظ المنتج';
      }
    },

    // --- CLOUDINARY & IMAGE UPLOAD LOGIC ---
    async uploadSingleImage(file, targetInputId = null, statusId = null, folder = 'yellowrose', callback = null) {
      const statusEl = statusId ? document.getElementById(statusId) : null;
      if (statusEl) statusEl.textContent = 'جاري الرفع السحابي...';

      // 1. Get signed signature from backend
      const signRes = await fetch('/api/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: folder || 'yellowrose' })
      });
      const signData = await signRes.json();
      if (!signData.success) {
        if (statusEl) statusEl.textContent = 'فشل التوقيع السحابي';
        throw new Error(signData.error || 'فشل التوقيع الأمني للرفع');
      }

      // 2. Direct upload to Cloudinary API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signData.apiKey);
      formData.append('timestamp', signData.timestamp);
      formData.append('signature', signData.signature);
      formData.append('folder', folder || 'yellowrose');

      const cloudUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`;
      const upRes = await fetch(cloudUrl, {
        method: 'POST',
        body: formData
      });
      const upData = await upRes.json();
      if (!upData.secure_url) {
        if (statusEl) statusEl.textContent = 'فشل الرفع';
        throw new Error(upData.error ? upData.error.message : 'فشل رفع الصورة إلى السحابة');
      }

      if (targetInputId) {
        const inp = document.getElementById(targetInputId);
        if (inp) inp.value = upData.secure_url;
      }
      if (statusEl) statusEl.textContent = 'تم الرفع بنجاح ✓';
      if (typeof callback === 'function') callback(upData.secure_url);

      return upData.secure_url;
    },

    async handleProductFilesUpload(files) {
      if (!files || files.length === 0) return;
      const progressBox = document.getElementById('prodUploadProgressContainer');
      const progressBar = document.getElementById('prodUploadProgressBar');
      const progressStatus = document.getElementById('prodUploadProgressStatus');

      if (progressBox) progressBox.style.display = 'block';
      if (progressBar) progressBar.style.width = '10%';
      if (progressStatus) progressStatus.textContent = `جاري رفع 1 من ${files.length} إلى Cloudinary...`;

      let successCount = 0;
      for (let i = 0; i < files.length; i++) {
        try {
          if (progressStatus) progressStatus.textContent = `جاري رفع ${i + 1} من ${files.length}... (${files[i].name})`;
          if (progressBar) progressBar.style.width = `${Math.round(((i + 1) / files.length) * 100)}%`;

          const url = await this.uploadSingleImage(files[i], null, null, 'yellowrose');
          if (!this.state.currentProductImages) this.state.currentProductImages = [];
          this.state.currentProductImages.push({ url, code: '' });
          if (!this.state.selectedCoverUrl) this.state.selectedCoverUrl = url;
          successCount++;
        } catch (err) {
          console.error('File upload failed:', err);
          this.showToast(`فشل رفع: ${files[i].name}`);
        }
      }

      if (progressBox) {
        setTimeout(() => {
          progressBox.style.display = 'none';
          if (progressBar) progressBar.style.width = '0%';
        }, 1200);
      }

      this.renderProductImagesPreview();
      if (successCount > 0) {
        this.showToast(`تم رفع ${successCount} صورة بنجاح إلى السحابة ✓`);
      }
    },

    addDirectImageUrl() {
      const input = document.getElementById('prodModalDirectUrl');
      let url = input ? input.value.trim() : '';
      if (!url) {
        url = (prompt('أدخل رابط الصورة السحابي المباشر (https://...):') || '').trim();
      }

      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        if (!this.state.currentProductImages) this.state.currentProductImages = [];
        this.state.currentProductImages.push({ url, code: '' });
        if (!this.state.selectedCoverUrl) this.state.selectedCoverUrl = url;
        if (input) input.value = '';
        this.renderProductImagesPreview();
        this.showToast('تمت إضافة رابط الصورة ✓');
      } else if (url) {
        this.showToast('يرجى التأكد من أن الرابط يبدأ بـ https://');
      }
    },

    renderProductImagesPreview() {
      const container = document.getElementById('prodModalImagesGrid') || document.getElementById('productImagesPreviewGrid');
      const countEl = document.getElementById('prodImagesCount');
      const images = this.state.currentProductImages || [];
      if (countEl) countEl.textContent = images.length;
      if (!container) return;

      if (images.length === 0) {
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 0.75rem;">لم يتم رفع أي صور لهذا المنتج حتى الآن.</div>';
        return;
      }

      container.innerHTML = images.map((img, idx) => {
        const isCover = (img.url === this.state.selectedCoverUrl) || (idx === 0 && !this.state.selectedCoverUrl);
        return `
          <div class="preview-img-card ${isCover ? 'is-cover' : ''}">
            <img src="${img.url}" alt="Product Photo ${idx + 1}">
            <button type="button" class="btn-crown-cover" onclick="window.PortalApp.setCoverImage('${img.url}')" title="${isCover ? 'الغلاف الرئيسي الحالي 👑' : 'تعيين كغلاف رئيسي'}">
              <i class="fas fa-crown"></i>
            </button>
            <button type="button" class="btn-remove-preview" onclick="window.PortalApp.removeProductImage(${idx})" title="حذف هذه الصورة">
              <i class="fas fa-times"></i>
            </button>
            <div style="padding: 4px;">
              <input type="text" placeholder="كود الصورة" value="${img.code || ''}" 
                style="width: 100%; font-size: 0.72rem; padding: 2px 4px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-gold); color: #fff; border-radius: 4px; text-align: center;"
                onchange="window.PortalApp.updatePhotoMeta(${idx}, 'code', this.value)">
            </div>
          </div>
        `;
      }).join('');
    },

    updatePhotoMeta(index, field, value) {
      if (this.state.currentProductImages && this.state.currentProductImages[index]) {
        this.state.currentProductImages[index][field] = value;
      }
    },

    setCoverImage(url) {
      this.state.selectedCoverUrl = url;
      this.renderProductImagesPreview();
      this.showToast('تم تحديد الصورة كغلاف رئيسي للمنتج 👑');
    },

    removeProductImage(index) {
      if (!this.state.currentProductImages) return;
      const removed = this.state.currentProductImages.splice(index, 1)[0];
      if (removed && removed.url === this.state.selectedCoverUrl) {
        this.state.selectedCoverUrl = this.state.currentProductImages[0] ? this.state.currentProductImages[0].url : '';
      }
      this.renderProductImagesPreview();
    },

    // =========================================
    // TAB 4: REVIEWS & RATINGS (ADMIN)
    // =========================================
    renderReviews() {
      const container = document.getElementById('reviewsStreamList');
      if (!container) return;

      const ratedOrders = this.state.orders.filter(o => o.review && o.review.rating);
      const totalReviews = ratedOrders.length;

      let avg = 5.0;
      if (totalReviews > 0) {
        const sum = ratedOrders.reduce((acc, curr) => acc + (curr.review.rating || 5), 0);
        avg = (sum / totalReviews).toFixed(1);
      }

      const avgEl = document.getElementById('metricAvgRating');
      const countEl = document.getElementById('metricTotalReviews');
      if (avgEl) avgEl.textContent = avg;
      if (countEl) countEl.textContent = totalReviews;

      if (totalReviews === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:3rem 1rem;">لم يتم تسجيل أي تقييمات من العملاء بعد.</p>';
        return;
      }

      container.innerHTML = ratedOrders.map(o => `
        <div class="review-bubble">
          <div class="review-bubble-header">
            <div>
              <strong style="color:var(--gold-light);">${o.orderId}</strong>
              <span style="font-size:0.82rem; color:var(--text-muted); margin-right:8px;">${window.YRUtils.formatDateArabic(o.review.createdAt || o.createdAt)}</span>
            </div>
            <div class="stars-row">${'⭐'.repeat(Math.min(5, o.review.rating))}</div>
          </div>
          <div class="review-comment">
            ${o.review.comment ? `"${window.YRUtils.escapeHtml(o.review.comment)}"` : '<em style="color:var(--text-muted); font-size:0.85rem;">(لم يترك العميل تعليقاً نصياً)</em>'}
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
            العميل: ${window.YRUtils.escapeHtml(o.customerName || 'عميل المتجر')} | هاتف: ${window.YRUtils.escapeHtml(o.customerPhone || '---')}
          </div>
        </div>
      `).join('');
    },

    // =========================================
    // TAB 5: MARKETING CAMPAIGNS (ADMIN)
    // =========================================
    async loadMarketingStats() {
      try {
        const res = await fetch('/api/marketing/stats');
        if (res.ok) {
          const data = await res.json();
          const stats = data.stats || data;
          const countEl = document.getElementById('marketingActiveSubscribersCount');
          const mobileEl = document.getElementById('marketingMobileCount');
          const desktopEl = document.getElementById('marketingDesktopCount');
          const new7El = document.getElementById('marketingNew7DaysCount');

          if (countEl) countEl.textContent = stats.totalActive || 0;
          if (new7El) new7El.textContent = stats.newLast7Days || 0;

          if (Array.isArray(stats.byDevice)) {
            const mob = stats.byDevice.find(d => d._id === 'mobile') || { count: 0 };
            const desk = stats.byDevice.find(d => d._id === 'desktop') || { count: 0 };
            if (mobileEl) mobileEl.textContent = mob.count || 0;
            if (desktopEl) desktopEl.textContent = desk.count || 0;
          }
        }
      } catch (err) {
        console.error('Error loading marketing stats:', err);
      }
    },

    async sendMarketingCampaign() {
      const title = document.getElementById('campaignTitleInput').value.trim();
      const body = document.getElementById('campaignBodyInput').value.trim();
      const url = document.getElementById('campaignUrlInput').value.trim();
      const btn = document.getElementById('btnSendCampaign');

      if (!confirm(`هل أنت متأكد من رغبتك في إرسال الإشعار لجميع العملاء؟\nالعنوان: ${title}`)) return;

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الإشعارات...';

      try {
        const res = await fetch('/api/marketing/campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, url })
        });
        const data = await res.json();
        if (data.success) {
          this.showToast(`تم إرسال الحملة بنجاح إلى ${data.sent || 0} مشترك ✓`);
          document.getElementById('marketingCampaignForm').reset();
        } else {
          this.showToast(data.error || 'فشل إرسال الحملة');
        }
      } catch (err) {
        this.showToast('تعذر الاتصال بالخادم');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال الحملة لجميع العملاء';
      }
    },

    // =========================================
    // TAB 6: BRAND IDENTITY & WHATSAPP TEMPLATES (ADMIN)
    // =========================================
    async loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const s = await res.json();
        this.state.settings = s || {};

        // Identity
        const nameAr = document.getElementById('cfgBrandNameAr');
        const nameEn = document.getElementById('cfgBrandNameEn');
        const sloganAr = document.getElementById('cfgBrandSloganAr');
        const logoUrl = document.getElementById('cfgBrandLogoUrl');
        const annText = document.getElementById('cfgBrandAnnouncement');
        const annActive = document.getElementById('cfgBrandAnnouncementActive');

        if (nameAr) nameAr.value = s.storeNameAr || s.siteName || 'يلوروز';
        if (nameEn) nameEn.value = s.storeNameEn || 'YELLOW ROSE';
        if (sloganAr) sloganAr.value = s.sloganAr || s.siteTagline || 'للورد والمناسبات';
        if (logoUrl) logoUrl.value = s.logoUrl || '/assets/logo.png';
        if (annText) annText.value = s.announcement || '';
        if (annActive) annActive.checked = !!s.announcementActive;

        this.updateLogoPreview(s.logoUrl || '/assets/logo.png');

        // WhatsApp Templates
        const waConfirm = document.getElementById('cfgWaOrderConfirm');
        const waReady = document.getElementById('cfgWaOrderReady');
        const waReview = document.getElementById('cfgWaReviewRating');
        const waInquiry = document.getElementById('cfgWaCatalogInquiry');

        if (waConfirm) {
          waConfirm.value = s.waOrderConfirm || s.whatsappConfirmMessage || 
`مرحباً بك عميلنا العزيز {customer_name} في يلوروز 💛
تم استلام طلبك وبدأنا في تجهيزه بكل عناية برقم:
🔢 *{order_id}*

📱 يمكنك متابعة حالة طلبك وتجهيزه مباشرة والنداء على الموظف عبر الرابط التالي:
{pager_url}

شاكرين وممتنين لاختيارك يلوروز ✨`;
        }

        if (waReady) {
          waReady.value = s.waOrderReady || s.whatsappReadyMessage ||
`يسعدنا إبلاغك عميلنا العزيز {customer_name} 🌸
بأن طلبك رقم *{order_id}* أصبح جاهزاً تماماً للاستلام الآن في الفرع! 💐

📍 يسعدنا تشريفك، أو يمكنك استخدام زر (أنا عند الباب) عبر رابط البيجر:
{pager_url}`;
        }

        if (waReview) {
          waReview.value = s.waReviewRating || s.whatsappRatingMessage ||
`عميلنا العزيز {customer_name} 🌹
سعدنا جداً بخدمتك اليوم في يلوروز!
رأيك يهمنا ويسعدنا مشاركتك لتجربتك وتقييم الخدمة عبر الرابط التالي:
{rating_url}

نتطلع لرؤيتك مجدداً بكل حب 💛`;
        }

        if (waInquiry) {
          waInquiry.value = s.waCatalogInquiry || s.catalogInquiryMessage ||
`مرحباً يلوروز 💛
أود الاستفسار والتنسيق بخصوص المنتج:
{product_name}
الرابط: {product_url}`;
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    },

    updateLogoPreview(url) {
      const img = document.getElementById('previewBrandLogoImg');
      if (img && url) {
        img.src = url;
      }
    },

    insertTag(textareaId, tag) {
      const textarea = document.getElementById(textareaId);
      if (!textarea) return;
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const val = textarea.value;
      textarea.value = val.substring(0, start) + tag + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + tag.length;
      textarea.focus();
    },

    async saveBrandAndWhatsappSettings() {
      const btn = document.getElementById('btnSaveBrandAndWhatsapp');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري حفظ الإعدادات...';

      try {
        const storeNameAr = (document.getElementById('cfgBrandNameAr')?.value || '').trim();
        const storeNameEn = (document.getElementById('cfgBrandNameEn')?.value || '').trim();
        const sloganAr = (document.getElementById('cfgBrandSloganAr')?.value || '').trim();
        const logoUrl = (document.getElementById('cfgBrandLogoUrl')?.value || '').trim();
        const announcement = (document.getElementById('cfgBrandAnnouncement')?.value || '').trim();
        const announcementActive = !!document.getElementById('cfgBrandAnnouncementActive')?.checked;

        const waOrderConfirm = (document.getElementById('cfgWaOrderConfirm')?.value || '').trim();
        const waOrderReady = (document.getElementById('cfgWaOrderReady')?.value || '').trim();
        const waReviewRating = (document.getElementById('cfgWaReviewRating')?.value || '').trim();
        const waCatalogInquiry = (document.getElementById('cfgWaCatalogInquiry')?.value || '').trim();

        const payload = Object.assign({}, this.state.settings, {
          storeNameAr,
          siteName: storeNameAr,
          storeNameEn,
          sloganAr,
          siteTagline: sloganAr,
          logoUrl,
          announcement,
          announcementActive,
          waOrderConfirm,
          whatsappConfirmMessage: waOrderConfirm,
          waOrderReady,
          whatsappReadyMessage: waOrderReady,
          waReviewRating,
          whatsappRatingMessage: waReviewRating,
          waCatalogInquiry,
          catalogInquiryMessage: waCatalogInquiry
        });

        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success || res.ok) {
          this.state.settings = payload;
          this.showToast('تم حفظ وتحديث إعدادات الهوية ورسائل الواتساب بنجاح ✓');
        } else {
          this.showToast(data.error || 'فشل حفظ الإعدادات');
        }
      } catch (err) {
        this.showToast('تعذر الاتصال بالخادم');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> حفظ جميع إعدادات الهوية والرسائل';
      }
    },

    // =========================================
    // TAB 7: SECURITY & DYNAMIC PINS (ADMIN)
    // =========================================
    async updateSecurityPins() {
      const adminPin = document.getElementById('newAdminPinInput').value.trim();
      const employeePin = document.getElementById('newEmployeePinInput').value.trim();
      const btn = document.getElementById('btnSavePins');

      if (!adminPin && !employeePin) {
        this.showToast('يرجى إدخال رمز جديد واحد على الأقل لتحديثه');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري حفظ الرموز وتحديث التشفير...';

      try {
        const payload = {};
        if (adminPin) payload.adminPin = adminPin;
        if (employeePin) payload.employeePin = employeePin;

        const res = await fetch('/api/settings/pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
          this.showToast('تم تحديث وتفعيل الرموز الجديدة بنجاح ✓');
          document.getElementById('newAdminPinInput').value = '';
          document.getElementById('newEmployeePinInput').value = '';
        } else {
          this.showToast(data.error || 'فشل تحديث الرموز');
        }
      } catch (err) {
        this.showToast('تعذر الاتصال بالخادم');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> حفظ وتفعيل الرموز الجديدة';
      }
    },

    // =========================================
    // AUDIO NOTIFICATIONS (SYNTHESIZED CHIMES)
    // =========================================
    toggleAudio() {
      this.state.audioEnabled = !this.state.audioEnabled;
      const btnText = document.getElementById('audioStatusText');
      const btn = document.getElementById('audioToggleBtn');
      if (this.state.audioEnabled) {
        if (btnText) btnText.textContent = 'الصوت مفعّل';
        if (btn) btn.querySelector('i').className = 'fas fa-volume-up text-gold';
        this.showToast('تم تفعيل التنبيهات الصوتية 🔔');
      } else {
        if (btnText) btnText.textContent = 'الصوت مكتوم';
        if (btn) btn.querySelector('i').className = 'fas fa-volume-mute';
        this.showToast('تم كتم التنبيهات الصوتية');
      }
    },

    playNotificationChime() {
      if (!this.state.audioEnabled) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch (e) {}
    },

    playCallAlertChime() {
      if (!this.state.audioEnabled) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } catch (e) {}
    },

    // =========================================
    // TOAST NOTIFICATIONS
    // =========================================
    showToast(msg) {
      const toast = document.getElementById('portalToast');
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3200);
    }
  };

  window.PortalApp = PortalApp;

  document.addEventListener('DOMContentLoaded', () => {
    PortalApp.init();
  });
})();
