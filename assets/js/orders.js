// ==========================================
//  orders.js — Yellow Rose Sales Orders
// ==========================================

let allOrders = [];

// ─── On Load ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  // Setup Event Listeners
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

  // Expose for inline handlers
  window.updateStatus = updateStatus;
  window.showQrModal = showQrModal;
  window.fetchOrders = fetchOrders;
});

// ─── Auth ─────────────────────────────────
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
      errEl.style.display = 'block';
    }
  } catch {
    errEl.textContent = 'حدث خطأ في الاتصال بالخادم.';
    errEl.style.display = 'block';
  }
}

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  showLogin();
  document.getElementById('pinInput').value = '';
}

function showLogin() {
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('mainContent').style.display = 'none';
}
function showDashboard() {
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
}

// ─── Fetch ────────────────────────────────
async function fetchOrders() {
  const icon = document.getElementById('refreshIcon');
  if (icon) icon.className = 'fas fa-spinner spinner';

  try {
    const res = await fetch('/api/orders');
    if (res.status === 401 || res.status === 403) {
      showLogin();
      return;
    }
    const data = await res.json();
    if (data.success) {
      allOrders = (data.orders || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      applyFilters();
      updateStats();
      showToast('تم تحديث الطلبات ✓');
    }
  } catch {
    showToast('خطأ في الاتصال بالخادم');
  } finally {
    if (icon) icon.className = 'fas fa-sync-alt';
  }
}

// ─── Stats ────────────────────────────────
function updateStats() {
  document.getElementById('statTotal').textContent = allOrders.length;
  document.getElementById('statPending').textContent = allOrders.filter(o => o.status === 'pending').length;
  document.getElementById('statPreparing').textContent = allOrders.filter(o => o.status === 'preparing').length;
  document.getElementById('statReady').textContent = allOrders.filter(o => o.status === 'ready').length;
}

// ─── Filters ──────────────────────────────
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

// ─── Render ───────────────────────────────
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
    if (order.deliveryMethod) tags.push(`<span class="tag tag-delivery"><i class="fas fa-truck"></i> ${order.deliveryMethod}</span>`);

    // Card details
    const cardSection = order.cardData?.message ? `
      <div class="info-row" style="margin-top: 0.5rem; background: #fef9e7; border-radius: 8px; padding: 0.75rem; flex-direction: column; gap: 4px;">
        <div style="font-weight: 700; font-size: 0.85rem; color: #b8860b; margin-bottom: 4px;"><i class="fas fa-envelope-open-text"></i> كرت الإهداء</div>
        ${order.cardData.recipient ? `<div style="font-size: 0.85rem;"><strong>إلى:</strong> ${order.cardData.recipient}</div>` : ''}
        ${order.cardData.sender    ? `<div style="font-size: 0.85rem;"><strong>من:</strong> ${order.cardData.sender}</div>` : ''}
        <div style="font-size: 0.85rem; color: #555;"><strong>النص:</strong> ${order.cardData.message}</div>
      </div>` : '';

    const waPhone = (order.customerPhone || '').replace(/\D/g, '');

    const card = document.createElement('article');
    card.className = 'order-card';
    card.id = `order-${order.orderId}`;
    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="order-id">${order.orderId}</div>
          <div class="order-date">${dateStr}</div>
        </div>
        <span class="status-badge ${st.cls}">${st.label}</span>
      </div>

      <div class="card-body">
        <div class="info-row">
          <i class="fas fa-user"></i>
          <span class="info-label">العميل:</span>
          <span class="info-value">${order.customerName || 'غير محدد'}</span>
        </div>
        <div class="info-row">
          <i class="fas fa-phone-alt"></i>
          <span class="info-label">الجوال:</span>
          <span class="info-value">${order.customerPhone || '—'}</span>
        </div>
        <div class="info-row">
          <i class="fas fa-box-open"></i>
          <span class="info-label">المنتج:</span>
          <span class="info-value">${order.productTitle || 'غير محدد'}</span>
        </div>
        ${tags.length > 0 ? `<div class="tags">${tags.join('')}</div>` : ''}
        ${cardSection}
      </div>

      <div class="card-footer">
        <select class="status-select" data-order-id="${order.orderId}" onchange="updateStatus('${order.orderId}', this.value)">
          <option value="pending"   ${order.status === 'pending'   ? 'selected' : ''}>⏳ قيد الانتظار</option>
          <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>⚙️ جاري التجهيز</option>
          <option value="ready"     ${order.status === 'ready'     ? 'selected' : ''}>✅ جاهز</option>
          <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>🏁 مكتمل</option>
        </select>
        </select>
        ${order.pagerToken ? `<button class="action-btn btn-dark" onclick="showQrModal('${order.pagerToken}')">
          <i class="fas fa-qrcode"></i> نداء
        </button>` : ''}
        ${waPhone ? `<a class="action-btn btn-green" href="https://wa.me/${waPhone}" target="_blank" rel="noopener">
          <i class="fab fa-whatsapp"></i> واتساب
        </a>` : ''}
      </div>
    `;
    grid.appendChild(card);
  });
}

// ─── Update Status ────────────────────────
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
      showToast('تم تحديث حالة الطلب ✓');
    } else {
      showToast('فشل تحديث الحالة ✗');
      fetchOrders();
    }
  } catch {
    showToast('خطأ في الاتصال ✗');
  }
}

// ─── Toast ────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── Modals Logic ─────────────────────────
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
  const orderType = document.getElementById('noOrderType').value;
  const notes = document.getElementById('noNotes').value.trim();

  const newOrder = {
    customerName,
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
        showQrModal(data.order.pagerToken);
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

function showQrModal(token) {
  const modal = document.getElementById('qrModal');
  const pagerUrl = window.location.origin + '/pager.html?token=' + token;
  document.getElementById('qrLink').href = pagerUrl;
  
  new QRious({
    element: document.getElementById('qrCanvas'),
    value: pagerUrl,
    size: 250,
    background: 'white',
    foreground: 'black'
  });
  
  modal.classList.add('active');
}

function closeQrModal() {
  document.getElementById('qrModal').classList.remove('active');
}
