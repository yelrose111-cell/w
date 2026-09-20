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

async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    const orders = await res.json();
    renderOrders(orders);
  } catch (err) {
    console.error('Error fetching orders', err);
  }
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
    const isPending = order.status === 'pending';
    const statusClass = isPending ? 'status-pending' : 'status-printed';
    const statusText = isPending ? 'قيد الانتظار' : 'مطبوع';
    
    html += `
      <div class="order-card ${isActive ? 'active' : ''}" onclick='selectOrder(${JSON.stringify(order).replace(/'/g, "&#39;")})'>
        <div style="display:flex; justify-content:space-between;">
          <div class="order-id">${order.orderId}</div>
          <div class="order-status ${statusClass}">${statusText}</div>
        </div>
        <div class="order-title">المنتج: ${escapeHtml(order.productName || 'إنشاء فوري')}</div>
        <div style="font-size:13px; color:#555;">إلى: ${escapeHtml(order.recipientName || 'غير محدد')}</div>
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
  renderCanvas(order.recipientName, order.message, order.senderName, order.fontFamily, order.fontSize, order.alignment);
  
  // enable print
  document.getElementById('printBtn').disabled = false;
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
  const size = document.getElementById('qcSize').value;
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
