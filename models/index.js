const fs = require('fs');
const path = require('path');

// Read all files in the current directory
const models = {};
fs.readdirSync(__dirname).forEach((file) => {
  const modelName = path.basename(file, path.extname(file));
  if (modelName !== 'index') {
    // Skip the index.js file
    models[modelName] = require(path.join(__dirname, file));
  }
});

module.exports = models;
