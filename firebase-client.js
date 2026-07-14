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
  const [{ initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult }, { getFirestore, doc, getDoc, setDoc }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
  ]);
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const rankingDoc = doc(db, 'awsStarBattle', 'ranking');
  const allowedAdmins = (config.allowedAdmins || []).map((email) => email.toLowerCase());
  const isAdmin = (user) => !!user && allowedAdmins.includes(user.email?.toLowerCase());
  const provider = new GoogleAuthProvider();
  let redirectLoginResult = null;

  try {
    const result = await getRedirectResult(auth);
    if (result && sessionStorage.getItem('awsAdminLoginRedirect') === '1') {
      redirectLoginResult = isAdmin(result.user);
      sessionStorage.removeItem('awsAdminLoginRedirect');
    }
  } catch (error) {
    sessionStorage.removeItem('awsAdminLoginRedirect');
    redirectLoginResult = { error: error?.code || 'auth/redirect-failed' };
  }

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
      if (window.matchMedia('(pointer: coarse)').matches) {
        sessionStorage.setItem('awsAdminLoginRedirect', '1');
        await signInWithRedirect(auth, provider);
        return { redirecting: true };
      }
      try {
        const result = await signInWithPopup(auth, provider);
        return isAdmin(result.user);
      } catch (error) {
        const redirectErrors = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'];
        if (!redirectErrors.includes(error?.code)) throw error;
        sessionStorage.setItem('awsAdminLoginRedirect', '1');
        await signInWithRedirect(auth, provider);
        return { redirecting: true };
      }
    },
    consumeRedirectLogin() {
      const result = redirectLoginResult;
      redirectLoginResult = null;
      return result;
    },
    loginErrorMessage(error) {
      const messages = {
        'auth/unauthorized-domain': `Questo sito (${window.location.hostname}) non è ancora autorizzato in Firebase.`,
        'auth/popup-closed-by-user': 'La finestra di accesso è stata chiusa prima del completamento.',
        'auth/network-request-failed': 'Connessione non disponibile. Controlla la rete e riprova.',
      };
      return messages[error?.code] || 'Accesso non completato. Riprova.';
    },
  };
  window.dispatchEvent(new Event('aws-store-ready'));
}
