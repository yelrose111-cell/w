const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static(__dirname));

// Proxy API requests to local backend running on 8080
app.use('/api', createProxyMiddleware({ 
  target: 'http://localhost:8080',
  changeOrigin: true
}));

app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
});
