let pollingInterval = null;
let currentSelectedOrder = null;

document.addEventListener('DOMContentLoaded', () => {
  const token = getCookie('auth_token');
  if (!token) {
    document.getElementById('loginOverlay').style.display = 'flex';
  } else {
    document.getElementById('loginOverlay').style.display = 'none';
    startPolling();
  }

  // Setup Event Listeners
  const el = (id) => document.getElementById(id);
  if (el('loginBtn')) el('loginBtn').addEventListener('click', handleLogin);
  if (el('logoutBtn')) el('logoutBtn').addEventListener('click', logout);
  if (el('refreshBtn')) el('refreshBtn').addEventListener('click', fetchOrders);
  if (el('qcOpenBtn')) el('qcOpenBtn').addEventListener('click', openQuickCreateModal);
  if (el('qcPreviewBtn')) el('qcPreviewBtn').addEventListener('click', previewQuickCreate);
  if (el('qcCancelBtn')) el('qcCancelBtn').addEventListener('click', closeQuickCreateModal);
  if (el('readyBtn')) el('readyBtn').addEventListener('click', markOrderReady);
  if (el('printBtn')) el('printBtn').addEventListener('click', printCard);
  
  // Also expose to window for inline HTML onclick handlers just in case
  window.selectOrder = selectOrder;
  window.handleLogin = handleLogin;
});

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return match[2];
  return null;
}

async function handleLogin() {
  const pin = document.getElementById('employeePin').value;
  try {
    const res = await fetch('/api/auth/employee-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('loginOverlay').style.display = 'none';
      startPolling();
    } else {
      document.getElementById('loginError').style.display = 'block';
    }
  } catch (err) {
    document.getElementById('loginError').style.display = 'block';
  }
}

function logout() {
  document.cookie = 'auth_token=; Max-Age=0; path=/';
  clearInterval(pollingInterval);
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('employeePin').value = '';
}

function startPolling() {
  fetchOrders();
  pollingInterval = setInterval(fetchOrders, 10000); // 10 seconds
}

let allOrders = [];

async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    const data = await res.json();
    allOrders = data.orders || data; // support both formats
    filterOrders();
  } catch (err) {
    console.error('Error fetching orders', err);
  }
}

function filterOrders() {
  const searchInput = document.getElementById('orderSearchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  if (!query) {
    renderOrders(allOrders.filter(o => o.needsPrint === true || (o.cardData && o.cardData.message)));
    return;
  }
  
  const filtered = allOrders.filter(o => 
    (o.needsPrint === true || (o.cardData && o.cardData.message)) && 
    (o.orderId && o.orderId.toLowerCase().includes(query))
  );
  renderOrders(filtered);
}

function renderOrders(orders) {
  const list = document.getElementById('ordersList');
  if (!orders || orders.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#888;">لا توجد طلبات كروت إهداء حالياً.</p>';
    return;
  }
  
  let html = '';
  orders.forEach(order => {
    const isActive = currentSelectedOrder && currentSelectedOrder._id === order._id;
    let statusClass = 'status-pending';
    let statusText = 'قيد الانتظار';
    if (order.status === 'printed') {
      statusClass = 'status-printed';
      statusText = 'مطبوع';
    } else if (order.status === 'ready') {
      statusClass = 'status-printed';
      statusText = 'جاهز';
    } else if (order.status === 'completed') {
      statusClass = 'status-printed';
      statusText = 'مكتمل';
    }
    
    html += `
      <div class="order-card ${isActive ? 'active' : ''}" data-order="${escapeHtml(JSON.stringify(order))}" onclick="selectOrder(JSON.parse(this.dataset.order))">
        <div style="display:flex; justify-content:space-between;">
          <div class="order-id">${order.orderId}</div>
          <div class="order-status ${statusClass}">${statusText}</div>
        </div>
        <div class="order-title">المنتج: ${escapeHtml(order.productTitle || 'إنشاء فوري')}</div>
        <div style="font-size:13px; color:#555;">إلى: ${escapeHtml((order.cardData && order.cardData.recipient) ? order.cardData.recipient : 'غير محدد')}</div>
      </div>
    `;
  });
  list.innerHTML = html;
}

function selectOrder(order) {
  currentSelectedOrder = order;
  // highlight active card
  document.querySelectorAll('.order-card').forEach(card => {
    card.classList.remove('active');
    if (card.querySelector('.order-id').textContent === order.orderId) {
      card.classList.add('active');
    }
  });
  
  // render canvas
  const cardData = order.cardData || {};
  renderCanvas(cardData.recipient, cardData.message || order.message, cardData.sender, cardData.fontFamily, cardData.fontSize, cardData.textAlign || order.alignment);
  
  // enable print
  document.getElementById('printBtn').disabled = false;
  
  // enable pager ready button & render QR
  const readyBtn = document.getElementById('readyBtn');
  const pagerSection = document.getElementById('pagerQrSection');
  
  if (order.status !== 'ready' && order.status !== 'completed') {
    readyBtn.disabled = false;
  } else {
    readyBtn.disabled = true;
  }

  if (order.pagerToken) {
    pagerSection.style.display = 'block';
    const pagerUrl = window.location.origin + '/pager.html?token=' + order.pagerToken;
    document.getElementById('pagerLink').href = pagerUrl;
    
    // Generate QR Code
    new QRious({
      element: document.getElementById('pagerQrCanvas'),
      value: pagerUrl,
      size: 200,
      background: 'white',
      foreground: 'black'
    });
  } else {
    pagerSection.style.display = 'none';
  }
}

async function markOrderReady() {
  if (!currentSelectedOrder) return;
  
  const btn = document.getElementById('readyBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحديث...';
  
  try {
    const res = await fetch(`/api/orders/${currentSelectedOrder.orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ready' })
    });
    const data = await res.json();
    if (data.success) {
      btn.innerHTML = '<i class="fas fa-check"></i> تم تنبيه العميل';
      btn.style.background = '#27ae60';
      fetchOrders(); // Refresh the list
    } else {
      alert('حدث خطأ: ' + data.error);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-bell"></i> 🔔 العميل جاهز للاستلام';
    }
  } catch (error) {
    alert('حدث خطأ في الاتصال بالخادم');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-bell"></i> 🔔 العميل جاهز للاستلام';
  }
}

function renderCanvas(recipient, message, sender, font, size, align) {
  const recEl = document.getElementById('canvasRecipient');
  const msgEl = document.getElementById('canvasMessage');
  const senEl = document.getElementById('canvasSender');
  
  recEl.textContent = recipient ? 'إلى: ' + recipient : '';
  msgEl.textContent = message || '';
  senEl.textContent = sender ? 'من: ' + sender : '';
  
  msgEl.style.fontFamily = font || 'Tajawal';
  msgEl.style.fontSize = size || '14pt';
  msgEl.style.textAlign = align || 'center';
}

function openQuickCreateModal() {
  document.getElementById('quickCreateModal').style.display = 'flex';
}

function closeQuickCreateModal() {
  document.getElementById('quickCreateModal').style.display = 'none';
}

function previewQuickCreate() {
  const recipient = document.getElementById('qcRecipient').value;
  const message = document.getElementById('qcMessage').value;
  const sender = document.getElementById('qcSender').value;
  const font = document.getElementById('qcFont').value;
  let size = document.getElementById('qcSize').value;
  if(size < 8) size = 8;
  if(size > 100) size = 100;
  size = size + 'pt';
  const align = document.getElementById('qcAlign').value;
  
  if (!message.trim()) {
    alert('الرجاء كتابة نص الإهداء');
    return;
  }
  
  currentSelectedOrder = {
    orderId: 'فوري',
    recipientName: recipient,
    message: message,
    senderName: sender,
    fontFamily: font,
    fontSize: size,
    alignment: align,
    isQuickCreate: true
  };
  
  renderCanvas(recipient, message, sender, font, size, align);
  document.getElementById('printBtn').disabled = false;
  closeQuickCreateModal();
}

async function printCard() {
  if (!currentSelectedOrder) return;
  
  window.print();
  
  if (!currentSelectedOrder.isQuickCreate && currentSelectedOrder.status === 'pending') {
    try {
      await fetch(`/api/orders/${currentSelectedOrder.orderId}/print`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      fetchOrders();
    } catch (err) {
      console.error('Failed to update order status');
    }
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
