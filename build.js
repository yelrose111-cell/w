const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

const jsFiles = [
  'assets/js/db.js',
  'assets/js/main.js',
  'assets/js/album.js',
  'assets/js/admin.js'
];

const cssFiles = [
  'assets/css/style.css'
];

const jsDistDir = 'assets/dist/js';
const cssDistDir = 'assets/dist/css';

// Ensure directories exist
if (!fs.existsSync(jsDistDir)) {
  fs.mkdirSync(jsDistDir, { recursive: true });
}
if (!fs.existsSync(cssDistDir)) {
  fs.mkdirSync(cssDistDir, { recursive: true });
}

async function build() {
  console.log('Starting build process...');

  // Minify JS
  for (const file of jsFiles) {
    if (fs.existsSync(file)) {
      const code = fs.readFileSync(file, 'utf8');
      const result = await minify(code, {
        mangle: {
          toplevel: true, // Mangle top-level variable and function names
        },
        compress: {
          drop_console: true, // Remove console.log
        }
      });
      const basename = path.basename(file, '.js');
      const distPath = path.join(jsDistDir, `${basename}.min.js`);
      fs.writeFileSync(distPath, result.code);
      console.log(`Minified ${file} -> ${distPath}`);
    } else {
      console.warn(`File not found: ${file}`);
    }
  }

  // Minify CSS
  for (const file of cssFiles) {
    if (fs.existsSync(file)) {
      const code = fs.readFileSync(file, 'utf8');
      const result = new CleanCSS({}).minify(code);
      const basename = path.basename(file, '.css');
      const distPath = path.join(cssDistDir, `${basename}.min.css`);
      fs.writeFileSync(distPath, result.styles);
      console.log(`Minified ${file} -> ${distPath}`);
    } else {
      console.warn(`File not found: ${file}`);
    }
  }

  console.log('Build completed successfully!');
}

build().catch(console.error);
