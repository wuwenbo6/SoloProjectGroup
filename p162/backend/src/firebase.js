const admin = require('firebase-admin');

let db = null;

const initializeFirebase = () => {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    };

    if (serviceAccount.projectId && serviceAccount.privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      db = admin.firestore();
      console.log('Firebase initialized successfully');
    } else {
      console.warn('Firebase credentials not provided, running in demo mode');
    }
  } catch (error) {
    console.warn('Firebase initialization failed, running in demo mode:', error.message);
  }
};

const getFirestore = () => db;

const listenToDetections = (callback) => {
  if (!db) {
    console.warn('Firebase not initialized, cannot listen to detections');
    return () => {};
  }

  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  return db.collection('detections')
    .where('timestamp', '>', oneMinuteAgo)
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          callback({
            id: change.doc.id,
            ...data
          });
        }
      });
    }, error => {
      console.error('Firestore listener error:', error);
    });
};

const getRecentDetections = async (timeWindowMs = 300000) => {
  if (!db) {
    return [];
  }

  const cutoff = Date.now() - timeWindowMs;
  
  try {
    const snapshot = await db.collection('detections')
      .where('timestamp', '>', cutoff)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting recent detections:', error);
    return [];
  }
};

const saveQuakeEvent = async (event) => {
  if (!db) {
    console.log('Demo mode - would save quake event:', event.id);
    return;
  }

  try {
    await db.collection('quake_events').doc(event.id).set(event);
    console.log('Quake event saved:', event.id);
  } catch (error) {
    console.error('Error saving quake event:', error);
  }
};

module.exports = {
  initializeFirebase,
  getFirestore,
  listenToDetections,
  getRecentDetections,
  saveQuakeEvent
};
