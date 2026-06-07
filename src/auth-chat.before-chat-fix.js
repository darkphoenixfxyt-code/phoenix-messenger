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
  deleteDoc,
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
  Timestamp,
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
let friendsUnsub = null;
let incomingRequestsUnsub = null;
let presenceTimer = null;
let currentTab = 'all';
let friends = [];
let incomingRequests = [];
let callsUnsub = null;
let activeCallUnsub = null;
let activeSignalsUnsub = null;
let activeCall = null;
let pendingIncomingCall = null;
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let callRole = null;
let callType = 'voice';
let seenSignalIds = new Set();
let pendingIceCandidates = [];
let ringtoneAudioContext = null;
let ringtoneTimer = null;
let ringtoneMode = '';
let remoteAudioLevelTimer = null;
let remoteAudioContext = null;

const $ = id => document.getElementById(id);
const turnUrl = import.meta.env.VITE_TURN_URL || '';
const turnUsername = import.meta.env.VITE_TURN_USERNAME || '';
const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL || '';
const forceTurnRelay = import.meta.env.VITE_FORCE_TURN === 'true';
const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

if (turnUrl && turnUsername && turnCredential) {
  iceServers.push({
    urls: turnUrl,
    username: turnUsername,
    credential: turnCredential
  });
}

const rtcConfig = {
  iceServers,
  iceTransportPolicy: forceTurnRelay ? 'relay' : 'all'
};

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
  startFriendsSync();
  listenForIncomingCalls();
}

function clearMessenger() {
  cleanupCall(false);
  convos = [];
  friends = [];
  incomingRequests = [];
  activeId = null;
  currentProfile = null;
  username = '';
  convosUnsub?.();
  friendsUnsub?.();
  incomingRequestsUnsub?.();
  activeConvoUnsub?.();
  callsUnsub?.();
  convosUnsub = null;
  friendsUnsub = null;
  incomingRequestsUnsub = null;
  activeConvoUnsub = null;
  callsUnsub = null;
  clearInterval(presenceTimer);
  presenceTimer = null;
  renderSidebar();
  renderFriendLists();
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

function friendIdFor(uidA, uidB) {
  return `friend_${[uidA, uidB].sort().join('_')}`;
}

function friendRequestIdFor(fromUid, toUid) {
  return `request_${fromUid}_${toUid}`;
}

function blockIdFor(blockedUid) {
  return `block_${currentUser?.uid}_${blockedUid}`;
}

function getUserCardHtml(user, meta = '') {
  const name = user.username || user.displayName || user.email || 'User';
  const col = getColor(name);
  return `
    <div class="c-avatar" style="background:${col.bg};color:${col.fg};">${getInitials(name)}</div>
    <div class="user-card-info">
      <div class="user-card-name">${escapeHtml(name)}</div>
      <div class="user-card-meta">${escapeHtml(meta || user.bio || user.email || 'Phoenix user')}</div>
    </div>`;
}

async function startDmWithUser(other, firstMessage = '') {
  if (!currentUser || !other?.uid) return;
  if (other.uid === currentUser.uid) {
    alert('You cannot start a DM with yourself.');
    return;
  }

  const id = dmIdFor(currentUser.uid, other.uid);
  const otherName = other.username || other.displayName || other.email || 'User';
  const ref = doc(db, 'conversations', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      type: 'dm',
      members: [currentUser.uid, other.uid],
      memberNames: [getProfileName(), otherName],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: ''
    });
  }

  if (!convos.some(c => c.id === id)) {
    convos.unshift({
      id,
      type: 'dm',
      name: otherName,
      members: [currentUser.uid, other.uid],
      memberNames: [getProfileName(), otherName],
      lastMessage: '',
      updatedAt: null,
      messages: []
    });
    renderSidebar();
  }

  closeModal();
  closeFriendModal();
  openConvo(id);
  if (firstMessage) {
    const box = $('inputBox');
    if (box) box.innerText = firstMessage;
    await sendMessage();
  }
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

  await startDmWithUser(other, msg);
}

function openFriendModal() {
  $('friendModalOverlay')?.classList.add('open');
  renderFriendLists();
  setTimeout(() => $('userSearchInput')?.focus(), 50);
}

function closeFriendModal() {
  $('friendModalOverlay')?.classList.remove('open');
}

function closeFriendModalOutside(e) {
  if (e.target === $('friendModalOverlay')) closeFriendModal();
}

function renderSearchEmpty(message) {
  const results = $('userSearchResults');
  if (results) results.innerHTML = `<div class="friend-empty">${escapeHtml(message)}</div>`;
}

async function searchUsers() {
  const input = $('userSearchInput');
  const term = input?.value.trim();
  if (!term) {
    renderSearchEmpty('Enter a username.');
    input?.focus();
    return;
  }

  renderSearchEmpty('Searching...');
  const user = await findUserByUsername(term);
  if (!user) {
    renderSearchEmpty('No user found.');
    return;
  }
  renderUserSearchResult(user);
}

function renderUserSearchResult(user) {
  const results = $('userSearchResults');
  if (!results) return;
  const self = user.uid === currentUser?.uid;
  const alreadyFriend = friends.some(friend => (friend.users || []).includes(user.uid));
  results.innerHTML = `
    <div class="user-card">
      ${getUserCardHtml(user, self ? 'This is you' : alreadyFriend ? 'Friend' : 'Phoenix user')}
      <div class="user-card-actions">
        <button class="btn-mini primary" onclick="startDmFromSearch('${escapeHtml(user.uid)}')">Message</button>
        <button class="btn-mini" onclick="sendFriendRequest('${escapeHtml(user.uid)}')" ${self || alreadyFriend ? 'disabled' : ''}>Add</button>
        <button class="btn-mini danger" onclick="blockUser('${escapeHtml(user.uid)}')" ${self ? 'disabled' : ''}>Block</button>
      </div>
    </div>`;
}

function renderFriendLists() {
  const requestsEl = $('incomingRequestsList');
  if (requestsEl) {
    requestsEl.innerHTML = incomingRequests.length ? incomingRequests.map(req => `
      <div class="user-card">
        ${getUserCardHtml({ username: req.fromUsername, uid: req.fromUid }, 'Wants to add you')}
        <div class="user-card-actions">
          <button class="btn-mini primary" onclick="acceptFriendRequest('${escapeHtml(req.id)}')">Accept</button>
          <button class="btn-mini" onclick="declineFriendRequest('${escapeHtml(req.id)}')">Decline</button>
        </div>
      </div>`).join('') : '<div class="friend-empty">No pending requests.</div>';
  }

  const friendsEl = $('friendsList');
  if (friendsEl) {
    friendsEl.innerHTML = friends.length ? friends.map(friend => {
      const idx = (friend.users || []).findIndex(uid => uid !== currentUser?.uid);
      const otherUid = (friend.users || [])[idx] || '';
      const otherName = (friend.usernames || [])[idx] || 'Friend';
      return `
        <div class="user-card">
          ${getUserCardHtml({ username: otherName, uid: otherUid }, 'Friend')}
          <div class="user-card-actions">
            <button class="btn-mini primary" onclick="startDmFromFriend('${escapeHtml(friend.id)}')">Message</button>
            <button class="btn-mini danger" onclick="removeFriend('${escapeHtml(friend.id)}')">Remove</button>
          </div>
        </div>`;
    }).join('') : '<div class="friend-empty">No friends yet.</div>';
  }
}

function startFriendsSync() {
  if (!currentUser) return;
  incomingRequestsUnsub?.();
  friendsUnsub?.();

  const requestsQ = query(
    collection(db, 'friendRequests'),
    where('toUid', '==', currentUser.uid)
  );
  incomingRequestsUnsub = onSnapshot(requestsQ, snapshot => {
    incomingRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(request => request.status === 'pending');
    renderFriendLists();
  }, error => console.error('Friend request sync failed:', error));

  const friendsQ = query(collection(db, 'friends'), where('users', 'array-contains', currentUser.uid));
  friendsUnsub = onSnapshot(friendsQ, snapshot => {
    friends = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFriendLists();
  }, error => console.error('Friends sync failed:', error));
}

async function sendFriendRequest(uid) {
  if (!currentUser || !uid || uid === currentUser.uid) return;
  const userSnap = await getDoc(doc(db, 'users', uid));
  const user = userSnap.exists() ? userSnap.data() : {};
  const friendRef = doc(db, 'friends', friendIdFor(currentUser.uid, uid));
  if ((await getDoc(friendRef)).exists()) {
    alert('You are already friends.');
    return;
  }

  await setDoc(doc(db, 'friendRequests', friendRequestIdFor(currentUser.uid, uid)), {
    fromUid: currentUser.uid,
    fromUsername: getProfileName(),
    toUid: uid,
    toUsername: user.username || user.displayName || '',
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  alert('Friend request sent.');
}

async function acceptFriendRequest(requestId) {
  if (!currentUser || !requestId) return;
  const reqRef = doc(db, 'friendRequests', requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return;
  const req = reqSnap.data();
  if (req.toUid !== currentUser.uid) return;

  await setDoc(doc(db, 'friends', friendIdFor(req.fromUid, req.toUid)), {
    users: [req.fromUid, req.toUid],
    usernames: [req.fromUsername || 'Friend', getProfileName()],
    createdAt: serverTimestamp()
  });
  await updateDoc(reqRef, {
    status: 'accepted',
    updatedAt: serverTimestamp()
  });
}

async function declineFriendRequest(requestId) {
  if (!requestId) return;
  await updateDoc(doc(db, 'friendRequests', requestId), {
    status: 'declined',
    updatedAt: serverTimestamp()
  });
}

async function removeFriend(friendId) {
  if (!friendId) return;
  await deleteDoc(doc(db, 'friends', friendId));
  renderFriendLists();
}

async function blockUser(uid) {
  if (!currentUser || !uid || uid === currentUser.uid) return;
  const userSnap = await getDoc(doc(db, 'users', uid));
  const user = userSnap.exists() ? userSnap.data() : {};
  await setDoc(doc(db, 'blocks', blockIdFor(uid)), {
    blockerUid: currentUser.uid,
    blockerUsername: getProfileName(),
    blockedUid: uid,
    blockedUsername: user.username || user.displayName || '',
    createdAt: serverTimestamp()
  });
  alert('User blocked.');
}

async function startDmFromSearch(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return;
  await startDmWithUser({ id: snap.id, ...snap.data() });
}

async function startDmFromFriend(friendId) {
  const friend = friends.find(item => item.id === friendId);
  if (!friend) return;
  const otherUid = (friend.users || []).find(uid => uid !== currentUser?.uid);
  if (!otherUid) return;
  const snap = await getDoc(doc(db, 'users', otherUid));
  if (snap.exists()) await startDmWithUser({ id: snap.id, ...snap.data() });
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

function getActiveDmPeer() {
  const convo = convos.find(c => c.id === activeId);
  if (!convo || convo.type !== 'dm' || !currentUser) return null;
  const receiverId = (convo.members || []).find(uid => uid !== currentUser.uid);
  const receiverName = (convo.memberNames || []).find(name => name !== getProfileName()) || convo.name;
  return receiverId ? { convo, receiverId, receiverName } : null;
}

function getCallPeerName() {
  if (activeCall) {
    return activeCall.callerId === currentUser?.uid
      ? activeCall.receiverName
      : activeCall.callerName;
  }
  const peer = getActiveDmPeer();
  return peer?.receiverName || $('headerName')?.textContent || 'Call';
}

function setCallUi(status = '', mode = callType) {
  const visible = Boolean(status);
  $('callBar')?.classList.toggle('visible', visible);
  if ($('callStatusText')) $('callStatusText').textContent = status;
  if ($('callModeText')) $('callModeText').textContent = mode === 'video' ? 'Video' : 'Voice';
  if ($('callTitle')) $('callTitle').textContent = getCallPeerName();
  const callAvatar = $('callAvatar');
  if (callAvatar) {
    const name = getCallPeerName();
    const col = getColor(name);
    callAvatar.textContent = getInitials(name);
    callAvatar.style.background = col.bg;
    callAvatar.style.color = col.fg;
  }
  const inCall = ['Calling...', 'Ringing...', 'Connected', 'Starting call...'].includes(status)
    || status.startsWith('Connected')
    || status.startsWith('Remote audio')
    || status.startsWith('Tap here');
  if ($('endCallBtn')) $('endCallBtn').style.display = inCall ? '' : 'none';
  if ($('muteCallBtn')) $('muteCallBtn').style.display = inCall ? '' : 'none';
  if ($('cameraCallBtn')) $('cameraCallBtn').style.display = mode === 'video' && inCall ? '' : 'none';
  if ($('callBarMuteBtn')) $('callBarMuteBtn').style.display = inCall ? '' : 'none';
  if ($('callBarEndBtn')) $('callBarEndBtn').style.display = inCall ? '' : 'none';
  if ($('callBarCameraBtn')) $('callBarCameraBtn').style.display = mode === 'video' && inCall ? '' : 'none';
}

function playTone(frequency, startDelay, duration, volume = 0.08) {
  if (!ringtoneAudioContext) return;
  const osc = ringtoneAudioContext.createOscillator();
  const gain = ringtoneAudioContext.createGain();
  const startAt = ringtoneAudioContext.currentTime + startDelay;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ringtoneAudioContext.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.04);
}

function playRingPattern(mode) {
  if (!ringtoneAudioContext) return;
  if (mode === 'incoming') {
    playTone(880, 0, 0.28, 0.11);
    playTone(660, 0.34, 0.28, 0.1);
  } else {
    playTone(440, 0, 0.16, 0.055);
    playTone(440, 0.55, 0.16, 0.045);
  }
}

function startRingtone(mode) {
  if (ringtoneMode === mode && ringtoneTimer) return;
  stopRingtone();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  ringtoneAudioContext = ringtoneAudioContext || new AudioContext();
  ringtoneAudioContext.resume?.();
  ringtoneMode = mode;
  playRingPattern(mode);
  ringtoneTimer = setInterval(() => playRingPattern(mode), mode === 'incoming' ? 1400 : 1800);
}

function stopRingtone() {
  clearInterval(ringtoneTimer);
  ringtoneTimer = null;
  ringtoneMode = '';
}

async function playRemoteAudio() {
  const audio = $('remoteAudio');
  if (!audio || !audio.srcObject) return;
  remoteAudioContext?.resume?.();
  audio.muted = false;
  audio.volume = 1;
  audio.autoplay = true;
  audio.playsInline = true;
  try {
    await audio.play();
    if (activeCall?.status === 'accepted' && !remoteAudioLevelTimer) setCallUi('Connected', callType);
  } catch (error) {
    console.warn('Remote audio playback blocked:', error);
    if (activeCall?.status === 'accepted') setCallUi('Tap here to enable audio', callType);
  }
}

function startRemoteAudioMeter(stream) {
  clearInterval(remoteAudioLevelTimer);
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext || !stream?.getAudioTracks().length) return;
  remoteAudioContext = remoteAudioContext || new AudioContext();
  remoteAudioContext.resume?.();
  const source = remoteAudioContext.createMediaStreamSource(stream);
  const analyser = remoteAudioContext.createAnalyser();
  const samples = new Uint8Array(analyser.fftSize);
  source.connect(analyser);
  remoteAudioLevelTimer = setInterval(() => {
    analyser.getByteTimeDomainData(samples);
    let total = 0;
    for (const sample of samples) total += Math.abs(sample - 128);
    const level = total / samples.length;
    if (activeCall?.status === 'accepted') {
      setCallUi(level > 1.5 ? 'Connected - audio receiving' : 'Connected - no audio detected', callType);
    }
  }, 1200);
}

function flashCallStatus(message, mode = 'Voice') {
  setCallUi(message, mode.toLowerCase());
  setTimeout(() => {
    if (!activeCall && !pendingIncomingCall) setCallUi('');
  }, 2200);
}

function setIncomingPopup(call = null) {
  pendingIncomingCall = call;
  $('incomingCallPopup')?.classList.toggle('visible', Boolean(call));
  if (!call) {
    if (ringtoneMode === 'incoming') stopRingtone();
    return;
  }
  if ($('incomingCallTitle')) $('incomingCallTitle').textContent = `${call.callerName || 'Someone'} is calling...`;
  if ($('incomingCallSubtitle')) $('incomingCallSubtitle').textContent = call.type === 'video' ? 'Video call' : 'Voice call';
  startRingtone('incoming');
}

async function getLocalMedia(type) {
  if (localStream) return localStream;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('microphone access needs HTTPS or localhost');
  }
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === 'video'
  });
  localStream.getAudioTracks().forEach(track => {
    track.enabled = true;
  });
  return localStream;
}

function createPeerConnection(callId) {
  const pc = new RTCPeerConnection(rtcConfig);
  remoteStream = new MediaStream();
  pc.onicecandidate = event => {
    if (!event.candidate || !currentUser) return;
    addDoc(collection(db, 'calls', callId, 'signals'), {
      type: 'ice-candidate',
      data: serializeIceCandidate(event.candidate),
      senderId: currentUser.uid,
      createdAt: serverTimestamp()
    }).catch(console.error);
  };
  pc.ontrack = event => {
    const audio = $('remoteAudio');
    if (!audio) return;
    if (event.track.kind === 'audio') {
      event.track.enabled = true;
      if (!remoteStream.getTracks().some(track => track.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
      audio.srcObject = remoteStream;
      setCallUi('Remote audio track received', callType);
      startRemoteAudioMeter(remoteStream);
      event.track.onunmute = () => {
        setCallUi('Connected - audio ready', callType);
        playRemoteAudio();
      };
    }
    playRemoteAudio();
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      if (!remoteAudioLevelTimer) setCallUi('Connected', callType);
      playRemoteAudio();
    }
    if (['failed', 'disconnected'].includes(pc.connectionState)) {
      setCallUi(`Call ${pc.connectionState}`, callType);
    }
  };
  return pc;
}

function serializeSessionDescription(description) {
  return {
    type: description.type,
    sdp: description.sdp
  };
}

function serializeIceCandidate(candidate) {
  return typeof candidate.toJSON === 'function'
    ? candidate.toJSON()
    : {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      usernameFragment: candidate.usernameFragment
    };
}

async function preparePeer(callId, type, stream = null) {
  peerConnection = createPeerConnection(callId);
  const mediaStream = stream || await getLocalMedia(type);
  mediaStream.getTracks().forEach(track => peerConnection.addTrack(track, mediaStream));
}

async function addSignal(callId, type, data) {
  if (!currentUser) return;
  await addDoc(collection(db, 'calls', callId, 'signals'), {
    type,
    data,
    senderId: currentUser.uid,
    createdAt: serverTimestamp()
  });
}

function listenToCall(callId) {
  activeCallUnsub?.();
  activeCallUnsub = onSnapshot(doc(db, 'calls', callId), snap => {
    if (!snap.exists()) {
      cleanupCall(false);
      return;
    }
    const data = { id: snap.id, ...snap.data() };
    activeCall = data;
    if (data.status === 'ringing') setCallUi(callRole === 'caller' ? 'Calling...' : 'Ringing...', data.type);
    if (data.status === 'accepted') {
      stopRingtone();
      setCallUi('Connected', data.type);
    }
    if (['declined', 'ended'].includes(data.status)) {
      stopRingtone();
      cleanupCall(false);
    }
  }, console.error);
}

function listenToSignals(callId) {
  activeSignalsUnsub?.();
  seenSignalIds = new Set();
  const q = query(collection(db, 'calls', callId, 'signals'), orderBy('createdAt', 'asc'));
  activeSignalsUnsub = onSnapshot(q, async snapshot => {
    for (const change of snapshot.docChanges()) {
      if (change.type !== 'added' || seenSignalIds.has(change.doc.id)) continue;
      seenSignalIds.add(change.doc.id);
      const signal = change.doc.data();
      if (!peerConnection || signal.senderId === currentUser?.uid) continue;
      try {
        if (signal.type === 'answer' && callRole === 'caller') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data));
          for (const candidate of pendingIceCandidates) await peerConnection.addIceCandidate(candidate);
          pendingIceCandidates = [];
        }
        if (signal.type === 'ice-candidate') {
          const candidate = new RTCIceCandidate(signal.data);
          if (peerConnection.remoteDescription) await peerConnection.addIceCandidate(candidate);
          else pendingIceCandidates.push(candidate);
        }
      } catch (error) {
        console.error('Signal handling failed:', error);
      }
    }
  }, console.error);
}

async function startCall(type = 'voice') {
  if (!currentUser) {
    flashCallStatus('Log in before calling', type);
    return;
  }
  if (activeCall) {
    flashCallStatus('Call already active', type);
    return;
  }
  const peer = getActiveDmPeer();
  if (!peer) {
    flashCallStatus('Open a direct message first', type);
    return;
  }

  callType = type;
  callRole = 'caller';
  setCallUi('Starting call...', type);

  let stream;
  try {
    stream = await getLocalMedia(type);
  } catch (error) {
    console.error(error);
    cleanupCall(false);
    flashCallStatus(`Mic blocked: ${error.message || error.name || 'permission denied'}`, type);
    return;
  }

  const callRef = doc(collection(db, 'calls'));
  activeCall = {
    id: callRef.id,
    callerId: currentUser.uid,
    callerName: getProfileName(),
    receiverId: peer.receiverId,
    receiverName: peer.receiverName,
    type,
    status: 'ringing'
  };

  try {
    await setDoc(callRef, {
      callerId: currentUser.uid,
      callerName: getProfileName(),
      receiverId: peer.receiverId,
      receiverName: peer.receiverName,
      type,
      status: 'preparing',
      createdAt: serverTimestamp(),
      endedAt: null
    });
    listenToCall(callRef.id);
    listenToSignals(callRef.id);
    await preparePeer(callRef.id, type, stream);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await addSignal(callRef.id, 'offer', serializeSessionDescription(offer));
    await updateDoc(callRef, {
      status: 'ringing',
      updatedAt: serverTimestamp()
    });
    setCallUi('Calling...', type);
    startRingtone('outgoing');
    setTimeout(() => {
      if (activeCall?.id === callRef.id && activeCall.status === 'ringing') endCurrentCall();
    }, 30000);
  } catch (error) {
    console.error(error);
    cleanupCall(false);
    flashCallStatus(`Call failed: ${error.code || error.message || 'permissions/rules'}`, type);
  }
}

function startVoiceCall() {
  startCall('voice');
}

function startVideoCall() {
  startCall('video');
}

function listenForIncomingCalls() {
  if (!currentUser) return;
  callsUnsub?.();
  const q = query(collection(db, 'calls'), where('receiverId', '==', currentUser.uid), where('status', '==', 'ringing'));
  callsUnsub = onSnapshot(q, snapshot => {
    if (activeCall || pendingIncomingCall) return;
    const first = snapshot.docs[0];
    if (first) setIncomingPopup({ id: first.id, ...first.data() });
  }, error => {
    console.error('Incoming call listener failed:', error);
  });
}

async function acceptIncomingCall() {
  if (!pendingIncomingCall || !currentUser) return;
  ringtoneAudioContext?.resume?.();
  const call = pendingIncomingCall;
  setIncomingPopup(null);
  stopRingtone();
  callRole = 'receiver';
  callType = call.type || 'voice';
  activeCall = call;

  try {
    await preparePeer(call.id, callType);
    listenToCall(call.id);
    listenToSignals(call.id);
    const signalSnap = await getDocs(query(collection(db, 'calls', call.id, 'signals'), where('type', '==', 'offer'), limit(1)));
    if (signalSnap.empty) throw new Error('Missing call offer.');
    const offer = signalSnap.docs[0].data().data;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    for (const candidate of pendingIceCandidates) await peerConnection.addIceCandidate(candidate);
    pendingIceCandidates = [];
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await updateDoc(doc(db, 'calls', call.id), { status: 'accepted' });
    await addSignal(call.id, 'answer', serializeSessionDescription(answer));
    setCallUi('Connected', callType);
  } catch (error) {
    console.error(error);
    alert(`Could not accept call: ${error.message || 'check microphone permissions and Firestore rules.'}`);
    endCurrentCall();
  }
}

async function declineIncomingCall() {
  if (!pendingIncomingCall) return;
  ringtoneAudioContext?.resume?.();
  await updateDoc(doc(db, 'calls', pendingIncomingCall.id), {
    status: 'declined',
    endedAt: serverTimestamp()
  }).catch(console.error);
  stopRingtone();
  setIncomingPopup(null);
}

function toggleMute() {
  const audioTrack = localStream?.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;
  if ($('muteCallBtn')) $('muteCallBtn').style.opacity = audioTrack.enabled ? '1' : '0.45';
  if ($('callBarMuteBtn')) $('callBarMuteBtn').style.opacity = audioTrack.enabled ? '1' : '0.45';
}

function toggleCamera() {
  const videoTrack = localStream?.getVideoTracks()[0];
  if (!videoTrack) return;
  videoTrack.enabled = !videoTrack.enabled;
  if ($('cameraCallBtn')) $('cameraCallBtn').style.opacity = videoTrack.enabled ? '1' : '0.45';
  if ($('callBarCameraBtn')) $('callBarCameraBtn').style.opacity = videoTrack.enabled ? '1' : '0.45';
}

async function endCurrentCall() {
  const callId = activeCall?.id || pendingIncomingCall?.id;
  if (callId) {
    await updateDoc(doc(db, 'calls', callId), {
      status: 'ended',
      endedAt: serverTimestamp()
    }).catch(console.error);
  }
  cleanupCall(false);
}

function cleanupCall(showEnded = false) {
  stopRingtone();
  activeCallUnsub?.();
  activeSignalsUnsub?.();
  activeCallUnsub = null;
  activeSignalsUnsub = null;
  peerConnection?.close();
  peerConnection = null;
  localStream?.getTracks().forEach(track => track.stop());
  localStream = null;
  remoteStream?.getTracks().forEach(track => track.stop());
  remoteStream = null;
  clearInterval(remoteAudioLevelTimer);
  remoteAudioLevelTimer = null;
  remoteAudioContext?.close?.();
  remoteAudioContext = null;
  const audio = $('remoteAudio');
  if (audio) audio.srcObject = null;
  activeCall = null;
  pendingIncomingCall = null;
  callRole = null;
  seenSignalIds = new Set();
  pendingIceCandidates = [];
  setIncomingPopup(null);
  if (showEnded) {
    setTimeout(() => setCallUi(''), 1800);
  } else {
    setCallUi('');
  }
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
$('userSearchInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') searchUsers();
});
$('inputBox')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
$('voiceCallBtn')?.addEventListener('click', event => {
  event.preventDefault();
  startVoiceCall();
});
$('videoCallBtn')?.addEventListener('click', event => {
  event.preventDefault();
  startVideoCall();
});
$('endCallBtn')?.addEventListener('click', event => {
  event.preventDefault();
  endCurrentCall();
});
$('muteCallBtn')?.addEventListener('click', event => {
  event.preventDefault();
  toggleMute();
});
$('cameraCallBtn')?.addEventListener('click', event => {
  event.preventDefault();
  toggleCamera();
});
$('callBarMuteBtn')?.addEventListener('click', event => {
  event.preventDefault();
  toggleMute();
});
$('callBarCameraBtn')?.addEventListener('click', event => {
  event.preventDefault();
  toggleCamera();
});
$('callBarEndBtn')?.addEventListener('click', event => {
  event.preventDefault();
  endCurrentCall();
});
$('callBar')?.addEventListener('click', event => {
  event.preventDefault();
  playRemoteAudio();
});

document.querySelectorAll('.rail-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

window.addEventListener('beforeunload', () => {
  if (activeCall?.id) {
    updateDoc(doc(db, 'calls', activeCall.id), {
      status: 'ended',
      endedAt: Timestamp.now()
    }).catch(() => {});
  }
});

Object.assign(window, {
  acceptIncomingCall,
  acceptFriendRequest,
  blockUser,
  closeModal,
  closeFriendModal,
  closeFriendModalOutside,
  closeModalOutside,
  closeProfileModal,
  closeProfileModalOutside,
  closeRoomModal,
  closeRoomModalOutside,
  createRoom,
  declineFriendRequest,
  declineIncomingCall,
  endCurrentCall,
  filterConvos,
  openModal,
  openFriendModal,
  openProfileModal,
  openRoomModal,
  removeFriend,
  saveProfile,
  searchUsers,
  sendMessage,
  sendFriendRequest,
  setTab,
  signOutUser,
  startChat,
  startDmFromFriend,
  startDmFromSearch,
  startVideoCall,
  startVoiceCall,
  toggleCamera,
  toggleMute
});
