// Compatibility entry point. Keep the historic (data, folder) write signatures.
const path = require('node:path');
const typed = require('../backend/dist/resources/catalog.js');
const defaultFolder = path.resolve(__dirname, '../../assets/prefab');
module.exports = {
  readCatalog: (folder = defaultFolder) => typed.readCatalog(folder),
  savePrefab: (data, folder = defaultFolder) => typed.savePrefab(folder, data),
  saveTagPrefab: (data, folder = defaultFolder) => typed.saveTagPrefab(folder, data),
};
