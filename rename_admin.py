import re

with open('assets/js/admin.js', 'r', encoding='utf-8') as f:
    content = f.read()

# ID replacements based on HTML changes
replacements = {
    'tabAlbumsList': 'tabProductsList',
    'tabAlbumForm': 'tabProductForm',
    'albumFormTitle': 'productFormTitle',
    'albumForm': 'productForm',
    'albumCategorySelect': 'productCategorySelect',
    'albumTitleInput': 'productTitleInput',
    'albumDescInput': 'productDescInput',
    'albumFeaturedCheck': 'productFeaturedCheck',
    'albumFilesInput': 'productFilesInput',
    'saveAlbumBtn': 'saveProductBtn',
    'adminAlbumsList': 'adminProductsList',
    'statAlbumsCount': 'statProductsCount',
    'enableAlbumModeCheck': 'enableProductModeCheck',
    'albumModeFields': 'productModeFields'
}

for old, new in replacements.items():
    content = content.replace(old, new)

# DB method replacements
content = content.replace('window.YellowRoseDB.getAlbums', 'window.YellowRoseDB.getProducts')
content = content.replace('window.YellowRoseDB.getAlbumById', 'window.YellowRoseDB.getProductById')
content = content.replace('window.YellowRoseDB.saveAlbum', 'window.YellowRoseDB.saveProduct')
content = content.replace('window.YellowRoseDB.deleteAlbum', 'window.YellowRoseDB.deleteProduct')

# General variable replacements
content = content.replace('currentAlbumImages', 'currentProductImages')
content = content.replace('loadDashboardStatsAndAlbums', 'loadDashboardStatsAndProducts')
content = content.replace('renderAdminAlbumsList', 'renderAdminProductsList')
content = content.replace('editAlbum(', 'editProduct(')
content = content.replace('deleteAlbum(', 'deleteProduct(')
content = content.replace('album.html', 'catalog.html')

with open('assets/js/admin.js', 'w', encoding='utf-8') as f:
    f.write(content)

