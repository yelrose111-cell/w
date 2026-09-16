/**
 * يلوروز | YELLOW ROSE - Main Page Logic (index.html)
 * Album Grid Showcase, Category Filtering, Dynamic Search & Direct WhatsApp Order
 */

let allProducts = [];
let currentCategory = "all";
let searchQuery = "";

document.addEventListener("DOMContentLoaded", async () => {
  // Sync Site Settings (Announcement Bar & Logo)
  await window.YellowRoseDB.syncSiteSettingsToDom();

  setupNavigation();
  await loadAndRenderModernShowcase();
  setupSearchFilter();
});

// Setup Mobile Nav and Header Shadow
function setupNavigation() {
  const mobileBtn = document.getElementById("mobileMenuBtn");
  const navMenu = document.getElementById("navMenu");
  if (mobileBtn && navMenu) {
    mobileBtn.addEventListener("click", () => {
      navMenu.classList.toggle("open");
    });

    document.querySelectorAll(".nav-item").forEach(link => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("open");
      });
    });
  }

  window.addEventListener("scroll", () => {
    const header = document.getElementById("header");
    if (!header) return;
    if (window.scrollY > 50) {
      header.style.boxShadow = "0 6px 25px rgba(0, 0, 0, 0.08)";
    } else {
      header.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.03)";
    }
  });
}

// Removed Admin Indicator

// Load and Render Albums from DB

let allCategories = [];

// دالة جلب وعرض الأقسام والمنتجات بالنظام الحديث
async function loadAndRenderModernShowcase() {
  try {
    // 1. جلب الأقسام والمنتجات من قاعدة البيانات
    allCategories = await window.YellowRoseDB.getCategories();
    allProducts = await window.YellowRoseDB.getProducts();

    // تحديث كاش الأقسام العام
    window.CATEGORIES = {};
    allCategories.forEach(c => window.CATEGORIES[c.id] = c);

    // 2. رندرة شريط الأقسام الدائري
    renderCircularCategories(allCategories);

    // 3. رندرة الأقسام المميزة ووصل حديثاً
    renderProductTracks(allProducts);

    // Populate footer categories dynamically
    const footerGrid = document.getElementById("footerCategoriesGrid");
    if (footerGrid) {
      footerGrid.innerHTML = "";
      allCategories.forEach(cat => {
        const link = document.createElement("a");
        link.href = `catalog.html?category=${cat.id}`;
        link.textContent = cat.name;
        footerGrid.appendChild(link);
      });
    }

    // Populate mobile categories menu
    const mobileCats = document.getElementById("mobileCategoriesList");
    if (mobileCats) {
      mobileCats.innerHTML = "";
      allCategories.forEach(cat => {
        const link = document.createElement("a");
        link.href = `catalog.html?category=${cat.id}`;
        link.innerHTML = `<i class="fas ${cat.icon || 'fa-tag'}"></i> ${cat.name}`;
        mobileCats.appendChild(link);
      });
    }

  } catch (err) {
    console.error("فشل تحميل البيانات:", err);
  }
}

// 1. بناء شريط الأقسام الدائري
function renderCircularCategories(cats) {
  const track = document.getElementById("circularCategoriesTrack");
  if (!track) return;

  track.innerHTML = `
    <a href="catalog.html" class="category-circle-item active" title="عرض كل الأقسام">
      <div class="category-circle-img-box">
        <div class="category-circle-img" style="display:flex;align-items:center;justify-content:center;background:#F5EBD4;color:var(--gold-dark);font-size:22px;">
          <i class="fas fa-th-large"></i>
        </div>
      </div>
      <span class="category-circle-name">الكل</span>
    </a>
  `;

  cats.forEach(cat => {
    const cover = cat.coverUrl || 'assets/logo.png';
    const item = document.createElement("a");
    item.href = `catalog.html?category=${cat.id}`;
    item.className = "category-circle-item";
    item.innerHTML = `
      <div class="category-circle-img-box">
        <img src="${cover}" alt="${cat.name}" class="category-circle-img" loading="lazy" onerror="this.src='assets/logo.png';">
      </div>
      <span class="category-circle-name">${cat.name}</span>
    `;
    track.appendChild(item);
  });
}

// 2. بناء شريطي المنتجات (الأكثر طلباً + وصل حديثاً)
function renderProductTracks(products) {
  const featuredTrack = document.getElementById("featuredProductsTrack");
  const newArrivalsTrack = document.getElementById("newArrivalsTrack");

  // تصفية المنتجات المميزة (featured) أو أخذ أول 8 منتجات
  const featured = products.filter(p => p.featured);
  const featuredList = featured.length > 0 ? featured : products.slice(0, 8);

  // ترتيب المنتجات حسب الأحدث لوصل حديثاً
  const newArrivalsList = [...products].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 8);

  if (featuredTrack) {
    featuredTrack.innerHTML = "";
    featuredList.forEach(prod => featuredTrack.appendChild(createProductCard(prod)));
  }

  if (newArrivalsTrack) {
    newArrivalsTrack.innerHTML = "";
    newArrivalsList.forEach(prod => newArrivalsTrack.appendChild(createProductCard(prod)));
  }
}

// دالة مساعدة لتوليد قالب البطاقة الخالي من الأسعار
function createProductCard(product) {
  const catName = window.CATEGORIES[product.categoryId]?.name || "تنسيق فاخر";
  const cover = product.coverUrl || (product.images && product.images[0]?.url) || 'assets/logo.png';
  const waUrl = window.YellowRoseDB.buildWhatsAppUrl(product);

  const card = document.createElement("div");
  card.className = "modern-showcase-card";
  card.innerHTML = `
    <div class="card-media-box">
      <a href="catalog.html?id=${product.id}">
        <img src="${cover}" alt="${escapeHtml(product.title)}" class="card-media-img" loading="lazy" onerror="this.src='assets/logo.png';">
      </a>
      <span class="card-category-tag"><i class="fas fa-gem"></i> ${escapeHtml(catName)}</span>
    </div>

    <div class="card-details-box">
      <h4 class="card-product-title">
        <a href="catalog.html?id=${product.id}">${escapeHtml(product.title)}</a>
      </h4>
      <p class="card-product-desc">${escapeHtml(product.description) || "تنسيق متقن يعكس فخامة وأناقة مناسباتكم الراقية."}</p>
      
      <!-- أزرار الإجراءات دون أسعار ودون سلة -->
      <div class="card-dual-actions">
        <a href="catalog.html?id=${product.id}" class="btn-card-view">
          <i class="fas fa-eye"></i> تفاصيل العمل
        </a>
        <a href="${waUrl}" target="_blank" rel="noopener" class="btn-card-order">
          <i class="fab fa-whatsapp"></i> طلب بالواتساب
        </a>
      </div>
    </div>
  `;
  return card;
}

// 3. البحث السريع
function setupSearchFilter() {
  const searchInput = document.getElementById("gallerySearchInput");
  const mainShowcaseUI = document.getElementById("mainShowcaseUI");
  const defaultTracksUI = document.getElementById("defaultTracksUI");
  const searchResultsUI = document.getElementById("searchResultsUI");
  const searchResultsGrid = document.getElementById("searchResultsGrid");
  const noItems = document.getElementById("noItemsMessage");

  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    
    if (q === "") {
      // إخفاء نتائج البحث والعودة للواجهة الأصلية
      mainShowcaseUI.classList.remove("hidden");
      defaultTracksUI.classList.remove("hidden");
      searchResultsUI.classList.add("hidden");
    } else {
      // إظهار شبكة البحث
      mainShowcaseUI.classList.add("hidden");
      defaultTracksUI.classList.add("hidden");
      searchResultsUI.classList.remove("hidden");

      const filtered = allProducts.filter(p => 
        (p.title && p.title.toLowerCase().includes(q)) || 
        (p.description && p.description.toLowerCase().includes(q)) ||
        (window.CATEGORIES[p.categoryId] && window.CATEGORIES[p.categoryId].name.toLowerCase().includes(q))
      );
      
      searchResultsGrid.innerHTML = "";
      filtered.forEach(prod => {
        // إنشاء بطاقة لكن نضيف لها تنسيق يناسب الشبكة بدلاً من الشريط الأفقي
        const card = createProductCard(prod);
        card.style.flex = "none";
        card.style.width = "100%";
        searchResultsGrid.appendChild(card);
      });

      if (filtered.length === 0) {
        noItems.classList.remove("hidden");
      } else {
        noItems.classList.add("hidden");
      }
    }
  });
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
