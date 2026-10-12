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
      products: [],
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
        item.addEventListener('click', (e) => {
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

      const qcBtn = document.getElementById('btnQuickCreateCardModal');
      if (qcBtn) qcBtn.addEventListener('click', () => this.openQuickPrintModal());
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
      if (this.state.role !== 'admin' && ['products', 'reviews', 'marketing', 'settings'].includes(tabId)) {
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
        settings: 'إدارة الرموز والأمان'
      };
      const titleEl = document.getElementById('topbarTitle');
      if (titleEl && titles[tabId]) titleEl.textContent = titles[tabId];

      // Close mobile sidebar if open
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');

      if (tabId === 'reviews') this.renderReviews();
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
      const custName = order.customerName && order.customerName !== 'عميل عبر الواتساب' ? ` ${order.customerName}` : '';
      const pagerUrl = window.location.origin + '/p/' + (order.pagerToken || order.orderId);

      return `مرحباً بك عميلنا العزيز${custName}، يسعدنا ونتشرف بخدمتك في Yellow Rose 💛\n\nتم استلام طلبك وبدأنا في تجهيزه بكل عناية برقم:\n🔢 *${orderId}*\n\n📱 يمكنك متابعة حالة طلبك وتجهيزه مباشرة عبر الرابط التالي:\n${pagerUrl}\n\nشاكرين وممتنين لاختيارك لنا ✨`;
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

    openQuickPrintModal() {
      document.getElementById('modalQuickPrint').classList.add('active');
    },

    applyQuickCard() {
      const rec = document.getElementById('qpRecipient').value.trim();
      const msg = document.getElementById('qpMessage').value.trim();
      const snd = document.getElementById('qpSender').value.trim();

      document.getElementById('inputCardRecipient').value = rec;
      document.getElementById('inputCardMessage').value = msg;
      document.getElementById('inputCardSender').value = snd;

      this.state.currentPrintOrder = null;
      this.syncCanvasFromInputs();
      this.closeModals();
      this.showToast('تم تجهيز الكرت الفوري للطباعة');
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
        const [catsRes, prodsRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/products')
        ]);
        if (catsRes.ok) this.state.categories = await catsRes.json();
        if (prodsRes.ok) this.state.products = await prodsRes.json();

        this.renderCategoriesList();
        this.renderProductsTable();
      } catch (err) {
        console.error('Error loading catalog data:', err);
      }
    },

    renderCategoriesList() {
      const container = document.getElementById('categoryTreeList');
      if (!container) return;
      const cats = this.state.categories;
      if (cats.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">لا توجد أقسام مسجلة.</p>';
        return;
      }
      container.innerHTML = cats.map(c => `
        <div class="category-tree-item">
          <div>
            <strong>${window.YRUtils.escapeHtml(c.name)}</strong>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-right:4px;">(كود: ${c.prefix || 'YR'})</span>
          </div>
          <button style="background:none; border:none; color:var(--red); cursor:pointer;" onclick="window.PortalApp.deleteCategory('${c.id}')" title="حذف القسم">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `).join('');
    },

    renderProductsTable() {
      const tbody = document.getElementById('productsTableBody');
      if (!tbody) return;
      const prods = this.state.products;
      if (prods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">لا توجد منتجات مسجلة.</td></tr>';
        return;
      }
      tbody.innerHTML = prods.map(p => `
        <tr>
          <td><img src="${p.coverUrl || '/assets/logo.png'}" class="table-thumb" alt="Product"></td>
          <td><strong style="color:var(--gold-light);">${p.productCode || 'YR-00'}</strong></td>
          <td>${window.YRUtils.escapeHtml(p.title)}</td>
          <td>${p.categoryName || '---'}</td>
          <td><span class="order-badge badge-ready">نشط</span></td>
          <td>
            <button style="background:none; border:none; color:var(--red); cursor:pointer; font-size:1rem;" onclick="window.PortalApp.deleteProduct('${p.id}')" title="حذف المنتج">
              <i class="fas fa-trash-alt"></i>
            </button>
          </td>
        </tr>
      `).join('');
    },

    async deleteCategory(id) {
      if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
      try {
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
          this.showToast('تم حذف القسم بنجاح ✓');
          this.loadCategoriesAndProducts();
        }
      } catch (e) {
        this.showToast('فشل حذف القسم');
      }
    },

    async deleteProduct(id) {
      if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
      try {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        if (res.ok) {
          this.showToast('تم حذف المنتج بنجاح ✓');
          this.loadCategoriesAndProducts();
        }
      } catch (e) {
        this.showToast('فشل حذف المنتج');
      }
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
          const stats = await res.json();
          const countEl = document.getElementById('marketingActiveSubscribersCount');
          if (countEl) countEl.textContent = stats.totalActive || 0;
        }
      } catch (err) {}
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
    // TAB 6: SECURITY & DYNAMIC PINS (ADMIN)
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
