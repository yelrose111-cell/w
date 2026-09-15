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
  await loadAndRenderProducts();
  setupFilterAndSearch();
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

    const mobileCats = document.getElementById("mobileCategoriesList");
    if (mobileCats && window.CATEGORIES) {
      mobileCats.innerHTML = "";
      Object.values(window.CATEGORIES).forEach(cat => {
        const link = document.createElement("a");
        link.href = `catalog.html?category=${cat.id}`;
        link.innerHTML = `<i class="fas ${cat.icon || 'fa-tag'}"></i> ${cat.name}`;
        mobileCats.appendChild(link);
      });
    }
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

async function loadAndRenderProducts() {
  const cats = await window.YellowRoseDB.getCategories();
  window.CATEGORIES = {};
  cats.forEach(c => window.CATEGORIES[c.id] = c);
  
  const categoryTabs = document.getElementById("categoryTabs");
  if (categoryTabs) {
    categoryTabs.innerHTML = `
      <button class="cat-btn active" data-category="all">
        <i class="fas fa-th"></i>
        <span>الكل</span>
      </button>
    `;
    cats.forEach(cat => {
      categoryTabs.innerHTML += `
        <button class="cat-btn" data-category="${cat.id}">
          <i class="fas ${cat.icon || 'fa-tag'}"></i>
          <span>${cat.name}</span>
        </button>
      `;
    });
    
    // Re-attach listeners for category buttons
    document.querySelectorAll(".cat-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentCategory = btn.getAttribute("data-category");
        filterProducts();
      });
    });
  }

  const productsListContainer = document.getElementById("galleryGrid");
  if (!productsListContainer) return;
  productsListContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i> جاري تحميل المنتجات...</div>';

  try {
    allProducts = await window.YellowRoseDB.getProducts();
    updateCategoryCounts();
    renderGallery();
  } catch (err) {
    console.error("Failed to load products:", err);
    productsListContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
        <p style="color: #c0392b;">حدث خطأ أثناء تحميل المنتجات، يرجى إعادة المحاولة.</p>
      </div>
    `;
  }
}

// Filter and Render Gallery
function renderGallery() {
  const grid = document.getElementById("galleryGrid");
  const noItemsMsg = document.getElementById("noItemsMessage");
  if (!grid) return;

  grid.innerHTML = "";

  const cats = Object.values(window.CATEGORIES);
  let renderedCount = 0;

  cats.forEach(catInfo => {
    // Filter by tab
    if (currentCategory !== "all" && catInfo.id !== currentCategory) return;

    // Filter by search
    if (searchQuery && !catInfo.name.toLowerCase().includes(searchQuery.toLowerCase())) return;

    const catAlbums = allProducts.filter(a => a.category === catInfo.id);
    
    let imagesCount = 0;
    let coverUrl = 'assets/logo.png';
    let hasFeatured = false;

    if (catAlbums.length > 0) {
      catAlbums.forEach(a => {
        if (a.images && a.images.length > 0) imagesCount += a.images.length;
        if (a.featured) hasFeatured = true;
      });
      // Try to find cover url from the newest album
      for (let i = catAlbums.length - 1; i >= 0; i--) {
        const a = catAlbums[i];
        if (a.coverUrl) { coverUrl = a.coverUrl; break; }
        if (a.images && a.images.length > 0) { coverUrl = a.images[0].thumbnailUrl || a.images[0].url; break; }
      }
    } else {
      // Don't show empty categories on the home page
      return; 
    }

    renderedCount++;

    const card = document.createElement("div");
    card.className = "album-card category-card";
    card.setAttribute("data-id", catInfo.id);

    card.innerHTML = `
      <div class="card-img-wrapper">
        <a href="catalog.html?category=${catInfo.id}" class="card-img-link" title="استعراض قسم ${escapeHtml(catInfo.name)}">
          <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(catInfo.name)}" class="card-img" loading="lazy" onerror="this.src='assets/logo.png';">
        </a>
        <span class="card-category-badge" style="top: 15px; left: auto; right: 15px; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px);">
          <i class="fas ${catInfo.icon || 'fa-tag'}"></i> ${escapeHtml(catInfo.name)}
        </span>
        <span class="card-photo-count">
          <i class="fas fa-camera"></i> ${imagesCount} ${imagesCount > 10 ? 'منتج' : 'منتجات'}
        </span>
        ${hasFeatured ? `<span class="card-featured-badge"><i class="fas fa-star"></i> قسم مميز</span>` : ''}
      </div>

      <div class="card-body">
        <h3 class="card-title" style="margin-bottom: 5px;">
          <a href="catalog.html?category=${catInfo.id}">${escapeHtml(catInfo.name)}</a>
        </h3>
        <p class="card-desc">استعرض جميع صور وتنسيقات قسم ${escapeHtml(catInfo.name)} بشكل مباشر.</p>
        
        <div class="card-album-actions" style="margin-top: 15px;">
          <a href="catalog.html?category=${catInfo.id}" class="btn-card-album" style="width: 100%; justify-content: center;">
            <i class="fas fa-images"></i> عرض جميع المنتجات للقسم
          </a>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  if (renderedCount === 0) {
    if (noItemsMsg) noItemsMsg.classList.remove("hidden");
  } else {
    if (noItemsMsg) noItemsMsg.classList.add("hidden");
  }
}

// Update Counts on Category Tabs
function updateCategoryCounts() {
  // Intentionally left empty as per user request to hide counts
}

// Setup Filters and Search Handlers
function setupFilterAndSearch() {
  // Category tabs
  document.querySelectorAll(".cat-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.getAttribute("data-category");
      renderGallery();
    });
  });

  // Search input
  const searchInput = document.getElementById("gallerySearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderGallery();
    });
  }
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
