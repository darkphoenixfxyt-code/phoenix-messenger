import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBYvXcMTmR35ztAvSm-7oWak_hia0G92fM",
  authDomain: "phoenix-messenger-c2f5f.firebaseapp.com",
  projectId: "phoenix-messenger-c2f5f",
  storageBucket: "phoenix-messenger-c2f5f.firebasestorage.app",
  messagingSenderId: "845033715931",
  appId: "1:845033715931:web:1818da261417468a2934fe",
  measurementId: "G-44XEWYVYJX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const COLORS = [
  { bg: 'rgba(108,99,255,0.15)', fg: '#6c63ff' },
  { bg: 'rgba(34,197,94,0.15)', fg: '#22c55e' },
  { bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b' },
  { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' },
  { bg: 'rgba(20,184,166,0.15)', fg: '#14b8a6' },
  { bg: 'rgba(168,85,247,0.15)', fg: '#a855f7' },
  { bg: 'rgba(59,130,246,0.15)', fg: '#3b82f6' }
];

let currentUser = null;
let currentProfile = null;
let username = '';
let convos = [];
let activeId = null;
let activeConvoUnsub = null;
let convosUnsub = null;
let presenceTimer = null;
let currentTab = 'all';

const $ = id => document.getElementById(id);

function setAuthError(message) {
  const el = $('authError');
  if (el) el.textContent = message || '';
}

function setSetupError(message) {
  const el = $('setupError');
  if (el) el.textContent = message || '';
}

function lockMessenger(locked) {
  $('appShell')?.classList.toggle('auth-locked', locked);
}

function showAuth(show) {
  $('authOverlay')?.classList.toggle('hidden', !show);
}

function showUsernameSetup(show) {
  $('usernameSetupOverlay')?.classList.toggle('open', show);
}

function cleanUsername(value) {
  return String(value || '').trim().replace(/\s+/g, '_').slice(0, 24);
}

function getInitials(name) {
  return String(name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getColor(name) {
  let h = 0;
  for (const c of String(name || 'Phoenix')) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[h % COLORS.length];
}

function escapeHtml(text) {
  return String(text || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function formatTime(value) {
  const date = value?.toDate ? value.toDate() : null;
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getProfileName(profile = currentProfile) {
  return profile?.username || profile?.displayName || currentUser?.displayName || currentUser?.email || 'User';
}

function updateCurrentUserUi() {
  const avatar = $('userAvatar');
  if (!avatar) return;
  const name = getProfileName();
  avatar.textContent = getInitials(name);
  avatar.title = name;
  const col = getColor(name);
  avatar.style.background = col.bg;
  avatar.style.color = col.fg;
  avatar.style.borderColor = col.fg;
  const sidebarTitle = document.querySelector('.sidebar-title');
  if (sidebarTitle) sidebarTitle.textContent = `Messages · ${name}`;
}

async function ensureUserProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const base = {
    uid: user.uid,
    displayName: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
    lastSeen: serverTimestamp()
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      ...base,
      username: '',
      usernameLower: '',
      createdAt: serverTimestamp()
    });
    return { ...base, username: '', usernameLower: '' };
  }

  await updateDoc(ref, base);
  return { ...snap.data(), ...base };
}

async function saveUsernameFromSetup() {
  if (!currentUser) return;
  const input = $('setupUsernameInput');
  const desired = cleanUsername(input?.value);
  if (!desired) {
    setSetupError('Choose a username.');
    return;
  }

  const lower = desired.toLowerCase();
  const existing = await getDocs(query(collection(db, 'users'), where('usernameLower', '==', lower), limit(1)));
  const taken = existing.docs.some(d => d.id !== currentUser.uid);
  if (taken) {
    setSetupError('That username is already taken.');
    return;
  }

  await updateDoc(doc(db, 'users', currentUser.uid), {
    username: desired,
    usernameLower: lower,
    lastSeen: serverTimestamp()
  });
  localStorage.setItem('phoenix_username', desired);
  currentProfile = { ...currentProfile, username: desired, usernameLower: lower };
  username = desired;
  setSetupError('');
  showUsernameSetup(false);
  openMessenger();
}

async function saveProfile() {
  if (!currentUser || !currentProfile) return;
  const desired = cleanUsername($('profileUsernameInput')?.value);
  const displayName = String($('profileDisplayNameInput')?.value || '').trim();
  const bio = String($('profileBioInput')?.value || '').trim();
  const status = $('profileStatusInput')?.value || 'online';

  if (!desired) return;
  const lower = desired.toLowerCase();
  if (lower !== currentProfile.usernameLower) {
    const existing = await getDocs(query(collection(db, 'users'), where('usernameLower', '==', lower), limit(1)));
    if (existing.docs.some(d => d.id !== currentUser.uid)) {
      alert('That username is already taken.');
      return;
    }
  }

  await updateDoc(doc(db, 'users', currentUser.uid), {
    username: desired,
    usernameLower: lower,
    displayName,
    bio,
    status,
    lastSeen: serverTimestamp()
  });

  currentProfile = { ...currentProfile, username: desired, usernameLower: lower, displayName, bio, status };
  username = desired;
  localStorage.setItem('phoenix_username', desired);
  updateCurrentUserUi();
  closeProfileModal();
}

function openMessenger() {
  showAuth(false);
  lockMessenger(false);
  updateCurrentUserUi();
  renderSidebar();
  startPresence();
  startConversationSync();
}

function clearMessenger() {
  convos = [];
  activeId = null;
  currentProfile = null;
  username = '';
  convosUnsub?.();
  activeConvoUnsub?.();
  convosUnsub = null;
  activeConvoUnsub = null;
  clearInterval(presenceTimer);
  presenceTimer = null;
  renderSidebar();
}

function startPresence() {
  if (!currentUser) return;
  const ref = doc(db, 'users', currentUser.uid);
  updateDoc(ref, { status: 'online', lastSeen: serverTimestamp() }).catch(console.error);
  clearInterval(presenceTimer);
  presenceTimer = setInterval(() => {
    updateDoc(ref, { lastSeen: serverTimestamp() }).catch(console.error);
  }, 30000);
}

async function handleGoogleLogin() {
  setAuthError('');
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    setAuthError(error.message);
  }
}

async function handleEmailLogin(createAccount = false) {
  setAuthError('');
  const email = $('authEmail')?.value.trim();
  const password = $('authPassword')?.value;
  if (!email || !password) {
    setAuthError('Enter email and password.');
    return;
  }

  try {
    if (createAccount) await createUserWithEmailAndPassword(auth, email, password);
    else await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    setAuthError(error.message);
  }
}

async function signOutUser() {
  if (currentUser) {
    updateDoc(doc(db, 'users', currentUser.uid), {
      status: 'offline',
      lastSeen: serverTimestamp()
    }).catch(console.error);
  }
  await signOut(auth);
}

function startConversationSync() {
  if (!currentUser) return;
  convosUnsub?.();
  const q = query(collection(db, 'conversations'), where('members', 'array-contains', currentUser.uid));
  convosUnsub = onSnapshot(q, snapshot => {
    convos = snapshot.docs.map(d => {
      const data = d.data();
      const memberNames = Array.isArray(data.memberNames) ? data.memberNames : [];
      const title = data.type === 'dm'
        ? memberNames.find(name => name !== getProfileName()) || data.name || 'Direct message'
        : data.name || 'Conversation';
      return {
        id: d.id,
        type: data.type || 'dm',
        name: title,
        members: data.members || [],
        memberNames,
        lastMessage: data.lastMessage || '',
        updatedAt: data.updatedAt,
        messages: []
      };
    }).sort((a, b) => {
      const ad = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
      const bd = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
      return bd - ad;
    });
    renderSidebar();
  }, error => {
    console.error('Conversation sync failed:', error);
    renderSidebar();
  });
}

function renderSidebar() {
  const list = $('convoList');
  const empty = $('sidebarEmpty');
  if (!list || !empty) return;
  list.innerHTML = '';

  const visible = convos.filter(c => currentTab === 'all' || (currentTab === 'dms' && c.type === 'dm') || (currentTab === 'rooms' && c.type === 'room'));
  if (visible.length === 0) {
    empty.style.display = 'flex';
    list.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  list.style.display = 'block';
  visible.forEach(c => {
    const col = getColor(c.name);
    const div = document.createElement('div');
    div.className = 'convo-item' + (c.id === activeId ? ' active' : '');
    div.onclick = () => openConvo(c.id);
    div.innerHTML = `
      <div class="c-avatar" style="background:${col.bg};color:${col.fg};">${getInitials(c.name)}</div>
      <div class="convo-info">
        <div class="convo-name">${escapeHtml(c.name)}</div>
        <div class="convo-preview">${escapeHtml(c.lastMessage || 'No messages yet')}</div>
      </div>`;
    list.appendChild(div);
  });
}

function openConvo(id) {
  activeId = id;
  const c = convos.find(x => x.id === id);
  if (!c) return;
  const col = getColor(c.name);
  $('chatHeader')?.classList.add('visible');
  const av = $('headerAvatar');
  if (av) {
    av.textContent = getInitials(c.name);
    av.style.background = col.bg;
    av.style.color = col.fg;
  }
  if ($('headerName')) $('headerName').textContent = c.name;
  if ($('headerStatus')) $('headerStatus').textContent = c.type === 'dm' ? 'Direct message' : 'Room';
  $('messages')?.classList.add('visible');
  $('inputArea')?.classList.add('visible');
  if ($('chatEmpty')) $('chatEmpty').style.display = 'none';
  if ($('inputBox')) {
    $('inputBox').setAttribute('data-placeholder', `Message ${c.name.split(' ')[0]}...`);
    $('inputBox').focus();
  }
  renderSidebar();
  listenToMessages(id);
}

function listenToMessages(convoId) {
  activeConvoUnsub?.();
  const q = query(collection(db, 'conversations', convoId, 'messages'), orderBy('createdAt', 'asc'), limit(200));
  activeConvoUnsub = onSnapshot(q, snapshot => {
    const c = convos.find(x => x.id === convoId);
    if (!c) return;
    c.messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderActiveConvoMessages();
  }, error => console.error('Message sync failed:', error));
}

function renderActiveConvoMessages() {
  const c = convos.find(x => x.id === activeId);
  const msgs = $('messages');
  if (!c || !msgs) return;
  msgs.innerHTML = '';
  c.messages.forEach(m => appendBubble(m, c, false));
  msgs.scrollTop = msgs.scrollHeight;
}

function appendBubble(message, convo, scroll = true) {
  const msgs = $('messages');
  if (!msgs) return;
  const mine = message.senderId === currentUser?.uid;
  const senderName = message.senderName || (mine ? getProfileName() : convo.name);
  const col = getColor(senderName);
  const row = document.createElement('div');
  row.className = 'msg-row' + (mine ? ' mine' : '');
  row.innerHTML = mine ? `
    <div class="msg-stack">
      <div class="bubble mine">${escapeHtml(message.deleted ? 'Message deleted' : message.text)}</div>
      <div class="msg-meta">${escapeHtml(senderName)} ${formatTime(message.createdAt)}</div>
    </div>` : `
    <div class="msg-avatar-sm" style="background:${col.bg};color:${col.fg};">${getInitials(senderName)}</div>
    <div class="msg-stack">
      <div class="bubble theirs">${escapeHtml(message.deleted ? 'Message deleted' : message.text)}</div>
      <div class="msg-meta">${escapeHtml(senderName)} ${formatTime(message.createdAt)}</div>
    </div>`;
  msgs.appendChild(row);
  if (scroll) msgs.scrollTop = msgs.scrollHeight;
}

async function findUserByUsername(value) {
  const wanted = cleanUsername(value).toLowerCase();
  const snap = await getDocs(query(collection(db, 'users'), where('usernameLower', '==', wanted), limit(1)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

function dmIdFor(uidA, uidB) {
  return `dm_${[uidA, uidB].sort().join('_')}`;
}

async function startChat() {
  const recipientInput = $('recipientInput');
  const firstMessageInput = $('firstMessageInput');
  if (!recipientInput || !firstMessageInput || !currentUser) return;
  const name = recipientInput.value.trim();
  const msg = firstMessageInput.value.trim();
  if (!name) {
    recipientInput.focus();
    return;
  }

  const other = await findUserByUsername(name);
  if (!other) {
    alert('No user found with that username.');
    return;
  }
  if (other.uid === currentUser.uid) {
    alert('You cannot start a DM with yourself.');
    return;
  }

  const id = dmIdFor(currentUser.uid, other.uid);
  const ref = doc(db, 'conversations', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      type: 'dm',
      members: [currentUser.uid, other.uid],
      memberNames: [getProfileName(), other.username || other.displayName || 'User'],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: ''
    });
  }

  if (!convos.some(c => c.id === id)) {
    convos.unshift({
      id,
      type: 'dm',
      name: other.username || other.displayName || 'User',
      members: [currentUser.uid, other.uid],
      memberNames: [getProfileName(), other.username || other.displayName || 'User'],
      lastMessage: '',
      updatedAt: null,
      messages: []
    });
    renderSidebar();
  }

  closeModal();
  openConvo(id);
  if (msg) {
    const box = $('inputBox');
    if (box) box.innerText = msg;
    await sendMessage();
  }
}

async function sendMessage() {
  if (!activeId || !currentUser) return;
  const box = $('inputBox');
  if (!box) return;
  const text = box.innerText.trim();
  if (!text) return;
  const c = convos.find(x => x.id === activeId);
  if (!c) return;

  box.innerText = '';
  await addDoc(collection(db, 'conversations', activeId, 'messages'), {
    text,
    senderId: currentUser.uid,
    senderName: getProfileName(),
    senderPhotoURL: currentProfile?.photoURL || currentUser.photoURL || '',
    createdAt: serverTimestamp(),
    editedAt: null,
    deleted: false
  });
  await updateDoc(doc(db, 'conversations', activeId), {
    updatedAt: serverTimestamp(),
    lastMessage: text
  });
}

function openModal() {
  $('modalOverlay')?.classList.add('open');
  setTimeout(() => $('recipientInput')?.focus(), 50);
}

function closeModal() {
  $('modalOverlay')?.classList.remove('open');
  if ($('recipientInput')) $('recipientInput').value = '';
  if ($('firstMessageInput')) $('firstMessageInput').value = '';
}

function closeModalOutside(e) {
  if (e.target === $('modalOverlay')) closeModal();
}

function openProfileModal() {
  if (!currentProfile) return;
  if ($('profileUsernameInput')) $('profileUsernameInput').value = currentProfile.username || '';
  if ($('profileDisplayNameInput')) $('profileDisplayNameInput').value = currentProfile.displayName || '';
  if ($('profileBioInput')) $('profileBioInput').value = currentProfile.bio || '';
  if ($('profileStatusInput')) $('profileStatusInput').value = currentProfile.status || 'online';
  $('profileModalOverlay')?.classList.add('open');
}

function closeProfileModal() {
  $('profileModalOverlay')?.classList.remove('open');
}

function closeProfileModalOutside(e) {
  if (e.target === $('profileModalOverlay')) closeProfileModal();
}

function openRoomModal() {
  $('roomModalOverlay')?.classList.add('open');
}

function closeRoomModal() {
  $('roomModalOverlay')?.classList.remove('open');
}

function closeRoomModalOutside(e) {
  if (e.target === $('roomModalOverlay')) closeRoomModal();
}

function createRoom() {
  alert('Rooms are not enabled in this Auth step yet.');
}

function setTab(el, type) {
  currentTab = type;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el?.classList.add('active');
  renderSidebar();
}

function filterConvos() {
  const q = ($('searchInput')?.value || '').toLowerCase();
  document.querySelectorAll('.convo-item').forEach(item => {
    const name = item.querySelector('.convo-name');
    item.style.display = name && name.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

onAuthStateChanged(auth, async user => {
  clearMessenger();
  currentUser = user;
  if (!user) {
    showUsernameSetup(false);
    showAuth(true);
    lockMessenger(true);
    return;
  }

  try {
    currentProfile = await ensureUserProfile(user);
    username = currentProfile.username || '';
    if (!username) {
      showAuth(false);
      lockMessenger(true);
      showUsernameSetup(true);
      return;
    }
    localStorage.setItem('phoenix_username', username);
    showUsernameSetup(false);
    openMessenger();
  } catch (error) {
    console.error(error);
    setAuthError(error.message);
    showAuth(true);
    lockMessenger(true);
  }
});

$('googleLoginBtn')?.addEventListener('click', handleGoogleLogin);
$('emailLoginBtn')?.addEventListener('click', () => handleEmailLogin(false));
$('emailSignupBtn')?.addEventListener('click', () => handleEmailLogin(true));
$('saveUsernameBtn')?.addEventListener('click', saveUsernameFromSetup);
$('setupUsernameInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveUsernameFromSetup();
});
$('inputBox')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

document.querySelectorAll('.rail-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

Object.assign(window, {
  closeModal,
  closeModalOutside,
  closeProfileModal,
  closeProfileModalOutside,
  closeRoomModal,
  closeRoomModalOutside,
  createRoom,
  filterConvos,
  openModal,
  openProfileModal,
  openRoomModal,
  saveProfile,
  sendMessage,
  setTab,
  signOutUser,
  startChat
});
