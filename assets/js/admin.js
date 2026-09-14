/**
 * يلوروز | YELLOW ROSE - Admin Dashboard Logic (admin.html) (v2.1)
 * Encrypted SHA-256 Authentication, Cloudinary Unsigned Direct Upload,
 * Per-Photo Name & Code Management, Site Settings & Cloud Sync.
 */

let currentEditingId = null;
let currentAlbumImages = [];
let selectedCoverUrl = "";

document.addEventListener("DOMContentLoaded", async () => {
  initAdminAuth();
  populateCategorySelect();
  setupTabNavigation();
  setupFormHandlers();
  await setupBrandIdentitySettings();
  await loadDashboardStatsAndAlbums();
  checkApiStatus();
});

// Check API Status
async function checkApiStatus() {
  const statusIndicator = document.getElementById("apiStatusIndicator");
  const statusText = document.getElementById("apiStatusText");
  if (!statusIndicator || !statusText) return;

  try {
    const response = await fetch('/api/health');
    if (response.ok) {
      statusIndicator.classList.remove("offline");
      statusIndicator.classList.add("online");
      statusText.textContent = "متصل (API)";
    } else {
      statusIndicator.classList.remove("online");
      statusIndicator.classList.add("offline");
      statusText.textContent = "مفصول (Local)";
    }
  } catch (err) {
    statusIndicator.classList.remove("online");
    statusIndicator.classList.add("offline");
    statusText.textContent = "مفصول (Local)";
  }
}

// Authentication Gate (Encrypted SHA-256)
function initAdminAuth() {
  const loginOverlay = document.getElementById("adminLoginOverlay");
  const dashboardContent = document.getElementById("adminDashboardContent");
  const loginForm = document.getElementById("adminLoginForm");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");

  if (window.YellowRoseDB.isAdminAuthenticated()) {
    if (loginOverlay) loginOverlay.style.display = "none";
    if (dashboardContent) dashboardContent.style.display = "block";
  } else {
    if (loginOverlay) loginOverlay.style.display = "flex";
    if (dashboardContent) dashboardContent.style.display = "none";
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pin = document.getElementById("adminPinInput").value;
      const success = await window.YellowRoseDB.loginAdmin(pin);
      if (success) {
        loginOverlay.style.display = "none";
        dashboardContent.style.display = "block";
        loadDashboardStatsAndAlbums();
      } else {
        if (loginError) {
          loginError.textContent = "رمز الدخول غير صحيح، يرجى المحاولة مرة أخرى.";
          loginError.classList.remove("hidden");
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("هل تود تسجيل الخروج من لوحة التحكم؟")) {
        window.YellowRoseDB.logoutAdmin();
        window.location.reload();
      }
    });
  }
}

// Setup Tabs
function setupTabNavigation() {
  const tabs = document.querySelectorAll(".admin-tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const targetId = tab.getAttribute("data-tab");
      document.querySelectorAll(".admin-tab-pane").forEach(pane => {
        pane.classList.remove("active");
      });
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add("active");
    });
  });
}

// Populate Category Dropdown
function populateCategorySelect() {
  const select = document.getElementById("albumCategorySelect");
  if (!select) return;
  select.innerHTML = "";

  Object.values(window.CATEGORIES).forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
}

// Load Dashboard Stats and Albums List
async function loadDashboardStatsAndAlbums() {
  const albums = await window.YellowRoseDB.getAlbums(true);

  const statAlbumsCount = document.getElementById("statAlbumsCount");
  const statPhotosCount = document.getElementById("statPhotosCount");
  const statCategoriesCount = document.getElementById("statCategoriesCount");

  let totalPhotos = 0;
  const activeCats = new Set();

  albums.forEach(a => {
    totalPhotos += (Array.isArray(a.images) ? a.images.length : 1);
    if (a.category) activeCats.add(a.category);
  });

  if (statAlbumsCount) statAlbumsCount.textContent = albums.length;
  if (statPhotosCount) statPhotosCount.textContent = totalPhotos;
  if (statCategoriesCount) statCategoriesCount.textContent = activeCats.size;

  renderAdminAlbumsList(albums);
}

// Render Admin Albums List
function renderAdminAlbumsList(albums) {
  const listContainer = document.getElementById("adminAlbumsList");
  if (!listContainer) return;
  listContainer.innerHTML = "";

  if (albums.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 40px;">
        <i class="fas fa-folder-open" style="font-size: 40px; color: var(--gold-primary); margin-bottom: 10px;"></i>
        <h3>لا توجد ألبومات حالياً</h3>
        <p>ابدأ بإضافة أول ألبوم ليلوروز عبر تبويب "إضافة ألبوم جديد".</p>
      </div>
    `;
    return;
  }

  albums.forEach(album => {
    const item = document.createElement("div");
    item.className = "admin-album-row";

    const catName = window.CATEGORIES[album.category]?.name || album.categoryName || "تنسيق";
    const imgCount = Array.isArray(album.images) ? album.images.length : 1;
    const cover = album.coverUrl || (album.images && (album.images[0]?.url || album.images[0])) || "assets/logo.png";

    item.innerHTML = `
      <div class="row-thumb" style="${album.isDirectMode ? 'border: 2px dashed var(--gold-primary);' : ''}">
        <img src="${escapeHtml(cover)}" alt="${escapeHtml(album.title)}" onerror="this.src='assets/logo.png';">
        <span class="row-badge-count"><i class="fas fa-images"></i> ${imgCount}</span>
      </div>
      <div class="row-info">
        <div class="row-title-box">
          <h4 class="row-title">${escapeHtml(album.title)} ${album.isDirectMode ? '<span style="font-size:12px; color:var(--gold-dark); background:rgba(212,175,55,0.1); padding:2px 6px; border-radius:4px; margin-right:8px;">مباشرة</span>' : ''}</h4>
          ${album.featured ? '<span class="badge-featured-mini"><i class="fas fa-star"></i> مميز</span>' : ''}
        </div>
        <div class="row-meta">
          <span class="row-category"><i class="fas fa-tag"></i> ${escapeHtml(catName)}</span>
          <span class="row-date"><i class="far fa-clock"></i> ${album.createdAt || ''}</span>
        </div>
      </div>
      <div class="row-actions">
        <a href="album.html?id=${album.id}" target="_blank" class="btn-action-view" title="معاينة كزائر">
          <i class="fas fa-eye"></i> معاينة
        </a>
        <button class="btn-action-edit" onclick="editAlbum('${album.id}')" title="تعديل الألبوم">
          <i class="fas fa-edit"></i> تعديل
        </button>
        <button class="btn-action-delete" onclick="deleteAlbum('${album.id}')" title="حذف الألبوم">
          <i class="fas fa-trash-alt"></i> حذف
        </button>
      </div>
    `;

    listContainer.appendChild(item);
  });
}

// Setup Form & Upload Handlers
function setupFormHandlers() {
  const form = document.getElementById("albumForm");
  const fileInput = document.getElementById("albumFilesInput");
  const urlInput = document.getElementById("directImageUrlInput");
  const addUrlBtn = document.getElementById("addDirectUrlBtn");
  const cancelBtn = document.getElementById("cancelEditBtn");
  const albumModeCheck = document.getElementById("enableAlbumModeCheck");
  const albumModeFields = document.getElementById("albumModeFields");

  // Toggle Album Mode
  if (albumModeCheck && albumModeFields) {
    albumModeCheck.addEventListener("change", (e) => {
      if (e.target.checked) {
        albumModeFields.style.display = "block";
      } else {
        albumModeFields.style.display = "none";
      }
    });
  }

  // Multi-File Upload to Cloudinary or Local Fallback
  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const progressContainer = document.getElementById("uploadProgressContainer");
      if (progressContainer) progressContainer.classList.remove("hidden");

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await handleSingleFileUpload(file, i + 1, files.length);
      }

      if (progressContainer) progressContainer.classList.add("hidden");
      fileInput.value = "";
      renderImagesPreview();
    });
  }

  // Add Direct Image URL
  if (addUrlBtn && urlInput) {
    addUrlBtn.addEventListener("click", () => {
      const url = urlInput.value.trim();
      if (url) {
        const idx = currentAlbumImages.length + 1;
        const albumTitle = document.getElementById("albumTitleInput").value.trim() || "تنسيق";
        currentAlbumImages.push({
          url: url,
          name: `${albumTitle} (صورة #${idx})`,
          code: `#YR-${Date.now().toString().slice(-4)}-${idx < 10 ? '0' + idx : idx}`
        });
        if (!selectedCoverUrl) selectedCoverUrl = url;
        urlInput.value = "";
        renderImagesPreview();
      }
    });
  }

  // Cancel Edit
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      resetAlbumForm();
      document.querySelector('[data-tab="tabAlbumsList"]').click();
    });
  }

  // Form Submit
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const category = document.getElementById("albumCategorySelect").value;
      const isAlbumMode = document.getElementById("enableAlbumModeCheck") ? document.getElementById("enableAlbumModeCheck").checked : true;
      const title = document.getElementById("albumTitleInput").value.trim();
      const description = document.getElementById("albumDescInput").value.trim();
      const featured = document.getElementById("albumFeaturedCheck").checked;

      if (isAlbumMode && !title) {
        alert("يرجى إدخال عنوان الألبوم.");
        return;
      }

      if (currentAlbumImages.length === 0) {
        alert("يرجى رفع أو إضافة صورة واحدة على الأقل.");
        return;
      }

      const submitBtn = document.getElementById("saveAlbumBtn");
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

      try {
        if (isAlbumMode || currentEditingId) {
          // الحفظ كألبوم منفصل
          const cover = selectedCoverUrl || (currentAlbumImages[0] ? currentAlbumImages[0].url : "");
          const albumData = {
            id: currentEditingId || `alb_yr_${Date.now()}`,
            title: title || "ألبوم غير مسمى",
            category,
            categoryName: window.CATEGORIES[category]?.name || "باقات ورد",
            description,
            coverUrl: cover,
            images: currentAlbumImages,
            featured,
            createdAt: new Date().toISOString().split("T")[0]
          };
          await window.YellowRoseDB.saveAlbum(albumData);
          showToast(currentEditingId ? "تم تحديث الألبوم بنجاح!" : "تمت إضافة الألبوم بنجاح!");
        } else {
          // الحفظ المباشر للقسم
          const directId = `direct_${category}`;
          let directAlbum = await window.YellowRoseDB.getAlbumById(directId);
          if (!directAlbum) {
            directAlbum = {
              id: directId,
              title: `صور مباشرة - ${window.CATEGORIES[category]?.name || "القسم"}`,
              category,
              categoryName: window.CATEGORIES[category]?.name || "باقات ورد",
              description: "صور مضافة مباشرة للقسم",
              coverUrl: currentAlbumImages[0] ? currentAlbumImages[0].url : "",
              images: [],
              featured: false,
              createdAt: new Date().toISOString().split("T")[0],
              isDirectMode: true
            };
          }
          directAlbum.images.push(...currentAlbumImages);
          if (!directAlbum.coverUrl && directAlbum.images.length > 0) {
            directAlbum.coverUrl = directAlbum.images[0].url;
          }
          await window.YellowRoseDB.saveAlbum(directAlbum);
          showToast("تمت إضافة الصور للقسم بنجاح!");
        }

        resetAlbumForm();
        await loadDashboardStatsAndAlbums();
        document.querySelector('[data-tab="tabAlbumsList"]').click();
      } catch (err) {
        alert("حدث خطأ أثناء الحفظ.");
        console.error(err);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ الألبوم في المعرض';
      }
    });
  }
}

// Upload Single File to Cloudinary via Secure Signed Upload
async function handleSingleFileUpload(file, currentIdx, totalCount) {
  const progressBar = document.getElementById("uploadProgressBar");
  const progressStatus = document.getElementById("uploadProgressStatus");

  if (progressStatus) {
    progressStatus.textContent = `جاري رفع الصورة ${currentIdx} من ${totalCount}: ${file.name}...`;
  }
  if (progressBar) {
    progressBar.style.width = `${Math.round((currentIdx / totalCount) * 100)}%`;
  }

  const isAlbumMode = document.getElementById("enableAlbumModeCheck") ? document.getElementById("enableAlbumModeCheck").checked : true;
  const albumTitle = isAlbumMode ? document.getElementById("albumTitleInput").value.trim() : document.getElementById("albumCategorySelect").options[document.getElementById("albumCategorySelect").selectedIndex].text;
  const numIdx = currentAlbumImages.length + 1;
  const photoName = `${albumTitle || "تنسيق"} (صورة #${numIdx})`;
  const photoCode = `#YR-${Date.now().toString().slice(-4)}-${numIdx < 10 ? '0' + numIdx : numIdx}`;

  try {
    const signRes = await fetch('/api/cloudinary/sign', { method: 'POST' });
    if (!signRes.ok) throw new Error("فشل في استخراج التوقيع الرقمي");
    const signData = await signRes.json();
    if (!signData.success) throw new Error(signData.error);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signData.apiKey);
    formData.append("timestamp", signData.timestamp);
    formData.append("signature", signData.signature);
    formData.append("folder", "yellowrose");

    const response = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`, {
      method: "POST",
      body: formData
    });

    if (response.ok) {
      const data = await response.json();
      currentAlbumImages.push({
        url: data.secure_url,
        thumbnailUrl: data.secure_url, // For now they are same, Cloudinary supports transformations
        publicId: data.public_id,
        width: data.width,
        height: data.height,
        format: data.format,
        bytes: data.bytes,
        name: photoName,
        code: photoCode
      });
      if (!selectedCoverUrl) selectedCoverUrl = data.secure_url;
      return;
    }
  } catch (e) {
    console.error("Signed Cloudinary upload failed:", e);
    alert("فشل رفع الصورة: " + e.message);
  }
}

// Render Preview of Uploaded Images in Form (with Name and Code inputs)
function renderImagesPreview() {
  const previewBox = document.getElementById("uploadedImagesGrid");
  if (!previewBox) return;
  previewBox.innerHTML = "";

  if (currentAlbumImages.length === 0) {
    previewBox.innerHTML = '<p class="text-muted" style="font-size: 13px; grid-column: 1 / -1;">لم يتم رفع أي صور بعد.</p>';
    return;
  }

  currentAlbumImages.forEach((photo, idx) => {
    const photoUrl = typeof photo === "string" ? photo : photo.url;
    const photoName = typeof photo === "object" && photo.name ? photo.name : `صورة #${idx + 1}`;
    const photoCode = typeof photo === "object" && photo.code ? photo.code : `#YR-0${idx + 1}`;

    const card = document.createElement("div");
    card.className = `preview-img-card ${photoUrl === selectedCoverUrl ? 'is-cover' : ''}`;
    card.style.height = "auto";
    card.style.padding = "6px";
    card.style.background = "#222";
    card.style.borderRadius = "8px";

    card.innerHTML = `
      <div style="position: relative; aspect-ratio: 1; border-radius: 4px; overflow: hidden; margin-bottom: 6px;">
        <img src="${escapeHtml(photoUrl)}" alt="صورة ${idx + 1}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='assets/logo.png';">
        ${photoUrl === selectedCoverUrl ? '<span class="cover-badge"><i class="fas fa-crown"></i> الغلاف</span>' : ''}
        <div class="preview-actions">
          <button type="button" class="btn-preview-cover" title="تعيين كصورة غلاف للألبوم" onclick="setAsCover(${idx})">
            <i class="fas fa-crown"></i>
          </button>
          <button type="button" class="btn-preview-delete" title="حذف الصورة" onclick="removeImage(${idx})">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <input type="text" value="${escapeHtml(photoName)}" placeholder="اسم الصورة..." onchange="updatePhotoName(${idx}, this.value)" style="width: 100%; font-size: 11px; padding: 4px 6px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px;" title="اسم الصورة">
        <input type="text" value="${escapeHtml(photoCode)}" placeholder="كود الصورة..." onchange="updatePhotoCode(${idx}, this.value)" style="width: 100%; font-size: 11px; padding: 4px 6px; background: #333; border: 1px solid #444; color: var(--gold-light); border-radius: 4px; font-weight: bold;" title="كود الصورة">
      </div>
    `;

    previewBox.appendChild(card);
  });
}

window.updatePhotoName = function(idx, val) {
  if (currentAlbumImages[idx]) {
    if (typeof currentAlbumImages[idx] === "string") {
      currentAlbumImages[idx] = { url: currentAlbumImages[idx], name: val, code: `#YR-0${idx + 1}` };
    } else {
      currentAlbumImages[idx].name = val;
    }
  }
};

window.updatePhotoCode = function(idx, val) {
  if (currentAlbumImages[idx]) {
    if (typeof currentAlbumImages[idx] === "string") {
      currentAlbumImages[idx] = { url: currentAlbumImages[idx], name: `صورة #${idx + 1}`, code: val };
    } else {
      currentAlbumImages[idx].code = val;
    }
  }
};

window.setAsCover = function(index) {
  const photo = currentAlbumImages[index];
  selectedCoverUrl = typeof photo === "string" ? photo : photo.url;
  renderImagesPreview();
};

window.removeImage = function(index) {
  const removed = currentAlbumImages.splice(index, 1)[0];
  const removedUrl = typeof removed === "string" ? removed : removed.url;
  if (selectedCoverUrl === removedUrl) {
    selectedCoverUrl = currentAlbumImages[0] ? (currentAlbumImages[0].url || currentAlbumImages[0]) : "";
  }
  renderImagesPreview();
};

// Edit Album Action
window.editAlbum = async function(id) {
  const album = await window.YellowRoseDB.getAlbumById(id);
  if (!album) return;

  currentEditingId = album.id;
  currentAlbumImages = (album.images || [album.coverUrl]).map((img, i) => {
    if (typeof img === "string") {
      return {
        url: img,
        name: `${album.title} (صورة #${i + 1})`,
        code: `#YR-0${i + 1}`
      };
    }
    return { ...img };
  });
  selectedCoverUrl = album.coverUrl || (currentAlbumImages[0] ? currentAlbumImages[0].url : "");

  document.getElementById("albumFormTitle").textContent = album.isDirectMode ? `إدارة الصور المباشرة: ${window.CATEGORIES[album.category]?.name || album.category}` : `تعديل ألبوم: ${album.title}`;
  document.getElementById("albumTitleInput").value = album.title;
  document.getElementById("albumCategorySelect").value = album.category;
  document.getElementById("albumDescInput").value = album.description || "";
  document.getElementById("albumFeaturedCheck").checked = !!album.featured;
  document.getElementById("saveAlbumBtn").innerHTML = '<i class="fas fa-save"></i> حفظ التحديثات';
  document.getElementById("cancelEditBtn").classList.remove("hidden");

  const albumModeCheck = document.getElementById("enableAlbumModeCheck");
  if (albumModeCheck) {
    albumModeCheck.checked = !album.isDirectMode;
    albumModeCheck.dispatchEvent(new Event("change"));
  }

  renderImagesPreview();
  document.querySelector('[data-tab="tabAlbumForm"]').click();
};

// Delete Album Action
window.deleteAlbum = async function(id) {
  if (confirm("هل أنت متأكد من رغبتك في حذف هذا الألبوم نهائياً من المعرض؟")) {
    await window.YellowRoseDB.deleteAlbum(id);
    showToast("تم حذف الألبوم بنجاح.");
    await loadDashboardStatsAndAlbums();
  }
};

function resetAlbumForm() {
  currentEditingId = null;
  currentAlbumImages = [];
  selectedCoverUrl = "";

  document.getElementById("albumForm").reset();
  document.getElementById("albumFormTitle").textContent = "إضافة صور للقسم";
  document.getElementById("saveAlbumBtn").innerHTML = '<i class="fas fa-save"></i> حفظ في المعرض';
  document.getElementById("cancelEditBtn").classList.add("hidden");

  const albumModeCheck = document.getElementById("enableAlbumModeCheck");
  if (albumModeCheck) {
    albumModeCheck.checked = false;
    albumModeCheck.dispatchEvent(new Event("change"));
  }

  renderImagesPreview();
}

// Setup Brand Identity & Logo Management (Dedicated Tab)
async function setupBrandIdentitySettings() {
  const settings = await window.YellowRoseDB.getSiteSettings();
  const config = window.YellowRoseDB.getCloudConfig();

  // Input elements
  const logoUrlInput = document.getElementById("cfgBrandLogoUrl");
  const brandNameArInput = document.getElementById("cfgBrandNameAr");
  const brandNameEnInput = document.getElementById("cfgBrandNameEn");
  const brandSloganArInput = document.getElementById("cfgBrandSloganAr");
  const brandSloganEnInput = document.getElementById("cfgBrandSloganEn");
  const annToggle = document.getElementById("cfgAnnouncementEnabled");
  const annText = document.getElementById("cfgAnnouncementText");

  // Control buttons
  const fileInput = document.getElementById("brandLogoFileInput");
  const uploadBtn = document.getElementById("btnUploadLogo");
  const resetLogoBtn = document.getElementById("btnResetDefaultLogo");
  const saveBtn = document.getElementById("saveBrandIdentityBtn");

  // Mockup preview elements
  const previewNav = document.getElementById("previewLogoNav");
  const previewHero = document.getElementById("previewLogoHero");
  const previewFooter = document.getElementById("previewLogoFooter");

  // Populate initial values
  if (logoUrlInput) logoUrlInput.value = settings.logoUrl || "assets/logo.png?v=2";
  if (brandNameArInput) brandNameArInput.value = settings.brandNameAr || "يلوروز";
  if (brandNameEnInput) brandNameEnInput.value = settings.brandNameEn || "YELLOW ROSE";
  if (brandSloganArInput) brandSloganArInput.value = settings.brandSloganAr || "للورد والمناسبات";
  if (brandSloganEnInput) brandSloganEnInput.value = settings.brandSloganEn || "YELLOW ROSE • LUXURY FLORAL & EVENT DESIGN";
  if (annToggle) annToggle.checked = !!settings.announcementBarEnabled;
  if (annText) annText.value = settings.announcementText || "";

  // Helper to update previews live across mockups
  const updatePreviews = (logoUrl, nameAr, nameEn, sloganAr, sloganEn) => {
    const url = logoUrl || settings.logoUrl || "assets/logo.png?v=2";
    if (previewNav) previewNav.src = url;
    if (previewHero) previewHero.src = url;
    if (previewFooter) previewFooter.src = url;

    document.querySelectorAll(".preview-brand-ar").forEach(el => {
      el.textContent = nameAr || "يلوروز";
    });
    document.querySelectorAll(".preview-brand-en").forEach(el => {
      el.textContent = nameEn || "YELLOW ROSE";
    });
    document.querySelectorAll(".preview-slogan-ar").forEach(el => {
      el.textContent = sloganAr || "للورد والمناسبات";
    });
    document.querySelectorAll(".preview-slogan-en").forEach(el => {
      el.textContent = sloganEn || "YELLOW ROSE • LUXURY FLORAL & EVENT DESIGN";
    });
  };

  updatePreviews(
    settings.logoUrl,
    settings.brandNameAr,
    settings.brandNameEn,
    settings.brandSloganAr,
    settings.brandSloganEn
  );

  // Live input events for instant feedback
  [brandNameArInput, brandNameEnInput, brandSloganArInput, brandSloganEnInput].forEach(inp => {
    if (inp) {
      inp.addEventListener("input", () => {
        updatePreviews(
          logoUrlInput?.value.trim(),
          brandNameArInput?.value.trim(),
          brandNameEnInput?.value.trim(),
          brandSloganArInput?.value.trim(),
          brandSloganEnInput?.value.trim()
        );
      });
    }
  });

  if (logoUrlInput) {
    logoUrlInput.addEventListener("input", () => {
      updatePreviews(
        logoUrlInput.value.trim(),
        brandNameArInput?.value.trim(),
        brandNameEnInput?.value.trim(),
        brandSloganArInput?.value.trim(),
        brandSloganEnInput?.value.trim()
      );
    });
  }

  // Trigger file selection dialog
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => fileInput.click());
  }

  // Handle uploaded file (Cloudinary if configured, or local DataURL)
  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      showToast("جاري تحميل الشعار ومعالجته...");

      // Upload securely to Cloudinary using Signed URLs
      try {
        const signRes = await fetch('/api/cloudinary/sign', { method: 'POST' });
        if (!signRes.ok) throw new Error("فشل في استخراج التوقيع الرقمي");
        const signData = await signRes.json();
        if (!signData.success) throw new Error(signData.error);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", signData.apiKey);
        formData.append("timestamp", signData.timestamp);
        formData.append("signature", signData.signature);
        formData.append("folder", "yellowrose");

        const response = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`, {
          method: "POST",
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          if (logoUrlInput) logoUrlInput.value = data.secure_url;
          updatePreviews(
            data.secure_url,
            brandNameArInput?.value.trim(),
            brandNameEnInput?.value.trim(),
            brandSloganArInput?.value.trim(),
            brandSloganEnInput?.value.trim()
          );
          showToast("تم رفع الشعار بنجاح إلى السحابة! اضغط على زر الحفظ لتطبيقه.");
          return;
        }
      } catch (err) {
        console.warn("Cloudinary logo upload failed, using local reader:", err);
      }

      // Local fallback with FileReader (Base64 DataURL)
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const dataUrl = loadEvt.target.result;
        if (logoUrlInput) logoUrlInput.value = dataUrl;
        updatePreviews(
          dataUrl,
          brandNameArInput?.value.trim(),
          brandNameEnInput?.value.trim(),
          brandSloganArInput?.value.trim(),
          brandSloganEnInput?.value.trim()
        );
        showToast("تم اختيار الشعار وتحديث المعاينة! اضغط على زر الحفظ لتطبيقه.");
      };
      reader.readAsDataURL(file);
    });
  }

  // Reset to default logo
  if (resetLogoBtn) {
    resetLogoBtn.addEventListener("click", () => {
      const defLogo = "assets/logo.png?v=2";
      if (logoUrlInput) logoUrlInput.value = defLogo;
      updatePreviews(
        defLogo,
        brandNameArInput?.value.trim(),
        brandNameEnInput?.value.trim(),
        brandSloganArInput?.value.trim(),
        brandSloganEnInput?.value.trim()
      );
      showToast("تمت استعادة الشعار الأصلي الافتراضي في المعاينة.");
    });
  }

  // Save Brand Identity & Logo Settings
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const newSettings = {
        announcementBarEnabled: annToggle ? annToggle.checked : true,
        announcementText: annText ? annText.value.trim() : "",
        logoUrl: logoUrlInput ? (logoUrlInput.value.trim() || "assets/logo.png?v=2") : "assets/logo.png?v=2",
        brandNameAr: brandNameArInput ? (brandNameArInput.value.trim() || "يلوروز") : "يلوروز",
        brandNameEn: brandNameEnInput ? (brandNameEnInput.value.trim() || "YELLOW ROSE") : "YELLOW ROSE",
        brandSloganAr: brandSloganArInput ? (brandSloganArInput.value.trim() || "للورد والمناسبات") : "للورد والمناسبات",
        brandSloganEn: brandSloganEnInput ? (brandSloganEnInput.value.trim() || "YELLOW ROSE • LUXURY FLORAL & EVENT DESIGN") : "YELLOW ROSE • LUXURY FLORAL & EVENT DESIGN"
      };

      const success = window.YellowRoseDB.saveSiteSettings(newSettings);
      if (success) {
        // Also update stat card if present
        const statBrand = document.getElementById("statBrandName");
        if (statBrand) statBrand.textContent = newSettings.brandNameAr;

        showToast("✨ تم حفظ وتطبيق هوية المتجر والشعار بنجاح على كامل الموقع!");
      } else {
        alert("حدث خطأ أثناء حفظ الإعدادات، يرجى إعادة المحاولة.");
      }
    });
  }
}



// Toast notification helper
function showToast(msg) {
  let toast = document.getElementById("adminToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "adminToast";
    toast.className = "admin-toast";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
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
