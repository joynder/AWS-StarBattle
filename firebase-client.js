import './firebase-config.js';

const localStore = {
  load: async () => JSON.parse(localStorage.getItem('awsStarBattle')) || { teams: [], tournaments: [] },
  save: async (data) => localStorage.setItem('awsStarBattle', JSON.stringify(data)),
  login: null,
};

const config = window.AWS_FIREBASE_CONFIG;
if (!config?.apiKey || !config?.projectId) {
  window.awsStore = localStore;
  window.dispatchEvent(new Event('aws-store-ready'));
} else {
  const [{ initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup }, { getFirestore, doc, getDoc, setDoc }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
  ]);
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const rankingDoc = doc(db, 'awsStarBattle', 'ranking');
  const isAdmin = (user) => !!user && config.allowedAdmins.includes(user.email?.toLowerCase());

  window.awsStore = {
    async load() {
      const snapshot = await getDoc(rankingDoc);
      return snapshot.exists() ? snapshot.data() : { teams: [], tournaments: [] };
    },
    async save(data) {
      if (!isAdmin(auth.currentUser)) throw new Error('not-authorized');
      await setDoc(rankingDoc, data);
    },
    async login() {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      return isAdmin(result.user);
    },
  };
  window.dispatchEvent(new Event('aws-store-ready'));
}
