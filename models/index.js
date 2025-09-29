const fs = require('fs');
const path = require('path');

// Read all JS files in the current directory (skip directories and non-js files)
const models = {};
fs.readdirSync(__dirname).forEach((file) => {
  const fullPath = path.join(__dirname, file);
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) return;
  if (file.startsWith('.')) return;
  if (file === 'index.js') return;
  if (path.extname(file) !== '.js') return;

  const modelName = path.basename(file, path.extname(file));
  models[modelName] = require(fullPath);
});

module.exports = models;
