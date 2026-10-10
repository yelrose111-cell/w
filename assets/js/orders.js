// ==========================================
//  orders.js — Yellow Rose Sales Orders (SECURED)
// ==========================================

let allOrders = [];

// ✅ XSS Protection Helper
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatWhatsAppPhone(phone) {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('00966')) clean = clean.substring(2);
  if (clean.startsWith('05')) clean = '966' + clean.substring(1);
  else if (clean.startsWith('5') && clean.length === 9) clean = '966' + clean;
  return clean;
}

function buildOrderShareMessage(orderId, pagerUrl, customerName) {
  const greeting = (customerName && customerName !== '---')
    ? `مرحباً بك عميلنا العزيز ${customerName}، يسعدنا ونتشرف بخدمتك في Yellow Rose 💛`
    : `مرحباً بك عميلنا العزيز، يسعدنا ونتشرف بخدمتك في Yellow Rose 💛`;
    
  return `${greeting}

تم استلام طلبك وبدأنا في تجهيزه بكل عناية واهتمام برقم:
🔢 *${orderId}*

📱 يمكنك متابعة حالة طلبك مباشرة واستلام تنبيه فوري عند جاهزيته عبر الرابط التالي:
${pagerUrl}

شاكرين وممتنين لاختيارك لنا، ونسعد دائماً بخدمتك ✨`;
}

// Cooldown tracking for ping buttons
const pingCooldowns = new Map();

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    const el = (id) => document.getElementById(id);
    if (el('loginForm')) el('loginForm').addEventListener('submit', handleLogin);
    if (el('logoutBtn')) el('logoutBtn').addEventListener('click', handleLogout);
    if (el('searchOrder')) el('searchOrder').addEventListener('input', applyFilters);
    if (el('statusFilter')) el('statusFilter').addEventListener('change', applyFilters);
    
    if (el('btnOpenNewOrder')) el('btnOpenNewOrder').addEventListener('click', openNewOrderModal);
    if (el('btnCloseNewOrder')) el('btnCloseNewOrder').addEventListener('click', closeNewOrderModal);
    if (el('btnCancelNewOrder')) el('btnCancelNewOrder').addEventListener('click', closeNewOrderModal);
    if (el('newOrderForm')) el('newOrderForm').addEventListener('submit', handleNewOrderSubmit);
    if (el('btnCloseQrModal')) el('btnCloseQrModal').addEventListener('click', closeQrModal);
    
    window.updateStatus = updateStatus;
    window.showQrModal = showQrModal;
    window.showRatingQrModal = showRatingQrModal;
    window.fetchOrders = fetchOrders;
    window.pingOrder = pingOrder;
});

async function checkAuth() {
  try {
    const res = await fetch('/api/orders?_check=1');
    if (res.status === 401 || res.status === 403) {
      showLogin();
    } else {
      showDashboard();
      const data = await res.json();
      allOrders = (data.orders || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      applyFilters();
      updateStats();
    }
  } catch {
    showLogin();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const pin = document.getElementById('pinInput').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';

  try {
    const res = await fetch('/api/auth/employee-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (data.success) {
      showDashboard();
      fetchOrders();
    } else {
      if (data.error === 'Too many login attempts') {
        errEl.textContent = 'تم تجاوز عدد محاولات الدخول. يرجى الانتظار دقيقتين.';
      } else {
        errEl.textContent = 'رمز الدخول غير صحيح.';
      }
      errEl.style.display = 'block';
    }
  } catch {
    errEl.textContent = 'حدث خطأ في الاتصال بالخادم.';
    errEl.style.display = 'block';
  }
}

let ordersPollingTimer = null;
let lastKnownOrdersCount = 0;

function playNewOrderChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch(e) {}
}

function startPollingOrders() {
  if (ordersPollingTimer) clearInterval(ordersPollingTimer);
  ordersPollingTimer = setInterval(() => {
    fetchOrders(true);
  }, 5000);
}

function stopPollingOrders() {
  if (ordersPollingTimer) {
    clearInterval(ordersPollingTimer);
    ordersPollingTimer = null;
  }
}

async function handleLogout() {
  stopPollingOrders();
  await fetch('/api/auth/logout', { method: 'POST' });
  showLogin();
  document.getElementById('pinInput').value = '';
}

function showLogin() {
  stopPollingOrders();
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('mainContent').style.display = 'none';
}
function showDashboard() {
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  startPollingOrders();
}

async function fetchOrders(isSilent = false) {
  const icon = document.getElementById('refreshIcon');
  if (icon && !isSilent) icon.className = 'fas fa-spinner spinner';

  try {
    const res = await fetch('/api/orders');
    if (res.status === 401 || res.status === 403) {
      stopPollingOrders();
      showLogin();
      return;
    }
    const data = await res.json();
    if (data.success) {
      const newOrders = (data.orders || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      if (lastKnownOrdersCount > 0 && newOrders.length > lastKnownOrdersCount) {
        playNewOrderChime();
        showToast('🔔 وصل طلب جديد للتو!');
      }
      lastKnownOrdersCount = newOrders.length;
      allOrders = newOrders;
      
      applyFilters();
      updateStats();
      if (!isSilent) showToast('تم تحديث الطلبات ✓');
    }
  } catch {
    if (!isSilent) showToast('خطأ في الاتصال بالخادم');
  } finally {
    if (icon && !isSilent) icon.className = 'fas fa-sync-alt';
  }
}

function updateStats() {
  document.getElementById('statTotal').textContent = allOrders.length;
  document.getElementById('statPending').textContent = allOrders.filter(o => o.status === 'pending').length;
  document.getElementById('statPreparing').textContent = allOrders.filter(o => o.status === 'preparing').length;
  document.getElementById('statReady').textContent = allOrders.filter(o => o.status === 'ready').length;
}

function applyFilters() {
  const query = document.getElementById('searchOrder').value.trim().toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;

  const filtered = allOrders.filter(o => {
    const matchSearch = !query || (
      (o.orderId && o.orderId.toLowerCase().includes(query)) ||
      (o.customerName && o.customerName.toLowerCase().includes(query)) ||
      (o.productTitle && o.productTitle.toLowerCase().includes(query))
    );
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  renderOrders(filtered);
}

function renderOrders(orders) {
    const grid = document.getElementById('ordersGrid');
    grid.innerHTML = '';
    
    if (!orders || orders.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>لا توجد طلبات مطابقة.</p>
            </div>`;
        return;
    }
    
    const statusMap = {
        pending:   { label: 'قيد الانتظار',   cls: 'badge-pending' },
        preparing: { label: 'جاري التجهيز',   cls: 'badge-preparing' },
        ready:     { label: 'جاهز للاستلام', cls: 'badge-ready' },
        completed: { label: 'مكتمل',          cls: 'badge-completed' }
    };
    
    orders.forEach(order => {
        const st = statusMap[order.status] || statusMap['pending'];
        const dateStr = order.createdAt
            ? new Date(order.createdAt).toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—';
        
        const tags = [];
        if (order.isGift)     tags.push(`<span class="tag tag-gift"><i class="fas fa-gift"></i> هدية</span>`);
        if (order.needsPrint) tags.push(`<span class="tag tag-print"><i class="fas fa-print"></i> يحتاج طباعة</span>`);
        if (order.deliveryMethod) tags.push(`<span class="tag tag-delivery"><i class="fas fa-truck"></i> ${escapeHtml(order.deliveryMethod)}</span>`);
        
        // ✅ XSS Protection: Escape all user-provided fields
        const safeOrderId = escapeHtml(order.orderId);
        const safeCustomerName = escapeHtml(order.customerName || 'غير محدد');
        const safeCustomerPhone = escapeHtml(order.customerPhone || '—');
        const safeProductTitle = escapeHtml(order.productTitle || 'غير محدد');
        
        let cardSection = '';
        if (order.cardData?.message) {
            const safeRecipient = escapeHtml(order.cardData.recipient);
            const safeSender = escapeHtml(order.cardData.sender);
            const safeMessage = escapeHtml(order.cardData.message);
            
            cardSection = `
                <div class="info-row" style="margin-top: 0.5rem; background: #fef9e7; border-radius: 8px; padding: 0.75rem; flex-direction: column; gap: 4px;">
                    <div style="font-weight: 700; font-size: 0.85rem; color: #b8860b; margin-bottom: 4px;"><i class="fas fa-envelope-open-text"></i> كرت الإهداء</div>
                    ${safeRecipient ? `<div style="font-size: 0.85rem;"><strong>إلى:</strong> ${safeRecipient}</div>` : ''}
                    ${safeSender ? `<div style="font-size: 0.85rem;"><strong>من:</strong> ${safeSender}</div>` : ''}
                    <div style="font-size: 0.85rem; color: #555;"><strong>النص:</strong> ${safeMessage}</div>
                </div>`;
        }
        
        const waPhone = (order.customerPhone || '').replace(/\D/g, '');
        
        let reviewSection = '';
        if (order.review && order.review.rating) {
            const safeRating = Math.min(5, Math.max(1, order.review.rating));
            const stars = '⭐'.repeat(safeRating);
            const safeComment = order.review.comment 
                ? `<div style="font-size: 0.85rem; color: #166534; margin-top: 4px;">"${escapeHtml(order.review.comment)}"</div>` 
                : '<div style="font-size: 0.8rem; color: #888; margin-top: 2px;">(عميل لم يترك تعليقاً)</div>';
            reviewSection = `
                <div class="order-review" style="margin-top: 0.6rem; background: #f0fdf4; border-radius: 8px; padding: 0.6rem 0.8rem; border: 1px solid #bbf7d0;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-weight: 700; font-size: 0.85rem; color: #166534;"><i class="fas fa-star" style="color: #f59e0b;"></i> تقييم العميل</span>
                        <span style="font-size: 0.95rem; letter-spacing: 2px;">${stars}</span>
                    </div>
                    ${safeComment}
                </div>`;
        }

        const card = document.createElement('article');
        card.className = 'order-card';
        card.id = `order-${safeOrderId}`;
        
        // ✅ All user inputs are now escaped
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="order-id">${safeOrderId}</div>
                    <div class="order-date">${dateStr}</div>
                </div>
                <span class="status-badge ${st.cls}">${st.label}</span>
            </div>
            
            <div class="card-body">
                <div class="info-row">
                    <i class="fas fa-user"></i>
                    <span class="info-label">العميل:</span>
                    <span class="info-value">${safeCustomerName}</span>
                </div>
                <div class="info-row">
                    <i class="fas fa-phone-alt"></i>
                    <span class="info-label">الجوال:</span>
                    <span class="info-value">${safeCustomerPhone}</span>
                </div>
                <div class="info-row">
                    <i class="fas fa-box-open"></i>
                    <span class="info-label">المنتج:</span>
                    <span class="info-value">${safeProductTitle}</span>
                </div>
                ${tags.length > 0 ? `<div class="tags">${tags.join('')}</div>` : ''}
                ${cardSection}
                ${reviewSection}
            </div>
            
            <div class="card-footer">
                <select class="status-select" data-order-id="${safeOrderId}" onchange="updateStatus('${safeOrderId}', this.value)">
                    <option value="pending"   ${order.status === 'pending'   ? 'selected' : ''}>⏳ قيد الانتظار</option>
                    <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>⚙️ جاري التجهيز</option>
                    <option value="ready"     ${order.status === 'ready'     ? 'selected' : ''}>✅ جاهز</option>
                    <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>🏁 مكتمل</option>
                </select>
                ${order.pagerToken && order.status === 'ready' ? `<button class="action-btn btn-dark" id="ping-${safeOrderId}" onclick="pingOrder('${safeOrderId}')" title="جعل هاتف العميل يرن مرة أخرى">
                    <i class="fas fa-bell"></i> إعادة النداء
                </button>` : ''}
                ${order.pagerToken && order.status !== 'ready' && order.status !== 'completed' ? `<button class="action-btn btn-dark" onclick="showQrModal('${escapeHtml(order.pagerToken)}', '${safeOrderId}', '${escapeHtml(order.customerPhone && order.customerPhone !== '0500000000' && order.customerPhone !== '0000000000' ? order.customerPhone : '')}', '${safeCustomerName}')">
                    <i class="fas fa-qrcode"></i> باركود ومشاركة
                </button>` : ''}
                ${order.status === 'completed' ? `<button class="action-btn btn-dark" onclick="showRatingQrModal('${safeOrderId}')">
                    <i class="fas fa-star"></i> تقييم
                </button>` : ''}
                ${waPhone && waPhone !== '0000000000' && waPhone !== '0500000000' ? `<a class="action-btn btn-green" href="https://wa.me/${formatWhatsAppPhone(order.customerPhone)}?text=${encodeURIComponent(buildOrderShareMessage(safeOrderId, window.location.origin + '/pager.html?token=' + encodeURIComponent(safeOrderId), safeCustomerName))}" target="_blank" rel="noopener" title="إرسال رابط المتابعة للعميل">
                    <i class="fab fa-whatsapp"></i> واتساب
                </a>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

// ✅ FIX: Added Cooldown to pingOrder
async function pingOrder(orderId) {
    // Check cooldown
    const lastPing = pingCooldowns.get(orderId) || 0;
    const now = Date.now();
    const COOLDOWN_MS = 2000; // 2 seconds
    
    if (now - lastPing < COOLDOWN_MS) {
        showToast('انتظر قليلاً قبل إعادة النداء ⏱️');
        return;
    }
    
    const btn = document.getElementById(`ping-${orderId}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
    }
    
    try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/ping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
            showToast('تم إرسال نداء التنبيه للعميل 🔔');
            pingCooldowns.set(orderId, now);
        } else {
            showToast('فشل إرسال النداء ✗');
        }
    } catch (e) {
        showToast('خطأ في الاتصال ✗');
    } finally {
        if (btn) {
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-bell"></i> إعادة النداء';
            }, COOLDOWN_MS);
        }
    }
}

async function updateStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      const order = allOrders.find(o => o.orderId === orderId);
      if (order) order.status = newStatus;
      updateStats();
      renderOrders(allOrders);
      showToast('تم تحديث حالة الطلب ✓');
      if (newStatus === 'completed') {
        showRatingQrModal(orderId);
      }
    } else {
      showToast('فشل تحديث الحالة ✗');
      fetchOrders();
    }
  } catch {
    showToast('خطأ في الاتصال ✗');
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function openNewOrderModal() {
  document.getElementById('newOrderModal').classList.add('active');
  document.getElementById('noCustomerName').focus();
}

function closeNewOrderModal() {
  document.getElementById('newOrderModal').classList.remove('active');
  document.getElementById('newOrderForm').reset();
}

async function handleNewOrderSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitNewOrder');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';

  const customerName = document.getElementById('noCustomerName').value.trim();
  const rawCustomerPhone = (document.getElementById('noCustomerPhone')?.value || '').trim();
  const orderType = document.getElementById('noOrderType').value;
  const notes = document.getElementById('noNotes').value.trim();

  // تنظيف وتجهيز رقم الجوال بما يوافق متطلبات السيرفر
  const customerPhone = rawCustomerPhone ? rawCustomerPhone.replace(/[^\d+]/g, '') : '0500000000';

  const newOrder = {
    customerName,
    customerPhone: customerPhone || '0500000000',
    productTitle: orderType,
    notes,
    status: 'pending',
    needsPrint: orderType === 'طباعة كارت',
    isGift: false
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder)
    });
    const data = await res.json();
    if (data.success) {
      closeNewOrderModal();
      showToast('تم إنشاء الطلب بنجاح ✓');
      await fetchOrders();
      if (data.order && data.order.pagerToken) {
        const dispPhone = (rawCustomerPhone && rawCustomerPhone.length >= 8) ? rawCustomerPhone : '';
        showQrModal(data.order.pagerToken, data.order.orderId, dispPhone, data.order.customerName);
      }
    } else {
      showToast('فشل إنشاء الطلب: ' + data.error);
    }
  } catch (err) {
    showToast('خطأ في الاتصال بالخادم');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'إنشاء وحفظ';
  }
}

function showQrModal(token, orderId = null, customerPhone = null, customerName = null) {
  const modal = document.getElementById('qrModal');
  const safeOrderId = orderId || 'طلبك';
  const pagerUrl = window.location.origin + '/pager.html?token=' + encodeURIComponent(orderId || token);
  
  const displayEl = document.getElementById('qrOrderDisplay');
  if (displayEl) {
    displayEl.textContent = orderId ? `رقم الطلب: ${orderId}` : '---';
  }

  const custDisplay = document.getElementById('qrCustomerDisplay');
  if (custDisplay) {
    custDisplay.textContent = (customerName && customerName !== '---') ? `👤 العميل: ${customerName}` : '';
  }

  new QRious({
    element: document.getElementById('qrCanvas'),
    value: pagerUrl,
    size: 250,
    background: 'white',
    foreground: 'black'
  });

  const shareText = buildOrderShareMessage(safeOrderId, pagerUrl, customerName);
  const cleanPhone = formatWhatsAppPhone(customerPhone);

  // زر واتساب المباشر
  const waBtn = document.getElementById('qrWaShareBtn');
  if (waBtn) {
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareText)}`
      : `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    waBtn.href = waUrl;
    waBtn.style.display = 'flex';
    waBtn.innerHTML = cleanPhone 
      ? `<i class="fab fa-whatsapp" style="font-size: 1.25rem;"></i> إرسال للعميل بالواتساب (${customerPhone})`
      : `<i class="fab fa-whatsapp" style="font-size: 1.25rem;"></i> إرسال الرابط للعميل بالواتساب`;
  }

  // زر مشاركة النظام
  const nativeBtn = document.getElementById('qrNativeShareBtn');
  if (nativeBtn) {
    nativeBtn.style.display = 'flex';
    nativeBtn.onclick = async () => {
      const shareData = {
        title: `Yellow Rose - طلب ${safeOrderId}`,
        text: shareText,
        url: pagerUrl
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (_) {}
      } else {
        try {
          await navigator.clipboard.writeText(pagerUrl);
          showToast('✓ تم نسخ رابط المتابعة');
        } catch {
          showToast('تعذر النسخ');
        }
      }
    };
  }

  // زر نسخ الرابط
  const copyBtn = document.getElementById('qrCopyLinkBtn');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(pagerUrl);
        showToast('✓ تم نسخ رابط المتابعة للحافظة');
      } catch {
        showToast('تعذر النسخ التلقائي');
      }
    };
  }

  // رابط فتح الصفحة
  const linkEl = document.getElementById('qrLink');
  if (linkEl) {
    linkEl.href = pagerUrl;
  }
  
  modal.classList.add('active');
}

function showRatingQrModal(orderId) {
  const modal = document.getElementById('qrModal');
  const ratingUrl = window.location.origin + '/rating.html?order=' + encodeURIComponent(orderId);
  
  const displayEl = document.getElementById('qrOrderDisplay');
  if (displayEl) {
    displayEl.textContent = orderId ? `تقييم الطلب: ${orderId}` : '';
  }

  const custDisplay = document.getElementById('qrCustomerDisplay');
  if (custDisplay) {
    custDisplay.textContent = '🌟 نسعد برأيك وتقييمك لخدمتنا';
  }
  
  new QRious({
    element: document.getElementById('qrCanvas'),
    value: ratingUrl,
    size: 250,
    background: 'white',
    foreground: 'black'
  });

  const ratingText = `عميلنا العزيز في Yellow Rose، نسعد بتقييم تجربتك معنا للطلب رقم *${orderId}* عبر الرابط التالي:\n${ratingUrl}`;

  const waBtn = document.getElementById('qrWaShareBtn');
  if (waBtn) {
    waBtn.href = `https://wa.me/?text=${encodeURIComponent(ratingText)}`;
    waBtn.innerHTML = `<i class="fab fa-whatsapp" style="font-size: 1.25rem;"></i> إرسال رابط التقييم بالواتساب`;
  }

  const nativeBtn = document.getElementById('qrNativeShareBtn');
  if (nativeBtn) {
    nativeBtn.onclick = async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: `تقييم طلب Yellow Rose - ${orderId}`,
            text: ratingText,
            url: ratingUrl
          });
        } catch (_) {}
      } else {
        await navigator.clipboard.writeText(ratingUrl);
        showToast('✓ تم نسخ رابط التقييم');
      }
    };
  }

  const copyBtn = document.getElementById('qrCopyLinkBtn');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      await navigator.clipboard.writeText(ratingUrl);
      showToast('✓ تم نسخ رابط التقييم');
    };
  }

  const linkEl = document.getElementById('qrLink');
  if (linkEl) {
    linkEl.href = ratingUrl;
  }
  
  modal.classList.add('active');
}

function closeQrModal() {
  document.getElementById('qrModal').classList.remove('active');
}
