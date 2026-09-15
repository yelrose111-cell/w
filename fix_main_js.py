import re

with open('assets/js/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace allAlbums to allProducts
content = content.replace("let allAlbums = [];", "let allProducts = [];")
content = content.replace("loadAndRenderAlbums()", "loadAndRenderProducts()")
content = content.replace("window.YellowRoseDB.getAlbums()", "window.YellowRoseDB.getProducts()")
content = content.replace("allAlbums =", "allProducts =")
content = content.replace("allAlbums.filter", "allProducts.filter")
content = content.replace("allAlbums.forEach", "allProducts.forEach")
content = content.replace("const albums =", "const products =")
content = content.replace("renderAlbumsGrid(albums)", "renderProductsGrid(products)")
content = content.replace("renderAlbumsGrid(filteredAlbums)", "renderProductsGrid(filteredProducts)")
content = content.replace("filteredAlbums", "filteredProducts")
content = content.replace("function renderAlbumsGrid", "function renderProductsGrid")
content = content.replace("album.html", "catalog.html")

# Replace categories logic
setup_nav_replacement = """
  const mobileCats = document.getElementById("mobileCategoriesList");
  if (mobileCats) {
    const cats = await window.YellowRoseDB.getCategories();
    window.CATEGORIES = {};
    cats.forEach(c => window.CATEGORIES[c.id] = c);
    
    mobileCats.innerHTML = "";
    cats.forEach(cat => {
      const link = document.createElement("a");
      link.href = `catalog.html?category=${cat.id}`;
      link.innerHTML = `<i class="fas ${cat.icon || 'fa-tag'}"></i> ${cat.name}`;
      mobileCats.appendChild(link);
    });
  }
"""
content = re.sub(r'const mobileCats = document.getElementById\("mobileCategoriesList"\);.*?if \(mobileCats && window\.CATEGORIES\).*?\}', setup_nav_replacement, content, flags=re.DOTALL)

# Add load Categories bar logic
load_cats = """
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
        <span class="cat-count" id="count-all">0</span>
      </button>
    `;
    cats.forEach(cat => {
      categoryTabs.innerHTML += `
        <button class="cat-btn" data-category="${cat.id}">
          <i class="fas ${cat.icon || 'fa-tag'}"></i>
          <span>${cat.name}</span>
          <span class="cat-count" id="count-${cat.id}">0</span>
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

  const productsListContainer = document.getElementById("albumsGrid");
  productsListContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i> جاري تحميل المنتجات...</div>';

  allProducts = await window.YellowRoseDB.getProducts();
"""
content = re.sub(r'async function loadAndRenderProducts\(\) \{.*?allProducts = await window\.YellowRoseDB\.getProducts\(\);', load_cats, content, flags=re.DOTALL)

# Update product rendering
render_products = """
function renderProductsGrid(productsList) {
  const grid = document.getElementById("albumsGrid");
  if (!grid) return;

  grid.innerHTML = "";

  if (productsList.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-folder-open"></i>
        <h3>لا توجد منتجات مطابقة للبحث</h3>
        <p>جرب تصفح أقسام أخرى أو تغيير كلمات البحث.</p>
      </div>
    `;
    return;
  }

  productsList.forEach(product => {
    const card = document.createElement("div");
    card.className = "album-card";
    if (product.featured) card.classList.add("featured-card");

    const catName = window.CATEGORIES[product.categoryId]?.name || "تنسيق";
    const imgCount = Array.isArray(product.images) ? product.images.length : 1;
    const coverUrl = product.coverUrl || (product.images && product.images[0]?.url) || "assets/logo.png";
    
    let priceBadge = product.price ? `<div style="position:absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: #fff; padding: 5px 10px; border-radius: 8px; font-weight: bold;">${product.price}</div>` : '';

    card.innerHTML = `
      <a href="catalog.html?id=${product.id}" class="album-thumb-link">
        <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(product.title)}" class="album-cover" onerror="this.src='assets/logo.png';">
        ${priceBadge}
        ${product.featured ? '<span class="badge-featured"><i class="fas fa-star"></i> مميز</span>' : ''}
        <div class="album-overlay">
          <i class="fas fa-search-plus" style="font-size: 24px; color: #fff; text-shadow: 0 2px 5px rgba(0,0,0,0.5);"></i>
          <span style="display:block; margin-top:8px; font-weight: 700; color: #fff;">استعراض المنتج</span>
        </div>
      </a>
      <div class="album-info">
        <div class="album-meta-top">
          <span class="album-cat"><i class="fas fa-tag"></i> ${escapeHtml(catName)}</span>
          <span class="album-count"><i class="fas fa-images"></i> ${imgCount}</span>
        </div>
        <h3 class="album-title">${escapeHtml(product.title)}</h3>
        <p class="album-desc" style="font-size: 14px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.5;">
          ${escapeHtml(product.description || "").substring(0, 60)}${product.description && product.description.length > 60 ? '...' : ''}
        </p>
        <div class="album-actions" style="border-top: 1px dashed rgba(0,0,0,0.08); padding-top: 15px; display:flex; justify-content:space-between; align-items:center;">
          <a href="catalog.html?id=${product.id}" class="btn-primary" style="flex:1; padding: 8px; text-align:center; font-size: 13px;">تفاصيل المنتج</a>
          <a href="${window.YellowRoseDB.buildWhatsAppUrl(product)}" target="_blank" class="btn-whatsapp" style="margin-right: 8px; width:40px; padding:0; text-align:center; display:flex; align-items:center; justify-content:center;">
            <i class="fab fa-whatsapp" style="font-size: 18px;"></i>
          </a>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}
"""

content = re.sub(r'function renderProductsGrid.*?function setupFilterAndSearch', render_products + '\nfunction setupFilterAndSearch', content, flags=re.DOTALL)


# Update search filter
filter_func = """
function filterProducts() {
  const searchTerm = searchQuery.toLowerCase();
  
  const filtered = allProducts.filter(p => {
    const matchesCat = currentCategory === "all" || p.categoryId === currentCategory;
    const matchesSearch = p.title.toLowerCase().includes(searchTerm) || (p.description && p.description.toLowerCase().includes(searchTerm));
    return matchesCat && matchesSearch;
  });

  renderProductsGrid(filtered);
}
"""

content = re.sub(r'function filterProducts.*?\}', filter_func, content, flags=re.DOTALL)
content = content.replace("filterAlbums", "filterProducts")
content = content.replace("document.querySelectorAll('.cat-btn').forEach", "// document.querySelectorAll('.cat-btn').forEach")

with open('assets/js/main.js', 'w', encoding='utf-8') as f:
    f.write(content)

