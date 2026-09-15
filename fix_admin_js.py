import re

with open('assets/js/admin.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix admin.js to handle Products and Categories properly

new_setup_form_handlers = """
// Setup Form & Upload Handlers
function setupFormHandlers() {
  const form = document.getElementById("productForm");
  const fileInput = document.getElementById("productFilesInput");
  const urlInput = document.getElementById("directImageUrlInput");
  const addUrlBtn = document.getElementById("addDirectUrlBtn");
  const cancelBtn = document.getElementById("cancelEditBtn");
  
  // Category Form
  const categoryForm = document.getElementById("categoryForm");
  if (categoryForm) {
    categoryForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("categoryIdInput").value;
      const name = document.getElementById("categoryNameInput").value;
      const icon = document.getElementById("categoryIconInput").value;
      const order = document.getElementById("categoryOrderInput").value || 0;
      
      const categoryData = {
        name: name,
        icon: icon,
        order: parseInt(order)
      };
      
      if (id) categoryData.id = id;
      
      const success = await window.YellowRoseDB.saveCategory(categoryData);
      if (success) {
        showToast("تم حفظ القسم بنجاح!");
        document.getElementById("categoryFormContainer").style.display = "none";
        categoryForm.reset();
        await loadCategoriesList();
        populateCategorySelect(); // Update dropdown
      } else {
        showToast("خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى.");
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
        const title = document.getElementById("productTitleInput").value.trim() || "منتج";
        currentProductImages.push({
          url: url,
          name: `${title} (لقطة 직접ية)`,
          code: `#YR-PR-${currentProductImages.length + 1}`
        });
        if (!selectedCoverUrl) selectedCoverUrl = url;
        urlInput.value = "";
        renderImagesPreview();
      }
    });
  }

  // Submit Product Form
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (currentProductImages.length === 0) {
        showToast("يرجى إضافة صورة واحدة على الأقل!");
        return;
      }

      const catSelect = document.getElementById("productCategorySelect");
      const titleInput = document.getElementById("productTitleInput");
      const descInput = document.getElementById("productDescInput");
      const priceInput = document.getElementById("productPriceInput");
      const featuredCheck = document.getElementById("productFeaturedCheck");

      const productData = {
        id: currentEditingId || `pr_${Date.now()}`,
        categoryId: catSelect.value,
        title: titleInput.value.trim(),
        description: descInput ? descInput.value.trim() : "",
        price: priceInput ? priceInput.value.trim() : "",
        featured: featuredCheck ? featuredCheck.checked : false,
        coverUrl: selectedCoverUrl || currentProductImages[0].url,
        images: currentProductImages,
        createdAt: new Date().toISOString()
      };

      const btn = document.getElementById("saveProductBtn");
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
      btn.disabled = true;

      const success = await window.YellowRoseDB.saveProduct(productData);

      btn.innerHTML = originalText;
      btn.disabled = false;

      if (success) {
        showToast("تم حفظ المنتج بنجاح!");
        resetProductForm();
        loadDashboardStatsAndProducts();
        document.querySelector('[data-tab="tabProductsList"]').click();
      } else {
        showToast("خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى.");
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      resetProductForm();
      document.querySelector('[data-tab="tabProductsList"]').click();
    });
  }
}
"""

content = re.sub(r'// Setup Form & Upload Handlers.*?if \(cancelBtn\).*?\}\n\}', new_setup_form_handlers, content, flags=re.DOTALL)

# Add loadCategoriesList function
load_cats = """
async function loadCategoriesList() {
  const categories = await window.YellowRoseDB.getCategories();
  const listContainer = document.getElementById("adminCategoriesList");
  if (!listContainer) return;
  
  if (categories.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center; padding: 20px;">لا توجد أقسام حاليا</div>';
    return;
  }
  
  let html = '';
  categories.forEach(cat => {
    html += `
      <div class="admin-album-row" style="align-items: center; padding: 15px;">
        <div style="font-size: 24px; color: var(--gold-primary); margin-left: 15px;"><i class="fas ${cat.icon}"></i></div>
        <div style="flex: 1;">
          <h4 style="margin: 0; font-size: 16px;">${cat.name}</h4>
          <span style="font-size: 12px; color: #888;">ترتيب: ${cat.order || 0}</span>
        </div>
        <div class="row-actions">
          <button class="btn-action-edit" onclick="editCategory('${cat.id}')"><i class="fas fa-edit"></i> تعديل</button>
          <button class="btn-action-delete" onclick="deleteCategory('${cat.id}')"><i class="fas fa-trash-alt"></i> حذف</button>
        </div>
      </div>
    `;
  });
  listContainer.innerHTML = html;
}

window.editCategory = async (id) => {
  const categories = await window.YellowRoseDB.getCategories();
  const cat = categories.find(c => c.id === id);
  if (!cat) return;
  
  document.getElementById("categoryIdInput").value = cat.id;
  document.getElementById("categoryNameInput").value = cat.name;
  document.getElementById("categoryIconInput").value = cat.icon;
  document.getElementById("categoryOrderInput").value = cat.order || 0;
  
  document.getElementById("categoryFormTitle").textContent = "تعديل القسم";
  document.getElementById("categoryFormContainer").style.display = "block";
};

window.deleteCategory = async (id) => {
  if (confirm("هل أنت متأكد من حذف هذا القسم؟ لا يمكن التراجع!")) {
    const success = await window.YellowRoseDB.deleteCategory(id);
    if (success) {
      showToast("تم حذف القسم");
      await loadCategoriesList();
      populateCategorySelect();
    } else {
      showToast("حدث خطأ أثناء الحذف");
    }
  }
};
"""

content += load_cats

# Update loadDashboardStatsAndProducts to also load categories list
content = content.replace("renderAdminProductsList(albums);", "renderAdminProductsList(albums);\n  await loadCategoriesList();")


# Replace resetAlbumForm to resetProductForm
reset_func = """function resetProductForm() {
  currentEditingId = null;
  currentProductImages = [];
  selectedCoverUrl = "";
  
  document.getElementById("productForm").reset();
  
  const title = document.getElementById("productFormTitle");
  if (title) title.textContent = "إضافة منتج جديد";
  
  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.classList.add("hidden");
  
  renderImagesPreview();
}"""

content = re.sub(r'function resetProductForm\(\) \{.*?\}\s*function', reset_func + '\n\nfunction', content, flags=re.DOTALL)

with open('assets/js/admin.js', 'w', encoding='utf-8') as f:
    f.write(content)

