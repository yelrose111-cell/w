import re

with open('assets/js/catalog.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace album references with product
content = content.replace("albumId", "productId")
content = content.replace("window.YellowRoseDB.getAlbumById", "window.YellowRoseDB.getProductById")
content = content.replace("const album =", "const product =")
content = content.replace("if (!album)", "if (!product)")
content = content.replace("renderAlbum(album)", "renderProduct(product)")
content = content.replace("function renderAlbum(album)", "function renderProduct(product)")
content = content.replace("album.", "product.")
content = content.replace("albumContent", "productContent")
content = content.replace("albumCategory", "productCategory")
content = content.replace("albumDate", "productDate")
content = content.replace("albumTitle", "productTitle")
content = content.replace("albumDesc", "productDesc")
content = content.replace("albumImagesGrid", "productImagesGrid")
content = content.replace("albumContainer", "productContainer")
content = content.replace("albumError", "productError")

# Remove window.CATEGORIES initialization inside catalog since it is fetched globally
categories_fix = """
    const cats = await window.YellowRoseDB.getCategories();
    window.CATEGORIES = {};
    cats.forEach(c => window.CATEGORIES[c.id] = c);
"""

content = re.sub(r'async function init\(\) \{', 'async function init() {\n' + categories_fix, content)

with open('assets/js/catalog.js', 'w', encoding='utf-8') as f:
    f.write(content)
