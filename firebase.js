import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
  import {
    getDatabase, ref, push, onValue, onDisconnect, set, get, serverTimestamp,
    runTransaction
  } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

  const firebaseConfig = {
    apiKey: "AIzaSyAOrJgxlbOUaezajJL5q_yRdazwKxf0XUM",
    authDomain: "helixinfo.firebaseapp.com",
    databaseURL: "https://helixinfo-default-rtdb.firebaseio.com",
    projectId: "helixinfo",
    storageBucket: "helixinfo.firebasestorage.app",
    messagingSenderId: "643923715533",
    appId: "1:643923715533:web:8259b583f8be8ce7441084"
  };

  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);

  const presenceListRef = ref(db, 'presence');
  const myPresenceRef = push(presenceListRef);
  const connectedRef = ref(db, '.info/connected');

  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      onDisconnect(myPresenceRef).remove();
      set(myPresenceRef, { at: serverTimestamp() });
    }
  });

  const onlineWrap = document.getElementById('onlineWrap');
  const onlineCountEl = document.getElementById('onlineCount');

  onValue(presenceListRef, (snap) => {
    const count = snap.exists() ? Object.keys(snap.val()).length : 0;
    onlineCountEl.textContent = count;
    onlineWrap.style.display = '';
  });

  const totalWrap = document.getElementById('totalWrap');
  const totalCountEl = document.getElementById('totalCount');
  const totalRef = ref(db, 'stats/totalVisits');

  if (!sessionStorage.getItem('ffinfo_counted')) {
    runTransaction(totalRef, (current) => (current || 0) + 1);
    sessionStorage.setItem('ffinfo_counted', '1');
  }

  onValue(totalRef, (snap) => {
    totalCountEl.textContent = snap.exists() ? snap.val() : 0;
    totalWrap.style.display = '';
  });

  // ── Remote popup / announcement ──
  // Controlled from a private admin page that writes to popup/current:
  // { imageUrl, caption, active, updatedAt }
  const popupRef = ref(db, 'popup/current');
  const popupOverlay = document.getElementById('popupOverlay');
  const popupImg = document.getElementById('popupImg');
  const popupCaption = document.getElementById('popupCaption');
  const popupX = document.getElementById('popupX');
  const popupCloseBtn = document.getElementById('popupCloseBtn');

  function closePopup(){
    popupOverlay.classList.remove('show');
  }
  popupX.addEventListener('click', closePopup);
  popupCloseBtn.addEventListener('click', closePopup);
  popupOverlay.addEventListener('click', (e) => { if(e.target === popupOverlay) closePopup(); });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closePopup(); });

  get(popupRef).then((snap) => {
    if(!snap.exists()) return;
    const d = snap.val();
    if(!d || !d.active || !d.imageUrl) return;

    popupImg.src = d.imageUrl;
    popupImg.alt = d.caption || 'Announcement';
    popupCaption.textContent = d.caption || '';
    popupCaption.style.display = d.caption ? '' : 'none';
    popupOverlay.classList.add('show');
  }).catch(() => { /* fail silently, don't block the page */ });
