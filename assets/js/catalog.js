/**
 * يلوروز | YELLOW ROSE - Album Details Page Logic (product.html)
 * Loads selected album photos, full-resolution responsive grid, photo names & codes, lightbox & WhatsApp booking
 */

let currentAlbum = null;
let currentLightboxIndex = 0;

document.addEventListener("DOMContentLoaded", async () => {
  // Sync Site Settings (Announcement Bar & Logo)
  await window.YellowRoseDB.syncSiteSettingsToDom();
  
  // Load dynamic categories
  const categories = await window.YellowRoseDB.getCategories();
  if (categories && categories.length > 0) {
    window.CATEGORIES = {};
    categories.forEach(c => window.CATEGORIES[c.id] = c);
  }

  setupNavigation();
  await loadAlbumDetails();
  setupLightboxListeners();
});

// Setup Mobile Navigation & Scroll
function setupNavigation() {
  const mobileBtn = document.getElementById("mobileMenuBtn");
  const navMenu = document.getElementById("navMenu");
  if (mobileBtn && navMenu) {
    mobileBtn.addEventListener("click", () => {
      navMenu.classList.toggle("open");
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

// Load Album by ID or Category
async function loadAlbumDetails() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  const categoryId = params.get("category");

  if (!productId && !categoryId) {
    showNotFound("لم يتم تحديد معرّف الألبوم أو القسم المطلوب.");
    return;
  }

  try {
    if (productId) {
      currentAlbum = await window.YellowRoseDB.getProductById(productId);
      if (!currentAlbum) {
        showNotFound("عذراً، لم نتمكن من العثور على الألبوم المطلوب. ربما تم نقله أو حذفه.");
        return;
      }
      renderAlbumDetails(currentAlbum);
    } else if (categoryId) {
      const allAlbums = await window.YellowRoseDB.getProducts();
      const catAlbums = allAlbums.filter(a => a.categoryId === categoryId);
      const catInfo = window.CATEGORIES[categoryId];

      if (!catInfo) {
        showNotFound("عذراً، لم نتمكن من العثور على القسم المطلوب.");
        return;
      }

      const subAlbums = catAlbums.filter(a => !a.isDirectMode);
      const directAlbum = catAlbums.find(a => a.isDirectMode);
      
      const syntheticAlbum = {
        title: `قسم ${catInfo.name}`,
        description: `تصفح جميع المجلدات والصور الخاصة بقسم ${catInfo.name} من يلوروز.`,
        categoryId: categoryId,
        categoryName: catInfo.name,
        images: directAlbum ? directAlbum.images : [],
        createdAt: new Date().toISOString().split('T')[0],
        isCategoryView: true,
        subAlbums: subAlbums
      };
      currentAlbum = syntheticAlbum;
      renderAlbumDetails(currentAlbum);
    }
  } catch (err) {
    console.error("Error loading album details:", err);
    showNotFound("حدث خطأ أثناء جلب تفاصيل الألبوم.");
  }
}

function showNotFound(message) {
  const container = document.getElementById("albumDetailsContainer");
  const notFoundBox = document.getElementById("albumNotFound");
  const notFoundMsg = document.getElementById("notFoundMessage");
  if (container) container.style.display = "none";
  if (notFoundBox) {
    notFoundBox.style.display = "block";
    if (notFoundMsg) notFoundMsg.textContent = message;
  }
}

// Render Album Header and Photo Gallery Grid
function renderAlbumDetails(product) {
  const container = document.getElementById("albumDetailsContainer");
  if (!container) return;
  container.style.display = "block";

  // Update Page Title
  document.title = `${product.title} | أعمال يلوروز YELLOW ROSE`;

  // Breadcrumbs
  const breadcrumbCat = document.getElementById("breadcrumbCategory");
  const breadcrumbTitle = document.getElementById("breadcrumbTitle");
  const catInfo = window.CATEGORIES[product.categoryId] || { name: product.categoryName || "الألبوم", icon: "fa-tag" };
  
  if (breadcrumbCat) {
    breadcrumbCat.textContent = catInfo.name;
    breadcrumbCat.href = `index.html#gallery`;
  }
  if (breadcrumbTitle) {
    breadcrumbTitle.textContent = product.title;
  }

  // Header Elements
  const catBadge = document.getElementById("productCategoryBadge");
  const titleEl = document.getElementById("productTitle");
  const descEl = document.getElementById("productDescription");
  const dateEl = document.getElementById("productDate");
  const countEl = document.getElementById("albumPhotoCount");
  const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : [product.coverUrl];

  if (catBadge) {
    catBadge.innerHTML = `<i class="fas ${catInfo.icon || 'fa-gem'}"></i> ${catInfo.name}`;
  }
  if (titleEl) titleEl.textContent = product.title;
  if (descEl) descEl.textContent = product.description || "تنسيق متقن يعكس فخامة وأناقة مناسباتكم الخاصة.";
  if (dateEl) dateEl.textContent = product.createdAt || "2026";
  if (countEl) countEl.textContent = `${images.length} ${images.length > 10 ? 'منتج' : 'منتجات'}`;

  // Render Sub-Albums
  const subAlbumsSection = document.getElementById("subAlbumsSection");
  const subAlbumsGrid = document.getElementById("subAlbumsGrid");
  
  if (product.isCategoryView && product.subAlbums && product.subAlbums.length > 0) {
    if (subAlbumsSection) subAlbumsSection.style.display = "block";
    if (subAlbumsGrid) {
      subAlbumsGrid.innerHTML = "";
      product.subAlbums.forEach(sub => {
        const cover = sub.coverUrl || (sub.images && (sub.images[0]?.thumbnailUrl || sub.images[0]?.url || sub.images[0])) || "assets/logo.png";
        const imgCount = Array.isArray(sub.images) ? sub.images.length : 1;
        const card = document.createElement("a");
        card.href = `catalog.html?id=${sub.id}`;
        card.className = "gallery-card";
        card.innerHTML = `
          <div class="gallery-img-wrapper">
            <img src="${window.escapeHtml(cover)}" alt="${window.escapeHtml(sub.title)}" loading="lazy" onerror="this.src='assets/logo.png';">
            <div class="gallery-overlay">
              <span class="gallery-btn"><i class="fas fa-eye"></i> استعرض الألبوم</span>
            </div>
            <div class="gallery-badge"><i class="fas fa-images"></i> ${imgCount} صورة</div>
            ${sub.featured ? '<div class="gallery-featured-badge"><i class="fas fa-star"></i> مميز</div>' : ''}
          </div>
          <div class="gallery-card-content">
            <h3 class="gallery-title">${window.escapeHtml(sub.title)}</h3>
            <p class="gallery-category">${catInfo.name}</p>
          </div>
        `;
        subAlbumsGrid.appendChild(card);
      });
    }
  } else {
    if (subAlbumsSection) subAlbumsSection.style.display = "none";
  }

  // Render Images Grid
  const grid = document.getElementById("albumPhotosGrid");
  const directImagesSection = document.getElementById("directImagesSection");
  if (!grid) return;
  grid.innerHTML = "";

  if (images.length === 0 && product.isCategoryView) {
    if (directImagesSection) directImagesSection.style.display = "none";
    return;
  }
  
  if (directImagesSection) directImagesSection.style.display = "block";

  images.forEach((photo, index) => {
    const photoUrl = typeof photo === "string" ? photo : photo.url;
    const photoThumbUrl = typeof photo === "object" && photo.thumbnailUrl ? photo.thumbnailUrl : photoUrl;
    const photoName = typeof photo === "object" && photo.name ? photo.name : `${product.title} (صورة #${index + 1})`;
    const photoCode = typeof photo === "object" && photo.code ? photo.code : `#YR-0${index + 1}`;

    const itemCard = document.createElement("div");
    itemCard.className = "album-photo-card";

    const photoWaUrl = window.YellowRoseDB.buildWhatsAppUrl(product, { url: photoUrl, name: photoName, code: photoCode });

    itemCard.innerHTML = `
      <div class="album-photo-inner" onclick="openLightbox(${index})" title="اضغط للتكبير الكامل">
        <img src="${escapeHtml(photoThumbUrl)}" alt="${escapeHtml(photoName)}" class="album-photo-img" loading="lazy" onerror="this.src='assets/logo.png';">
        <div class="album-photo-overlay">
          <button class="btn-zoom-photo" title="عرض بدقة كاملة">
            <i class="fas fa-search-plus"></i>
          </button>
        </div>
        <span class="photo-code-badge"><i class="fas fa-hashtag"></i> ${escapeHtml(photoCode)}</span>
      </div>

      <div class="album-photo-info-box">
        <div class="photo-name-row">
          <h4 class="photo-title-text">${escapeHtml(photoName)}</h4>
          <span class="photo-code-pill">${escapeHtml(photoCode)}</span>
        </div>
        
        <div class="album-photo-footer">
          <button class="btn-open-lightbox-small" onclick="openLightbox(${index})">
            <i class="fas fa-expand"></i> معاينة مكبرة
          </button>
          <a href="${photoWaUrl}" target="_blank" rel="noopener" class="btn-photo-whatsapp" title="طلب هذا النموذج بالاسم والكود">
            <i class="fab fa-whatsapp"></i> طلب بالواتساب
          </a>
        </div>
      </div>
    `;

    grid.appendChild(itemCard);
  });
}

// Lightbox Logic
window.openLightbox = function(index) {
  if (!currentAlbum || !currentAlbum.images) return;
  currentLightboxIndex = index;
  updateLightboxContent();

  const modal = document.getElementById("albumLightboxModal");
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
};

window.closeLightbox = function() {
  const modal = document.getElementById("albumLightboxModal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
  }
};

window.nextLightboxImage = function() {
  const images = currentAlbum.images;
  currentLightboxIndex = (currentLightboxIndex + 1) % images.length;
  updateLightboxContent();
};

window.prevLightboxImage = function() {
  const images = currentAlbum.images;
  currentLightboxIndex = (currentLightboxIndex - 1 + images.length) % images.length;
  updateLightboxContent();
};

function updateLightboxContent() {
  const images = currentAlbum.images;
  const photo = images[currentLightboxIndex];
  const photoUrl = typeof photo === "string" ? photo : photo.url;
  const photoName = typeof photo === "object" && photo.name ? photo.name : `${currentAlbum.title} (صورة ${currentLightboxIndex + 1})`;
  const photoCode = typeof photo === "object" && photo.code ? photo.code : `#YR-0${currentLightboxIndex + 1}`;

  const imgEl = document.getElementById("lightboxImg");
  const titleEl = document.getElementById("lightboxTitle");
  const counterEl = document.getElementById("lightboxCounter");
  const waBtn = document.getElementById("lightboxWaBtn");

  if (imgEl) imgEl.src = photoUrl;
  if (titleEl) {
    titleEl.innerHTML = `<strong>${escapeHtml(photoName)}</strong> <span style="background: rgba(200, 162, 81, 0.25); color: var(--gold-light); padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 6px;">${escapeHtml(photoCode)}</span>`;
  }
  if (counterEl) counterEl.textContent = `صورة ${currentLightboxIndex + 1} من ${images.length}`;

  if (waBtn) {
    waBtn.href = window.YellowRoseDB.buildWhatsAppUrl(currentAlbum, { url: photoUrl, name: photoName, code: photoCode });
  }
}

// Setup Lightbox Listeners
function setupLightboxListeners() {
  const closeBtn = document.getElementById("closeLightboxBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);

  const modal = document.getElementById("albumLightboxModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.id === "albumLightboxModal") closeLightbox();
    });
  }

  const prevBtn = document.getElementById("lightboxPrevBtn");
  const nextBtn = document.getElementById("lightboxNextBtn");
  if (prevBtn) prevBtn.addEventListener("click", prevLightboxImage);
  if (nextBtn) nextBtn.addEventListener("click", nextLightboxImage);

  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("albumLightboxModal");
    if (!modal || !modal.classList.contains("active")) return;

    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") nextLightboxImage();
    if (e.key === "ArrowRight") prevLightboxImage();
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
