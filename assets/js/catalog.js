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
    
    // Populate footer categories dynamically
    const footerGrid = document.getElementById("footerCategoriesGrid");
    if (footerGrid) {
      footerGrid.innerHTML = "";
      categories.forEach(cat => {
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
      categories.forEach(cat => {
        const link = document.createElement("a");
        link.href = `catalog.html?category=${cat.id}`;
        link.innerHTML = `<i class="fas ${cat.icon ? cat.icon.replace(/["&<>]/g, '') : 'fa-tag'}"></i> ${cat.name.replace(/["&<>]/g, '')}`;
        mobileCats.appendChild(link);
      });
    }
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

  try {
    if (productId) {
      await renderProductView(productId);
    } else if (subcategoryId && subcategoryId !== 'all') {
      await renderSubcategoryView(subcategoryId);
    } else if (categoryId && categoryId !== 'all') {
      await renderCategoryView(categoryId);
    } else {
      // If no valid param or category='all' or subcategory='all'
      await renderAllProductsView();
    }
    if (window.hideGlobalPreloader) window.hideGlobalPreloader();
  } catch (err) {
    console.error("Error loading page content:", err);
    if (window.hideGlobalPreloader) window.hideGlobalPreloader();
    showNotFound("حدث خطأ أثناء جلب التفاصيل.");
  }
}

// -------------------------------------------------------------
// ALL PRODUCTS VIEW (Search & Filter)
// -------------------------------------------------------------
let allGlobalProducts = [];

async function renderAllProductsView() {
  document.getElementById("catalogMainContainer").style.display = "block";
  document.title = `جميع المنتجات | أعمال يلوروز YELLOW ROSE`;

  // Breadcrumbs & Header
  document.getElementById("breadcrumbCategory").textContent = "جميع المنتجات";
  document.getElementById("breadcrumbCategory").href = `catalog.html`;
  document.getElementById("breadcrumbTitle").textContent = "الكل";
  
  document.getElementById("pageTypeBadge").innerHTML = `<i class="fas fa-gem"></i> تشكيلة`;
  document.getElementById("pageTitle").textContent = "جميع المنتجات";
  document.getElementById("pageDescription").textContent = "تصفح وابحث في جميع منتجات وتنسيقات يلوروز.";

  const grid = document.getElementById("productsGrid");
  const filterBar = document.getElementById("productsFilterBar");
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  
  grid.innerHTML = "";
  
  // Show filter bar
  if (filterBar) filterBar.classList.remove("hidden");
  
  // Hide subcategories tab
  const tabsWrapper = document.getElementById("subcategoryTabsWrapper");
  if (tabsWrapper) tabsWrapper.style.display = "none";
  
  document.getElementById("productsSection").style.display = "block";
  document.getElementById("productImagesSection").style.display = "none";

  // Fetch all products
  allGlobalProducts = await window.YellowRoseDB.getProducts();

  if (allGlobalProducts.length === 0) {
    document.getElementById("noProductsMessage").classList.remove("hidden");
    return;
  }
  document.getElementById("noProductsMessage").classList.add("hidden");

  // Populate Categories Filter
  if (categoryFilter && window.CATEGORIES) {
    categoryFilter.innerHTML = '<option value="all">جميع الأقسام</option>';
    Object.values(window.CATEGORIES).forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      categoryFilter.appendChild(opt);
    });
  }

  const renderFilteredGrid = () => {
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const selectedCat = categoryFilter ? categoryFilter.value : "all";

    const filtered = allGlobalProducts.filter(p => {
      const matchSearch = p.title.toLowerCase().includes(searchTerm) || (p.code && p.code.toLowerCase().includes(searchTerm));
      const matchCat = selectedCat === "all" || p.categoryId === selectedCat;
      return matchSearch && matchCat;
    });

    grid.innerHTML = "";
    if (filtered.length === 0) {
      document.getElementById("noProductsMessage").classList.remove("hidden");
    } else {
      document.getElementById("noProductsMessage").classList.add("hidden");
      
      // Update header count
      const countPill = document.getElementById("pageCountPill");
      if (countPill) {
        countPill.style.display = "inline-flex";
        const countText = document.getElementById("pageItemCount");
        if (countText) countText.textContent = `${filtered.length} ${filtered.length > 10 ? 'منتج' : 'منتجات'}`;
      }

      filtered.forEach(p => {
        const catInfo = (window.CATEGORIES && window.CATEGORIES[p.categoryId]) || { name: 'قسم عام' };
        const cover = p.coverUrl || (p.images && p.images.length > 0 && (p.images[0].thumbnailUrl || p.images[0].url)) || "assets/logo.png";
        const waUrl = window.YellowRoseDB.buildWhatsAppUrl(p);

        const card = document.createElement("div");
        card.className = "modern-showcase-card";
        card.style.flex = "none";
        card.style.width = "100%";

        card.innerHTML = `
          <div class="card-media-box">
            <a href="catalog.html?id=${p.id}">
              <img src="${escapeHtml(cover)}" alt="${escapeHtml(p.title)}" class="card-media-img" loading="lazy" onerror="this.src='assets/logo.png';">
            </a>
            <span class="card-category-tag"><i class="fas fa-gem"></i> ${escapeHtml(catInfo.name)}</span>
            ${p.featured ? '<div class="gallery-featured-badge" style="top:auto;bottom:12px;right:12px;"><i class="fas fa-star"></i> مميز</div>' : ''}
          </div>
          <div class="card-details-box">
            <h4 class="card-product-title">
              <a href="catalog.html?id=${p.id}">${escapeHtml(p.title)}</a>
            </h4>
            <p class="card-product-desc">${escapeHtml(p.description) || "تنسيق متقن يعكس فخامة وأناقة مناسباتكم الراقية."}</p>
            <div class="card-dual-actions">
              <a href="catalog.html?id=${p.id}" class="btn-card-view">
                <i class="fas fa-eye"></i> تفاصيل العمل
              </a>
              <a href="${waUrl}" target="_blank" rel="noopener" class="btn-card-order">
                <i class="fab fa-whatsapp"></i> طلب بالواتساب
              </a>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    }
  };

  if (searchInput) {
    searchInput.addEventListener("input", renderFilteredGrid);
  }
  if (categoryFilter) {
    categoryFilter.addEventListener("change", renderFilteredGrid);
  }

  // Initial render
  renderFilteredGrid();
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
async function renderCategoryView(categoryId, activeSubcategoryId = "all") {
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
  const tabsWrapper = document.getElementById("subcategoryTabsWrapper");
  const tabsContainer = document.getElementById("subcategoryTabs");

  if (tabsWrapper && tabsContainer) {
    if (subcats.length > 0) {
      tabsWrapper.style.display = "block";
      tabsContainer.innerHTML = `
        <button class="category-circle-item ${activeSubcategoryId === 'all' ? 'active' : ''}" data-subcategory="all" style="border:none; background:transparent; padding:0; outline:none;">
          <div class="category-circle-img-box">
            <div class="category-circle-img" style="display:flex;align-items:center;justify-content:center;background:#F5EBD4;color:var(--gold-dark);font-size:22px;">
              <i class="fas fa-th-large"></i>
            </div>
          </div>
          <span class="category-circle-name">الكل</span>
        </button>
      `;
      
      subcats.forEach(sub => {
        const cover = sub.coverUrl || 'assets/logo.png';
        tabsContainer.innerHTML += `
          <button class="category-circle-item ${activeSubcategoryId === sub.id ? 'active' : ''}" data-subcategory="${sub.id}" style="border:none; background:transparent; padding:0; outline:none;">
            <div class="category-circle-img-box">
              <img src="${escapeHtml(cover)}" alt="${escapeHtml(sub.name)}" class="category-circle-img" loading="lazy" onerror="this.src='assets/logo.png';">
            </div>
            <span class="category-circle-name">${escapeHtml(sub.name)}</span>
          </button>
        `;
      });

      // Add click listeners to tabs
      document.querySelectorAll("#subcategoryTabs .category-circle-item").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll("#subcategoryTabs .category-circle-item").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          
          // Update URL without reloading page
          const subId = btn.dataset.subcategory;
          const url = new URL(window.location);
          if (subId === 'all') {
            url.searchParams.delete('subcategory');
            url.searchParams.set('category', categoryId);
          } else {
            url.searchParams.delete('category');
            url.searchParams.set('subcategory', subId);
          }
          window.history.pushState({}, '', url);

          renderProductsForCategoryTab(categoryId, subId);
        });
      });
    } else {
      tabsWrapper.style.display = "none";
    }
  }

  // Render initial products
  await renderProductsForCategoryTab(categoryId, activeSubcategoryId);
}

// Helper to filter and render products based on selected Tab
async function renderProductsForCategoryTab(categoryId, subcategoryId) {
  const catInfo = window.CATEGORIES[categoryId];
  const allProducts = await window.YellowRoseDB.getProducts();
  
  let catProducts = [];
  if (subcategoryId === "all") {
    // "الكل": جلب المنتجات المباشرة للقسم الرئيسي بالإضافة لمنتجات الأقسام الفرعية التابعة له
    const allSubcats = Object.values(window.SUBCATEGORIES || {}).filter(s => s.categoryId === categoryId).map(s => s.id);
    catProducts = allProducts.filter(p => p.categoryId === categoryId || allSubcats.includes(p.subcategoryId));
  } else {
    // جلب منتجات القسم الفرعي المحدد فقط
    catProducts = allProducts.filter(p => p.subcategoryId === subcategoryId);
  }

  // توحيد عرض المنتجات لعدم الخلط بين الألبومات المباشرة والمنتجات العادية
  // بما أن المستخدم يريد استخدام شكل البطاقات العصرية دائماً
  const normalProducts = catProducts.filter(p => !p.isDirectMode);
  const directAlbums = catProducts.filter(p => p.isDirectMode);

  // دمجها معاً في شبكة واحدة أو عرضها بطريقتها المخصصة حسب الإعدادات
  renderProductsGrid(catProducts, catInfo, false);
  const directGrid = document.getElementById("directImagesGrid");
  const directSection = document.getElementById("directImagesSection");
  if (directGrid && directSection) {
     directGrid.innerHTML = "";
     directSection.style.display = "none";
  }
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

  // Redirect to Category view and auto-activate the Subcategory tab
  await renderCategoryView(subInfo.categoryId, subcategoryId);
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
    const waUrl = window.YellowRoseDB.buildWhatsAppUrl(p);

    const card = document.createElement("div");
    card.className = "modern-showcase-card";
    
    // override width and flex to fit naturally in a grid instead of horizontal scroll
    card.style.flex = "none";
    card.style.width = "100%";

    card.innerHTML = `
      <div class="card-media-box">
        <a href="catalog.html?id=${p.id}">
          <img src="${escapeHtml(cover)}" alt="${escapeHtml(p.title)}" class="card-media-img" loading="lazy" onerror="this.src='assets/logo.png';">
        </a>
        <span class="card-category-tag"><i class="fas fa-gem"></i> ${escapeHtml(catInfo.name)}</span>
        ${p.featured ? '<div class="gallery-featured-badge" style="top:auto;bottom:12px;right:12px;"><i class="fas fa-star"></i> مميز</div>' : ''}
      </div>
      <div class="card-details-box">
        <h4 class="card-product-title">
          <a href="catalog.html?id=${p.id}">${escapeHtml(p.title)}</a>
        </h4>
        <p class="card-product-desc">${escapeHtml(p.description) || "تنسيق متقن يعكس فخامة وأناقة مناسباتكم الراقية."}</p>
        <div class="card-dual-actions">
          <a href="catalog.html?id=${p.id}" class="btn-card-view">
            <i class="fas fa-eye"></i> تفاصيل العمل
          </a>
          <a href="${waUrl}" target="_blank" rel="noopener" class="btn-card-order">
            <i class="fab fa-whatsapp"></i> طلب بالواتساب
          </a>
        </div>
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
  document.getElementById("productsSection").style.display = "none";

  // Show Gift Option Container
  const giftContainer = document.getElementById("giftOptionContainer");
  const giftCheck = document.getElementById("enableGiftCheck");
  const giftForm = document.getElementById("giftDetailsForm");
  const giftPhone = document.getElementById("giftRecipientPhone");
  const giftDeliveryRadios = document.getElementsByName("giftDelivery");

  if (giftContainer && giftCheck && giftForm) {
    giftContainer.style.display = "block";
    
    // Reset form state on new product load
    giftCheck.checked = false;
    giftForm.classList.add("hidden");
    if(giftPhone) giftPhone.value = "";
    if(giftDeliveryRadios && giftDeliveryRadios.length > 0) giftDeliveryRadios[0].checked = true;

    // Toggle form visibility
    giftCheck.onchange = function() {
      if (this.checked) {
        giftForm.classList.remove("hidden");
      } else {
        giftForm.classList.add("hidden");
      }
    };
  }

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
          <a href="#" onclick="handleGiftWhatsAppOrder(event, ${index})" class="btn-photo-whatsapp" title="طلب هذا النموذج بالاسم والكود">
            <i class="fab fa-whatsapp"></i> طلب بالواتساب
          </a>
        </div>
      </div>
    `;

    grid.appendChild(itemCard);
  });
}

// -------------------------------------------------------------
// WhatsApp Order Handler with Gift Support
// -------------------------------------------------------------
window.handleGiftWhatsAppOrder = function(e, index) {
  e.preventDefault();
  
  if (!currentAlbum) return;

  const images = Array.isArray(currentAlbum.images) && currentAlbum.images.length > 0 ? currentAlbum.images : (currentAlbum.coverUrl ? [currentAlbum.coverUrl] : []);
  const photo = images[index];
  
  const photoUrl = typeof photo === "string" ? photo : photo.url;
  const photoName = typeof photo === "object" && photo.name ? photo.name : `${currentAlbum.title} (صورة #${index + 1})`;
  const photoCode = typeof photo === "object" && photo.code ? photo.code : `#YR-0${index + 1}`;

  let giftData = null;
  const giftCheck = document.getElementById("enableGiftCheck");
  
  if (giftCheck && giftCheck.checked) {
    const phone = document.getElementById("giftRecipientPhone") ? document.getElementById("giftRecipientPhone").value.trim() : "";
    
    if (!phone) {
      alert("الرجاء إدخال رقم جوال المهدى إليه لتقديم الهدية.");
      return;
    }

    let delivery = "توصيل";
    const deliveryRadios = document.getElementsByName("giftDelivery");
    for (let r of deliveryRadios) {
      if (r.checked) {
        delivery = r.value;
        break;
      }
    }

    giftData = {
      isGift: true,
      recipientPhone: phone,
      deliveryMethod: delivery
    };
  }

  const finalWaUrl = window.YellowRoseDB.buildWhatsAppUrl(currentAlbum, { url: photoUrl, name: photoName, code: photoCode }, giftData);
  window.open(finalWaUrl, "_blank", "noopener");
};

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
