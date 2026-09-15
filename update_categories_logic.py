import re

with open('assets/js/admin.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace populateCategorySelect with async fetching version
old_func = """function populateCategorySelect() {
  const select = document.getElementById("productCategorySelect");
  if (!select) return;
  select.innerHTML = "";

  Object.values(window.CATEGORIES).forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
}"""

new_func = """async function populateCategorySelect() {
  const select = document.getElementById("productCategorySelect");
  if (!select) return;
  
  const categories = await window.YellowRoseDB.getCategories();
  // Update global cache
  window.CATEGORIES = {};
  categories.forEach(c => window.CATEGORIES[c.id] = c);

  select.innerHTML = '<option value="">-- اختر القسم الرئيسي --</option>';
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
}"""

content = content.replace(old_func, new_func)

with open('assets/js/admin.js', 'w', encoding='utf-8') as f:
    f.write(content)

