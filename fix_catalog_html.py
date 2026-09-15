import re

with open('catalog.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("assets/js/album.js", "assets/js/catalog.js")
content = content.replace("ألبوم يلوروز", "كتالوج يلوروز")
content = content.replace("تفاصيل الألبوم", "تفاصيل المنتج")
content = content.replace("id=\"albumContent\"", "id=\"productContent\"")
content = content.replace("id=\"albumCategory\"", "id=\"productCategory\"")
content = content.replace("id=\"albumDate\"", "id=\"productDate\"")
content = content.replace("id=\"albumTitle\"", "id=\"productTitle\"")
content = content.replace("id=\"albumDesc\"", "id=\"productDesc\"")
content = content.replace("id=\"albumImagesGrid\"", "id=\"productImagesGrid\"")
content = content.replace("albumContainer", "productContainer")
content = content.replace("albumError", "productError")

with open('catalog.html', 'w', encoding='utf-8') as f:
    f.write(content)

