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
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
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
import { uploadImage } from './cloudinary.js';

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
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MOD_ACCESS_CODE = '440255';

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
let typingUnsub = null;
let convosUnsub = null;
let roomsUnsub = null;
let serversUnsub = null;
let channelsUnsub = null;
let serverMembersUnsub = null;
let friendsUnsub = null;
let incomingRequestsUnsub = null;
let outgoingRequestsUnsub = null;
let presenceTimer = null;
let currentTab = 'all';
let activeMode = 'home';
let servers = [];
let channels = [];
let serverMembers = [];
let activeServerId = null;
let activeChannelId = null;
let activeChannel = null;
let pendingInviteCode = '';
let unreadChannelCounts = {};
let seenChannelUpdates = {};
let unreadCounts = {};
let seenConvoUpdates = {};
let replyDraft = null;
let typingTimer = null;
let lastTypingWrite = 0;
let friends = [];
let incomingRequests = [];
let outgoingRequests = [];
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

function getUserUid(user) {
  return user?.uid || user?.id || '';
}

function updateCurrentUserUi() {
  const avatar = $('userAvatar');
  if (!avatar) return;
  const name = getProfileName();
  const photo = currentProfile?.avatarURL || currentProfile?.photoURL || currentUser?.photoURL || '';
  avatar.textContent = photo ? '' : getInitials(name);
  avatar.title = name;
  const col = getColor(name);
  avatar.style.background = photo ? `center / cover url("${photo}")` : col.bg;
  avatar.style.color = col.fg;
  avatar.style.borderColor = col.fg;
  const sidebarTitle = document.querySelector('.sidebar-title');
  if (sidebarTitle && activeMode === 'home') sidebarTitle.textContent = `Messages · ${name}`;
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
  const avatarURL = String($('profileAvatarUrlInput')?.value || '').trim();
  const bannerURL = String($('profileBannerUrlInput')?.value || '').trim();
  const pronouns = String($('profilePronounsInput')?.value || '').trim();
  const location = String($('profileLocationInput')?.value || '').trim();
  const website = String($('profileWebsiteInput')?.value || '').trim();

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
    avatarURL,
    bannerURL,
    pronouns,
    location,
    website,
    status,
    lastSeen: serverTimestamp()
  });

  currentProfile = { ...currentProfile, username: desired, usernameLower: lower, displayName, bio, avatarURL, bannerURL, pronouns, location, website, status };
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
  ensureDefaultRooms();
  startConversationSync();
  startRoomSync();
  startServerSync();
  startFriendsSync();
  listenForIncomingCalls();
  handleInviteFromUrl();
}

function clearMessenger() {
  cleanupCall(false);
  convos = [];
  friends = [];
  incomingRequests = [];
  outgoingRequests = [];
  servers = [];
  channels = [];
  serverMembers = [];
  unreadCounts = {};
  unreadChannelCounts = {};
  seenConvoUpdates = {};
  seenChannelUpdates = {};
  replyDraft = null;
  activeId = null;
  activeMode = 'home';
  activeServerId = null;
  activeChannelId = null;
  activeChannel = null;
  currentProfile = null;
  username = '';
  convosUnsub?.();
  roomsUnsub?.();
  serversUnsub?.();
  channelsUnsub?.();
  serverMembersUnsub?.();
  friendsUnsub?.();
  incomingRequestsUnsub?.();
  outgoingRequestsUnsub?.();
  activeConvoUnsub?.();
  typingUnsub?.();
  callsUnsub?.();
  convosUnsub = null;
  roomsUnsub = null;
  serversUnsub = null;
  channelsUnsub = null;
  serverMembersUnsub = null;
  friendsUnsub = null;
  incomingRequestsUnsub = null;
  outgoingRequestsUnsub = null;
  activeConvoUnsub = null;
  typingUnsub = null;
  callsUnsub = null;
  clearInterval(presenceTimer);
  presenceTimer = null;
  renderSidebar();
  renderServerRail();
  renderMemberPanel();
  renderFriendLists();
  renderReplyDraft();
  renderTypingIndicator([]);
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
    const memberConvos = snapshot.docs.map(d => {
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
        public: Boolean(data.public),
        messages: []
      };
    });
    updateUnreadFromConvos(memberConvos);
    upsertConvos(memberConvos);
    renderSidebar();
  }, error => {
    console.error('Conversation sync failed:', error);
    renderSidebar();
  });
}

function getUpdateMillis(value) {
  return value?.toMillis ? value.toMillis() : 0;
}

function updateUnreadFromConvos(items) {
  items.forEach(item => {
    const next = getUpdateMillis(item.updatedAt);
    const prev = seenConvoUpdates[item.id] || 0;
    if (prev && next > prev && item.id !== activeId && item.lastMessage) {
      unreadCounts[item.id] = (unreadCounts[item.id] || 0) + 1;
    }
    if (next) seenConvoUpdates[item.id] = next;
  });
}

async function ensureDefaultRooms() {
  if (!currentUser) return;
  const defaults = [
    ['room_general', 'General', 'Main Phoenix Messenger room'],
    ['room_gaming', 'Gaming', 'Games, parties, and voice sessions'],
    ['room_dev', 'Dev', 'Code, projects, and builds'],
    ['room_music', 'Music', 'Tracks, playlists, and artists']
  ];
  await Promise.all(defaults.map(([id, name, description]) => setDoc(doc(db, 'conversations', id), {
    type: 'room',
    public: true,
    name,
    description,
    members: [],
    memberNames: [],
    createdBy: currentUser.uid,
    createdByName: getProfileName(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: description
  }, { merge: true }).catch(console.error)));
}

function upsertConvos(items) {
  const byId = new Map(convos.map(c => [c.id, c]));
  items.forEach(item => byId.set(item.id, { ...byId.get(item.id), ...item }));
  convos = Array.from(byId.values()).sort((a, b) => {
    const ad = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
    const bd = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
    return bd - ad;
  });
}

function startRoomSync() {
  if (!currentUser) return;
  roomsUnsub?.();
  const q = query(collection(db, 'conversations'), where('type', '==', 'room'), where('public', '==', true));
  roomsUnsub = onSnapshot(q, snapshot => {
    const rooms = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        type: 'room',
        name: data.name || 'Room',
        description: data.description || '',
        members: data.members || [],
        memberNames: data.memberNames || [],
        lastMessage: data.lastMessage || data.description || '',
        updatedAt: data.updatedAt,
        public: true,
        messages: []
      };
    });
    upsertConvos(rooms);
    renderSidebar();
  }, error => console.error('Room sync failed:', error));
}

function getActiveServer() {
  return servers.find(server => server.id === activeServerId) || null;
}

function getMyServerMember(serverId = activeServerId) {
  return serverMembers.find(member => member.uid === currentUser?.uid && member.serverId === serverId) || null;
}

function hasServerPermission(permission, serverId = activeServerId) {
  const role = getMyServerMember(serverId)?.role || 'member';
  const permissions = {
    owner: ['all', 'create_channels', 'delete_messages', 'invite_users', 'send_messages', 'react', 'join_voice'],
    admin: ['create_channels', 'delete_messages', 'invite_users', 'send_messages', 'react', 'join_voice'],
    mod: ['delete_messages', 'invite_users', 'send_messages', 'react', 'join_voice'],
    member: ['send_messages', 'react', 'join_voice']
  };
  return permissions[role]?.includes('all') || permissions[role]?.includes(permission);
}

function startServerSync() {
  if (!currentUser) return;
  serversUnsub?.();
  const q = query(collection(db, 'servers'), where('memberIds', 'array-contains', currentUser.uid));
  serversUnsub = onSnapshot(q, snapshot => {
    servers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => getUpdateMillis(b.updatedAt || b.createdAt) - getUpdateMillis(a.updatedAt || a.createdAt));
    renderServerRail();
    if (activeMode === 'server' && activeServerId && !servers.some(server => server.id === activeServerId)) openHome();
  }, error => console.error('Server sync failed:', error));
}

function renderServerRail() {
  const list = $('serverList');
  if (!list) return;
  list.innerHTML = '';
  $('homeServerBtn')?.classList.toggle('active', activeMode === 'home');
  servers.forEach(server => {
    const button = document.createElement('button');
    const col = getColor(server.name);
    button.className = 'server-pill' + (server.id === activeServerId && activeMode === 'server' ? ' active' : '');
    button.title = server.name || 'Server';
    button.onclick = () => openServer(server.id);
    button.style.background = server.iconUrl ? '' : col.bg;
    button.style.color = server.iconUrl ? 'transparent' : col.fg;
    button.innerHTML = server.iconUrl
      ? `<img src="${escapeHtml(server.iconUrl)}" alt="">`
      : getInitials(server.name || 'S');
    list.appendChild(button);
  });
}

function openHome() {
  stopTyping();
  activeMode = 'home';
  activeServerId = null;
  activeChannelId = null;
  activeChannel = null;
  channels = [];
  serverMembers = [];
  channelsUnsub?.();
  serverMembersUnsub?.();
  channelsUnsub = null;
  serverMembersUnsub = null;
  activeConvoUnsub?.();
  activeConvoUnsub = null;
  replyDraft = null;
  renderReplyDraft();
  renderServerRail();
  renderSidebar();
  renderMemberPanel();
  $('chatPanel')?.classList.remove('server-open', 'server-channel');
  if (activeId && convos.some(c => c.id === activeId)) openConvo(activeId);
  else showEmptyChat('Welcome to Phoenix Messenger', 'Your messages live here. Start a conversation or search for someone to chat with.');
}

function renderSidebar() {
  const list = $('convoList');
  const empty = $('sidebarEmpty');
  if (!list || !empty) return;
  if (activeMode === 'server') {
    renderChannelSidebar();
    return;
  }

  $('sidebar')?.classList.remove('server-mode');
  const title = $('sidebarTitle');
  if (title) title.textContent = `Messages · ${getProfileName()}`;
  if ($('serverActions')) $('serverActions').style.display = 'none';
  if ($('newMessageBtn')) $('newMessageBtn').style.display = '';
  if ($('secondaryCreateBtn')) $('secondaryCreateBtn').title = 'New room';
  resetSidebarEmptyHome();
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
      </div>
      ${unreadCounts[c.id] ? `<div class="unread-badge">${unreadCounts[c.id] > 99 ? '99+' : unreadCounts[c.id]}</div>` : ''}`;
    list.appendChild(div);
  });
}

function renderChannelSidebar() {
  const list = $('convoList');
  const empty = $('sidebarEmpty');
  const server = getActiveServer();
  if (!list || !empty || !server) return;
  $('sidebar')?.classList.add('server-mode');
  if ($('sidebarTitle')) $('sidebarTitle').textContent = server.name || 'Server';
  if ($('serverActions')) $('serverActions').style.display = 'flex';
  if ($('newMessageBtn')) $('newMessageBtn').style.display = 'none';
  if ($('secondaryCreateBtn')) $('secondaryCreateBtn').title = 'Create channel';
  list.innerHTML = '';

  if (!channels.length) {
    empty.style.display = 'flex';
    list.style.display = 'none';
    const heading = empty.querySelector('h3');
    const text = empty.querySelector('p');
    if (heading) heading.textContent = 'No channels yet';
    if (text) text.textContent = 'Create a channel to start this server.';
    const btn = empty.querySelector('.new-chat-btn');
    if (btn) {
      btn.textContent = '+ New channel';
      btn.onclick = openChannelModal;
    }
    return;
  }

  empty.style.display = 'none';
  list.style.display = 'block';
  channels.forEach(channel => {
    const div = document.createElement('div');
    const isVoice = channel.type === 'voice';
    div.className = `convo-item channel-item ${isVoice ? 'voice' : 'text'}${channel.id === activeChannelId ? ' active' : ''}`;
    div.onclick = () => openChannel(channel.id);
    div.innerHTML = `
      <div class="c-avatar">${isVoice ? '🎤' : '#'}</div>
      <div class="convo-info">
        <div class="convo-name">${escapeHtml(channel.name || 'channel')}</div>
        <div class="convo-preview">${escapeHtml(isVoice ? 'Voice channels coming soon' : channel.lastMessage || 'No messages yet')}</div>
      </div>
      ${unreadChannelCounts[channel.id] ? `<div class="unread-badge">${unreadChannelCounts[channel.id] > 99 ? '99+' : unreadChannelCounts[channel.id]}</div>` : ''}`;
    list.appendChild(div);
  });
}

function resetSidebarEmptyHome() {
  const empty = $('sidebarEmpty');
  if (!empty) return;
  const h3 = empty.querySelector('h3');
  const p = empty.querySelector('p');
  const btn = empty.querySelector('.new-chat-btn');
  if (h3) h3.textContent = 'No conversations yet';
  if (p) p.textContent = 'Start a new chat to connect with someone';
  if (btn) {
    btn.textContent = '+ New message';
    btn.onclick = openModal;
  }
}

function showEmptyChat(title, subtitle) {
  $('chatHeader')?.classList.remove('visible');
  $('messages')?.classList.remove('visible');
  $('inputArea')?.classList.remove('visible');
  renderTypingIndicator([]);
  const empty = $('chatEmpty');
  if (empty) {
    empty.style.display = 'flex';
    const h2 = empty.querySelector('h2');
    const p = empty.querySelector('p');
    if (h2) h2.textContent = title;
    if (p) p.textContent = subtitle;
  }
}

function openConvo(id) {
  stopTyping();
  activeMode = 'home';
  activeServerId = null;
  activeChannelId = null;
  activeChannel = null;
  channelsUnsub?.();
  serverMembersUnsub?.();
  $('chatPanel')?.classList.remove('server-open', 'server-channel');
  activeId = id;
  unreadCounts[id] = 0;
  replyDraft = null;
  renderReplyDraft();
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
  renderServerRail();
  renderMemberPanel();
  listenToMessages(id);
  listenToTyping(id);
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

function startChannelSync(serverId) {
  channelsUnsub?.();
  serverMembersUnsub?.();
  const channelQuery = query(collection(db, 'servers', serverId, 'channels'), orderBy('position', 'asc'));
  channelsUnsub = onSnapshot(channelQuery, snapshot => {
    const nextChannels = snapshot.docs.map(d => ({ id: d.id, serverId, ...d.data() }));
    updateUnreadFromChannels(nextChannels);
    channels = nextChannels;
    renderSidebar();
    if (!activeChannelId) {
      const general = channels.find(channel => channel.name === 'general' && channel.type === 'text') || channels.find(channel => channel.type === 'text');
      if (general) openChannel(general.id);
    }
  }, error => console.error('Channel sync failed:', error));

  serverMembersUnsub = onSnapshot(collection(db, 'servers', serverId, 'members'), snapshot => {
    serverMembers = snapshot.docs.map(d => ({ id: d.id, serverId, ...d.data() }));
    renderMemberPanel();
    renderSidebar();
  }, error => console.error('Server member sync failed:', error));
}

function updateUnreadFromChannels(items) {
  items.forEach(item => {
    const next = getUpdateMillis(item.updatedAt || item.createdAt);
    const prev = seenChannelUpdates[item.id] || 0;
    if (prev && next > prev && item.id !== activeChannelId && item.lastMessage) {
      unreadChannelCounts[item.id] = (unreadChannelCounts[item.id] || 0) + 1;
    }
    if (next) seenChannelUpdates[item.id] = next;
  });
}

function openServer(serverId) {
  stopTyping();
  activeMode = 'server';
  activeServerId = serverId;
  activeChannelId = null;
  activeChannel = null;
  activeId = null;
  replyDraft = null;
  renderReplyDraft();
  activeConvoUnsub?.();
  activeConvoUnsub = null;
  $('chatPanel')?.classList.add('server-open', 'server-channel');
  renderServerRail();
  renderSidebar();
  renderMemberPanel();
  startChannelSync(serverId);
  showEmptyChat(getActiveServer()?.name || 'Server', 'Choose a text channel to start chatting.');
}

function openChannel(channelId) {
  const channel = channels.find(item => item.id === channelId);
  if (!channel || !activeServerId) return;
  activeChannelId = channelId;
  activeChannel = channel;
  unreadChannelCounts[channelId] = 0;
  replyDraft = null;
  renderReplyDraft();
  renderSidebar();

  if (channel.type === 'voice') {
    activeConvoUnsub?.();
    activeConvoUnsub = null;
    renderTypingIndicator([]);
    showEmptyChat('Voice channels coming soon', 'Phoenix voice rooms will plug into this server channel later.');
    $('inputArea')?.classList.remove('visible');
    return;
  }

  const col = getColor(channel.name);
  $('chatHeader')?.classList.add('visible');
  const av = $('headerAvatar');
  if (av) {
    av.textContent = '#';
    av.style.background = col.bg;
    av.style.color = col.fg;
  }
  if ($('headerName')) $('headerName').textContent = `#${channel.name}`;
  if ($('headerStatus')) $('headerStatus').textContent = `${getActiveServer()?.name || 'Server'} channel`;
  $('messages')?.classList.add('visible');
  $('inputArea')?.classList.add('visible');
  if ($('chatEmpty')) $('chatEmpty').style.display = 'none';
  if ($('inputBox')) {
    $('inputBox').setAttribute('data-placeholder', `Message #${channel.name}...`);
    $('inputBox').focus();
  }
  listenToChannelMessages(activeServerId, channelId);
  listenToTyping(getActiveConversationKey());
}

function listenToChannelMessages(serverId, channelId) {
  activeConvoUnsub?.();
  const q = query(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), orderBy('createdAt', 'asc'), limit(200));
  activeConvoUnsub = onSnapshot(q, snapshot => {
    if (activeMode !== 'server' || activeChannelId !== channelId) return;
    activeChannel = { ...(channels.find(x => x.id === channelId) || activeChannel || {}), messages: snapshot.docs.map(d => ({ id: d.id, ...d.data() })) };
    renderActiveConvoMessages();
  }, error => console.error('Channel message sync failed:', error));
}

function listenToTyping(convoId) {
  typingUnsub?.();
  const q = query(collection(db, 'typing'), where('conversationId', '==', convoId));
  typingUnsub = onSnapshot(q, snapshot => {
    const now = Date.now();
    const typers = snapshot.docs
      .map(d => d.data())
      .filter(data => data.uid !== currentUser?.uid && data.isTyping && typingIsFresh(data.updatedAt, now));
    renderTypingIndicator(typers);
  }, error => console.error('Typing sync failed:', error));
}

function typingIsFresh(value, now = Date.now()) {
  const date = value?.toDate ? value.toDate() : null;
  return date ? now - date.getTime() < 3500 : false;
}

function renderTypingIndicator(typers = []) {
  const el = $('typingIndicator');
  if (!el) return;
  el.classList.toggle('visible', typers.length > 0);
  if (!typers.length) {
    el.textContent = '';
    return;
  }
  const names = typers.map(t => t.username || 'Someone').slice(0, 2);
  el.textContent = names.length === 1 ? `${names[0]} is typing...` : `${names.join(', ')} are typing...`;
}

function getActiveConversationKey() {
  return activeMode === 'server'
    ? `server_${activeServerId}_${activeChannelId}`
    : activeId;
}

function typingDocId(convoId = getActiveConversationKey()) {
  return `${convoId}_${currentUser?.uid}`;
}

function handleTypingInput() {
  const conversationId = getActiveConversationKey();
  if (!conversationId || !currentUser) return;
  const now = Date.now();
  if (now - lastTypingWrite > 800) {
    setDoc(doc(db, 'typing', typingDocId()), {
      conversationId,
      uid: currentUser.uid,
      username: getProfileName(),
      isTyping: true,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(console.error);
    lastTypingWrite = now;
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 2000);
}

function stopTyping() {
  clearTimeout(typingTimer);
  typingTimer = null;
  const conversationId = getActiveConversationKey();
  if (!conversationId || !currentUser) return;
  setDoc(doc(db, 'typing', typingDocId()), {
    conversationId,
    uid: currentUser.uid,
    username: getProfileName(),
    isTyping: false,
    updatedAt: serverTimestamp()
  }, { merge: true }).catch(() => {});
}

function renderActiveConvoMessages() {
  const c = activeMode === 'server' ? activeChannel : convos.find(x => x.id === activeId);
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
  const deleted = Boolean(message.deleted);
  const attachmentHtml = deleted ? '' : renderAttachment(message.attachment, mine);
  const replyHtml = message.replyTo ? `
    <button class="reply-preview" onclick="scrollToMessage('${escapeHtml(message.replyTo.messageId || '')}')">
      <span>${escapeHtml(message.replyTo.senderName || 'Reply')}</span>
      <span>${escapeHtml(message.replyTo.text || 'Attachment')}</span>
    </button>` : '';
  const textHtml = deleted ? '<span class="deleted-text">Message deleted</span>' : escapeHtml(message.text || '');
  const editedHtml = message.editedAt && !deleted ? '<span class="edited-label">edited</span>' : '';
  const bodyHtml = `${replyHtml}${textHtml ? `<div>${textHtml} ${editedHtml}</div>` : ''}${attachmentHtml}${renderReactions(message)}`;
  const row = document.createElement('div');
  row.className = 'msg-row' + (mine ? ' mine' : '');
  row.id = `message-${message.id}`;
  row.oncontextmenu = event => {
    event.preventDefault();
    document.querySelectorAll('.msg-row.show-tools').forEach(el => {
      if (el !== row) el.classList.remove('show-tools');
    });
    row.classList.toggle('show-tools');
  };
  row.innerHTML = mine ? `
    <div class="msg-stack">
      <div class="bubble mine">${bodyHtml}</div>
      ${renderMessageTools(message, mine)}
      <div class="msg-meta">${escapeHtml(senderName)} ${formatTime(message.createdAt)}</div>
    </div>` : `
    <div class="msg-avatar-sm" style="background:${col.bg};color:${col.fg};">${getInitials(senderName)}</div>
    <div class="msg-stack">
      <div class="bubble theirs">${bodyHtml}</div>
      ${renderMessageTools(message, mine)}
      <div class="msg-meta">${escapeHtml(senderName)} ${formatTime(message.createdAt)}</div>
    </div>`;
  msgs.appendChild(row);
  if (scroll) msgs.scrollTop = msgs.scrollHeight;
}

function renderMessageTools(message, mine) {
  if (message.deleted) return '';
  const canDelete = canDeleteActiveMessage(message);
  return `
    <div class="msg-tools">
      <button class="msg-tool" onclick="replyToMessage('${escapeHtml(message.id)}')">Reply</button>
      <button class="msg-tool" onclick="copyMessageText('${escapeHtml(message.id)}')">Copy</button>
      ${mine ? `<button class="msg-tool" onclick="editMessage('${escapeHtml(message.id)}')">Edit</button>` : ''}
      ${canDelete ? `<button class="msg-tool danger" onclick="deleteMessage('${escapeHtml(message.id)}')">Delete</button>` : ''}
      <span class="quick-reactions">
        ${['👍', '❤️', '😂', '🔥', '👀'].map(emoji => `<button class="msg-tool reaction-tool" onclick="toggleReaction('${escapeHtml(message.id)}','${emoji}')">${emoji}</button>`).join('')}
      </span>
    </div>`;
}

function renderReactions(message) {
  const reactions = message.reactions || {};
  const entries = Object.entries(reactions).filter(([, users]) => Array.isArray(users) && users.length);
  if (!entries.length) return '';
  return `<div class="reactions">${entries.map(([emoji, users]) => {
    const active = users.includes(currentUser?.uid);
    return `<button class="reaction-pill ${active ? 'active' : ''}" onclick="toggleReaction('${escapeHtml(message.id)}','${escapeHtml(emoji)}')">${escapeHtml(emoji)} ${users.length}</button>`;
  }).join('')}</div>`;
}

function renderAttachment(attachment, mine = false) {
  if (!attachment?.url) return '';
  const name = escapeHtml(attachment.name || 'Attachment');
  const url = escapeHtml(attachment.url);
  const size = attachment.size ? ` · ${formatFileSize(attachment.size)}` : '';
  if (String(attachment.type || '').startsWith('image/')) {
    return `
      <a class="attachment-image-link" href="${url}" target="_blank" rel="noopener">
        <img class="attachment-image" src="${url}" alt="${name}">
      </a>
      <a class="attachment-caption ${mine ? 'mine' : ''}" href="${url}" target="_blank" rel="noopener">${name}${size}</a>`;
  }
  return `
    <a class="attachment-file ${mine ? 'mine' : ''}" href="${url}" target="_blank" rel="noopener" download>
      <span class="attachment-file-icon">File</span>
      <span class="attachment-file-info">
        <span class="attachment-file-name">${name}</span>
        <span class="attachment-file-meta">${escapeHtml(attachment.type || 'file')}${size}</span>
      </span>
    </a>`;
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function safeFileName(name) {
  return String(name || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 96);
}

async function findUserByUsername(value) {
  const wanted = cleanUsername(value).toLowerCase();
  const snap = await getDocs(query(collection(db, 'users'), where('usernameLower', '==', wanted), limit(1)));
  if (!snap.empty) {
    const found = snap.docs[0];
    return { id: found.id, uid: found.data().uid || found.id, ...found.data() };
  }

  const fallback = await getDocs(query(collection(db, 'users'), limit(100)));
  const found = fallback.docs.find(d => {
    const data = d.data();
    return cleanUsername(data.username || data.displayName || data.email).toLowerCase() === wanted;
  });
  return found ? { id: found.id, uid: found.data().uid || found.id, ...found.data() } : null;
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

function getFriendDisplayName(user) {
  return user?.username || user?.displayName || user?.email || 'User';
}

async function startDmWithUser(other, firstMessage = '') {
  const otherUid = getUserUid(other);
  if (!currentUser || !otherUid) {
    alert('Could not start chat: user profile is missing an id.');
    return;
  }
  if (otherUid === currentUser.uid) {
    alert('You cannot start a DM with yourself.');
    return;
  }

  const otherName = getFriendDisplayName(other);
  const id = dmIdFor(currentUser.uid, otherUid);
  const ref = doc(db, 'conversations', id);
  await setDoc(ref, {
    type: 'dm',
    members: [currentUser.uid, otherUid],
    memberNames: [getProfileName(), otherName],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: ''
  }, { merge: true });

  if (!convos.some(c => c.id === id)) {
    convos.unshift({
      id,
      type: 'dm',
      name: otherName,
      members: [currentUser.uid, otherUid],
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

  try {
    const other = await findUserByUsername(name);
    if (!other) {
      alert('No user found with that username.');
      return;
    }
    await startDmWithUser(other, msg);
  } catch (error) {
    console.error('Start chat failed:', error);
    alert(`Could not start chat: ${error.code || error.message || 'check Firestore rules'}`);
  }
}

function getUserCardHtml(user, meta = '') {
  const name = getFriendDisplayName(user);
  const avatarUrl = user.avatarURL || user.photoURL || '';
  const col = getColor(name);
  const avatarStyle = avatarUrl
    ? `background:center / cover url("${escapeHtml(avatarUrl)}");color:transparent;`
    : `background:${col.bg};color:${col.fg};`;
  return `
    <div class="c-avatar" style="${avatarStyle}">${avatarUrl ? '' : getInitials(name)}</div>
    <div class="user-card-info">
      <div class="user-card-name">${escapeHtml(name)}</div>
      <div class="user-card-meta">${escapeHtml(meta || user.bio || user.email || 'Phoenix user')}</div>
    </div>`;
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
  const uid = getUserUid(user);
  const self = uid === currentUser?.uid;
  const alreadyFriend = friends.some(friend => (friend.users || []).includes(uid));
  const pendingOutgoing = outgoingRequests.some(request => request.toUid === uid && request.status === 'pending');
  const pendingIncoming = incomingRequests.some(request => request.fromUid === uid && request.status === 'pending');
  results.innerHTML = `
    <div class="user-card">
      ${getUserCardHtml(user, self ? 'This is you' : alreadyFriend ? 'Friend' : pendingOutgoing ? 'Request sent' : pendingIncoming ? 'Sent you a request' : 'Phoenix user')}
      <div class="user-card-actions">
        <button class="btn-mini primary" onclick="startDmFromSearch('${escapeHtml(uid)}')" ${self ? 'disabled' : ''}>Message</button>
        <button class="btn-mini" onclick="sendFriendRequest('${escapeHtml(uid)}')" ${self || alreadyFriend || pendingOutgoing ? 'disabled' : ''}>Add</button>
        <button class="btn-mini danger" onclick="blockUser('${escapeHtml(uid)}')" ${self ? 'disabled' : ''}>Block</button>
      </div>
    </div>`;
}

function renderFriendLists() {
  const requestsEl = $('incomingRequestsList');
  if (requestsEl) {
    requestsEl.innerHTML = incomingRequests.length ? incomingRequests.map(req => `
      <div class="user-card">
        ${getUserCardHtml({ username: req.fromUsername, uid: req.fromUid, photoURL: req.fromPhotoURL }, 'Wants to add you')}
        <div class="user-card-actions">
          <button class="btn-mini primary" onclick="acceptFriendRequest('${escapeHtml(req.id)}')">Accept</button>
          <button class="btn-mini" onclick="declineFriendRequest('${escapeHtml(req.id)}')">Decline</button>
          <button class="btn-mini danger" onclick="blockUser('${escapeHtml(req.fromUid)}')">Block</button>
        </div>
      </div>`).join('') : '<div class="friend-empty">No pending requests.</div>';
  }

  const outgoingEl = $('outgoingRequestsList');
  if (outgoingEl) {
    outgoingEl.innerHTML = outgoingRequests.length ? outgoingRequests.map(req => `
      <div class="user-card">
        ${getUserCardHtml({ username: req.toUsername, uid: req.toUid, photoURL: req.toPhotoURL }, 'Request pending')}
        <div class="user-card-actions">
          <button class="btn-mini danger" onclick="cancelFriendRequest('${escapeHtml(req.id)}')">Cancel</button>
        </div>
      </div>`).join('') : '<div class="friend-empty">No sent requests.</div>';
  }

  const friendsEl = $('friendsList');
  if (friendsEl) {
    friendsEl.innerHTML = friends.length ? friends.map(friend => {
      const users = friend.users || [];
      const otherUid = users.find(uid => uid !== currentUser?.uid) || '';
      const idx = users.indexOf(otherUid);
      const otherName = (friend.usernames || [])[idx] || 'Friend';
      const otherPhoto = (friend.photos || [])[idx] || '';
      return `
        <div class="user-card">
          ${getUserCardHtml({ username: otherName, uid: otherUid, photoURL: otherPhoto }, 'Friend')}
          <div class="user-card-actions">
            <button class="btn-mini primary" onclick="startDmFromFriend('${escapeHtml(friend.id)}')">Message</button>
            <button class="btn-mini danger" onclick="removeFriend('${escapeHtml(friend.id)}')">Remove</button>
            <button class="btn-mini danger" onclick="blockUser('${escapeHtml(otherUid)}')">Block</button>
          </div>
        </div>`;
    }).join('') : '<div class="friend-empty">No friends yet.</div>';
  }
}

function startFriendsSync() {
  if (!currentUser) return;
  incomingRequestsUnsub?.();
  outgoingRequestsUnsub?.();
  friendsUnsub?.();

  incomingRequestsUnsub = onSnapshot(
    query(collection(db, 'friendRequests'), where('toUid', '==', currentUser.uid)),
    snapshot => {
      incomingRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(request => request.status === 'pending');
      renderFriendLists();
    },
    error => console.error('Incoming friend request sync failed:', error)
  );

  outgoingRequestsUnsub = onSnapshot(
    query(collection(db, 'friendRequests'), where('fromUid', '==', currentUser.uid)),
    snapshot => {
      outgoingRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(request => request.status === 'pending');
      renderFriendLists();
    },
    error => console.error('Outgoing friend request sync failed:', error)
  );

  friendsUnsub = onSnapshot(
    query(collection(db, 'friends'), where('users', 'array-contains', currentUser.uid)),
    snapshot => {
      friends = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFriendLists();
    },
    error => console.error('Friends sync failed:', error)
  );
}

async function sendFriendRequest(uid) {
  if (!currentUser || !uid || uid === currentUser.uid) return;
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) {
    alert('No user found.');
    return;
  }
  const user = { id: userSnap.id, uid: userSnap.data().uid || userSnap.id, ...userSnap.data() };
  if ((await getDoc(doc(db, 'friends', friendIdFor(currentUser.uid, uid)))).exists()) {
    alert('You are already friends.');
    return;
  }
  await setDoc(doc(db, 'friendRequests', friendRequestIdFor(currentUser.uid, uid)), {
    fromUid: currentUser.uid,
    fromUsername: getProfileName(),
    fromPhotoURL: currentProfile?.avatarURL || currentProfile?.photoURL || currentUser.photoURL || '',
    toUid: uid,
    toUsername: getFriendDisplayName(user),
    toPhotoURL: user.avatarURL || user.photoURL || '',
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
  if (req.toUid !== currentUser.uid || req.status !== 'pending') return;
  await setDoc(doc(db, 'friends', friendIdFor(req.fromUid, req.toUid)), {
    users: [req.fromUid, req.toUid],
    usernames: [req.fromUsername || 'Friend', getProfileName()],
    photos: [req.fromPhotoURL || '', currentProfile?.avatarURL || currentProfile?.photoURL || currentUser.photoURL || ''],
    createdAt: serverTimestamp()
  });
  await updateDoc(reqRef, { status: 'accepted', updatedAt: serverTimestamp() });
}

async function declineFriendRequest(requestId) {
  if (!requestId) return;
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'declined', updatedAt: serverTimestamp() });
}

async function cancelFriendRequest(requestId) {
  if (!requestId) return;
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'cancelled', updatedAt: serverTimestamp() });
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
  const friendDoc = doc(db, 'friends', friendIdFor(currentUser.uid, uid));
  if ((await getDoc(friendDoc)).exists()) await deleteDoc(friendDoc);
  alert('User blocked.');
}

async function startDmFromSearch(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return;
  await startDmWithUser({ id: snap.id, uid: snap.data().uid || snap.id, ...snap.data() });
}

async function startDmFromFriend(friendId) {
  const friend = friends.find(item => item.id === friendId);
  if (!friend) return;
  const otherUid = (friend.users || []).find(uid => uid !== currentUser?.uid);
  if (!otherUid) return;
  const snap = await getDoc(doc(db, 'users', otherUid));
  if (snap.exists()) await startDmWithUser({ id: snap.id, uid: snap.data().uid || snap.id, ...snap.data() });
}

async function sendMessage() {
  if (!getActiveConversationKey() || !currentUser) return;
  const box = $('inputBox');
  if (!box) return;
  const text = box.innerText.trim();
  if (!text) return;
  box.innerText = '';
  stopTyping();
  await sendMessagePayload({ text });
}

function getActiveMessageCollectionRef() {
  if (activeMode === 'server') {
    if (!activeServerId || !activeChannelId) return null;
    return collection(db, 'servers', activeServerId, 'channels', activeChannelId, 'messages');
  }
  if (!activeId) return null;
  return collection(db, 'conversations', activeId, 'messages');
}

function getActiveMessageDocRef(messageId) {
  if (activeMode === 'server') {
    if (!activeServerId || !activeChannelId) return null;
    return doc(db, 'servers', activeServerId, 'channels', activeChannelId, 'messages', messageId);
  }
  if (!activeId) return null;
  return doc(db, 'conversations', activeId, 'messages', messageId);
}

function canDeleteActiveMessage(message) {
  if (!message || message.deleted) return false;
  if (message.senderId === currentUser?.uid) return true;
  return activeMode === 'server' && hasServerPermission('delete_messages');
}

function getActiveMessageParentRef() {
  if (activeMode === 'server') {
    if (!activeServerId || !activeChannelId) return null;
    return doc(db, 'servers', activeServerId, 'channels', activeChannelId);
  }
  if (!activeId) return null;
  return doc(db, 'conversations', activeId);
}

async function sendMessagePayload({ text = '', attachment = null }) {
  if (!getActiveConversationKey() || !currentUser) return;
  const c = activeMode === 'server' ? activeChannel : convos.find(x => x.id === activeId);
  const messageRef = getActiveMessageCollectionRef();
  const parentRef = getActiveMessageParentRef();
  if (!c || !messageRef || !parentRef) return;
  const cleanText = String(text || '').trim();
  if (!cleanText && !attachment) return;

  await addDoc(messageRef, {
    text: cleanText,
    attachment: attachment || null,
    replyTo: replyDraft || null,
    reactions: {},
    senderId: currentUser.uid,
    senderName: getProfileName(),
    senderPhotoURL: currentProfile?.photoURL || currentUser.photoURL || '',
    createdAt: serverTimestamp(),
    editedAt: null,
    deleted: false
  });
  await updateDoc(parentRef, {
    updatedAt: serverTimestamp(),
    lastMessage: cleanText || (attachment?.type?.startsWith('image/') ? 'Photo' : `File: ${attachment?.name || 'Attachment'}`)
  });
  if (activeMode === 'server' && activeServerId) {
    await updateDoc(doc(db, 'servers', activeServerId), { updatedAt: serverTimestamp() }).catch(console.error);
  }
  replyDraft = null;
  renderReplyDraft();
}

function getActiveMessage(messageId) {
  const c = activeMode === 'server' ? activeChannel : convos.find(x => x.id === activeId);
  return c?.messages?.find(message => message.id === messageId) || null;
}

async function editMessage(messageId) {
  const message = getActiveMessage(messageId);
  if (!message || message.senderId !== currentUser?.uid || message.deleted) return;
  const next = prompt('Edit message', message.text || '');
  if (next === null) return;
  const text = next.trim();
  if (!text) return;
  await updateDoc(getActiveMessageDocRef(messageId), {
    text,
    editedAt: serverTimestamp()
  });
  await updateDoc(getActiveMessageParentRef(), {
    updatedAt: serverTimestamp(),
    lastMessage: text
  });
}

async function deleteMessage(messageId) {
  const message = getActiveMessage(messageId);
  if (!canDeleteActiveMessage(message)) return;
  if (!confirm('Delete this message?')) return;
  await updateDoc(getActiveMessageDocRef(messageId), {
    text: '',
    attachment: null,
    deleted: true,
    editedAt: serverTimestamp()
  });
  await updateDoc(getActiveMessageParentRef(), {
    updatedAt: serverTimestamp(),
    lastMessage: 'Message deleted'
  });
}

async function copyMessageText(messageId) {
  const message = getActiveMessage(messageId);
  if (!message?.text || message.deleted) return;
  await navigator.clipboard?.writeText(message.text);
}

function replyToMessage(messageId) {
  const message = getActiveMessage(messageId);
  if (!message || message.deleted) return;
  replyDraft = {
    messageId,
    text: (message.text || (message.attachment ? message.attachment.name || 'Attachment' : '')).slice(0, 140),
    senderName: message.senderName || 'User'
  };
  renderReplyDraft();
  $('inputBox')?.focus();
}

function cancelReply() {
  replyDraft = null;
  renderReplyDraft();
}

function renderReplyDraft() {
  const el = $('replyPreview');
  if (!el) return;
  el.classList.toggle('visible', Boolean(replyDraft));
  el.innerHTML = replyDraft ? `
    <div>
      <div class="reply-label">${escapeHtml(replyDraft.senderName || 'Reply')}</div>
      <div class="reply-text">${escapeHtml(replyDraft.text || 'Attachment')}</div>
    </div>
    <button class="reply-cancel" onclick="cancelReply()">x</button>` : '';
}

function scrollToMessage(messageId) {
  if (!messageId) return;
  const el = $(`message-${messageId}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el?.classList.add('pulse-message');
  setTimeout(() => el?.classList.remove('pulse-message'), 1200);
}

async function toggleReaction(messageId, emoji) {
  const message = getActiveMessage(messageId);
  if (!message || message.deleted || !currentUser) return;
  const reactions = { ...(message.reactions || {}) };
  const users = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
  reactions[emoji] = users.includes(currentUser.uid)
    ? users.filter(uid => uid !== currentUser.uid)
    : [...users, currentUser.uid];
  if (!reactions[emoji].length) delete reactions[emoji];
  await updateDoc(getActiveMessageDocRef(messageId), { reactions });
}

async function sendAttachment(file) {
  if (!getActiveConversationKey() || !currentUser || !file) return;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    alert('File is too large. Keep uploads under 25 MB.');
    return;
  }

  const toolbar = $('inputArea');
  toolbar?.classList.add('uploading');
  try {
    const url = await uploadImage(file);
    await sendMessagePayload({
      attachment: {
        url,
        name: file.name || 'Attachment',
        size: file.size || 0,
        type: file.type || 'application/octet-stream'
      }
    });
  } catch (error) {
    console.error('Attachment upload failed:', error);
    alert(`Upload failed: ${error.message || 'check Cloudinary settings'}`);
  } finally {
    toolbar?.classList.remove('uploading');
    if ($('fileInput')) $('fileInput').value = '';
    if ($('imageInput')) $('imageInput').value = '';
  }
}

function chooseFile() {
  if (!getActiveConversationKey()) {
    alert('Open a chat before sending a file.');
    return;
  }
  $('fileInput')?.click();
}

function chooseImage() {
  if (!getActiveConversationKey()) {
    alert('Open a chat before sending a photo.');
    return;
  }
  $('imageInput')?.click();
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
  if ($('profileAvatarUrlInput')) $('profileAvatarUrlInput').value = currentProfile.avatarURL || currentProfile.photoURL || '';
  if ($('profileBannerUrlInput')) $('profileBannerUrlInput').value = currentProfile.bannerURL || '';
  if ($('profilePronounsInput')) $('profilePronounsInput').value = currentProfile.pronouns || '';
  if ($('profileLocationInput')) $('profileLocationInput').value = currentProfile.location || '';
  if ($('profileWebsiteInput')) $('profileWebsiteInput').value = currentProfile.website || '';
  if ($('profileStatusInput')) $('profileStatusInput').value = currentProfile.status || 'online';
  renderProfilePreview();
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

function handleSecondaryCreate() {
  if (activeMode === 'server') openChannelModal();
  else openRoomModal();
}

async function createRoom() {
  if (!currentUser) return;
  const name = String($('roomNameInput')?.value || '').trim();
  const description = String($('roomDescriptionInput')?.value || '').trim();
  if (!name) {
    $('roomNameInput')?.focus();
    return;
  }
  const roomRef = doc(collection(db, 'conversations'));
  await setDoc(roomRef, {
    type: 'room',
    public: true,
    name,
    description,
    members: [currentUser.uid],
    memberNames: [getProfileName()],
    createdBy: currentUser.uid,
    createdByName: getProfileName(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: description || 'Room created'
  });
  closeRoomModal();
  if ($('roomNameInput')) $('roomNameInput').value = '';
  if ($('roomDescriptionInput')) $('roomDescriptionInput').value = '';
  openConvo(roomRef.id);
}

function openServerModal() {
  $('serverModalOverlay')?.classList.add('open');
  setTimeout(() => $('serverNameInput')?.focus(), 50);
}

function closeServerModal() {
  $('serverModalOverlay')?.classList.remove('open');
}

function closeServerModalOutside(e) {
  if (e.target === $('serverModalOverlay')) closeServerModal();
}

function openChannelModal() {
  if (!activeServerId) return;
  if (!hasServerPermission('create_channels')) {
    alert('You need admin permissions to create channels.');
    return;
  }
  $('channelModalOverlay')?.classList.add('open');
  setTimeout(() => $('channelNameInput')?.focus(), 50);
}

function closeChannelModal() {
  $('channelModalOverlay')?.classList.remove('open');
}

function closeChannelModalOutside(e) {
  if (e.target === $('channelModalOverlay')) closeChannelModal();
}

function cleanChannelName(value) {
  return String(value || '').trim().replace(/^#/, '').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().slice(0, 32);
}

async function createServer() {
  if (!currentUser) return;
  const name = String($('serverNameInput')?.value || '').trim();
  const description = String($('serverDescriptionInput')?.value || '').trim();
  const iconUrl = String($('serverIconInput')?.value || '').trim();
  if (!name) {
    $('serverNameInput')?.focus();
    return;
  }

  const serverRef = doc(collection(db, 'servers'));
  const memberRef = doc(db, 'servers', serverRef.id, 'members', currentUser.uid);
  await setDoc(serverRef, {
    name,
    description,
    ownerId: currentUser.uid,
    ownerName: getProfileName(),
    iconUrl,
    bannerUrl: '',
    memberIds: [currentUser.uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    memberCount: 1
  });
  await setDoc(memberRef, {
    uid: currentUser.uid,
    username: getProfileName(),
    displayName: currentProfile?.displayName || '',
    avatarURL: currentProfile?.avatarURL || currentProfile?.photoURL || currentUser.photoURL || '',
    role: 'owner',
    joinedAt: serverTimestamp()
  });
  await createDefaultServerChannels(serverRef.id);
  if ($('serverNameInput')) $('serverNameInput').value = '';
  if ($('serverDescriptionInput')) $('serverDescriptionInput').value = '';
  if ($('serverIconInput')) $('serverIconInput').value = '';
  closeServerModal();
  servers.unshift({ id: serverRef.id, name, description, ownerId: currentUser.uid, ownerName: getProfileName(), iconUrl, memberIds: [currentUser.uid], memberCount: 1 });
  renderServerRail();
  openServer(serverRef.id);
}

async function createDefaultServerChannels(serverId) {
  const defaults = [
    ['general', 'general', 'text', 10],
    ['announcements', 'announcements', 'text', 20],
    ['media', 'media', 'text', 30],
    ['general_voice', '🎤 General Voice', 'voice', 40]
  ];
  await Promise.all(defaults.map(([id, name, type, position]) => setDoc(doc(db, 'servers', serverId, 'channels', id), {
    name,
    type,
    position,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: type === 'voice' ? 'Voice channels coming soon' : ''
  }, { merge: true })));
}

async function createChannel() {
  if (!activeServerId || !hasServerPermission('create_channels')) return;
  const type = $('channelTypeInput')?.value || 'text';
  const rawName = String($('channelNameInput')?.value || '').trim();
  const name = type === 'voice' ? rawName.slice(0, 32) : cleanChannelName(rawName);
  if (!name) {
    $('channelNameInput')?.focus();
    return;
  }
  const position = channels.length ? Math.max(...channels.map(channel => Number(channel.position) || 0)) + 10 : 10;
  const channelRef = doc(collection(db, 'servers', activeServerId, 'channels'));
  await setDoc(channelRef, {
    name,
    type,
    position,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: type === 'voice' ? 'Voice channels coming soon' : ''
  });
  await updateDoc(doc(db, 'servers', activeServerId), { updatedAt: serverTimestamp() }).catch(console.error);
  if ($('channelNameInput')) $('channelNameInput').value = '';
  closeChannelModal();
  if (type === 'text') openChannel(channelRef.id);
}

async function createServerInvite() {
  if (!activeServerId || !currentUser) return;
  if (!hasServerPermission('invite_users')) {
    alert('You need invite permissions for this server.');
    return;
  }
  const server = getActiveServer();
  const code = Math.random().toString(36).slice(2, 10);
  await setDoc(doc(db, 'serverInvites', code), {
    serverId: activeServerId,
    serverName: server?.name || 'Server',
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    expiresAt: null
  });
  const url = `${location.origin}${location.pathname}?invite=${code}`;
  await navigator.clipboard?.writeText(url).catch(() => {});
  alert(`Invite link copied:\n${url}`);
}

async function handleInviteFromUrl() {
  const params = new URLSearchParams(location.search);
  const code = params.get('invite') || pendingInviteCode;
  if (!code) return;
  pendingInviteCode = currentUser ? '' : code;
  if (!currentUser) return;
  try {
    await joinServerFromInvite(code);
    const cleanUrl = `${location.origin}${location.pathname}`;
    history.replaceState({}, '', cleanUrl);
  } catch (error) {
    console.error('Invite failed:', error);
    alert(`Could not join server: ${error.code || error.message || 'check invite/rules'}`);
  }
}

async function joinServerFromInvite(code) {
  const inviteSnap = await getDoc(doc(db, 'serverInvites', code));
  if (!inviteSnap.exists()) throw new Error('Invite not found.');
  const invite = inviteSnap.data();
  const serverSnap = await getDoc(doc(db, 'servers', invite.serverId));
  if (!serverSnap.exists()) throw new Error('Server not found.');
  const memberRef = doc(db, 'servers', invite.serverId, 'members', currentUser.uid);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) {
    await setDoc(memberRef, {
      uid: currentUser.uid,
      username: getProfileName(),
      displayName: currentProfile?.displayName || '',
      avatarURL: currentProfile?.avatarURL || currentProfile?.photoURL || currentUser.photoURL || '',
      role: 'member',
      joinedAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'servers', invite.serverId), {
      memberIds: arrayUnion(currentUser.uid),
      memberCount: increment(1),
      updatedAt: serverTimestamp()
    });
  }
  if (!servers.some(server => server.id === invite.serverId)) {
    servers.unshift({ id: serverSnap.id, ...serverSnap.data() });
  }
  openServer(invite.serverId);
}

function renderMemberPanel() {
  const panel = $('memberPanel');
  if (!panel) return;
  const visible = activeMode === 'server' && Boolean(activeServerId);
  panel.classList.toggle('visible', visible);
  if (!visible) {
    panel.innerHTML = '';
    $('chatPanel')?.classList.remove('server-open');
    return;
  }
  $('chatPanel')?.classList.add('server-open');
  const now = Date.now();
  const sorted = [...serverMembers].sort((a, b) => {
    const roles = { owner: 0, admin: 1, mod: 2, member: 3 };
    return (roles[a.role] ?? 9) - (roles[b.role] ?? 9) || String(a.username || '').localeCompare(String(b.username || ''));
  });
  const online = sorted.filter(member => {
    const profile = member.profile || {};
    const lastSeen = profile.lastSeen?.toDate ? profile.lastSeen.toDate().getTime() : 0;
    return profile.status === 'online' || (lastSeen && now - lastSeen < 120000);
  });
  const offline = sorted.filter(member => !online.includes(member));
  const renderGroup = (title, members) => `
    <div class="member-title">${title} - ${members.length}</div>
    ${members.map(member => {
      const name = member.username || member.displayName || 'Member';
      const avatar = member.avatarURL || '';
      const col = getColor(name);
      return `
        <div class="member-card">
          <div class="member-avatar" style="${avatar ? `background:center / cover url('${escapeHtml(avatar)}');color:transparent;` : `background:${col.bg};color:${col.fg};`}">${avatar ? '' : getInitials(name)}</div>
          <div style="min-width:0;">
            <div class="member-name">${escapeHtml(name)}</div>
            <div class="member-role">${escapeHtml(member.role || 'member')}</div>
          </div>
        </div>`;
    }).join('')}`;
  panel.innerHTML = renderGroup('Online', online) + renderGroup('Offline', offline);
}

function renderProfilePreview() {
  const banner = $('profilePreviewBanner');
  const avatar = $('profilePreviewAvatar');
  const avatarUrl = $('profileAvatarUrlInput')?.value || currentProfile?.avatarURL || currentProfile?.photoURL || '';
  const bannerUrl = $('profileBannerUrlInput')?.value || currentProfile?.bannerURL || '';
  const name = $('profileUsernameInput')?.value || getProfileName();
  if (banner) banner.style.background = bannerUrl ? `center / cover url("${bannerUrl}")` : 'linear-gradient(135deg, rgba(108,99,255,0.7), rgba(20,184,166,0.45))';
  if (avatar) {
    avatar.textContent = avatarUrl ? '' : getInitials(name);
    avatar.style.background = avatarUrl ? `center / cover url("${avatarUrl}")` : getColor(name).bg;
    avatar.style.color = getColor(name).fg;
  }
}

function openModPanel() {
  $('modPanelOverlay')?.classList.add('open');
  setTimeout(() => $('modAccessCodeInput')?.focus(), 50);
}

function closeModPanel() {
  $('modPanelOverlay')?.classList.remove('open');
}

function closeModPanelOutside(e) {
  if (e.target === $('modPanelOverlay')) closeModPanel();
}

async function runModerationAction() {
  if (!currentUser) return;
  const code = String($('modAccessCodeInput')?.value || '').trim();
  if (code !== MOD_ACCESS_CODE) {
    alert('Wrong access code.');
    return;
  }
  const targetName = String($('modTargetInput')?.value || '').trim();
  const action = $('modActionInput')?.value || 'timeout';
  const reason = String($('modReasonInput')?.value || '').trim();
  const minutes = Math.max(0, Number($('modDurationInput')?.value || 0));
  if (!targetName) {
    $('modTargetInput')?.focus();
    return;
  }
  const target = await findUserByUsername(targetName);
  if (!target?.uid) {
    alert('No user found with that username.');
    return;
  }
  const until = action === 'timeout' && minutes > 0
    ? Timestamp.fromDate(new Date(Date.now() + minutes * 60000))
    : null;
  const moderation = {
    status: action,
    reason,
    until,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
    updatedByName: getProfileName()
  };
  await updateDoc(doc(db, 'users', target.uid), { moderation, moderationAccessCode: MOD_ACCESS_CODE });
  await addDoc(collection(db, 'moderationActions'), {
    targetUid: target.uid,
    targetUsername: target.username || target.displayName || targetName,
    action,
    reason,
    until,
    moderatorUid: currentUser.uid,
    moderatorName: getProfileName(),
    createdAt: serverTimestamp(),
    accessCode: MOD_ACCESS_CODE
  });
  alert('Moderation action saved.');
  closeModPanel();
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
  pendingInviteCode = new URLSearchParams(location.search).get('invite') || pendingInviteCode;
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
$('serverNameInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') createServer();
});
$('channelNameInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') createChannel();
});
$('inputBox')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
$('inputBox')?.addEventListener('input', handleTypingInput);
$('fileInput')?.addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (file) sendAttachment(file);
});
$('imageInput')?.addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (file) sendAttachment(file);
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
  stopTyping();
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
  cancelFriendRequest,
  cancelReply,
  chooseFile,
  chooseImage,
  closeModal,
  closeFriendModal,
  closeFriendModalOutside,
  closeModPanel,
  closeModPanelOutside,
  closeModalOutside,
  closeProfileModal,
  closeProfileModalOutside,
  closeRoomModal,
  closeRoomModalOutside,
  closeChannelModal,
  closeChannelModalOutside,
  closeServerModal,
  closeServerModalOutside,
  copyMessageText,
  createChannel,
  createRoom,
  createServer,
  createServerInvite,
  declineFriendRequest,
  declineIncomingCall,
  deleteMessage,
  editMessage,
  endCurrentCall,
  filterConvos,
  handleSecondaryCreate,
  openModal,
  openChannelModal,
  openFriendModal,
  openHome,
  openModPanel,
  openProfileModal,
  openRoomModal,
  openServer,
  openServerModal,
  removeFriend,
  renderProfilePreview,
  replyToMessage,
  runModerationAction,
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
  scrollToMessage,
  toggleReaction,
  toggleCamera,
  toggleMute
});
