/**
 * يلوروز | YELLOW ROSE - Catalog Page Logic (catalog.html)
 * Handles Category views, Subcategory views, and individual Product details (Lightbox)
 */

let currentAlbum = null; // Used for Product view lightbox
let currentLightboxIndex = 0;

document.addEventListener("DOMContentLoaded", async () => {
  // Sync Site Settings (Announcement Bar & Logo)
  await window.YellowRoseDB.syncSiteSettingsToDom();
  
  // Load dynamic categories & subcategories
  const categories = await window.YellowRoseDB.getCategories();
  if (categories && categories.length > 0) {
    window.CATEGORIES = {};
    categories.forEach(c => window.CATEGORIES[c.id] = c);
  }

  const subcategories = await window.YellowRoseDB.getSubcategories();
  if (subcategories && subcategories.length > 0) {
    window.SUBCATEGORIES = {};
    subcategories.forEach(c => window.SUBCATEGORIES[c.id] = c);
  } else {
    window.SUBCATEGORIES = {};
  }

  setupNavigation();
  await loadPageContent();
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

// Route the page based on query parameters
async function loadPageContent() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  const categoryId = params.get("category");
  const subcategoryId = params.get("subcategory");

  if (!productId && !categoryId && !subcategoryId) {
    showNotFound("لم يتم تحديد معرّف القسم أو الألبوم المطلوب.");
    return;
  }

  try {
    if (productId) {
      await renderProductView(productId);
    } else if (subcategoryId) {
      await renderSubcategoryView(subcategoryId);
    } else if (categoryId) {
      await renderCategoryView(categoryId);
    }
  } catch (err) {
    console.error("Error loading page content:", err);
    showNotFound("حدث خطأ أثناء جلب التفاصيل.");
  }
}

function showNotFound(message) {
  const container = document.getElementById("catalogMainContainer");
  const notFoundBox = document.getElementById("albumNotFound");
  const notFoundMsg = document.getElementById("notFoundMessage");
  if (container) container.style.display = "none";
  if (notFoundBox) {
    notFoundBox.style.display = "block";
    if (notFoundMsg) notFoundMsg.textContent = message;
  }
}

// -------------------------------------------------------------
// 1. CATEGORY VIEW
// -------------------------------------------------------------
async function renderCategoryView(categoryId) {
  const catInfo = window.CATEGORIES[categoryId];
  if (!catInfo) {
    showNotFound("عذراً، لم نتمكن من العثور على القسم المطلوب.");
    return;
  }

  document.getElementById("catalogMainContainer").style.display = "block";
  document.title = `قسم ${catInfo.name} | أعمال يلوروز YELLOW ROSE`;

  // Breadcrumbs & Header
  document.getElementById("breadcrumbCategory").textContent = catInfo.name;
  document.getElementById("breadcrumbCategory").href = `catalog.html?category=${categoryId}`;
  document.getElementById("breadcrumbTitle").textContent = "عرض القسم";
  
  document.getElementById("pageTypeBadge").innerHTML = `<i class="fas ${catInfo.icon || 'fa-gem'}"></i> قسم`;
  document.getElementById("pageTitle").textContent = catInfo.name;
  document.getElementById("pageDescription").textContent = `تصفح جميع الأقسام الفرعية والمنتجات الخاصة بقسم ${catInfo.name}.`;

  // Find Subcategories for this Category
  const subcats = Object.values(window.SUBCATEGORIES).filter(s => s.categoryId === categoryId);
  const subcatsSection = document.getElementById("subcategoriesSection");
  const subcatsGrid = document.getElementById("subcategoriesGrid");

  if (subcats.length > 0) {
    subcatsSection.style.display = "block";
    subcatsGrid.innerHTML = "";
    subcats.forEach(sub => {
      const cover = sub.coverUrl || "assets/logo.png";
      const card = document.createElement("a");
      card.href = `catalog.html?subcategory=${sub.id}`;
      card.className = "gallery-card";
      card.innerHTML = `
        <div class="gallery-img-wrapper">
          <img src="${escapeHtml(cover)}" alt="${escapeHtml(sub.name)}" loading="lazy" onerror="this.src='assets/logo.png';">
          <div class="gallery-overlay">
            <span class="gallery-btn"><i class="fas fa-folder-open"></i> الدخول للقسم</span>
          </div>
          <div class="gallery-badge"><i class="fas ${sub.icon || 'fa-folder'}"></i> قسم فرعي</div>
        </div>
        <div class="gallery-card-content">
          <h3 class="gallery-title">${escapeHtml(sub.name)}</h3>
          <p class="gallery-category">استعرض منتجات وتنسيقات القسم</p>
        </div>
      `;
      subcatsGrid.appendChild(card);
    });
  } else {
    subcatsSection.style.display = "none";
  }

  // Find Products that belong directly to this category
  const allProducts = await window.YellowRoseDB.getProducts();
  const catProducts = allProducts.filter(p => p.categoryId === categoryId && !p.subcategoryId);
  
  const normalProducts = catProducts.filter(p => !p.isDirectMode);
  const directAlbums = catProducts.filter(p => p.isDirectMode);

  renderProductsGrid(normalProducts, catInfo, directAlbums.length > 0);
  renderDirectImagesGrid(directAlbums, catInfo);
}

// -------------------------------------------------------------
// 2. SUBCATEGORY VIEW
// -------------------------------------------------------------
async function renderSubcategoryView(subcategoryId) {
  const subInfo = window.SUBCATEGORIES[subcategoryId];
  if (!subInfo) {
    showNotFound("عذراً، لم نتمكن من العثور على القسم الفرعي المطلوب.");
    return;
  }
  const catInfo = window.CATEGORIES[subInfo.categoryId] || { name: "القسم الرئيسي", id: subInfo.categoryId };

  document.getElementById("catalogMainContainer").style.display = "block";
  document.title = `${subInfo.name} | أعمال يلوروز YELLOW ROSE`;

  // Breadcrumbs & Header
  document.getElementById("breadcrumbCategory").textContent = catInfo.name;
  document.getElementById("breadcrumbCategory").href = `catalog.html?category=${catInfo.id}`;
  
  const breadcrumbSub = document.getElementById("breadcrumbSubcategory");
  breadcrumbSub.style.display = "inline";
  document.getElementById("breadcrumbSubLink").textContent = subInfo.name;
  document.getElementById("breadcrumbSubLink").href = `catalog.html?subcategory=${subInfo.id}`;
  
  document.getElementById("breadcrumbTitle").textContent = "عرض المنتجات";
  
  document.getElementById("pageTypeBadge").innerHTML = `<i class="fas ${subInfo.icon || 'fa-folder-open'}"></i> قسم فرعي`;
  document.getElementById("pageTitle").textContent = subInfo.name;
  document.getElementById("pageDescription").textContent = `تصفح جميع المنتجات الخاصة بـ ${subInfo.name}.`;

  // Hide subcategories section
  document.getElementById("subcategoriesSection").style.display = "none";

  // Find Products
  const allProducts = await window.YellowRoseDB.getProducts();
  const subProducts = allProducts.filter(p => p.subcategoryId === subcategoryId);
  
  const normalProducts = subProducts.filter(p => !p.isDirectMode);
  const directAlbums = subProducts.filter(p => p.isDirectMode);

  renderProductsGrid(normalProducts, catInfo, directAlbums.length > 0);
  renderDirectImagesGrid(directAlbums, catInfo);
}

// Render the products grid for Category/Subcategory views
function renderProductsGrid(products, catInfo, hasDirectAlbums = false) {
  const productsSection = document.getElementById("productsSection");
  const productsGrid = document.getElementById("productsGrid");
  const noProducts = document.getElementById("noProductsMessage");

  productsGrid.innerHTML = "";

  if (products.length === 0) {
    if (!hasDirectAlbums) {
      productsSection.style.display = "block";
      noProducts.classList.remove("hidden");
    } else {
      productsSection.style.display = "none";
      noProducts.classList.add("hidden");
    }
    return;
  }
  
  productsSection.style.display = "block";
  noProducts.classList.add("hidden");

  // Update header count
  const countPill = document.getElementById("pageCountPill");
  countPill.style.display = "inline-flex";
  document.getElementById("pageItemCount").textContent = `${products.length} ${products.length > 10 ? 'منتج' : 'منتجات'}`;

  products.forEach(p => {
    const cover = p.coverUrl || (p.images && p.images.length > 0 && (p.images[0].thumbnailUrl || p.images[0].url)) || "assets/logo.png";
    const imgCount = Array.isArray(p.images) ? p.images.length : 1;
    const card = document.createElement("a");
    card.href = `catalog.html?id=${p.id}`;
    card.className = "gallery-card";
    card.innerHTML = `
      <div class="gallery-img-wrapper">
        <img src="${escapeHtml(cover)}" alt="${escapeHtml(p.title)}" loading="lazy" onerror="this.src='assets/logo.png';">
        <div class="gallery-overlay">
          <span class="gallery-btn"><i class="fas fa-eye"></i> تفاصيل العمل</span>
        </div>
        <div class="gallery-badge"><i class="fas fa-images"></i> ${imgCount} صورة</div>
        ${p.featured ? '<div class="gallery-featured-badge"><i class="fas fa-star"></i> مميز</div>' : ''}
      </div>
      <div class="gallery-card-content">
        <h3 class="gallery-title">${escapeHtml(p.title)}</h3>
        <p class="gallery-category">${escapeHtml(catInfo.name)}</p>
      </div>
    `;
    productsGrid.appendChild(card);
  });
}

// Render the unpacked images for direct albums
function renderDirectImagesGrid(directAlbums, catInfo) {
  const imagesSection = document.getElementById("productImagesSection");
  const grid = document.getElementById("albumPhotosGrid");
  
  if (!directAlbums || directAlbums.length === 0) {
    if (!currentAlbum) { // only hide if not in product view
      imagesSection.style.display = "none";
    }
    return;
  }
  
  imagesSection.style.display = "block";
  // We don't clear the grid because maybe it was cleared already, but just to be safe
  grid.innerHTML = "";

  // Combine all images from all direct albums
  let allDirectImages = [];
  directAlbums.forEach(album => {
    if (album.images && album.images.length > 0) {
      album.images.forEach(img => {
        allDirectImages.push({
          photo: img,
          albumTitle: album.title,
          album: album
        });
      });
    } else if (album.coverUrl) {
      allDirectImages.push({
        photo: album.coverUrl,
        albumTitle: album.title,
        album: album
      });
    }
  });
  
  // Set global currentAlbum to a synthetic one so lightbox works
  currentAlbum = {
    title: catInfo.name,
    images: allDirectImages.map(item => item.photo)
  };

  allDirectImages.forEach((item, index) => {
    const photo = item.photo;
    const photoUrl = typeof photo === "string" ? photo : photo.url;
    const photoThumbUrl = typeof photo === "object" && photo.thumbnailUrl ? photo.thumbnailUrl : photoUrl;
    const photoName = typeof photo === "object" && photo.name ? photo.name : `${item.albumTitle} (صورة #${index + 1})`;
    const photoCode = typeof photo === "object" && photo.code ? photo.code : `#YR-0${index + 1}`;

    const itemCard = document.createElement("div");
    itemCard.className = "album-photo-card";

    const photoWaUrl = window.YellowRoseDB.buildWhatsAppUrl(item.album, { url: photoUrl, name: photoName, code: photoCode });

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

// -------------------------------------------------------------
// 3. PRODUCT VIEW
// -------------------------------------------------------------
async function renderProductView(productId) {
  currentAlbum = await window.YellowRoseDB.getProductById(productId);
  if (!currentAlbum) {
    showNotFound("عذراً، لم نتمكن من العثور على المنتج المطلوب.");
    return;
  }

  document.getElementById("catalogMainContainer").style.display = "block";
  document.title = `${currentAlbum.title} | أعمال يلوروز YELLOW ROSE`;

  const catInfo = window.CATEGORIES[currentAlbum.categoryId] || { name: currentAlbum.categoryName || "الأقسام", id: currentAlbum.categoryId };
  const subInfo = currentAlbum.subcategoryId ? window.SUBCATEGORIES[currentAlbum.subcategoryId] : null;

  // Breadcrumbs
  document.getElementById("breadcrumbCategory").textContent = catInfo.name;
  document.getElementById("breadcrumbCategory").href = `catalog.html?category=${catInfo.id}`;
  
  if (subInfo) {
    const breadcrumbSub = document.getElementById("breadcrumbSubcategory");
    breadcrumbSub.style.display = "inline";
    document.getElementById("breadcrumbSubLink").textContent = subInfo.name;
    document.getElementById("breadcrumbSubLink").href = `catalog.html?subcategory=${subInfo.id}`;
  }
  
  document.getElementById("breadcrumbTitle").textContent = currentAlbum.title;

  // Header Elements
  document.getElementById("pageTypeBadge").innerHTML = `<i class="fas ${catInfo.icon || 'fa-gem'}"></i> ${catInfo.name}`;
  document.getElementById("pageTitle").textContent = currentAlbum.title;
  document.getElementById("pageDescription").textContent = currentAlbum.description || "تنسيق متقن يعكس فخامة وأناقة مناسباتكم الخاصة.";
  
  const datePill = document.getElementById("productDatePill");
  datePill.style.display = "inline-flex";
  let dateStr = "2026";
  if (currentAlbum.createdAt) {
    try {
       const d = new Date(currentAlbum.createdAt);
       dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : currentAlbum.createdAt;
    } catch(e) {
       dateStr = currentAlbum.createdAt;
    }
  }
  document.getElementById("productDate").textContent = dateStr;
  
  const images = Array.isArray(currentAlbum.images) && currentAlbum.images.length > 0 ? currentAlbum.images : (currentAlbum.coverUrl ? [currentAlbum.coverUrl] : []);
  const countPill = document.getElementById("pageCountPill");
  countPill.style.display = "inline-flex";
  document.getElementById("pageItemCount").textContent = `${images.length} ${images.length > 10 ? 'صورة' : 'صور'}`;

  // Hide unnecessary sections
  document.getElementById("subcategoriesSection").style.display = "none";
  document.getElementById("productsSection").style.display = "none";

  // Show and Render Images Grid
  const imagesSection = document.getElementById("productImagesSection");
  const grid = document.getElementById("albumPhotosGrid");
  
  if (images.length === 0) {
    imagesSection.style.display = "none";
    return;
  }
  
  imagesSection.style.display = "block";
  grid.innerHTML = "";

  images.forEach((photo, index) => {
    const photoUrl = typeof photo === "string" ? photo : photo.url;
    const photoThumbUrl = typeof photo === "object" && photo.thumbnailUrl ? photo.thumbnailUrl : photoUrl;
    const photoName = typeof photo === "object" && photo.name ? photo.name : `${currentAlbum.title} (صورة #${index + 1})`;
    const photoCode = typeof photo === "object" && photo.code ? photo.code : `#YR-0${index + 1}`;

    const itemCard = document.createElement("div");
    itemCard.className = "album-photo-card";

    const photoWaUrl = window.YellowRoseDB.buildWhatsAppUrl(currentAlbum, { url: photoUrl, name: photoName, code: photoCode });

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

// -------------------------------------------------------------
// Lightbox Logic
// -------------------------------------------------------------
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
