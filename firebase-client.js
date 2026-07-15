import './firebase-config.js';

function getInitials(name) {
  if (!name) return 'SB';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const localStore = {
  load: async () => JSON.parse(localStorage.getItem('awsStarBattle')) || { teams: [], tournaments: [] },
  save: async (data) => localStorage.setItem('awsStarBattle', JSON.stringify(data)),
  async updateTeamMemberInfo(teamId, uid, nickname, photoURL) {
    const rankingData = await this.load();
    let updated = false;
    rankingData.teams = (rankingData.teams || []).map((t) => {
      if (String(t.id) === String(teamId)) {
        t.membersDetails = (t.membersDetails || []).map((m) => {
          if (m.uid === uid) {
            updated = true;
            return { ...m, nickname, photoURL };
          }
          return m;
        });
        if (!updated && (t.members || []).includes(uid)) {
          t.membersDetails = [...(t.membersDetails || []), { uid, nickname, photoURL }];
        }
      }
      return t;
    });
    await this.save(rankingData);
  }
};

const localAuth = {
  currentUser: null,
  listeners: [],
  onAuthChange(callback) {
    this.listeners.push(callback);
    const localUser = JSON.parse(localStorage.getItem('awsStarBattleUser')) || null;
    this.currentUser = localUser;
    callback(localUser);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  },
  _notify() {
    this.listeners.forEach((callback) => callback(this.currentUser));
  },
  async signUp(email, password, nickname) {
    const initials = getInitials(nickname);
    const defaultPhoto = `https://placehold.co/90x90/41156d/fff?text=${initials}`;
    
    // Auto-admin for local test with joynderland@gmail.com
    const isLocalAdmin = email === 'joynderland@gmail.com';
    const badges = isLocalAdmin ? ['admin', 'club_leader'] : [];
    
    const profile = {
      uid: 'local_' + Date.now(),
      nickname: nickname || email.split('@')[0],
      photoURL: defaultPhoto,
      teamId: null,
      role: null,
      email: email,
      badges: badges
    };
    
    // Save to users list for search mock
    const users = JSON.parse(localStorage.getItem('awsStarBattleUsersList')) || [];
    users.push(profile);
    localStorage.setItem('awsStarBattleUsersList', JSON.stringify(users));

    localStorage.setItem('awsStarBattleUser', JSON.stringify(profile));
    this.currentUser = profile;
    this._notify();
    return profile;
  },
  async loginWithEmail(email, password) {
    const users = JSON.parse(localStorage.getItem('awsStarBattleUsersList')) || [];
    let profile = users.find((u) => u.email === email);
    
    if (!profile) {
      // Create on the fly for ease of local testing
      const isLocalAdmin = email === 'joynderland@gmail.com';
      const initials = getInitials(email.split('@')[0]);
      const defaultPhoto = `https://placehold.co/90x90/41156d/fff?text=${initials}`;
      profile = {
        uid: 'local_' + Date.now(),
        nickname: email.split('@')[0],
        photoURL: defaultPhoto,
        teamId: null,
        role: null,
        email: email,
        badges: isLocalAdmin ? ['admin', 'club_leader'] : []
      };
      users.push(profile);
      localStorage.setItem('awsStarBattleUsersList', JSON.stringify(users));
    }
    
    if (profile.email === 'joynderland@gmail.com') {
      sessionStorage.setItem('awsStarBattleAdmin', 'true');
    }
    localStorage.setItem('awsStarBattleUser', JSON.stringify(profile));
    this.currentUser = profile;
    this._notify();
    return profile;
  },
  async loginWithGoogle() {
    return this.loginWithEmail('joynderland@gmail.com', '');
  },
  async logout() {
    localStorage.removeItem('awsStarBattleUser');
    sessionStorage.removeItem('awsStarBattleAdmin');
    this.currentUser = null;
    this._notify();
  },
  async updateProfile(nickname, photoURL) {
    if (!this.currentUser) throw new Error('not-logged-in');
    
    const initials = getInitials(nickname);
    const finalPhoto = photoURL || `https://placehold.co/90x90/41156d/fff?text=${initials}`;
    
    this.currentUser.nickname = nickname;
    this.currentUser.photoURL = finalPhoto;
    
    localStorage.setItem('awsStarBattleUser', JSON.stringify(this.currentUser));
    
    // Update in users list
    const users = JSON.parse(localStorage.getItem('awsStarBattleUsersList')) || [];
    localStorage.setItem('awsStarBattleUsersList', JSON.stringify(users.map((u) => u.uid === this.currentUser.uid ? this.currentUser : u)));
    
    if (this.currentUser.teamId) {
      await window.awsStore.updateTeamMemberInfo(this.currentUser.teamId, this.currentUser.uid, nickname, finalPhoto);
    }
    this._notify();
  },
  async uploadProfilePhoto(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  },
  
  // Mock Invitations API
  async searchUsers(query) {
    const users = JSON.parse(localStorage.getItem('awsStarBattleUsersList')) || [];
    const q = query.toLowerCase();
    return users.filter((u) => u.uid !== this.currentUser?.uid && u.nickname.toLowerCase().includes(q));
  },
  
  async sendInvitation(teamId, teamName, teamLogo, fromUid, toUid, toNickname) {
    const invitations = JSON.parse(localStorage.getItem('awsStarBattleInvitations')) || [];
    const invId = `inv_local_${Date.now()}`;
    const newInv = {
      id: invId,
      teamId,
      teamName,
      teamLogo,
      fromUid,
      toUid,
      toNickname,
      status: 'pending',
      timestamp: Date.now()
    };
    invitations.push(newInv);
    localStorage.setItem('awsStarBattleInvitations', JSON.stringify(invitations));
    return newInv;
  },
  
  async getPendingInvitations(uid) {
    const invitations = JSON.parse(localStorage.getItem('awsStarBattleInvitations')) || [];
    return invitations.filter((inv) => inv.toUid === uid && inv.status === 'pending');
  },
  
  async respondToInvitation(invitationId, status) {
    const invitations = JSON.parse(localStorage.getItem('awsStarBattleInvitations')) || [];
    localStorage.setItem('awsStarBattleInvitations', JSON.stringify(invitations.map((inv) => inv.id === invitationId ? { ...inv, status } : inv)));
  }
};

const config = window.AWS_FIREBASE_CONFIG;
if (!config?.apiKey || !config?.projectId) {
  window.awsStore = localStore;
  window.awsAuth = localAuth;
  setTimeout(() => window.dispatchEvent(new Event('aws-store-ready')), 0);
} else {
  try {
    const [
      { initializeApp },
      { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc },
      { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup },
      { getStorage, ref, uploadBytes, getDownloadURL }
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js'),
    ]);

    const app = initializeApp(config);
    const db = getFirestore(app);
    const auth = getAuth(app);
    let storage = null;
    try {
      storage = getStorage(app);
    } catch (e) {
      console.warn("Storage not initialized:", e);
    }

    const rankingDoc = doc(db, 'awsStarBattle', 'ranking');

    window.awsStore = {
      async load() {
        const snapshot = await getDoc(rankingDoc);
        return snapshot.exists() ? snapshot.data() : { teams: [], tournaments: [] };
      },
      async save(data) {
        await setDoc(rankingDoc, data);
      },
      async updateTeamMemberInfo(teamId, uid, nickname, photoURL) {
        const rankingData = await this.load();
        let updated = false;
        rankingData.teams = (rankingData.teams || []).map((t) => {
          if (String(t.id) === String(teamId)) {
            t.membersDetails = (t.membersDetails || []).map((m) => {
              if (m.uid === uid) {
                updated = true;
                return { ...m, nickname, photoURL };
              }
              return m;
            });
            if (!updated && (t.members || []).includes(uid)) {
              t.membersDetails = [...(t.membersDetails || []), { uid, nickname, photoURL }];
            }
          }
          return t;
        });
        await this.save(rankingData);
      }
    };

    window.awsAuth = {
      currentUser: null,
      onAuthChange(callback) {
        return onAuthStateChanged(auth, async (user) => {
          if (user) {
            const allowedAdmins = config.allowedAdmins || [];
            const isAdmin = user.email && allowedAdmins.includes(user.email);
            const userDocRef = doc(db, 'users', user.uid);
            let profile = null;
            try {
              const userSnap = await getDoc(userDocRef);
              if (userSnap.exists()) {
                profile = userSnap.data();
                // Assicurati che gli allowedAdmins abbiano i badge admin/club_leader
                if (isAdmin && (!profile.badges || !profile.badges.includes('admin'))) {
                  profile.badges = ['admin', 'club_leader'];
                  await setDoc(userDocRef, { badges: profile.badges }, { merge: true });
                }
              } else {
                const initials = getInitials(user.displayName || user.email.split('@')[0]);
                const defaultPhoto = `https://placehold.co/90x90/41156d/fff?text=${initials}`;
                profile = {
                  uid: user.uid,
                  nickname: user.displayName || user.email.split('@')[0],
                  photoURL: user.photoURL || defaultPhoto,
                  teamId: null,
                  role: null,
                  email: user.email,
                  badges: isAdmin ? ['admin', 'club_leader'] : []
                };
                await setDoc(userDocRef, profile);
              }
            } catch (e) {
              console.error("Error loading user profile:", e);
              profile = {
                uid: user.uid,
                nickname: user.email.split('@')[0],
                photoURL: `https://placehold.co/90x90/41156d/fff?text=${getInitials(user.email.split('@')[0])}`,
                teamId: null,
                role: null,
                email: user.email,
                badges: isAdmin ? ['admin', 'club_leader'] : []
              };
            }
            
            // Imposta sessione admin per retrocompatibilità
            if (profile.badges && profile.badges.includes('admin')) {
              sessionStorage.setItem('awsStarBattleAdmin', 'true');
            }
            
            window.awsAuth.currentUser = profile;
            callback(profile);
          } else {
            window.awsAuth.currentUser = null;
            callback(null);
          }
        });
      },

      async signUp(email, password, nickname) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        const initials = getInitials(nickname);
        const defaultPhoto = `https://placehold.co/90x90/41156d/fff?text=${initials}`;
        
        const allowedAdmins = config.allowedAdmins || [];
        const isAdmin = email && allowedAdmins.includes(email);
        const badges = isAdmin ? ['admin', 'club_leader'] : [];
        
        const profile = {
          uid: user.uid,
          nickname: nickname || email.split('@')[0],
          photoURL: defaultPhoto,
          teamId: null,
          role: null,
          email: email,
          badges: badges
        };
        
        await setDoc(doc(db, 'users', user.uid), profile);
        window.awsAuth.currentUser = profile;
        return profile;
      },

      async loginWithEmail(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },

      async loginWithGoogle() {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      },

      async logout() {
        await signOut(auth);
        sessionStorage.removeItem('awsStarBattleAdmin');
      },

      async updateProfile(nickname, photoURL) {
        if (!auth.currentUser) throw new Error('not-logged-in');
        const uid = auth.currentUser.uid;
        const userDocRef = doc(db, 'users', uid);
        
        const initials = getInitials(nickname);
        const finalPhoto = photoURL || `https://placehold.co/90x90/41156d/fff?text=${initials}`;
        
        const updates = { nickname, photoURL: finalPhoto };
        await setDoc(userDocRef, updates, { merge: true });
        
        if (window.awsAuth.currentUser) {
          Object.assign(window.awsAuth.currentUser, updates);
        }
        
        const userSnap = await getDoc(userDocRef);
        const currentProfile = userSnap.data();
        if (currentProfile.teamId) {
          await window.awsStore.updateTeamMemberInfo(currentProfile.teamId, uid, nickname, finalPhoto);
        }
      },

      async uploadProfilePhoto(file) {
        if (!storage) throw new Error('storage-not-configured');
        if (!auth.currentUser) throw new Error('not-logged-in');
        const uid = auth.currentUser.uid;
        const storageRef = ref(storage, `profiles/${uid}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
      },
      
      // Real Firebase Invitations API
      async searchUsers(query) {
        if (!auth.currentUser) return [];
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users = [];
        usersSnapshot.forEach((docSnap) => {
          const u = docSnap.data();
          if (u.uid !== auth.currentUser.uid && u.nickname.toLowerCase().includes(query.toLowerCase())) {
            users.push(u);
          }
        });
        return users;
      },
      
      async sendInvitation(teamId, teamName, teamLogo, fromUid, toUid, toNickname) {
        const invId = `inv_${teamId}_${toUid}`;
        const newInv = {
          id: invId,
          teamId,
          teamName,
          teamLogo,
          fromUid,
          toUid,
          toNickname,
          status: 'pending',
          timestamp: Date.now()
        };
        await setDoc(doc(db, 'invitations', invId), newInv);
        return newInv;
      },
      
      async getPendingInvitations(uid) {
        const invitationsSnapshot = await getDocs(collection(db, 'invitations'));
        const invs = [];
        invitationsSnapshot.forEach((docSnap) => {
          const inv = docSnap.data();
          if (inv.toUid === uid && inv.status === 'pending') {
            invs.push(inv);
          }
        });
        return invs;
      },
      
      async respondToInvitation(invitationId, status) {
        const invRef = doc(db, 'invitations', invitationId);
        if (status === 'accepted' || status === 'declined') {
          // Possiamo semplicemente eliminare l'invito per pulizia, o fare l'update
          await deleteDoc(invRef);
        }
      }
    };

    setTimeout(() => window.dispatchEvent(new Event('aws-store-ready')), 0);
  } catch (error) {
    console.error("Firebase dynamic import failed, falling back to localStorage", error);
    window.awsStore = localStore;
    window.awsAuth = localAuth;
    setTimeout(() => window.dispatchEvent(new Event('aws-store-ready')), 0);
  }
}
