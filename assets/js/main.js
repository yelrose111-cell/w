/**
 * يلوروز | YELLOW ROSE - Main Page Logic (index.html)
 * Album Grid Showcase, Category Filtering, Dynamic Search & Direct WhatsApp Order
 */

let allAlbums = [];
let currentCategory = "all";
let searchQuery = "";

document.addEventListener("DOMContentLoaded", async () => {
  // Sync Site Settings (Announcement Bar & Logo)
  await window.YellowRoseDB.syncSiteSettingsToDom();

  setupNavigation();
  setupAdminIndicator();
  await loadAndRenderAlbums();
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

// Show Admin Controls ONLY if authenticated
function setupAdminIndicator() {
  const isAdmin = window.YellowRoseDB.isAdminAuthenticated();
  const adminBadge = document.getElementById("adminSecretBadge");
  if (adminBadge) {
    adminBadge.style.display = isAdmin ? "inline-flex" : "none";
  }
}

// Load and Render Albums from DB
async function loadAndRenderAlbums() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  grid.innerHTML = `
    <div class="loading-state" style="grid-column: 1 / -1; text-align: center; padding: 50px 20px;">
      <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: var(--gold-primary);"></i>
      <p style="margin-top: 15px; color: var(--text-muted); font-size: 16px;">جاري تحميل أعمال وألبومات يلوروز الفاخرة...</p>
    </div>
  `;

  try {
    allAlbums = await window.YellowRoseDB.getAlbums();
    updateCategoryCounts();
    renderGallery();
  } catch (err) {
    console.error("Failed to load albums:", err);
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
        <p style="color: #c0392b;">حدث خطأ أثناء تحميل الألبومات، يرجى إعادة المحاولة.</p>
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

    const catAlbums = allAlbums.filter(a => a.category === catInfo.id);
    
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
        <a href="album.html?category=${catInfo.id}" class="card-img-link" title="استعراض قسم ${escapeHtml(catInfo.name)}">
          <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(catInfo.name)}" class="card-img" loading="lazy" onerror="this.src='assets/logo.png';">
        </a>
        <span class="card-category-badge" style="top: 15px; left: auto; right: 15px; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px);">
          <i class="fas ${catInfo.icon || 'fa-tag'}"></i> ${escapeHtml(catInfo.name)}
        </span>
        <span class="card-photo-count">
          <i class="fas fa-camera"></i> ${imagesCount} ${imagesCount > 10 ? 'صورة' : 'صور'}
        </span>
        ${hasFeatured ? `<span class="card-featured-badge"><i class="fas fa-star"></i> قسم مميز</span>` : ''}
      </div>

      <div class="card-body">
        <h3 class="card-title" style="margin-bottom: 5px;">
          <a href="album.html?category=${catInfo.id}">${escapeHtml(catInfo.name)}</a>
        </h3>
        <p class="card-desc">استعرض جميع صور وتنسيقات قسم ${escapeHtml(catInfo.name)} بشكل مباشر.</p>
        
        <div class="card-album-actions" style="margin-top: 15px;">
          <a href="album.html?category=${catInfo.id}" class="btn-card-album" style="width: 100%; justify-content: center;">
            <i class="fas fa-images"></i> عرض جميع الصور
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
  const countAll = document.getElementById("count-all");
  if (countAll) countAll.textContent = allAlbums.length;

  Object.keys(window.CATEGORIES).forEach(cat => {
    const el = document.getElementById(`count-${cat}`);
    if (el) {
      const count = allAlbums.filter(a => a.category === cat).length;
      el.textContent = count;
    }
  });
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
