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
  const [{ initializeApp }, { getFirestore, doc, getDoc, setDoc }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
  ]);
  const app = initializeApp(config);
  const db = getFirestore(app);
  const rankingDoc = doc(db, 'awsStarBattle', 'ranking');

  window.awsStore = {
    async load() {
      const snapshot = await getDoc(rankingDoc);
      return snapshot.exists() ? snapshot.data() : { teams: [], tournaments: [] };
    },
    async save(data) {
      await setDoc(rankingDoc, data);
    },
    async login() {
      return true;
    },
    consumeRedirectLogin() {
      return null;
    },
    loginErrorMessage(error) {
      const messages = {
        'permission-denied': 'Le regole Firebase non consentono ancora il salvataggio. Pubblica le nuove regole del progetto.',
        unavailable: 'Connessione al database non disponibile. Riprova.',
      };
      return messages[error?.code] || 'Connessione al database non completata. Riprova.';
    },
  };
  window.dispatchEvent(new Event('aws-store-ready'));
}
