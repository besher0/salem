const admin = require('firebase-admin');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.warn('FIREBASE_SERVICE_ACCOUNT not set. Firebase admin will not be initialized.');
  module.exports = admin;
  return;
}

let serviceAccount = null;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (err) {
  console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', err.message);
  module.exports = admin;
  return;
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (err) {
  console.error('Firebase admin initialization failed:', err.message);
}

module.exports = admin;
