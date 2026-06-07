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
  arrayRemove,
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
import { Room, RoomEvent, Track } from 'livekit-client';
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
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 2000;
const MESSAGE_WINDOW_MS = 5000;
const MESSAGE_WINDOW_LIMIT = 5;
const MAX_VOICE_MESSAGE_MS = 5 * 60 * 1000;
const IDLE_AFTER_MS = 5 * 60 * 1000;
const MOD_ACCESS_CODE = '440255';
const APP_VERSION = 'v1.2.0';
const BUG_REPORT_EMAIL = import.meta.env.VITE_BUG_REPORT_EMAIL || '';
const ROLE_DEFAULTS = {
  owner: { color: '#f59e0b', icon: '◆', permissions: ['administrator'] },
  admin: { color: '#a855f7', icon: '★', permissions: ['manage_channels', 'manage_roles', 'kick_members', 'ban_members', 'manage_messages', 'invite_users', 'send_messages', 'react', 'join_voice'] },
  mod: { color: '#22c55e', icon: '◆', permissions: ['kick_members', 'manage_messages', 'invite_users', 'send_messages', 'react', 'join_voice'] },
  member: { color: '#94a3b8', icon: '●', permissions: ['send_messages', 'react', 'join_voice'] }
};

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
let voiceMembersUnsub = null;
let voicePresenceTimer = null;
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
let activeVoiceServerId = null;
let activeVoiceChannelId = null;
let activeVoiceChannelName = '';
let voiceMembers = [];
let voiceChannelMembers = {};
let voiceChannelMemberUnsubs = {};
let voiceSignalsUnsub = null;
let voiceLocalStream = null;
let voicePeerConnections = new Map();
let voiceSeenSignalIds = new Set();
let voiceMuted = false;
let voiceDeafened = false;
let voiceConnectionState = '';
let unreadChannelCounts = {};
let seenChannelUpdates = {};
let unreadCounts = {};
let seenConvoUpdates = {};
let recentMessageTimes = [];
let notificationSoundEnabled = localStorage.getItem('phoenix_sound_enabled') !== 'false';
let currentTheme = localStorage.getItem('phoenix_theme') || 'dark';
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
let liveKitRoom = null;
let liveKitRoomName = '';
let liveKitContext = '';
let liveKitReconnectTimer = null;
let screenShareActive = false;
let voiceMessageRecorder = null;
let voiceMessageStream = null;
let voiceMessageChunks = [];
let voiceMessageStartedAt = 0;
let voiceMessageTimer = null;
let voiceMessageCancelled = false;
let lastActivityAt = Date.now();
let autoIdle = false;
let draftRolePermissions = {};
let draftRoleStyles = {};
let draggedRole = '';
const userProfileCache = new Map();
const userProfileUnsubs = new Map();
const syncErrorTimes = new Map();

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
  if (message) showToast(message, 'error');
}

function setSetupError(message) {
  const el = $('setupError');
  if (el) el.textContent = message || '';
}

function lockMessenger(locked) {
  $('appShell')?.classList.toggle('auth-locked', locked);
  if (locked) $('connectionPill')?.classList.remove('visible');
  else setConnectionStatus();
}

function showLanding(show) {
  $('landingPage')?.classList.toggle('hidden', !show);
}

function showAuth(show) {
  $('authOverlay')?.classList.toggle('hidden', !show);
}

function updateDownloadCounter() {
  const count = Number(localStorage.getItem('phoenix_windows_download_requests') || 0);
  if ($('downloadCounter')) $('downloadCounter').textContent = count.toLocaleString();
}

function scrollToDownloads() {
  $('downloadsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function requestWindowsDownload() {
  const next = Number(localStorage.getItem('phoenix_windows_download_requests') || 0) + 1;
  localStorage.setItem('phoenix_windows_download_requests', String(next));
  updateDownloadCounter();
  showToast('Windows installer is coming soon. Your download request was recorded.', 'info');
  scrollToDownloads();
}

function openChangelog() {
  $('changelogOverlay')?.classList.add('open');
}

function closeChangelog() {
  $('changelogOverlay')?.classList.remove('open');
}

function closeChangelogOutside(e) {
  if (e.target === $('changelogOverlay')) closeChangelog();
}

function openAuthPanel() {
  showAuth(true);
  setTimeout(() => $('authEmail')?.focus(), 50);
}

function closeAuthPanel() {
  showAuth(false);
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

function showToast(message, type = 'info') {
  const stack = $('toastStack');
  if (!stack || !message) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = String(message);
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

function friendlyError(error, fallback = 'Something went wrong.') {
  const code = error?.code || '';
  const message = String(error?.message || '');
  if (code.includes('permission-denied')) return 'Permission denied. You may not have access to this chat.';
  if (/notallowederror|permission denied|permissions policy|microphone|camera/i.test(message)) {
    return 'Microphone or camera permission was denied.';
  }
  if (/livekit|voice token|could not create voice token|token response/i.test(message)) {
    return message || 'Could not connect to voice. Try again in a moment.';
  }
  if (!navigator.onLine) return 'You appear to be offline. Check your connection.';
  return message || fallback;
}

function reportSyncError(key, error, fallback) {
  console.error(`${key} failed:`, error);
  const now = Date.now();
  if (now - (syncErrorTimes.get(key) || 0) < 10000) return;
  syncErrorTimes.set(key, now);
  showToast(friendlyError(error, fallback), 'error');
}

function setConnectionStatus(status = navigator.onLine ? 'Online' : 'Offline') {
  const pill = $('connectionPill');
  if (!pill) return;
  const clean = String(status || '').trim() || (navigator.onLine ? 'Online' : 'Offline');
  pill.textContent = clean;
  pill.classList.toggle('visible', Boolean(currentUser));
  pill.classList.toggle('offline', /offline|disconnected|failed/i.test(clean));
  pill.classList.toggle('reconnecting', /reconnecting|connecting/i.test(clean));
}

function setButtonLoading(id, loading, label = '') {
  const btn = $(id);
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = label || 'Loading...';
  } else if (btn.dataset.originalText) {
    btn.textContent = btn.dataset.originalText;
    delete btn.dataset.originalText;
  }
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

function setElementLoading(element, loading, label = '') {
  const btn = element?.closest?.('button') || (document.activeElement?.tagName === 'BUTTON' ? document.activeElement : null);
  if (!btn) return null;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = label || 'Working...';
  } else if (btn.dataset.originalText) {
    btn.textContent = btn.dataset.originalText;
    delete btn.dataset.originalText;
  }
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
  return btn;
}

function closeActionMenu() {
  $('actionMenuOverlay')?.classList.remove('open');
}

function closeActionMenuOutside(event) {
  if (event.target === $('actionMenuOverlay')) closeActionMenu();
}

function openActionMenu(title, actions = []) {
  if ($('actionMenuTitle')) $('actionMenuTitle').textContent = title || 'Actions';
  const buttons = $('actionMenuButtons');
  if (!buttons) return;
  buttons.innerHTML = '';
  actions.filter(Boolean).forEach(action => {
    const button = document.createElement('button');
    button.className = `btn-ghost${action.danger ? ' danger' : ''}`;
    button.textContent = action.label;
    button.title = action.title || action.label;
    button.onclick = async () => {
      closeActionMenu();
      await action.run?.();
    };
    buttons.appendChild(button);
  });
  $('actionMenuOverlay')?.classList.add('open');
}

async function copyText(value, successMessage = 'Copied.') {
  try {
    await navigator.clipboard.writeText(String(value || ''));
    showToast(successMessage, 'success');
  } catch {
    showToast('Could not copy to clipboard.', 'error');
  }
}

function openConversationMenu() {
  const source = activeMode === 'server' ? activeChannel : convos.find(convo => convo.id === activeId);
  if (!source) {
    showToast('Open a conversation first.', 'info');
    return;
  }
  const actions = [
    { label: 'Search Messages', run: openGlobalSearch },
    { label: 'Pinned Messages', run: openPinnedMessages },
    { label: 'Copy Name', run: () => copyText(source.name || $('headerName')?.textContent, 'Conversation name copied.') },
    { label: 'Copy ID', run: () => copyText(source.id || activeId || activeChannelId, 'Conversation ID copied.') }
  ];
  if (activeMode !== 'server' && source.type === 'dm') {
    const peerUid = (source.members || []).find(uid => uid !== currentUser?.uid);
    if (peerUid) actions.push({ label: 'View Profile', run: () => openRichProfile(peerUid) });
  }
  openActionMenu(source.name || 'Conversation Actions', actions);
}

function openHeaderProfile() {
  if (activeMode === 'server') {
    openConversationMenu();
    return;
  }
  const convo = convos.find(item => item.id === activeId);
  const peerUid = convo?.type === 'dm' ? (convo.members || []).find(uid => uid !== currentUser?.uid) : '';
  if (peerUid) openRichProfile(peerUid);
  else openConversationMenu();
}

function openRichProfileCurrent() {
  if (currentUser?.uid) openRichProfile(currentUser.uid);
}

function openServerActions(serverId) {
  const server = servers.find(item => item.id === serverId);
  if (!server) return;
  const actions = [
    { label: 'Open Server', run: () => openServer(serverId) },
    { label: 'Copy Server Name', run: () => copyText(server.name, 'Server name copied.') },
    { label: 'Copy Server ID', run: () => copyText(server.id, 'Server ID copied.') }
  ];
  if (activeServerId === serverId) {
    if (hasServerPermission('invite_users')) actions.push({ label: 'Copy Invite Link', run: createServerInvite });
    if (['owner', 'admin'].includes(getMyServerMember()?.role)) actions.push({ label: 'Server Settings', run: openServerSettings });
    if (getMyServerMember()?.role !== 'owner') actions.push({ label: 'Leave Server', danger: true, run: leaveServer });
  }
  openActionMenu(server.name || 'Server Actions', actions);
}

function openChannelActions(channelId) {
  const channel = channels.find(item => item.id === channelId);
  if (!channel) return;
  const actions = [
    { label: channel.type === 'voice' ? 'Join Voice' : 'Open Channel', run: () => openChannel(channelId) },
    { label: 'Copy Channel Name', run: () => copyText(channel.name, 'Channel name copied.') },
    { label: 'Copy Channel ID', run: () => copyText(channel.id, 'Channel ID copied.') }
  ];
  if (hasServerPermission('manage_channels')) {
    actions.push({ label: 'Delete Channel', danger: true, run: () => deleteChannel(channelId) });
  }
  openActionMenu(`#${channel.name || 'channel'}`, actions);
}

async function deleteChannel(channelId) {
  if (!activeServerId || !hasServerPermission('manage_channels')) {
    showToast('You do not have permission to delete channels.', 'error');
    return;
  }
  const channel = channels.find(item => item.id === channelId);
  if (!channel || !confirm(`Delete ${channel.name || 'this channel'}? Existing messages will no longer be accessible.`)) return;
  try {
    if (activeVoiceChannelId === channelId) await leaveVoiceChannel(true);
    await deleteDoc(doc(db, 'servers', activeServerId, 'channels', channelId));
    if (activeChannelId === channelId) {
      activeChannelId = null;
      activeChannel = null;
      showEmptyChat(getActiveServer()?.name || 'Server', 'Choose a channel to continue.');
    }
    showToast('Channel deleted.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not delete channel.'), 'error');
  }
}

function openEmojiPicker() {
  if (!getActiveConversationKey()) {
    showToast('Open a chat before choosing an emoji.', 'info');
    return;
  }
  const emojis = ['😀', '😂', '😍', '🥳', '😎', '😭', '😡', '👍', '👎', '❤️', '🔥', '👀', '🎉', '✨', '💯', '🙏', '🤝', '👏', '💬', '🚀', '✅', '❌', '🎮', '🎵'];
  const grid = $('emojiPickerGrid');
  if (grid) grid.innerHTML = emojis.map(emoji => `<button class="emoji-choice" title="${emoji}" onclick="insertEmoji('${emoji}')">${emoji}</button>`).join('');
  $('emojiPickerOverlay')?.classList.add('open');
}

function closeEmojiPicker() {
  $('emojiPickerOverlay')?.classList.remove('open');
}

function closeEmojiPickerOutside(event) {
  if (event.target === $('emojiPickerOverlay')) closeEmojiPicker();
}

function insertEmoji(emoji) {
  const box = $('inputBox');
  if (!box) return;
  box.focus();
  const inserted = document.execCommand?.('insertText', false, emoji);
  if (!inserted) box.innerText += emoji;
  handleTypingInput();
  closeEmojiPicker();
}

function renderNotificationsPanel() {
  const list = $('notificationsList');
  if (!list) return;
  const rows = [];
  convos.filter(convo => unreadCounts[convo.id]).forEach(convo => rows.push({
    title: convo.name,
    meta: `${unreadCounts[convo.id]} unread message${unreadCounts[convo.id] === 1 ? '' : 's'}`,
    run: () => openConvo(convo.id)
  }));
  channels.filter(channel => unreadChannelCounts[channel.id]).forEach(channel => rows.push({
    title: `#${channel.name}`,
    meta: `${unreadChannelCounts[channel.id]} unread message${unreadChannelCounts[channel.id] === 1 ? '' : 's'}`,
    run: () => openChannel(channel.id)
  }));
  list.innerHTML = '';
  if (!rows.length) {
    list.innerHTML = '<div class="friend-empty">You are all caught up.</div>';
    return;
  }
  rows.forEach(row => {
    const button = document.createElement('button');
    button.className = 'rc-result';
    button.innerHTML = `<div class="rc-result-main"><div class="rc-result-title">${escapeHtml(row.title)}</div><div class="rc-result-meta">${escapeHtml(row.meta)}</div></div>`;
    button.onclick = () => {
      closeNotificationsPanel();
      row.run();
    };
    list.appendChild(button);
  });
}

function openNotificationsPanel() {
  renderNotificationsPanel();
  $('notificationsOverlay')?.classList.add('open');
}

function closeNotificationsPanel() {
  $('notificationsOverlay')?.classList.remove('open');
}

function closeNotificationsPanelOutside(event) {
  if (event.target === $('notificationsOverlay')) closeNotificationsPanel();
}

function markAllNotificationsRead() {
  unreadCounts = {};
  unreadChannelCounts = {};
  renderSidebar();
  renderNotificationsPanel();
  showToast('Notifications marked as read.', 'success');
}

function openHelpAbout(section = 'help') {
  const content = {
    help: ['Help & About', 'Phoenix Messenger v1.2 connects friends and communities through DMs, servers, media sharing, and LiveKit voice. Use Report Bug if a control or workflow is not behaving correctly.'],
    privacy: ['Privacy', 'Phoenix Messenger uses Firebase Authentication and Firestore to provide your account and messages. Only share information you are comfortable storing in your Phoenix profile and conversations.'],
    terms: ['Terms', 'Use Phoenix Messenger respectfully. Do not abuse, harass, impersonate, or upload content you do not have permission to share.']
  }[section] || null;
  if ($('helpAboutTitle')) $('helpAboutTitle').textContent = content?.[0] || 'Help & About';
  if ($('helpAboutContent')) $('helpAboutContent').textContent = content?.[1] || '';
  $('helpAboutOverlay')?.classList.add('open');
}

function closeHelpAbout() {
  $('helpAboutOverlay')?.classList.remove('open');
}

function closeHelpAboutOutside(event) {
  if (event.target === $('helpAboutOverlay')) closeHelpAbout();
}

function openCallsPanel() {
  if (activeCall || liveKitContext === 'dm') {
    setCallUi($('callStatusText')?.textContent || 'Connected', callType);
    showToast('Current call is open.', 'info');
    return;
  }
  if (activeVoiceServerId && activeVoiceChannelId) {
    $('voiceChannelBar')?.classList.add('visible');
    showToast('Voice channel controls are open.', 'info');
    return;
  }
  showToast('Start a DM call or join a voice channel first.', 'info');
}

function openSavedMessages() {
  if (getActiveConversationKey()) openPinnedMessages();
  else showToast('Open a chat or channel to view pinned messages.', 'info');
}

function applyTheme(theme = currentTheme) {
  currentTheme = theme || 'dark';
  document.body.dataset.theme = currentTheme === 'dark' ? '' : currentTheme;
  localStorage.setItem('phoenix_theme', currentTheme);
}

function playNotificationSound() {
  if (!notificationSoundEnabled || currentProfile?.status === 'dnd') return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 660;
  gain.gain.value = 0.035;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
  setTimeout(() => ctx.close?.(), 240);
}

function sendDesktopNotification(title, body) {
  if (currentProfile?.status === 'dnd') return;
  if (document.visibilityState === 'visible') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/favicon.ico' });
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('This browser does not support notifications.', 'error');
    return;
  }
  const result = await Notification.requestPermission();
  showToast(result === 'granted' ? 'Browser notifications enabled.' : 'Notifications were not enabled.', result === 'granted' ? 'success' : 'error');
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
  const name = getProfileName();
  const photo = currentProfile?.avatarURL || currentProfile?.photoURL || currentUser?.photoURL || '';
  const col = getColor(name);
  if (avatar) {
    avatar.textContent = photo ? '' : getInitials(name);
    avatar.title = name;
    avatar.style.background = photo ? `center / cover url("${photo}")` : col.bg;
    avatar.style.color = col.fg;
    avatar.style.borderColor = col.fg;
  }
  const topAvatar = $('topProfileAvatar');
  if (topAvatar) {
    topAvatar.textContent = photo ? '' : getInitials(name);
    topAvatar.style.background = photo ? `center / cover url("${photo}")` : col.bg;
    topAvatar.style.color = col.fg;
  }
  if ($('topProfileName')) $('topProfileName').textContent = name;
  const topPresence = document.querySelector('.top-presence');
  if (topPresence) {
    topPresence.className = `top-presence ${getVisibleStatus(currentProfile, currentUser?.uid)}`;
    topPresence.title = getStatusLabel(currentProfile, currentUser?.uid);
  }
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

async function saveProfile(trigger = null) {
  if (!currentUser || !currentProfile) return;
  const loadingButton = setElementLoading(trigger, true, 'Saving...');
  const desired = cleanUsername($('profileUsernameInput')?.value);
  const displayName = String($('profileDisplayNameInput')?.value || '').trim();
  const bio = String($('profileBioInput')?.value || '').trim();
  const status = $('profileStatusInput')?.value || 'online';
  const customStatus = String($('profileCustomStatusInput')?.value || '').trim().slice(0, 80);
  const avatarURL = String($('profileAvatarUrlInput')?.value || '').trim();
  const bannerURL = String($('profileBannerUrlInput')?.value || '').trim();
  const pronouns = String($('profilePronounsInput')?.value || '').trim();
  const location = String($('profileLocationInput')?.value || '').trim();
  const website = String($('profileWebsiteInput')?.value || '').trim();
  const theme = $('profileThemeInput')?.value || 'dark';
  const sound = $('profileSoundInput')?.value || 'on';
  const dmNotifications = $('profileDmNotificationsInput')?.value || 'all';

  if (!desired) {
    setElementLoading(loadingButton, false);
    return;
  }
  const lower = desired.toLowerCase();
  try {
    if (lower !== currentProfile.usernameLower) {
      const existing = await getDocs(query(collection(db, 'users'), where('usernameLower', '==', lower), limit(1)));
      if (existing.docs.some(d => d.id !== currentUser.uid)) {
        showToast('That username is already taken.', 'error');
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
      customStatus,
      theme,
      notificationSound: sound,
      dmNotifications,
      lastSeen: serverTimestamp()
    });

    currentProfile = { ...currentProfile, username: desired, usernameLower: lower, displayName, bio, avatarURL, bannerURL, pronouns, location, website, status, customStatus, theme, notificationSound: sound, dmNotifications };
    userProfileCache.set(currentUser.uid, currentProfile);
    username = desired;
    localStorage.setItem('phoenix_username', desired);
    notificationSoundEnabled = sound !== 'off';
    localStorage.setItem('phoenix_sound_enabled', String(notificationSoundEnabled));
    applyTheme(theme);
    updateCurrentUserUi();
    closeProfileModal();
    showToast('Settings saved.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not save settings.'), 'error');
  } finally {
    setElementLoading(loadingButton, false);
  }
}

function openMessenger() {
  showLanding(false);
  showAuth(false);
  lockMessenger(false);
  setConnectionStatus(navigator.onLine ? 'Online' : 'Offline');
  applyTheme(currentProfile?.theme || currentTheme);
  notificationSoundEnabled = (currentProfile?.notificationSound || localStorage.getItem('phoenix_sound_enabled') || 'on') !== 'off';
  updateCurrentUserUi();
  renderSidebar();
  startPresence();
  ensureDefaultRooms().catch(error => reportSyncError('Default room setup', error, 'Could not prepare default rooms.'));
  startConversationSync();
  startRoomSync();
  startServerSync();
  startFriendsSync();
  listenForIncomingCalls();
  handleInviteFromUrl();
}

function clearMessenger() {
  cleanupCall(false);
  cancelVoiceMessageRecording();
  setConnectionStatus('Offline');
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
  userProfileUnsubs.forEach(unsub => unsub?.());
  userProfileUnsubs.clear();
  userProfileCache.clear();
  syncErrorTimes.clear();
  username = '';
  convosUnsub?.();
  roomsUnsub?.();
  serversUnsub?.();
  cleanupServerViewListeners();
  leaveVoiceChannel(false);
  friendsUnsub?.();
  incomingRequestsUnsub?.();
  outgoingRequestsUnsub?.();
  activeConvoUnsub?.();
  typingUnsub?.();
  callsUnsub?.();
  convosUnsub = null;
  roomsUnsub = null;
  serversUnsub = null;
  voiceMembersUnsub = null;
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

function cleanupServerViewListeners() {
  channelsUnsub?.();
  serverMembersUnsub?.();
  channelsUnsub = null;
  serverMembersUnsub = null;
  Object.values(voiceChannelMemberUnsubs).forEach(unsub => unsub?.());
  voiceChannelMemberUnsubs = {};
  voiceChannelMembers = {};
}

function startPresence() {
  if (!currentUser) return;
  const ref = doc(db, 'users', currentUser.uid);
  const chosenStatus = currentProfile?.status || 'online';
  updateDoc(ref, { status: chosenStatus, lastSeen: serverTimestamp() }).catch(console.error);
  clearInterval(presenceTimer);
  presenceTimer = setInterval(() => {
    const configured = currentProfile?.status || 'online';
    const inactive = Date.now() - lastActivityAt >= IDLE_AFTER_MS;
    const nextStatus = ['dnd', 'invisible'].includes(configured) ? configured : inactive ? 'idle' : 'online';
    autoIdle = nextStatus === 'idle' && configured !== 'idle';
    updateDoc(ref, { status: nextStatus, lastSeen: serverTimestamp() }).catch(console.error);
  }, 30000);
}

function noteUserActivity() {
  lastActivityAt = Date.now();
  if (!autoIdle || !currentUser || ['dnd', 'invisible'].includes(currentProfile?.status)) return;
  autoIdle = false;
  updateDoc(doc(db, 'users', currentUser.uid), { status: 'online', lastSeen: serverTimestamp() }).catch(console.error);
}

async function handleGoogleLogin() {
  setAuthError('');
  setButtonLoading('googleLoginBtn', true, 'Connecting...');
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    setAuthError(friendlyError(error, 'Google login failed.'));
  } finally {
    setButtonLoading('googleLoginBtn', false);
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
    setButtonLoading(createAccount ? 'emailSignupBtn' : 'emailLoginBtn', true, createAccount ? 'Creating...' : 'Logging in...');
    if (createAccount) await createUserWithEmailAndPassword(auth, email, password);
    else await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    setAuthError(friendlyError(error, 'Login failed.'));
  } finally {
    setButtonLoading(createAccount ? 'emailSignupBtn' : 'emailLoginBtn', false);
  }
}

async function signOutUser() {
  await leaveVoiceChannel(true);
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
    reportSyncError('Conversation sync', error, 'Could not load conversations.');
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
      if (item.type === 'dm') {
        if ((currentProfile?.dmNotifications || 'all') !== 'mute') {
          playNotificationSound();
          sendDesktopNotification(item.name || 'Phoenix Messenger', item.lastMessage || 'New message');
        }
      }
    }
    if (next) seenConvoUpdates[item.id] = next;
  });
}

async function ensureDefaultRooms() {
  if (!currentUser) return;
  const seedKey = `phoenix_default_rooms_seeded_${firebaseConfig.projectId}`;
  if (localStorage.getItem(seedKey) === 'true') return;
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
  }, { merge: true })));
  localStorage.setItem(seedKey, 'true');
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
  }, error => reportSyncError('Room sync', error, 'Could not load rooms.'));
}

function getActiveServer() {
  return servers.find(server => server.id === activeServerId) || null;
}

function getMyServerMember(serverId = activeServerId) {
  return serverMembers.find(member => member.uid === currentUser?.uid && member.serverId === serverId) || null;
}

function getServerRoleRank(role, server = getActiveServer()) {
  const hierarchy = server?.roleHierarchy || ['owner', 'admin', 'mod', 'member'];
  const index = hierarchy.indexOf(role || 'member');
  return index === -1 ? hierarchy.length : index;
}

function hasServerPermission(permission, serverId = activeServerId) {
  const role = getMyServerMember(serverId)?.role || 'member';
  const server = servers.find(item => item.id === serverId) || getActiveServer();
  const aliases = {
    create_channels: 'manage_channels',
    delete_messages: 'manage_messages'
  };
  const permissions = server?.rolePermissions?.[role] || ROLE_DEFAULTS[role]?.permissions || [];
  return permissions.includes('administrator') || permissions.includes(permission) || permissions.includes(aliases[permission]);
}

async function getCachedUserProfile(uid) {
  if (!uid) return null;
  if (userProfileCache.has(uid)) return userProfileCache.get(uid);
  const profileSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
  const profile = profileSnap?.exists() ? profileSnap.data() : null;
  userProfileCache.set(uid, profile);
  return profile;
}

function watchUserProfile(uid) {
  if (!uid || userProfileUnsubs.has(uid)) return;
  userProfileUnsubs.set(uid, onSnapshot(doc(db, 'users', uid), snapshot => {
    userProfileCache.set(uid, snapshot.exists() ? snapshot.data() : null);
    renderSidebar();
    renderFriendLists();
    if (activeMode === 'server') {
      serverMembers = serverMembers.map(member => member.uid === uid
        ? { ...member, profile: userProfileCache.get(uid) }
        : member);
      renderMemberPanel();
    }
  }, () => {}));
}

function getVisibleStatus(profile = {}, uid = '') {
  if (!profile) return 'offline';
  const configured = String(profile.status || 'offline').toLowerCase();
  if (configured === 'invisible') return uid === currentUser?.uid ? 'invisible' : 'offline';
  if (['online', 'idle', 'dnd'].includes(configured)) return configured;
  const lastSeen = profile.lastSeen?.toDate ? profile.lastSeen.toDate().getTime() : 0;
  return lastSeen && Date.now() - lastSeen < 120000 ? 'online' : 'offline';
}

function getStatusLabel(profile = {}, uid = '') {
  const status = getVisibleStatus(profile, uid);
  return { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', invisible: 'Invisible', offline: 'Offline' }[status] || 'Offline';
}

function renderStatusDot(profile = {}, uid = '') {
  const status = getVisibleStatus(profile, uid);
  return `<span class="status-dot ${status}" title="${getStatusLabel(profile, uid)}"></span>`;
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
  }, error => reportSyncError('Server sync', error, 'Could not load servers.'));
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
    button.oncontextmenu = event => {
      event.preventDefault();
      openServerActions(server.id);
    };
    button.style.background = server.iconUrl ? '' : col.bg;
    button.style.color = server.iconUrl ? 'transparent' : col.fg;
    button.innerHTML = server.iconUrl
      ? `<img src="${escapeHtml(server.iconUrl)}" alt="" loading="lazy" decoding="async" fetchpriority="low">`
      : getInitials(server.name || 'S');
    list.appendChild(button);
  });
}

function openHome() {
  stopTyping();
  typingUnsub?.();
  typingUnsub = null;
  activeMode = 'home';
  activeServerId = null;
  activeChannelId = null;
  activeChannel = null;
  channels = [];
  serverMembers = [];
  cleanupServerViewListeners();
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
  closeMobileSidebar();
}

function openDmList() {
  openHome();
  currentTab = 'dms';
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.textContent.trim() === 'DMs'));
  renderSidebar();
  closeMobileSidebar();
}

function openServersList() {
  if (servers.length) openServer(activeServerId && servers.some(server => server.id === activeServerId) ? activeServerId : servers[0].id);
  else openServerModal();
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
    const peerUid = c.type === 'dm' ? (c.members || []).find(uid => uid !== currentUser?.uid) : '';
    const peerProfile = peerUid ? userProfileCache.get(peerUid) : null;
    if (peerUid) watchUserProfile(peerUid);
    const div = document.createElement('div');
    div.className = 'convo-item' + (c.id === activeId ? ' active' : '');
    div.onclick = () => openConvo(c.id);
    div.innerHTML = `
      <div class="avatar-wrap">
        <div class="c-avatar" style="background:${col.bg};color:${col.fg};">${getInitials(c.name)}</div>
        ${c.type === 'dm' ? renderStatusDot(peerProfile, peerUid) : ''}
      </div>
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
  if ($('serverSettingsBtn')) $('serverSettingsBtn').style.display = ['owner', 'admin'].includes(getMyServerMember()?.role) ? '' : 'none';
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
    const joined = activeVoiceServerId === activeServerId && activeVoiceChannelId === channel.id;
    const members = voiceChannelMembers[channel.id] || [];
    div.className = `convo-item channel-item ${isVoice ? 'voice' : 'text'}${channel.id === activeChannelId ? ' active' : ''}`;
    div.onclick = () => openChannel(channel.id);
    div.oncontextmenu = event => {
      event.preventDefault();
      openChannelActions(channel.id);
    };
    div.innerHTML = `
      <div class="c-avatar">${isVoice ? '🎤' : '#'}</div>
      <div class="convo-info">
        <div class="convo-name">${escapeHtml(channel.name || 'channel')}</div>
        <div class="convo-preview">${escapeHtml(isVoice ? `${members.length} connected${joined ? ' · joined' : ''}` : channel.lastMessage || 'No messages yet')}</div>
      </div>
      ${unreadChannelCounts[channel.id] ? `<div class="unread-badge">${unreadChannelCounts[channel.id] > 99 ? '99+' : unreadChannelCounts[channel.id]}</div>` : ''}`;
    list.appendChild(div);
    if (isVoice && members.length) {
      const memberWrap = document.createElement('div');
      memberWrap.className = 'voice-members-list';
      memberWrap.innerHTML = members.map(member => `
        <div class="voice-member ${member.uid === currentUser?.uid ? 'self' : ''}">
          <span class="voice-member-dot ${member.speaking ? 'speaking' : ''}"></span>
          <span>${escapeHtml(member.username || 'User')}</span>
          ${member.muted ? '<span class="voice-flag">muted</span>' : ''}
        </div>`).join('');
      list.appendChild(memberWrap);
    }
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
  cancelVoiceMessageRecording();
  activeMode = 'home';
  activeServerId = null;
  activeChannelId = null;
  activeChannel = null;
  cleanupServerViewListeners();
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
  if ($('headerStatus')) {
    const peerUid = c.type === 'dm' ? (c.members || []).find(uid => uid !== currentUser?.uid) : '';
    const peerProfile = peerUid ? userProfileCache.get(peerUid) : null;
    $('headerStatus').textContent = c.type === 'dm' ? getStatusLabel(peerProfile, peerUid) : 'Room';
    if (peerUid && !userProfileCache.has(peerUid)) {
      getCachedUserProfile(peerUid).then(profile => {
        if (activeId === id && $('headerStatus')) $('headerStatus').textContent = getStatusLabel(profile, peerUid);
      });
    }
  }
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
  }, error => {
    reportSyncError('Message sync', error, 'Could not load messages.');
  });
}

function startChannelSync(serverId) {
  cleanupServerViewListeners();
  const channelQuery = query(collection(db, 'servers', serverId, 'channels'), orderBy('position', 'asc'));
  channelsUnsub = onSnapshot(channelQuery, snapshot => {
    const nextChannels = snapshot.docs.map(d => ({ id: d.id, serverId, ...d.data() }));
    updateUnreadFromChannels(nextChannels);
    channels = nextChannels;
    syncVoiceChannelMembers(serverId, channels.filter(channel => channel.type === 'voice'));
    renderSidebar();
    if (!activeChannelId) {
      const general = channels.find(channel => channel.name === 'general' && channel.type === 'text') || channels.find(channel => channel.type === 'text');
      if (general) openChannel(general.id);
    }
  }, error => {
    reportSyncError('Channel sync', error, 'Could not load server channels.');
  });

  serverMembersUnsub = onSnapshot(collection(db, 'servers', serverId, 'members'), snapshot => {
    serverMembers = snapshot.docs.map(d => ({ id: d.id, serverId, ...d.data() }));
    serverMembers.forEach(member => watchUserProfile(member.uid));
    renderMemberPanel();
    renderSidebar();
    Promise.all(serverMembers.map(async member => {
      const profile = await getCachedUserProfile(member.uid);
      return profile ? { ...member, profile } : member;
    })).then(enriched => {
      if (activeServerId !== serverId) return;
      serverMembers = enriched;
      renderMemberPanel();
    });
  }, error => {
    reportSyncError('Server member sync', error, 'Could not load server members.');
  });
}

function syncVoiceChannelMembers(serverId, voiceChannels) {
  const activeIds = new Set(voiceChannels.map(channel => channel.id));
  Object.keys(voiceChannelMemberUnsubs).forEach(channelId => {
    if (!activeIds.has(channelId)) {
      voiceChannelMemberUnsubs[channelId]?.();
      delete voiceChannelMemberUnsubs[channelId];
      delete voiceChannelMembers[channelId];
    }
  });

  voiceChannels.forEach(channel => {
    if (voiceChannelMemberUnsubs[channel.id]) return;
    voiceChannelMemberUnsubs[channel.id] = onSnapshot(
      collection(db, 'servers', serverId, 'voiceChannels', channel.id, 'members'),
      snapshot => {
        voiceChannelMembers[channel.id] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (activeVoiceServerId === serverId && activeVoiceChannelId === channel.id) {
          voiceMembers = voiceChannelMembers[channel.id];
          renderVoicePanel();
          syncVoicePeers();
        }
        renderSidebar();
      },
      error => reportSyncError('Voice member sync', error, 'Could not load voice channel members.')
    );
  });
}

function updateUnreadFromChannels(items) {
  items.forEach(item => {
    const next = getUpdateMillis(item.updatedAt || item.createdAt);
    const prev = seenChannelUpdates[item.id] || 0;
    if (prev && next > prev && item.id !== activeChannelId && item.lastMessage) {
      unreadChannelCounts[item.id] = (unreadChannelCounts[item.id] || 0) + 1;
      const preference = localStorage.getItem(`phoenix_server_notifications_${activeServerId}`) || 'mentions';
      const mentioned = String(item.lastMessage || '').toLowerCase().includes(`@${getProfileName().toLowerCase()}`);
      if (preference === 'all' || (preference === 'mentions' && mentioned)) {
        playNotificationSound();
        sendDesktopNotification(`#${item.name || 'channel'}`, item.lastMessage || 'New message');
      }
    }
    if (next) seenChannelUpdates[item.id] = next;
  });
}

function openServer(serverId) {
  stopTyping();
  cancelVoiceMessageRecording();
  typingUnsub?.();
  typingUnsub = null;
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
  const list = $('convoList');
  if (list) list.innerHTML = '<div class="server-loading">Loading channels...</div>';
  startChannelSync(serverId);
  showEmptyChat(getActiveServer()?.name || 'Server', 'Choose a text channel to start chatting.');
  closeMobileSidebar();
}

async function openChannel(channelId) {
  cancelVoiceMessageRecording();
  const channel = channels.find(item => item.id === channelId);
  if (!channel || !activeServerId) return;
  activeChannelId = channelId;
  activeChannel = channel;
  unreadChannelCounts[channelId] = 0;
  replyDraft = null;
  renderReplyDraft();
  renderSidebar();
  closeMobileSidebar();

  if (channel.type === 'voice') {
    activeConvoUnsub?.();
    activeConvoUnsub = null;
    typingUnsub?.();
    typingUnsub = null;
    renderTypingIndicator([]);
    showEmptyChat(channel.name || 'Voice channel', 'Joining voice channel...');
    $('inputArea')?.classList.remove('visible');
    await joinVoiceChannel(activeServerId, channel.id, channel.name);
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
  }, error => reportSyncError('Channel message sync', error, 'Could not load channel messages.'));
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
  }, error => reportSyncError('Typing sync', error, 'Could not load typing status.'));
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
  const canPin = activeMode !== 'server' || ['owner', 'admin', 'mod'].includes(getMyServerMember()?.role);
  const messageId = escapeHtml(message.id);
  return `
    <div class="msg-tools">
      <button type="button" class="msg-tool" data-message-action="reply" data-message-id="${messageId}">Reply</button>
      <button type="button" class="msg-tool" data-message-action="copy" data-message-id="${messageId}">Copy</button>
      ${canPin ? `<button type="button" class="msg-tool" data-message-action="pin" data-message-id="${messageId}">${message.pinned ? 'Unpin' : 'Pin'}</button>` : ''}
      ${mine ? `<button type="button" class="msg-tool" data-message-action="edit" data-message-id="${messageId}">Edit</button>` : ''}
      ${canDelete ? `<button type="button" class="msg-tool danger" data-message-action="delete" data-message-id="${messageId}">Delete</button>` : ''}
      <span class="quick-reactions">
        ${['👍', '❤️', '😂', '🔥', '👀'].map(emoji => `<button type="button" class="msg-tool reaction-tool" data-message-action="react" data-message-id="${messageId}" data-emoji="${emoji}" aria-label="React with ${emoji}">${emoji}</button>`).join('')}
      </span>
    </div>`;
}

function renderReactions(message) {
  const reactions = message.reactions || {};
  const entries = Object.entries(reactions).filter(([, users]) => Array.isArray(users) && users.length);
  if (!entries.length) return '';
  return `<div class="reactions">${entries.map(([emoji, users]) => {
    const active = users.includes(currentUser?.uid);
    return `<button type="button" class="reaction-pill ${active ? 'active' : ''}" data-message-action="react" data-message-id="${escapeHtml(message.id)}" data-emoji="${escapeHtml(emoji)}">${escapeHtml(emoji)} ${users.length}</button>`;
  }).join('')}</div>`;
}

async function handleMessageActionClick(event) {
  const button = event.target.closest?.('[data-message-action][data-message-id]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();

  const messageId = button.dataset.messageId;
  const action = button.dataset.messageAction;
  const message = getActiveMessage(messageId);
  if (!message) {
    showToast('That message is no longer available.', 'error');
    return;
  }

  button.disabled = true;
  try {
    if (action === 'reply') replyToMessage(messageId);
    else if (action === 'copy') await copyMessageText(messageId);
    else if (action === 'pin') await togglePinMessage(messageId);
    else if (action === 'edit') await editMessage(messageId);
    else if (action === 'delete') await deleteMessage(messageId);
    else if (action === 'react') await toggleReaction(messageId, button.dataset.emoji);
  } catch (error) {
    console.error('Message action failed:', error);
    showToast(friendlyError(error, 'Could not complete that message action.'), 'error');
  } finally {
    button.disabled = false;
  }
}

function renderAttachment(attachment, mine = false) {
  if (!attachment?.url) return '';
  const name = escapeHtml(attachment.name || 'Attachment');
  const url = escapeHtml(attachment.url);
  const size = attachment.size ? ` · ${formatFileSize(attachment.size)}` : '';
  if (String(attachment.type || '').startsWith('audio/')) {
    return `
      <div class="attachment-audio ${mine ? 'mine' : ''}">
        <audio controls preload="metadata" src="${url}"></audio>
        <span class="attachment-audio-meta">Voice message${size}</span>
      </div>`;
  }
  if (String(attachment.type || '').startsWith('image/')) {
    return `
      <a class="attachment-image-link" href="${url}" target="_blank" rel="noopener">
        <img class="attachment-image" src="${url}" alt="${name}" loading="lazy" decoding="async" fetchpriority="low">
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
    showToast('Could not start chat: user profile is missing an id.', 'error');
    return;
  }
  if (otherUid === currentUser.uid) {
    showToast('You cannot start a DM with yourself.', 'error');
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

async function startChat(trigger = null) {
  const recipientInput = $('recipientInput');
  const firstMessageInput = $('firstMessageInput');
  if (!recipientInput || !firstMessageInput || !currentUser) return;
  const name = recipientInput.value.trim();
  const msg = firstMessageInput.value.trim();
  if (!name) {
    recipientInput.focus();
    return;
  }

  const loadingButton = setElementLoading(trigger, true, 'Starting...');
  try {
    const other = await findUserByUsername(name);
    if (!other) {
      showToast('No user found with that username.', 'error');
      return;
    }
    await startDmWithUser(other, msg);
  } catch (error) {
    console.error('Start chat failed:', error);
    showToast(friendlyError(error, 'Could not start chat. Check Firestore rules.'), 'error');
  } finally {
    setElementLoading(loadingButton, false);
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
    <div class="avatar-wrap">
      <div class="c-avatar" style="${avatarStyle}">${avatarUrl ? '' : getInitials(name)}</div>
      ${renderStatusDot(user, getUserUid(user))}
    </div>
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
        <button class="btn-mini" onclick="openRichProfile('${escapeHtml(uid)}')">Profile</button>
        <button class="btn-mini primary" onclick="startDmFromSearch('${escapeHtml(uid)}')" ${self ? 'disabled' : ''}>Message</button>
        <button class="btn-mini" onclick="sendFriendRequest('${escapeHtml(uid)}', this)" ${self || alreadyFriend || pendingOutgoing ? 'disabled' : ''}>Add</button>
        <button class="btn-mini danger" onclick="blockUser('${escapeHtml(uid)}', this)" ${self ? 'disabled' : ''}>Block</button>
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
          <button class="btn-mini primary" onclick="acceptFriendRequest('${escapeHtml(req.id)}', this)">Accept</button>
          <button class="btn-mini" onclick="declineFriendRequest('${escapeHtml(req.id)}', this)">Decline</button>
          <button class="btn-mini danger" onclick="blockUser('${escapeHtml(req.fromUid)}', this)">Block</button>
        </div>
      </div>`).join('') : '<div class="friend-empty">No pending requests.</div>';
  }

  const outgoingEl = $('outgoingRequestsList');
  if (outgoingEl) {
    outgoingEl.innerHTML = outgoingRequests.length ? outgoingRequests.map(req => `
      <div class="user-card">
        ${getUserCardHtml({ username: req.toUsername, uid: req.toUid, photoURL: req.toPhotoURL }, 'Request pending')}
        <div class="user-card-actions">
          <button class="btn-mini danger" onclick="cancelFriendRequest('${escapeHtml(req.id)}', this)">Cancel</button>
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
      const profile = userProfileCache.get(otherUid) || {};
      if (otherUid) watchUserProfile(otherUid);
      return `
        <div class="user-card">
          ${getUserCardHtml({ ...profile, username: profile.username || otherName, uid: otherUid, photoURL: profile.photoURL || otherPhoto }, getStatusLabel(profile, otherUid))}
          <div class="user-card-actions">
            <button class="btn-mini" onclick="openRichProfile('${escapeHtml(otherUid)}')">Profile</button>
            <button class="btn-mini primary" onclick="startDmFromFriend('${escapeHtml(friend.id)}')">Message</button>
            <button class="btn-mini danger" onclick="removeFriend('${escapeHtml(friend.id)}', this)">Remove</button>
            <button class="btn-mini danger" onclick="blockUser('${escapeHtml(otherUid)}', this)">Block</button>
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
    error => reportSyncError('Incoming friend request sync', error, 'Could not load incoming friend requests.')
  );

  outgoingRequestsUnsub = onSnapshot(
    query(collection(db, 'friendRequests'), where('fromUid', '==', currentUser.uid)),
    snapshot => {
      outgoingRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(request => request.status === 'pending');
      renderFriendLists();
    },
    error => reportSyncError('Outgoing friend request sync', error, 'Could not load sent friend requests.')
  );

  friendsUnsub = onSnapshot(
    query(collection(db, 'friends'), where('users', 'array-contains', currentUser.uid)),
    snapshot => {
      friends = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFriendLists();
    },
    error => reportSyncError('Friends sync', error, 'Could not load friends.')
  );
}

async function sendFriendRequest(uid, trigger = null) {
  if (!currentUser || !uid || uid === currentUser.uid) return;
  const loadingButton = setElementLoading(trigger, true, 'Sending...');
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) {
      showToast('No user found.', 'error');
      return;
    }
    const user = { id: userSnap.id, uid: userSnap.data().uid || userSnap.id, ...userSnap.data() };
    if ((await getDoc(doc(db, 'friends', friendIdFor(currentUser.uid, uid)))).exists()) {
      showToast('You are already friends.', 'info');
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
    showToast('Friend request sent.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not send friend request.'), 'error');
  } finally {
    setElementLoading(loadingButton, false);
  }
}

async function acceptFriendRequest(requestId, trigger = null) {
  if (!currentUser || !requestId) return;
  const loadingButton = setElementLoading(trigger, true, 'Accepting...');
  try {
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
    showToast('Friend request accepted.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not accept friend request.'), 'error');
  } finally {
    setElementLoading(loadingButton, false);
  }
}

async function declineFriendRequest(requestId, trigger = null) {
  if (!requestId) return;
  const loadingButton = setElementLoading(trigger, true, 'Declining...');
  try {
    await updateDoc(doc(db, 'friendRequests', requestId), { status: 'declined', updatedAt: serverTimestamp() });
  } catch (error) {
    showToast(friendlyError(error, 'Could not decline friend request.'), 'error');
  } finally {
    setElementLoading(loadingButton, false);
  }
}

async function cancelFriendRequest(requestId, trigger = null) {
  if (!requestId) return;
  const loadingButton = setElementLoading(trigger, true, 'Canceling...');
  try {
    await updateDoc(doc(db, 'friendRequests', requestId), { status: 'cancelled', updatedAt: serverTimestamp() });
  } catch (error) {
    showToast(friendlyError(error, 'Could not cancel friend request.'), 'error');
  } finally {
    setElementLoading(loadingButton, false);
  }
}

async function removeFriend(friendId, trigger = null) {
  if (!friendId) return;
  const loadingButton = setElementLoading(trigger, true, 'Removing...');
  try {
    await deleteDoc(doc(db, 'friends', friendId));
    renderFriendLists();
    showToast('Friend removed.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not remove friend.'), 'error');
  } finally {
    setElementLoading(loadingButton, false);
  }
}

async function blockUser(uid, trigger = null) {
  if (!currentUser || !uid || uid === currentUser.uid) return;
  const loadingButton = setElementLoading(trigger, true, 'Blocking...');
  try {
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
    showToast('User blocked.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not block user.'), 'error');
  } finally {
    setElementLoading(loadingButton, false);
  }
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
  if (text.length > MAX_MESSAGE_LENGTH) {
    showToast(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters.`, 'error');
    return;
  }
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
  if (cleanText.length > MAX_MESSAGE_LENGTH) {
    showToast(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters.`, 'error');
    return;
  }
  const now = Date.now();
  recentMessageTimes = recentMessageTimes.filter(time => now - time < MESSAGE_WINDOW_MS);
  if (recentMessageTimes.length >= MESSAGE_WINDOW_LIMIT) {
    showToast('Slow down a little before sending more messages.', 'error');
    return;
  }
  recentMessageTimes.push(now);

  $('inputArea')?.classList.add('sending');
  $('inputArea')?.querySelector('.send-btn')?.classList.add('loading');
  try {
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
      lastMessage: cleanText || (attachment?.type?.startsWith('image/')
        ? 'Photo'
        : attachment?.type?.startsWith('audio/')
          ? 'Voice message'
          : `File: ${attachment?.name || 'Attachment'}`)
    });
    if (activeMode === 'server' && activeServerId) {
      await updateDoc(doc(db, 'servers', activeServerId), { updatedAt: serverTimestamp() }).catch(console.error);
    }
    if (cleanText.includes(`@${getProfileName()}`)) showToast('Mention sent.', 'success');
    replyDraft = null;
    renderReplyDraft();
  } catch (error) {
    console.error('Message send failed:', error);
    showToast(friendlyError(error, 'Message failed to send.'), 'error');
  } finally {
    $('inputArea')?.classList.remove('sending');
    $('inputArea')?.querySelector('.send-btn')?.classList.remove('loading');
  }
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
  try {
    await updateDoc(getActiveMessageDocRef(messageId), {
      text,
      editedAt: serverTimestamp()
    });
    await updateDoc(getActiveMessageParentRef(), {
      updatedAt: serverTimestamp(),
      lastMessage: text
    });
  } catch (error) {
    console.error('Edit failed:', error);
    showToast(friendlyError(error, 'Could not edit message.'), 'error');
  }
}

async function deleteMessage(messageId) {
  const message = getActiveMessage(messageId);
  if (!canDeleteActiveMessage(message)) return;
  if (!confirm('Delete this message?')) return;
  try {
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
    showToast('Message deleted.', 'success');
  } catch (error) {
    console.error('Delete failed:', error);
    showToast(friendlyError(error, 'Could not delete message.'), 'error');
  }
}

async function copyMessageText(messageId) {
  const message = getActiveMessage(messageId);
  if (!message?.text || message.deleted) {
    showToast('This message has no text to copy.', 'info');
    return;
  }
  await copyText(message.text, 'Message copied.');
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
  if (!message || message.deleted || !currentUser || !emoji) return;
  const reactions = { ...(message.reactions || {}) };
  const users = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
  reactions[emoji] = users.includes(currentUser.uid)
    ? users.filter(uid => uid !== currentUser.uid)
    : [...users, currentUser.uid];
  if (!reactions[emoji].length) delete reactions[emoji];
  try {
    await updateDoc(getActiveMessageDocRef(messageId), { reactions });
  } catch (error) {
    console.error('Reaction failed:', error);
    showToast(friendlyError(error, 'Could not update reaction.'), 'error');
  }
}

async function togglePinMessage(messageId) {
  const message = getActiveMessage(messageId);
  if (!message || message.deleted || !currentUser) return;
  if (activeMode === 'server' && !['owner', 'admin', 'mod'].includes(getMyServerMember()?.role)) {
    showToast('Only server owners, admins, and moderators can pin messages.', 'error');
    return;
  }
  try {
    await updateDoc(getActiveMessageDocRef(messageId), {
      pinned: !message.pinned,
      pinnedBy: !message.pinned ? currentUser.uid : null,
      pinnedAt: !message.pinned ? serverTimestamp() : null
    });
    showToast(message.pinned ? 'Message unpinned.' : 'Message pinned.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not update pinned message.'), 'error');
  }
}

async function sendAttachment(file) {
  if (!getActiveConversationKey() || !currentUser || !file) return;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    showToast('File is too large. Keep uploads under 10 MB.', 'error');
    return;
  }

  const toolbar = $('inputArea');
  toolbar?.classList.add('uploading');
  showToast('Uploading file...', 'info');
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
    showToast(`Upload failed: ${friendlyError(error, 'check Cloudinary settings')}`, 'error');
  } finally {
    toolbar?.classList.remove('uploading');
    if ($('fileInput')) $('fileInput').value = '';
    if ($('imageInput')) $('imageInput').value = '';
  }
}

function formatRecordingTime(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function getVoiceMessageMimeType() {
  if (!window.MediaRecorder) return '';
  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ].find(type => MediaRecorder.isTypeSupported?.(type)) || '';
}

function resetVoiceMessageRecordingUi() {
  clearInterval(voiceMessageTimer);
  voiceMessageTimer = null;
  voiceMessageStream?.getTracks().forEach(track => track.stop());
  voiceMessageStream = null;
  voiceMessageRecorder = null;
  voiceMessageChunks = [];
  voiceMessageStartedAt = 0;
  $('voiceRecordingBar')?.classList.remove('visible');
  $('voiceMessageBtn')?.classList.remove('recording');
  if ($('voiceRecordingTime')) $('voiceRecordingTime').textContent = '0:00';
}

async function startVoiceMessageRecording() {
  if (!getActiveConversationKey()) {
    showToast('Open a chat before recording a voice message.', 'error');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showToast('Voice messages are not supported in this browser.', 'error');
    return;
  }
  try {
    voiceMessageCancelled = false;
    voiceMessageChunks = [];
    voiceMessageStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getVoiceMessageMimeType();
    voiceMessageRecorder = mimeType
      ? new MediaRecorder(voiceMessageStream, { mimeType })
      : new MediaRecorder(voiceMessageStream);
    voiceMessageRecorder.ondataavailable = event => {
      if (event.data?.size) voiceMessageChunks.push(event.data);
    };
    voiceMessageRecorder.onstop = async () => {
      const cancelled = voiceMessageCancelled;
      const chunks = [...voiceMessageChunks];
      const type = voiceMessageRecorder?.mimeType || mimeType || 'audio/webm';
      resetVoiceMessageRecordingUi();
      if (cancelled || !chunks.length) return;
      const blob = new Blob(chunks, { type });
      const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `voice-message-${Date.now()}.${extension}`, { type });
      await sendAttachment(file);
    };
    voiceMessageRecorder.onerror = event => {
      console.error('Voice message recorder failed:', event.error);
      showToast(friendlyError(event.error, 'Voice message recording failed.'), 'error');
      resetVoiceMessageRecordingUi();
    };
    voiceMessageRecorder.start(250);
    voiceMessageStartedAt = Date.now();
    $('voiceRecordingBar')?.classList.add('visible');
    $('voiceMessageBtn')?.classList.add('recording');
    voiceMessageTimer = setInterval(() => {
      const elapsed = Date.now() - voiceMessageStartedAt;
      if ($('voiceRecordingTime')) $('voiceRecordingTime').textContent = formatRecordingTime(elapsed);
      if (elapsed >= MAX_VOICE_MESSAGE_MS) finishVoiceMessageRecording();
    }, 250);
  } catch (error) {
    console.error('Voice message permission failed:', error);
    resetVoiceMessageRecordingUi();
    showToast(friendlyError(error, 'Could not access your microphone.'), 'error');
  }
}

function finishVoiceMessageRecording() {
  if (!voiceMessageRecorder || voiceMessageRecorder.state === 'inactive') return;
  voiceMessageCancelled = false;
  voiceMessageRecorder.stop();
}

function cancelVoiceMessageRecording() {
  if (!voiceMessageRecorder || voiceMessageRecorder.state === 'inactive') {
    resetVoiceMessageRecordingUi();
    return;
  }
  voiceMessageCancelled = true;
  voiceMessageRecorder.stop();
}

function toggleVoiceMessageRecording() {
  if (voiceMessageRecorder && voiceMessageRecorder.state !== 'inactive') {
    finishVoiceMessageRecording();
    return;
  }
  startVoiceMessageRecording();
}

function chooseFile() {
  if (!getActiveConversationKey()) {
    showToast('Open a chat before sending a file.', 'error');
    return;
  }
  $('fileInput')?.click();
}

function chooseImage() {
  if (!getActiveConversationKey()) {
    showToast('Open a chat before sending a photo.', 'error');
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

async function getLiveKitToken(roomName, metadata = '') {
  let response;
  try {
    const idToken = await currentUser?.getIdToken?.();
    if (!idToken) throw new Error('You must be logged in to use voice.');
    response = await fetch('/api/livekit-token', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        room: roomName,
        name: getProfileName(),
        metadata
      })
    });
  } catch (error) {
    throw new Error(`Voice token request failed: ${error.message || 'network error'}`, { cause: error });
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Invalid voice token response.' };
  }
  if (!response.ok) {
    const missing = data.missing
      ? Object.entries(data.missing).filter(([, value]) => value).map(([key]) => key).join(', ')
      : '';
    throw new Error(data.error || (response.status === 404
      ? 'LiveKit token function was not found. Deploy the full Netlify project, including netlify/functions/livekit-token.js.'
      : `Could not create voice token. HTTP ${response.status}`) + (missing ? ` Missing: ${missing}` : ''));
  }
  if (!data.token || !data.url) throw new Error('LiveKit token response was missing url or token.');
  return data;
}

function setLiveKitStatus(status) {
  if (liveKitContext === 'server') setVoiceConnectionState(status);
  if (liveKitContext === 'dm') setCallUi(status, callType);
  if (/disconnected|failed|ended/i.test(status)) setConnectionStatus('Voice disconnected');
  else if (/reconnecting|connecting/i.test(status)) setConnectionStatus('Reconnecting');
  else if (/connected/i.test(status)) setConnectionStatus('Voice connected');
}

function getLiveKitParticipants() {
  if (!liveKitRoom) return [];
  const participants = [{
    uid: currentUser?.uid,
    username: getProfileName(),
    avatarURL: currentProfile?.avatarURL || currentProfile?.photoURL || currentUser?.photoURL || '',
    muted: voiceMuted,
    deafened: voiceDeafened,
    speaking: Boolean(liveKitRoom.localParticipant?.isSpeaking)
  }];
  for (const participant of liveKitRoom.remoteParticipants.values()) {
    participants.push({
      uid: participant.identity,
      username: participant.name || participant.identity || 'User',
      avatarURL: '',
      muted: !participant.isMicrophoneEnabled,
      deafened: false,
      speaking: Boolean(participant.isSpeaking)
    });
  }
  return participants;
}

function renderLiveKitParticipants() {
  if (liveKitContext !== 'server') return;
  voiceMembers = getLiveKitParticipants();
  if (activeVoiceChannelId) voiceChannelMembers[activeVoiceChannelId] = voiceMembers;
  renderVoicePanel();
  renderSidebar();
}

function updateScreenShareButtons() {
  const label = screenShareActive ? 'Stop' : 'Share';
  if ($('callBarShareBtn')) {
    $('callBarShareBtn').textContent = label;
    $('callBarShareBtn').classList.toggle('active', screenShareActive);
    $('callBarShareBtn').style.display = liveKitContext === 'dm' ? '' : 'none';
  }
  if ($('voiceShareBtn')) {
    $('voiceShareBtn').textContent = label;
    $('voiceShareBtn').classList.toggle('active', screenShareActive);
    $('voiceShareBtn').style.display = liveKitContext === 'server' ? '' : 'none';
  }
  if ($('stopScreenShareBtn')) $('stopScreenShareBtn').style.display = screenShareActive ? '' : 'none';
}

function renderScreenShareViewer() {
  const viewer = $('screenShareViewer');
  const stage = $('screenShareStage');
  if (!viewer || !stage) return;
  const shares = stage.querySelectorAll('[data-screen-share]');
  viewer.classList.toggle('visible', shares.length > 0);
  if ($('screenShareTitle')) {
    const remote = stage.querySelector('[data-screen-share="remote"]');
    $('screenShareTitle').textContent = remote?.dataset.participantName
      ? `${remote.dataset.participantName} is sharing`
      : screenShareActive ? 'You are sharing your screen' : 'Screen share';
  }
}

function cleanupScreenShareViewer() {
  document.querySelectorAll('[data-screen-share]').forEach(element => element.remove());
  screenShareActive = false;
  updateScreenShareButtons();
  renderScreenShareViewer();
}

function attachLiveKitTrack(track, participant, publication = null) {
  if (track.kind === Track.Kind.Audio) {
    const audio = track.attach();
    audio.autoplay = true;
    audio.playsInline = true;
    audio.dataset.livekitParticipant = participant.identity;
    audio.style.display = 'none';
    audio.muted = voiceDeafened;
    audio.volume = voiceDeafened ? 0 : 1;
    document.body.appendChild(audio);
    audio.play?.().catch(() => setLiveKitStatus('Tap to enable audio'));
    return;
  }
  if (track.kind === Track.Kind.Video && publication?.source === Track.Source.ScreenShare) {
    const video = track.attach();
    video.autoplay = true;
    video.playsInline = true;
    video.dataset.screenShare = 'remote';
    video.dataset.participantName = participant.name || participant.identity || 'Participant';
    $('screenShareStage')?.appendChild(video);
    video.play?.().catch(() => {});
    renderScreenShareViewer();
  }
}

function detachLiveKitTrack(track) {
  track.detach?.().forEach(element => element.remove());
}

function wireLiveKitRoom(room) {
  room
    .on(RoomEvent.Connected, () => setLiveKitStatus('Connected'))
    .on(RoomEvent.Reconnecting, () => setLiveKitStatus('Reconnecting'))
    .on(RoomEvent.SignalReconnecting, () => setLiveKitStatus('Reconnecting'))
    .on(RoomEvent.Reconnected, () => setLiveKitStatus('Connected'))
    .on(RoomEvent.ConnectionStateChanged, state => setLiveKitStatus(String(state || 'Connecting')))
    .on(RoomEvent.Disconnected, () => {
      if (!liveKitContext) return;
      setLiveKitStatus('Disconnected');
      showToast('Voice disconnected. Rejoin the channel or call to reconnect.', 'error');
    })
    .on(RoomEvent.ParticipantConnected, renderLiveKitParticipants)
    .on(RoomEvent.ParticipantDisconnected, renderLiveKitParticipants)
    .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      attachLiveKitTrack(track, participant, publication);
      renderLiveKitParticipants();
    })
    .on(RoomEvent.TrackUnsubscribed, track => {
      detachLiveKitTrack(track);
      renderScreenShareViewer();
      renderLiveKitParticipants();
    })
    .on(RoomEvent.LocalTrackUnpublished, publication => {
      if (publication.source !== Track.Source.ScreenShare) return;
      screenShareActive = false;
      document.querySelectorAll('[data-screen-share="local"]').forEach(element => element.remove());
      updateScreenShareButtons();
      renderScreenShareViewer();
    })
    .on(RoomEvent.TrackMuted, renderLiveKitParticipants)
    .on(RoomEvent.TrackUnmuted, renderLiveKitParticipants)
    .on(RoomEvent.ActiveSpeakersChanged, renderLiveKitParticipants)
    .on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (room.canPlaybackAudio === false) setLiveKitStatus('Tap to enable audio');
    });
}

async function connectLiveKitRoom({ roomName, context, metadata = '', audio = true, video = false }) {
  if (!currentUser) throw new Error('Log in before joining voice.');
  if (liveKitRoom && liveKitRoomName === roomName && liveKitContext === context) return liveKitRoom;
  await disconnectLiveKitRoom(false);

  liveKitRoomName = roomName;
  liveKitContext = context;
  setLiveKitStatus('Connecting');
  const { url, token } = await getLiveKitToken(roomName, metadata);
  const room = new Room({ adaptiveStream: true, dynacast: true });
  wireLiveKitRoom(room);
  liveKitRoom = room;
  await room.connect(url, token, { autoSubscribe: true });
  if (audio) await room.localParticipant.setMicrophoneEnabled(true);
  if (video) await room.localParticipant.setCameraEnabled(true);
  setLiveKitStatus('Connected');
  renderLiveKitParticipants();
  updateScreenShareButtons();
  return room;
}

async function toggleScreenShare() {
  if (!liveKitRoom) {
    showToast('Join a voice channel or start a call before sharing your screen.', 'error');
    return;
  }
  const enable = !screenShareActive;
  try {
    await liveKitRoom.localParticipant.setScreenShareEnabled(enable, { audio: false });
    screenShareActive = enable;
    document.querySelectorAll('[data-screen-share="local"]').forEach(element => element.remove());
    if (enable) {
      const publication = liveKitRoom.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const track = publication?.track;
      if (track) {
        const video = track.attach();
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.dataset.screenShare = 'local';
        $('screenShareStage')?.appendChild(video);
        video.play?.().catch(() => {});
      }
    }
    updateScreenShareButtons();
    renderScreenShareViewer();
    showToast(enable ? 'Screen sharing started.' : 'Screen sharing stopped.', 'success');
  } catch (error) {
    console.error('Screen share failed:', error);
    screenShareActive = false;
    updateScreenShareButtons();
    showToast(friendlyError(error, 'Could not share your screen. Check browser permissions.'), 'error');
  }
}

async function disconnectLiveKitRoom(clearUi = true) {
  clearTimeout(liveKitReconnectTimer);
  liveKitReconnectTimer = null;
  const room = liveKitRoom;
  liveKitRoom = null;
  liveKitRoomName = '';
  liveKitContext = '';
  room?.disconnect();
  document.querySelectorAll('[data-livekit-participant]').forEach(element => element.remove());
  cleanupScreenShareViewer();
  if (clearUi) {
    setCallUi('');
    $('voiceChannelBar')?.classList.remove('visible');
  }
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
  if ($('callBarShareBtn')) $('callBarShareBtn').style.display = inCall && liveKitContext === 'dm' ? '' : 'none';
  updateScreenShareButtons();
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

function cleanupCallAudioResources() {
  clearInterval(remoteAudioLevelTimer);
  remoteAudioLevelTimer = null;
  remoteAudioContext?.close?.();
  remoteAudioContext = null;
  ringtoneAudioContext?.close?.();
  ringtoneAudioContext = null;
  const audio = $('remoteAudio');
  if (audio) audio.srcObject = null;
}

function cleanupRingtoneAudioContext() {
  ringtoneAudioContext?.close?.();
  ringtoneAudioContext = null;
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
  if (/failed|blocked|denied|permission/i.test(message)) showToast(message, 'error');
  setTimeout(() => {
    if (!activeCall && !pendingIncomingCall) setCallUi('');
  }, 2200);
}

function toggleMobileSidebar() {
  $('appShell')?.classList.toggle('sidebar-open');
}

function closeMobileSidebar() {
  $('appShell')?.classList.remove('sidebar-open');
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

function voiceMemberRef(serverId = activeVoiceServerId, channelId = activeVoiceChannelId, uid = currentUser?.uid) {
  return doc(db, 'servers', serverId, 'voiceChannels', channelId, 'members', uid);
}

function voiceSignalsRef(serverId = activeVoiceServerId, channelId = activeVoiceChannelId) {
  return collection(db, 'servers', serverId, 'voiceChannels', channelId, 'signals');
}

function voicePairId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

function setVoiceConnectionState(state) {
  voiceConnectionState = state;
  if (/disconnected|failed|ended/i.test(state)) setConnectionStatus('Voice disconnected');
  else if (/reconnecting|connecting/i.test(state)) setConnectionStatus('Reconnecting');
  else if (/connected/i.test(state)) setConnectionStatus('Voice connected');
  renderVoicePanel();
}

function renderVoicePanel() {
  const visible = Boolean(activeVoiceServerId && activeVoiceChannelId);
  $('voiceChannelBar')?.classList.toggle('visible', visible);
  if (!visible) return;
  if ($('voiceChannelTitle')) $('voiceChannelTitle').textContent = activeVoiceChannelName || 'Voice channel';
  if ($('voiceChannelStatus')) {
    const connectedCount = voiceMembers.length || (voiceChannelMembers[activeVoiceChannelId] || []).length || 1;
    $('voiceChannelStatus').textContent = `${voiceConnectionState || 'Connected'} · ${connectedCount} connected`;
  }
  $('voiceMuteBtn')?.classList.toggle('active', voiceMuted);
  $('voiceDeafenBtn')?.classList.toggle('active', voiceDeafened);
  updateScreenShareButtons();
}

async function legacyJoinVoiceChannel(serverId, channelId, channelName = 'Voice channel') {
  if (!currentUser) return;
  if (activeVoiceServerId === serverId && activeVoiceChannelId === channelId) {
    renderVoicePanel();
    return;
  }

  await leaveVoiceChannel(true);
  activeVoiceServerId = serverId;
  activeVoiceChannelId = channelId;
  activeVoiceChannelName = channelName;
  voiceMuted = false;
  voiceDeafened = false;
  setVoiceConnectionState('Connecting');

  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('microphone access needs HTTPS or localhost');
    voiceLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    voiceLocalStream.getAudioTracks().forEach(track => {
      track.enabled = true;
    });
  } catch (error) {
    console.error('Voice join failed:', error);
    setVoiceConnectionState('Failed');
    showToast(`Could not join voice: ${friendlyError(error, 'microphone permission denied')}`, 'error');
    await leaveVoiceChannel(false);
    return;
  }

  await setDoc(voiceMemberRef(), {
    uid: currentUser.uid,
    username: getProfileName(),
    avatarURL: currentProfile?.avatarURL || currentProfile?.photoURL || currentUser.photoURL || '',
    muted: false,
    deafened: false,
    speaking: false,
    joinedAt: serverTimestamp(),
    lastSeen: serverTimestamp()
  }, { merge: true });

  voiceMembersUnsub?.();
  voiceMembersUnsub = onSnapshot(collection(db, 'servers', serverId, 'voiceChannels', channelId, 'members'), snapshot => {
    voiceMembers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    voiceChannelMembers[channelId] = voiceMembers;
    renderVoicePanel();
    renderSidebar();
    syncVoicePeers();
  }, error => {
    reportSyncError('Active voice member sync', error, 'Voice participant list is reconnecting.');
    setVoiceConnectionState('Reconnecting');
  });

  listenToVoiceSignals(serverId, channelId);
  startVoicePresence();
  startVoiceSpeakingMeter();
  renderVoicePanel();
}

function startVoicePresence() {
  clearInterval(voicePresenceTimer);
  voicePresenceTimer = setInterval(() => {
    if (!activeVoiceServerId || !activeVoiceChannelId || !currentUser) return;
    setDoc(voiceMemberRef(), { lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
  }, 15000);
}

function startVoiceSpeakingMeter() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext || !voiceLocalStream?.getAudioTracks().length) return;
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(voiceLocalStream);
  const analyser = ctx.createAnalyser();
  const samples = new Uint8Array(analyser.fftSize);
  source.connect(analyser);
  let lastSpeaking = false;
  const timer = setInterval(() => {
    if (!activeVoiceServerId || !activeVoiceChannelId || !voiceLocalStream) {
      clearInterval(timer);
      ctx.close?.();
      return;
    }
    analyser.getByteTimeDomainData(samples);
    let total = 0;
    for (const sample of samples) total += Math.abs(sample - 128);
    const speaking = !voiceMuted && total / samples.length > 1.8;
    if (speaking !== lastSpeaking) {
      lastSpeaking = speaking;
      setDoc(voiceMemberRef(), { speaking, lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
    }
  }, 600);
}

function createVoicePeer(peerUid) {
  const pc = new RTCPeerConnection(rtcConfig);
  const remote = new MediaStream();
  const audio = document.createElement('audio');
  audio.autoplay = true;
  audio.playsInline = true;
  audio.dataset.voicePeer = peerUid;
  audio.style.display = 'none';
  document.body.appendChild(audio);

  voiceLocalStream?.getTracks().forEach(track => pc.addTrack(track, voiceLocalStream));
  pc.onicecandidate = event => {
    if (!event.candidate || !currentUser || !activeVoiceServerId || !activeVoiceChannelId) return;
    addDoc(voiceSignalsRef(), {
      pairId: voicePairId(currentUser.uid, peerUid),
      type: 'ice-candidate',
      data: serializeIceCandidate(event.candidate),
      senderId: currentUser.uid,
      receiverId: peerUid,
      createdAt: serverTimestamp()
    }).catch(console.error);
  };
  pc.ontrack = event => {
    if (event.track.kind !== 'audio') return;
    if (!remote.getTracks().some(track => track.id === event.track.id)) remote.addTrack(event.track);
    audio.srcObject = remote;
    audio.muted = voiceDeafened;
    audio.volume = voiceDeafened ? 0 : 1;
    audio.play().catch(error => {
      console.warn('Voice audio playback blocked:', error);
      setVoiceConnectionState('Tap voice bar to enable audio');
    });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') setVoiceConnectionState('Connected');
    if (pc.connectionState === 'connecting') setVoiceConnectionState('Connecting');
    if (pc.connectionState === 'disconnected') setVoiceConnectionState('Reconnecting');
    if (['failed', 'closed'].includes(pc.connectionState)) setVoiceConnectionState(pc.connectionState === 'failed' ? 'Failed' : 'Disconnected');
  };
  const peerState = { pc, audio, remote, pendingIce: [] };
  voicePeerConnections.set(peerUid, peerState);
  return peerState;
}

async function ensureVoicePeer(peerUid, shouldOffer = false) {
  if (!peerUid || peerUid === currentUser?.uid || !voiceLocalStream) return;
  const peerState = voicePeerConnections.get(peerUid) || createVoicePeer(peerUid);
  if (!shouldOffer || peerState.offered) return;
  peerState.offered = true;
  const offer = await peerState.pc.createOffer();
  await peerState.pc.setLocalDescription(offer);
  await addDoc(voiceSignalsRef(), {
    pairId: voicePairId(currentUser.uid, peerUid),
    type: 'offer',
    data: serializeSessionDescription(offer),
    senderId: currentUser.uid,
    receiverId: peerUid,
    createdAt: serverTimestamp()
  });
}

function syncVoicePeers() {
  if (!currentUser || !activeVoiceServerId || !activeVoiceChannelId || !voiceLocalStream) return;
  const activePeerIds = new Set(voiceMembers.map(member => member.uid).filter(uid => uid && uid !== currentUser.uid));
  for (const peerUid of activePeerIds) {
    ensureVoicePeer(peerUid, currentUser.uid < peerUid).catch(error => {
      console.error('Voice peer setup failed:', error);
      setVoiceConnectionState('Failed');
    });
  }
  for (const [peerUid, peerState] of voicePeerConnections) {
    if (activePeerIds.has(peerUid)) continue;
    peerState.pc.close();
    peerState.audio.remove();
    voicePeerConnections.delete(peerUid);
  }
  if (!activePeerIds.size) setVoiceConnectionState('Connected');
}

function listenToVoiceSignals(serverId, channelId) {
  voiceSignalsUnsub?.();
  voiceSeenSignalIds = new Set();
  const q = query(collection(db, 'servers', serverId, 'voiceChannels', channelId, 'signals'), where('receiverId', '==', currentUser.uid));
  voiceSignalsUnsub = onSnapshot(q, async snapshot => {
    for (const change of snapshot.docChanges()) {
      if (change.type !== 'added' || voiceSeenSignalIds.has(change.doc.id)) continue;
      voiceSeenSignalIds.add(change.doc.id);
      const signal = change.doc.data();
      if (!signal.senderId || signal.senderId === currentUser.uid) continue;
      try {
        const peerState = voicePeerConnections.get(signal.senderId) || createVoicePeer(signal.senderId);
        if (signal.type === 'offer') {
          await peerState.pc.setRemoteDescription(new RTCSessionDescription(signal.data));
          for (const candidate of peerState.pendingIce) await peerState.pc.addIceCandidate(candidate);
          peerState.pendingIce = [];
          const answer = await peerState.pc.createAnswer();
          await peerState.pc.setLocalDescription(answer);
          await addDoc(voiceSignalsRef(serverId, channelId), {
            pairId: signal.pairId || voicePairId(currentUser.uid, signal.senderId),
            type: 'answer',
            data: serializeSessionDescription(answer),
            senderId: currentUser.uid,
            receiverId: signal.senderId,
            createdAt: serverTimestamp()
          });
        }
        if (signal.type === 'answer') {
          await peerState.pc.setRemoteDescription(new RTCSessionDescription(signal.data));
          for (const candidate of peerState.pendingIce) await peerState.pc.addIceCandidate(candidate);
          peerState.pendingIce = [];
        }
        if (signal.type === 'ice-candidate') {
          const candidate = new RTCIceCandidate(signal.data);
          if (peerState.pc.remoteDescription) await peerState.pc.addIceCandidate(candidate);
          else peerState.pendingIce.push(candidate);
        }
      } catch (error) {
        console.error('Voice signal failed:', error);
        setVoiceConnectionState('Failed');
      }
    }
  }, error => {
    console.error('Voice signal listener failed:', error);
    setVoiceConnectionState('Reconnecting');
  });
}

async function legacyToggleVoiceMute() {
  voiceMuted = !voiceMuted;
  voiceLocalStream?.getAudioTracks().forEach(track => {
    track.enabled = !voiceMuted;
  });
  if (activeVoiceServerId && activeVoiceChannelId) {
    await setDoc(voiceMemberRef(), { muted: voiceMuted, speaking: false, lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
  }
  renderVoicePanel();
}

async function legacyToggleVoiceDeafen() {
  voiceDeafened = !voiceDeafened;
  for (const peerState of voicePeerConnections.values()) {
    peerState.audio.muted = voiceDeafened;
    peerState.audio.volume = voiceDeafened ? 0 : 1;
  }
  if (activeVoiceServerId && activeVoiceChannelId) {
    await setDoc(voiceMemberRef(), { deafened: voiceDeafened, lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
  }
  renderVoicePanel();
}

async function legacyLeaveVoiceChannel(removePresence = true) {
  const serverId = activeVoiceServerId;
  const channelId = activeVoiceChannelId;
  clearInterval(voicePresenceTimer);
  voicePresenceTimer = null;
  voiceMembersUnsub?.();
  voiceSignalsUnsub?.();
  voiceMembersUnsub = null;
  voiceSignalsUnsub = null;
  for (const peerState of voicePeerConnections.values()) {
    peerState.pc.close();
    peerState.audio.remove();
  }
  voicePeerConnections.clear();
  voiceSeenSignalIds = new Set();
  voiceLocalStream?.getTracks().forEach(track => track.stop());
  voiceLocalStream = null;
  activeVoiceServerId = null;
  activeVoiceChannelId = null;
  activeVoiceChannelName = '';
  voiceMembers = [];
  voiceMuted = false;
  voiceDeafened = false;
  voiceConnectionState = '';
  $('voiceChannelBar')?.classList.remove('visible');
  if (removePresence && serverId && channelId && currentUser) {
    await deleteDoc(doc(db, 'servers', serverId, 'voiceChannels', channelId, 'members', currentUser.uid)).catch(console.error);
  }
  renderSidebar();
}

async function joinVoiceChannel(serverId, channelId, channelName = 'Voice channel') {
  if (!currentUser) return;
  if (activeVoiceServerId === serverId && activeVoiceChannelId === channelId && liveKitContext === 'server') {
    renderVoicePanel();
    return;
  }

  await leaveVoiceChannel(true);
  activeVoiceServerId = serverId;
  activeVoiceChannelId = channelId;
  activeVoiceChannelName = channelName;
  voiceMuted = false;
  voiceDeafened = false;
  setVoiceConnectionState('Connecting');

  try {
    const roomName = `server_${serverId}_voice_${channelId}`;
    await setDoc(voiceMemberRef(), {
      uid: currentUser.uid,
      username: getProfileName(),
      avatarURL: currentProfile?.avatarURL || currentProfile?.photoURL || currentUser.photoURL || '',
      muted: false,
      deafened: false,
      speaking: false,
      joinedAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      provider: 'livekit'
    }, { merge: true });

    voiceMembersUnsub?.();
    voiceMembersUnsub = onSnapshot(collection(db, 'servers', serverId, 'voiceChannels', channelId, 'members'), snapshot => {
      voiceMembers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      voiceChannelMembers[channelId] = voiceMembers;
      renderVoicePanel();
      renderSidebar();
    }, error => {
      reportSyncError('Active voice member sync', error, 'Voice participant list is reconnecting.');
      setVoiceConnectionState('Reconnecting');
    });

    await connectLiveKitRoom({
      roomName,
      context: 'server',
      metadata: JSON.stringify({ type: 'server', serverId, channelId }),
      audio: true,
      video: false
    });
    startVoicePresence();
    renderVoicePanel();
  } catch (error) {
    console.error('LiveKit voice join failed:', error);
    setVoiceConnectionState('Failed');
    showToast(`Could not join voice: ${friendlyError(error, 'check LiveKit settings')}`, 'error');
    await leaveVoiceChannel(true);
  }
}

async function toggleVoiceMute() {
  voiceMuted = !voiceMuted;
  await liveKitRoom?.localParticipant?.setMicrophoneEnabled(!voiceMuted).catch(console.error);
  if (activeVoiceServerId && activeVoiceChannelId) {
    await setDoc(voiceMemberRef(), { muted: voiceMuted, speaking: false, lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
  }
  renderVoicePanel();
}

async function toggleVoiceDeafen() {
  voiceDeafened = !voiceDeafened;
  document.querySelectorAll('[data-livekit-participant]').forEach(audio => {
    audio.muted = voiceDeafened;
    audio.volume = voiceDeafened ? 0 : 1;
  });
  if (activeVoiceServerId && activeVoiceChannelId) {
    await setDoc(voiceMemberRef(), { deafened: voiceDeafened, lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
  }
  renderVoicePanel();
}

async function leaveVoiceChannel(removePresence = true) {
  const serverId = activeVoiceServerId;
  const channelId = activeVoiceChannelId;
  clearInterval(voicePresenceTimer);
  voicePresenceTimer = null;
  voiceMembersUnsub?.();
  voiceMembersUnsub = null;
  await disconnectLiveKitRoom(false);
  activeVoiceServerId = null;
  activeVoiceChannelId = null;
  activeVoiceChannelName = '';
  voiceMembers = [];
  voiceMuted = false;
  voiceDeafened = false;
  voiceConnectionState = '';
  $('voiceChannelBar')?.classList.remove('visible');
  if (removePresence && serverId && channelId && currentUser) {
    await deleteDoc(doc(db, 'servers', serverId, 'voiceChannels', channelId, 'members', currentUser.uid)).catch(console.error);
  }
  renderSidebar();
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
  }, error => reportSyncError('Call status sync', error, 'Call status could not be updated.'));
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
  }, error => reportSyncError('Call signal sync', error, 'Call signaling was interrupted.'));
}

async function legacyStartCall(type = 'voice') {
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
    if (pendingIncomingCall && !snapshot.docs.some(callDoc => callDoc.id === pendingIncomingCall.id)) {
      stopRingtone();
      cleanupRingtoneAudioContext();
      setIncomingPopup(null);
    }
    if (activeCall || pendingIncomingCall) return;
    const first = snapshot.docs[0];
    if (first) setIncomingPopup({ id: first.id, ...first.data() });
  }, error => {
    reportSyncError('Incoming call sync', error, 'Could not listen for incoming calls.');
  });
}

async function legacyAcceptIncomingCall() {
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
    showToast(`Could not accept call: ${friendlyError(error, 'check microphone permissions and Firestore rules.')}`, 'error');
    endCurrentCall();
  }
}

async function legacyDeclineIncomingCall() {
  if (!pendingIncomingCall) return;
  ringtoneAudioContext?.resume?.();
  await updateDoc(doc(db, 'calls', pendingIncomingCall.id), {
    status: 'declined',
    endedAt: serverTimestamp()
  }).catch(console.error);
  stopRingtone();
  setIncomingPopup(null);
}

function legacyToggleMute() {
  const audioTrack = localStream?.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;
  if ($('muteCallBtn')) $('muteCallBtn').style.opacity = audioTrack.enabled ? '1' : '0.45';
  if ($('callBarMuteBtn')) $('callBarMuteBtn').style.opacity = audioTrack.enabled ? '1' : '0.45';
}

function legacyToggleCamera() {
  const videoTrack = localStream?.getVideoTracks()[0];
  if (!videoTrack) return;
  videoTrack.enabled = !videoTrack.enabled;
  if ($('cameraCallBtn')) $('cameraCallBtn').style.opacity = videoTrack.enabled ? '1' : '0.45';
  if ($('callBarCameraBtn')) $('callBarCameraBtn').style.opacity = videoTrack.enabled ? '1' : '0.45';
}

async function legacyEndCurrentCall() {
  const callId = activeCall?.id || pendingIncomingCall?.id;
  if (callId) {
    await updateDoc(doc(db, 'calls', callId), {
      status: 'ended',
      endedAt: serverTimestamp()
    }).catch(console.error);
  }
  cleanupCall(false);
}

function legacyCleanupCall(showEnded = false) {
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

function dmLiveKitRoomName(callId) {
  return `dm_call_${callId}`;
}

async function startCall(type = 'voice') {
  if (!currentUser) {
    flashCallStatus('Log in before calling', type);
    return;
  }
  if (activeCall || liveKitContext === 'dm') {
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
  const callRef = doc(collection(db, 'calls'));
  const roomName = dmLiveKitRoomName(callRef.id);
  activeCall = {
    id: callRef.id,
    callerId: currentUser.uid,
    callerName: getProfileName(),
    receiverId: peer.receiverId,
    receiverName: peer.receiverName,
    type,
    status: 'ringing',
    roomName
  };

  try {
    await setDoc(callRef, {
      callerId: currentUser.uid,
      callerName: getProfileName(),
      receiverId: peer.receiverId,
      receiverName: peer.receiverName,
      type,
      status: 'ringing',
      provider: 'livekit',
      roomName,
      createdAt: serverTimestamp(),
      endedAt: null
    });
    listenToCall(callRef.id);
    await connectLiveKitRoom({
      roomName,
      context: 'dm',
      metadata: JSON.stringify({ type: 'dm', callId: callRef.id }),
      audio: true,
      video: type === 'video'
    });
    setCallUi('Calling...', type);
    startRingtone('outgoing');
    setTimeout(() => {
      if (activeCall?.id === callRef.id && activeCall.status === 'ringing') endCurrentCall();
    }, 30000);
  } catch (error) {
    console.error('LiveKit call failed:', error);
    if (activeCall?.id) {
      await updateDoc(doc(db, 'calls', activeCall.id), {
        status: 'ended',
        endedAt: serverTimestamp()
      }).catch(console.error);
    }
    cleanupCall(false);
    flashCallStatus(`Call failed: ${friendlyError(error, 'check LiveKit settings')}`, type);
  }
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
    await updateDoc(doc(db, 'calls', call.id), { status: 'accepted', provider: 'livekit' });
    listenToCall(call.id);
    await connectLiveKitRoom({
      roomName: call.roomName || dmLiveKitRoomName(call.id),
      context: 'dm',
      metadata: JSON.stringify({ type: 'dm', callId: call.id }),
      audio: true,
      video: callType === 'video'
    });
    setCallUi('Connected', callType);
  } catch (error) {
    console.error('LiveKit accept failed:', error);
    showToast(`Could not accept call: ${friendlyError(error, 'check LiveKit settings')}`, 'error');
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
  cleanupRingtoneAudioContext();
  setIncomingPopup(null);
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

async function cleanupCall(showEnded = false) {
  stopRingtone();
  cleanupCallAudioResources();
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
  await disconnectLiveKitRoom(false);
  activeCall = null;
  pendingIncomingCall = null;
  callRole = null;
  seenSignalIds = new Set();
  pendingIceCandidates = [];
  setIncomingPopup(null);
  if (showEnded) setTimeout(() => setCallUi(''), 1800);
  else setCallUi('');
}

async function toggleMute() {
  if (liveKitContext === 'dm' && liveKitRoom) {
    const enabled = !liveKitRoom.localParticipant.isMicrophoneEnabled;
    await liveKitRoom.localParticipant.setMicrophoneEnabled(enabled).catch(console.error);
    if ($('muteCallBtn')) $('muteCallBtn').style.opacity = enabled ? '1' : '0.45';
    if ($('callBarMuteBtn')) $('callBarMuteBtn').style.opacity = enabled ? '1' : '0.45';
    return;
  }
  const audioTrack = localStream?.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;
  if ($('muteCallBtn')) $('muteCallBtn').style.opacity = audioTrack.enabled ? '1' : '0.45';
  if ($('callBarMuteBtn')) $('callBarMuteBtn').style.opacity = audioTrack.enabled ? '1' : '0.45';
}

async function toggleCamera() {
  if (liveKitContext === 'dm' && liveKitRoom) {
    const enabled = !liveKitRoom.localParticipant.isCameraEnabled;
    await liveKitRoom.localParticipant.setCameraEnabled(enabled).catch(console.error);
    if ($('cameraCallBtn')) $('cameraCallBtn').style.opacity = enabled ? '1' : '0.45';
    if ($('callBarCameraBtn')) $('callBarCameraBtn').style.opacity = enabled ? '1' : '0.45';
    return;
  }
  const videoTrack = localStream?.getVideoTracks()[0];
  if (!videoTrack) return;
  videoTrack.enabled = !videoTrack.enabled;
  if ($('cameraCallBtn')) $('cameraCallBtn').style.opacity = videoTrack.enabled ? '1' : '0.45';
  if ($('callBarCameraBtn')) $('callBarCameraBtn').style.opacity = videoTrack.enabled ? '1' : '0.45';
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
  if ($('profileCustomStatusInput')) $('profileCustomStatusInput').value = currentProfile.customStatus || '';
  if ($('profileThemeInput')) $('profileThemeInput').value = currentProfile.theme || currentTheme || 'dark';
  if ($('profileSoundInput')) $('profileSoundInput').value = notificationSoundEnabled ? 'on' : 'off';
  if ($('profileDmNotificationsInput')) $('profileDmNotificationsInput').value = currentProfile.dmNotifications || 'all';
  renderProfilePreview();
  switchSettingsSection('account');
  $('profileModalOverlay')?.classList.add('open');
}

function closeProfileModal() {
  $('profileModalOverlay')?.classList.remove('open');
}

function closeProfileModalOutside(e) {
  if (e.target === $('profileModalOverlay')) closeProfileModal();
}

function formatDateValue(value) {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
  return date ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown';
}

async function openRichProfile(uid) {
  if (!uid) return;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return;
    const profile = { uid: snap.id, ...snap.data() };
    const name = profile.displayName || profile.username || 'Phoenix user';
    const avatar = profile.avatarURL || profile.photoURL || '';
    const banner = profile.bannerURL || '';
    const col = getColor(name);
    const friend = friends.find(item => (item.users || []).includes(uid));
    const otherFriendsSnap = await getDocs(query(collection(db, 'friends'), where('users', 'array-contains', uid)));
    const myFriendIds = new Set(friends.flatMap(item => item.users || []).filter(friendUid => friendUid !== currentUser?.uid));
    const otherFriendIds = new Set(otherFriendsSnap.docs.flatMap(item => item.data().users || []).filter(friendUid => friendUid !== uid));
    const mutualFriends = [...myFriendIds].filter(friendUid => otherFriendIds.has(friendUid)).length;
    const mutualServers = servers.filter(server => (server.memberIds || []).includes(uid)).length;
    const card = $('richProfileCard');
    if (!card) return;
    card.innerHTML = `
      <div class="profile-card-banner" style="${banner ? `background:center / cover url('${escapeHtml(banner)}')` : `background:linear-gradient(135deg, ${col.bg}, var(--bg4))`}"></div>
      <div class="profile-card-body">
        <div class="avatar-wrap profile-card-avatar-wrap">
          <div class="profile-card-avatar" style="${avatar ? `background:center / cover url('${escapeHtml(avatar)}');color:transparent;` : `background:${col.bg};color:${col.fg};`}">${avatar ? '' : getInitials(name)}</div>
          ${renderStatusDot(profile, uid)}
        </div>
        <div class="profile-card-name">${escapeHtml(name)}</div>
        <div class="profile-card-status">${escapeHtml(profile.customStatus || getStatusLabel(profile, uid))}</div>
        <div class="profile-card-about">${escapeHtml(profile.bio || 'No About Me added yet.')}</div>
        <div class="profile-card-stats">
          <div class="profile-stat"><div class="profile-stat-label">Joined Phoenix</div><div class="profile-stat-value">${formatDateValue(profile.createdAt)}</div></div>
          <div class="profile-stat"><div class="profile-stat-label">Friends since</div><div class="profile-stat-value">${friend ? formatDateValue(friend.createdAt) : 'Not friends'}</div></div>
          <div class="profile-stat"><div class="profile-stat-label">Mutual friends</div><div class="profile-stat-value">${mutualFriends}</div></div>
          <div class="profile-stat"><div class="profile-stat-label">Mutual servers</div><div class="profile-stat-value">${mutualServers}</div></div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" onclick="copyText('${escapeHtml(profile.username || name)}','Username copied.')">Copy Username</button>
          ${uid === currentUser?.uid
            ? '<button class="btn-primary" onclick="closeRichProfile();openProfileModal()">Edit Profile</button>'
            : `<button class="btn-primary" onclick="closeRichProfile();startDmFromSearch('${escapeHtml(uid)}')">Message</button>`}
        </div>
      </div>`;
    $('richProfileOverlay')?.classList.add('open');
  } catch (error) {
    showToast(friendlyError(error, 'Could not load profile.'), 'error');
  }
}

function closeRichProfile() {
  $('richProfileOverlay')?.classList.remove('open');
}

function closeRichProfileOutside(e) {
  if (e.target === $('richProfileOverlay')) closeRichProfile();
}

function switchSettingsSection(section, button = null) {
  document.querySelectorAll('[data-settings-section]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.settingsSection === section);
  });
  document.querySelectorAll('[data-settings-target]').forEach(navButton => {
    navButton.classList.toggle('active', navButton === button || navButton.dataset.settingsTarget === section);
  });
  document.querySelector('.settings-content')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function openBugReportModal() {
  if ($('bugDeviceInput') && !$('bugDeviceInput').value) {
    $('bugDeviceInput').value = `${navigator.platform || 'Device'} · ${navigator.userAgent || 'Browser'}`;
  }
  $('bugReportModalOverlay')?.classList.add('open');
  $('bugWhatInput')?.focus();
}

function closeBugReportModal() {
  $('bugReportModalOverlay')?.classList.remove('open');
}

function closeBugReportModalOutside(e) {
  if (e.target === $('bugReportModalOverlay')) closeBugReportModal();
}

function sendBugReport() {
  const what = $('bugWhatInput')?.value.trim() || '';
  const device = $('bugDeviceInput')?.value.trim() || '';
  if (!what) {
    $('bugWhatInput')?.focus();
    showToast('Add what happened before sending the bug report.', 'error');
    return;
  }
  const subject = `Phoenix Messenger bug report (${APP_VERSION})`;
  const body = [
    'What happened?',
    what,
    '',
    'Device/browser:',
    device || 'Not provided',
    '',
    'Screenshot:',
    'Optional - attach one to this email if useful.',
    '',
    `User: ${getProfileName()} (${currentUser?.uid || 'signed out'})`,
    `Page: ${location.href}`,
    `Version: ${APP_VERSION}`
  ].join('\n');
  location.href = `mailto:${BUG_REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  closeBugReportModal();
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

async function createRoom(trigger = null) {
  if (!currentUser) return;
  const name = String($('roomNameInput')?.value || '').trim();
  const description = String($('roomDescriptionInput')?.value || '').trim();
  if (!name) {
    $('roomNameInput')?.focus();
    return;
  }
  const loadingButton = setElementLoading(trigger, true, 'Creating...');
  try {
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
    showToast('Room created.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not create room.'), 'error');
  } finally {
    setElementLoading(loadingButton, false);
  }
}

function openServerModal() {
  $('serverModalOverlay')?.classList.add('open');
  setTimeout(() => $('serverNameInput')?.focus(), 50);
}

function openGlobalSearch() {
  $('globalSearchOverlay')?.classList.add('open');
  setTimeout(() => $('globalSearchInput')?.focus(), 50);
}

function closeGlobalSearch() {
  $('globalSearchOverlay')?.classList.remove('open');
}

function closeGlobalSearchOutside(e) {
  if (e.target === $('globalSearchOverlay')) closeGlobalSearch();
}

async function runGlobalSearch() {
  const term = String($('globalSearchInput')?.value || '').trim().toLowerCase();
  const results = $('globalSearchResults');
  if (!results || !term) return;
  results.innerHTML = '<div class="friend-empty">Searching Phoenix...</div>';
  const rows = [];
  const conversationSearches = convos.slice(0, 20).map(async convo => {
    const snapshot = await getDocs(query(collection(db, 'conversations', convo.id, 'messages'), orderBy('createdAt', 'desc'), limit(50))).catch(() => null);
    snapshot?.docs.filter(messageDoc => String(messageDoc.data().text || '').toLowerCase().includes(term)).slice(0, 10).forEach(messageDoc => {
      const message = messageDoc.data();
      rows.push({ type: 'Message', title: message.text, meta: `${message.senderName || 'User'} in ${convo.name}`, action: `openConversationMessageResult('${escapeHtml(convo.id)}','${escapeHtml(messageDoc.id)}')` });
    });
  });
  const serverSearches = servers.slice(0, 10).map(async server => {
    const channelSnap = await getDocs(collection(db, 'servers', server.id, 'channels')).catch(() => null);
    const textChannels = channelSnap?.docs.filter(channelDoc => channelDoc.data().type !== 'voice') || [];
    textChannels.filter(channelDoc => String(channelDoc.data().name || '').toLowerCase().includes(term)).forEach(channelDoc => {
      rows.push({ type: 'Channel', title: `#${channelDoc.data().name}`, meta: server.name || 'Server', action: `openServerChannelResult('${escapeHtml(server.id)}','${escapeHtml(channelDoc.id)}')` });
    });
    await Promise.all(textChannels.slice(0, 15).map(async channelDoc => {
      const messageSnap = await getDocs(query(collection(db, 'servers', server.id, 'channels', channelDoc.id, 'messages'), orderBy('createdAt', 'desc'), limit(50))).catch(() => null);
      messageSnap?.docs.filter(messageDoc => String(messageDoc.data().text || '').toLowerCase().includes(term)).slice(0, 10).forEach(messageDoc => {
        const message = messageDoc.data();
        rows.push({ type: 'Message', title: message.text, meta: `${message.senderName || 'User'} in #${channelDoc.data().name}`, action: `openServerMessageResult('${escapeHtml(server.id)}','${escapeHtml(channelDoc.id)}','${escapeHtml(messageDoc.id)}')` });
      });
    }));
  });
  await Promise.all([...conversationSearches, ...serverSearches]);
  servers.filter(server => String(server.name || '').toLowerCase().includes(term)).forEach(server => rows.push({ type: 'Server', title: server.name, meta: server.description || 'Server', action: `openServer('${escapeHtml(server.id)}');closeGlobalSearch()` }));
  const usersSnap = await getDocs(query(collection(db, 'users'), where('usernameLower', '>=', term), where('usernameLower', '<=', `${term}\uf8ff`), limit(10))).catch(() => null);
  usersSnap?.docs.forEach(userDoc => {
    const user = userDoc.data();
    rows.push({ type: 'User', title: user.displayName || user.username || 'User', meta: user.customStatus || user.username || 'Phoenix user', action: `openRichProfile('${escapeHtml(userDoc.id)}')` });
  });
  results.innerHTML = rows.length ? rows.slice(0, 40).map(row => `<button class="rc-result" onclick="${row.action}"><div class="rc-result-main"><div class="rc-result-title">${escapeHtml(row.title)}</div><div class="rc-result-meta">${escapeHtml(row.type)} · ${escapeHtml(row.meta)}</div></div></button>`).join('') : '<div class="friend-empty">No results found.</div>';
}

function openServerChannelResult(serverId, channelId) {
  openServer(serverId);
  closeGlobalSearch();
  const tryOpen = attempts => {
    if (activeServerId !== serverId) return;
    if (channels.some(channel => channel.id === channelId)) {
      openChannel(channelId);
      return;
    }
    if (attempts > 0) setTimeout(() => tryOpen(attempts - 1), 150);
  };
  tryOpen(20);
}

function waitForMessageAndScroll(messageId, attempts = 24) {
  if ($(`message-${messageId}`)) {
    scrollToMessage(messageId);
    return;
  }
  if (attempts > 0) setTimeout(() => waitForMessageAndScroll(messageId, attempts - 1), 150);
}

function openConversationMessageResult(convoId, messageId) {
  closeGlobalSearch();
  openConvo(convoId);
  waitForMessageAndScroll(messageId);
}

function openServerMessageResult(serverId, channelId, messageId) {
  openServerChannelResult(serverId, channelId);
  waitForMessageAndScroll(messageId);
}

function openPinnedMessages() {
  const list = $('pinnedMessagesList');
  const source = activeMode === 'server' ? activeChannel : convos.find(convo => convo.id === activeId);
  const pinned = (source?.messages || []).filter(message => message.pinned && !message.deleted);
  if (list) list.innerHTML = pinned.length ? pinned.map(message => `<div class="rc-result"><div class="rc-result-main"><div class="rc-result-title">${escapeHtml(message.text || message.attachment?.name || 'Attachment')}</div><div class="rc-result-meta">${escapeHtml(message.senderName || 'User')} · ${formatTime(message.createdAt)}</div></div><button class="btn-mini" onclick="closePinnedMessages();scrollToMessage('${escapeHtml(message.id)}')">Jump</button></div>`).join('') : '<div class="friend-empty">No pinned messages in this conversation.</div>';
  $('pinnedMessagesOverlay')?.classList.add('open');
}

function closePinnedMessages() {
  $('pinnedMessagesOverlay')?.classList.remove('open');
}

function closePinnedMessagesOutside(e) {
  if (e.target === $('pinnedMessagesOverlay')) closePinnedMessages();
}

function openServerSettings() {
  const server = getActiveServer();
  if (!server) return;
  if (!['owner', 'admin'].includes(getMyServerMember()?.role)) {
    showToast('You do not have permission to manage server settings.', 'error');
    return;
  }
  if ($('serverSettingsName')) $('serverSettingsName').value = server.name || '';
  if ($('serverSettingsDescription')) $('serverSettingsDescription').value = server.description || '';
  if ($('serverSettingsIcon')) $('serverSettingsIcon').value = server.iconUrl || '';
  if ($('serverSettingsBanner')) $('serverSettingsBanner').value = server.bannerUrl || '';
  if ($('serverSettingsVanity')) $('serverSettingsVanity').value = server.vanityInviteCode || '';
  if ($('serverSettingsNotifications')) $('serverSettingsNotifications').value = localStorage.getItem(`phoenix_server_notifications_${activeServerId}`) || 'mentions';
  draftRolePermissions = Object.fromEntries(Object.entries(ROLE_DEFAULTS).map(([role, config]) => [role, [...(server.rolePermissions?.[role] || config.permissions)]]));
  draftRoleStyles = Object.fromEntries(Object.entries(ROLE_DEFAULTS).map(([role, config]) => [role, { ...(server.roleStyles?.[role] || { color: config.color, icon: config.icon }) }]));
  const hierarchy = server.roleHierarchy || ['owner', 'admin', 'mod', 'member'];
  const myRank = getServerRoleRank(getMyServerMember()?.role, server);
  const editableRoles = hierarchy.filter(role => role !== 'owner' && getServerRoleRank(role, server) > myRank);
  const roleSelect = $('rolePermissionSelect');
  if (roleSelect) roleSelect.innerHTML = editableRoles.map(role => `<option value="${escapeHtml(role)}">${escapeHtml(role[0].toUpperCase() + role.slice(1))}</option>`).join('');
  const hierarchyEl = $('roleHierarchy');
  if (hierarchyEl) {
    [...hierarchyEl.children].sort((a, b) => hierarchy.indexOf(a.dataset.role) - hierarchy.indexOf(b.dataset.role)).forEach(child => hierarchyEl.appendChild(child));
    [...hierarchyEl.children].forEach(child => {
      child.draggable = getMyServerMember()?.role === 'owner' && child.dataset.role !== 'owner';
    });
  }
  setupRoleDragAndDrop();
  renderRolePermissionEditor();
  renderServerBans();
  $('serverSettingsOverlay')?.classList.add('open');
}

function closeServerSettings() {
  $('serverSettingsOverlay')?.classList.remove('open');
}

function closeServerSettingsOutside(e) {
  if (e.target === $('serverSettingsOverlay')) closeServerSettings();
}

function chooseServerAsset(kind) {
  if (!['owner', 'admin'].includes(getMyServerMember()?.role)) {
    showToast('You do not have permission to manage this server.', 'error');
    return;
  }
  $(kind === 'banner' ? 'serverBannerUploadInput' : 'serverIconUploadInput')?.click();
}

function chooseProfileAsset(kind) {
  $(kind === 'banner' ? 'profileBannerUploadInput' : 'profileAvatarUploadInput')?.click();
}

async function uploadProfileAsset(file, kind) {
  if (!file) return;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    showToast('Image is too large. Keep uploads under 10 MB.', 'error');
    return;
  }
  try {
    showToast(`Uploading profile ${kind}...`, 'info');
    const url = await uploadImage(file);
    const input = $(kind === 'banner' ? 'profileBannerUrlInput' : 'profileAvatarUrlInput');
    if (input) input.value = url;
    renderProfilePreview();
    showToast(`Profile ${kind} uploaded. Save changes to apply it.`, 'success');
  } catch (error) {
    showToast(friendlyError(error, `Could not upload profile ${kind}.`), 'error');
  }
}

async function uploadServerAsset(file, kind) {
  if (!file) return;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    showToast('Image is too large. Keep uploads under 10 MB.', 'error');
    return;
  }
  try {
    showToast(`Uploading server ${kind}...`, 'info');
    const url = await uploadImage(file);
    const input = $(kind === 'banner' ? 'serverSettingsBanner' : 'serverSettingsIcon');
    if (input) input.value = url;
    showToast(`Server ${kind} uploaded. Save changes to apply it.`, 'success');
  } catch (error) {
    showToast(friendlyError(error, `Could not upload server ${kind}.`), 'error');
  }
}

async function renderServerBans() {
  const list = $('serverBansList');
  if (!list || !activeServerId) return;
  list.innerHTML = '<div class="friend-empty">Loading banned members...</div>';
  const bansSnap = await getDocs(collection(db, 'servers', activeServerId, 'bans')).catch(() => null);
  const bans = bansSnap?.docs.map(item => ({ id: item.id, ...item.data() })) || [];
  list.innerHTML = bans.length ? bans.map(ban => `
    <div class="rc-result">
      <div class="rc-result-main"><div class="rc-result-title">${escapeHtml(ban.username || ban.uid || 'User')}</div><div class="rc-result-meta">Banned ${formatDateValue(ban.bannedAt)}</div></div>
      <button class="btn-mini" onclick="unbanServerMember('${escapeHtml(ban.uid || ban.id)}')">Unban</button>
    </div>`).join('') : '<div class="friend-empty">No banned members.</div>';
}

async function unbanServerMember(uid) {
  if (!activeServerId || !uid || !hasServerPermission('ban_members')) {
    showToast('You do not have permission to unban members.', 'error');
    return;
  }
  try {
    await deleteDoc(doc(db, 'servers', activeServerId, 'bans', uid));
    showToast('Member unbanned.', 'success');
    renderServerBans();
  } catch (error) {
    showToast(friendlyError(error, 'Could not unban member.'), 'error');
  }
}

function renderRolePermissionEditor() {
  const role = $('rolePermissionSelect')?.value || 'admin';
  const permissions = draftRolePermissions[role] || [];
  if ($('roleColorInput')) $('roleColorInput').value = draftRoleStyles[role]?.color || ROLE_DEFAULTS[role]?.color || '#94a3b8';
  if ($('roleIconInput')) $('roleIconInput').value = draftRoleStyles[role]?.icon || ROLE_DEFAULTS[role]?.icon || '●';
  document.querySelectorAll('[data-role-permission]').forEach(input => {
    input.checked = permissions.includes(input.dataset.rolePermission);
    input.disabled = role === 'owner';
    input.onchange = () => {
      const next = new Set(draftRolePermissions[role] || []);
      if (input.checked) next.add(input.dataset.rolePermission);
      else next.delete(input.dataset.rolePermission);
      draftRolePermissions[role] = [...next];
    };
  });
}

function updateRoleStyleDraft() {
  const role = $('rolePermissionSelect')?.value || 'admin';
  draftRoleStyles[role] = {
    color: $('roleColorInput')?.value || ROLE_DEFAULTS[role]?.color || '#94a3b8',
    icon: String($('roleIconInput')?.value || ROLE_DEFAULTS[role]?.icon || '●').slice(0, 2)
  };
}

function setupRoleDragAndDrop() {
  const hierarchy = $('roleHierarchy');
  if (!hierarchy || hierarchy.dataset.ready) return;
  hierarchy.dataset.ready = 'true';
  hierarchy.addEventListener('dragstart', event => {
    draggedRole = event.target?.dataset?.role || '';
  });
  hierarchy.addEventListener('dragover', event => event.preventDefault());
  hierarchy.addEventListener('drop', event => {
    event.preventDefault();
    const target = event.target.closest('[data-role]');
    const dragged = hierarchy.querySelector(`[data-role="${draggedRole}"]`);
    if (!target || !dragged || target === dragged || draggedRole === 'owner' || getMyServerMember()?.role !== 'owner') return;
    hierarchy.insertBefore(dragged, target);
  });
}

async function saveServerSettings(trigger = null) {
  if (!activeServerId || !['owner', 'admin'].includes(getMyServerMember()?.role)) {
    showToast('You do not have permission to manage this server.', 'error');
    return;
  }
  const loadingButton = setElementLoading(trigger, true, 'Saving...');
  try {
    localStorage.setItem(`phoenix_server_notifications_${activeServerId}`, $('serverSettingsNotifications')?.value || 'mentions');
    await updateDoc(doc(db, 'servers', activeServerId), {
      name: String($('serverSettingsName')?.value || '').trim() || getActiveServer()?.name || 'Server',
      description: String($('serverSettingsDescription')?.value || '').trim(),
      iconUrl: String($('serverSettingsIcon')?.value || '').trim(),
      bannerUrl: String($('serverSettingsBanner')?.value || '').trim(),
      vanityInviteCode: String($('serverSettingsVanity')?.value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32),
      rolePermissions: { ...draftRolePermissions, owner: ['administrator'] },
      roleStyles: { ...draftRoleStyles, owner: draftRoleStyles.owner || { color: ROLE_DEFAULTS.owner.color, icon: ROLE_DEFAULTS.owner.icon } },
      roleHierarchy: [...($('roleHierarchy')?.children || [])].map(item => item.dataset.role),
      updatedAt: serverTimestamp()
    });
    closeServerSettings();
    showToast('Server settings saved.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not save server settings.'), 'error');
  } finally {
    setElementLoading(loadingButton, false);
  }
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
    showToast('You need admin permissions to create channels.', 'error');
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

async function createServer(trigger = null) {
  if (!currentUser) return;
  const name = String($('serverNameInput')?.value || '').trim();
  const description = String($('serverDescriptionInput')?.value || '').trim();
  const iconUrl = String($('serverIconInput')?.value || '').trim();
  if (!name) {
    $('serverNameInput')?.focus();
    return;
  }

  const loadingButton = setElementLoading(trigger, true, 'Creating...');
  try {
    const serverRef = doc(collection(db, 'servers'));
    const memberRef = doc(db, 'servers', serverRef.id, 'members', currentUser.uid);
    await setDoc(serverRef, {
      name,
      description,
      ownerId: currentUser.uid,
      ownerName: getProfileName(),
      iconUrl,
      bannerUrl: '',
      vanityInviteCode: '',
      rolePermissions: Object.fromEntries(Object.entries(ROLE_DEFAULTS).map(([role, config]) => [role, config.permissions])),
      roleStyles: Object.fromEntries(Object.entries(ROLE_DEFAULTS).map(([role, config]) => [role, { color: config.color, icon: config.icon }])),
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
    showToast('Server created.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not create server.'), 'error');
  } finally {
    setElementLoading(loadingButton, false);
  }
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

async function createChannel(trigger = null) {
  if (!activeServerId || !hasServerPermission('create_channels')) return;
  const type = $('channelTypeInput')?.value || 'text';
  const rawName = String($('channelNameInput')?.value || '').trim();
  const name = type === 'voice' ? rawName.slice(0, 32) : cleanChannelName(rawName);
  if (!name) {
    $('channelNameInput')?.focus();
    return;
  }
  const loadingButton = setElementLoading(trigger, true, 'Creating...');
  try {
    const position = channels.length ? Math.max(...channels.map(channel => Number(channel.position) || 0)) + 10 : 10;
    const channelRef = doc(collection(db, 'servers', activeServerId, 'channels'));
    await setDoc(channelRef, {
      name,
      type,
      position,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: type === 'voice' ? 'Voice channel created' : ''
    });
    await updateDoc(doc(db, 'servers', activeServerId), { updatedAt: serverTimestamp() }).catch(console.error);
    if ($('channelNameInput')) $('channelNameInput').value = '';
    closeChannelModal();
    if (type === 'text') openChannel(channelRef.id);
    showToast('Channel created.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not create channel.'), 'error');
  } finally {
    setElementLoading(loadingButton, false);
  }
}

async function createServerInvite() {
  if (!activeServerId || !currentUser) return;
  if (!hasServerPermission('invite_users')) {
    showToast('You need invite permissions for this server.', 'error');
    return;
  }
  try {
    const server = getActiveServer();
    const code = server?.vanityInviteCode || Math.random().toString(36).slice(2, 10);
    await setDoc(doc(db, 'serverInvites', code), {
      serverId: activeServerId,
      serverName: server?.name || 'Server',
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      expiresAt: null
    });
    const url = `${location.origin}${location.pathname}?invite=${code}`;
    await navigator.clipboard?.writeText(url).catch(() => {});
    showToast('Invite link copied.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not create invite.'), 'error');
  }
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
    showToast(friendlyError(error, 'Could not join server. Check invite or rules.'), 'error');
  }
}

async function joinServerFromInvite(code) {
  const inviteSnap = await getDoc(doc(db, 'serverInvites', code));
  if (!inviteSnap.exists()) throw new Error('Invite not found.');
  const invite = inviteSnap.data();
  const serverSnap = await getDoc(doc(db, 'servers', invite.serverId));
  if (!serverSnap.exists()) throw new Error('Server not found.');
  const banSnap = await getDoc(doc(db, 'servers', invite.serverId, 'bans', currentUser.uid));
  if (banSnap.exists()) throw new Error('You are banned from this server.');
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

function canKickServerMember(member) {
  if (!member || !currentUser || member.uid === currentUser.uid) return false;
  if (!hasServerPermission('kick_members')) return false;
  return getServerRoleRank(getMyServerMember()?.role) < getServerRoleRank(member.role);
}

function canBanServerMember(member) {
  if (!member || !currentUser || member.uid === currentUser.uid) return false;
  if (!hasServerPermission('ban_members')) return false;
  return getServerRoleRank(getMyServerMember()?.role) < getServerRoleRank(member.role);
}

function canManageServerMemberRole(member) {
  if (!member || !currentUser || member.uid === currentUser.uid || member.role === 'owner') return false;
  if (!hasServerPermission('manage_roles')) return false;
  return getServerRoleRank(getMyServerMember()?.role) < getServerRoleRank(member.role);
}

async function kickServerMember(uid) {
  if (!activeServerId || !uid) return;
  const member = serverMembers.find(item => item.uid === uid || item.id === uid);
  if (!canKickServerMember(member)) {
    showToast('Only server owners/admins can kick lower-role members.', 'error');
    return;
  }
  const name = member.username || member.displayName || 'this member';
  if (!confirm(`Kick ${name} from this server?`)) return;
  try {
    await Promise.all(channels.filter(channel => channel.type === 'voice').map(channel => deleteDoc(doc(db, 'servers', activeServerId, 'voiceChannels', channel.id, 'members', member.uid)).catch(() => {})));
    await deleteDoc(doc(db, 'servers', activeServerId, 'members', member.uid));
    await updateDoc(doc(db, 'servers', activeServerId), {
      memberIds: arrayRemove(member.uid),
      memberCount: increment(-1),
      updatedAt: serverTimestamp()
    });
    showToast(`${name} was kicked from the server.`, 'success');
  } catch (error) {
    console.error('Kick failed:', error);
    showToast(friendlyError(error, 'Could not kick member.'), 'error');
  }
}

async function banServerMember(uid) {
  if (!activeServerId || !uid) return;
  const member = serverMembers.find(item => item.uid === uid || item.id === uid);
  if (!canBanServerMember(member)) {
    showToast('You do not have permission to ban this member.', 'error');
    return;
  }
  const name = member.username || member.displayName || 'this member';
  if (!confirm(`Ban ${name} from this server?`)) return;
  try {
    await setDoc(doc(db, 'servers', activeServerId, 'bans', member.uid), {
      uid: member.uid,
      username: name,
      bannedBy: currentUser.uid,
      bannedAt: serverTimestamp()
    });
    await Promise.all(channels.filter(channel => channel.type === 'voice').map(channel => deleteDoc(doc(db, 'servers', activeServerId, 'voiceChannels', channel.id, 'members', member.uid)).catch(() => {})));
    await deleteDoc(doc(db, 'servers', activeServerId, 'members', member.uid));
    await updateDoc(doc(db, 'servers', activeServerId), {
      memberIds: arrayRemove(member.uid),
      memberCount: increment(-1),
      updatedAt: serverTimestamp()
    });
    showToast(`${name} was banned from the server.`, 'success');
  } catch (error) {
    console.error('Ban failed:', error);
    showToast(friendlyError(error, 'Could not ban member.'), 'error');
  }
}

async function updateServerMemberRole(uid, role) {
  if (!activeServerId || !uid || !ROLE_DEFAULTS[role]) return;
  const member = serverMembers.find(item => item.uid === uid || item.id === uid);
  if (!canManageServerMemberRole(member)) {
    showToast('You do not have permission to change this member role.', 'error');
    renderMemberPanel();
    return;
  }
  if (getServerRoleRank(role) <= getServerRoleRank(getMyServerMember()?.role)) {
    showToast('You cannot assign a role equal to or above your own.', 'error');
    renderMemberPanel();
    return;
  }
  try {
    await updateDoc(doc(db, 'servers', activeServerId, 'members', uid), { role });
    showToast('Member role updated.', 'success');
  } catch (error) {
    showToast(friendlyError(error, 'Could not update member role.'), 'error');
  }
}

async function leaveServer() {
  if (!activeServerId || !currentUser) return;
  const server = getActiveServer();
  const myMember = getMyServerMember();
  if (myMember?.role === 'owner' || server?.ownerId === currentUser.uid) {
    showToast('Server owners cannot leave until ownership is transferred.', 'error');
    return;
  }
  if (!confirm(`Leave ${server?.name || 'this server'}?`)) return;
  try {
    if (activeVoiceServerId === activeServerId) await leaveVoiceChannel(true);
    await deleteDoc(doc(db, 'servers', activeServerId, 'members', currentUser.uid));
    await updateDoc(doc(db, 'servers', activeServerId), {
      memberIds: arrayRemove(currentUser.uid),
      memberCount: increment(-1),
      updatedAt: serverTimestamp()
    });
    showToast('You left the server.', 'success');
    openHome();
  } catch (error) {
    console.error('Leave server failed:', error);
    showToast(friendlyError(error, 'Could not leave server.'), 'error');
  }
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
    return profile.status !== 'invisible' && (['online', 'idle', 'dnd'].includes(profile.status) || (lastSeen && now - lastSeen < 120000));
  });
  const offline = sorted.filter(member => !online.includes(member));
  const renderGroup = (title, members) => `
    <div class="member-title">${title} - ${members.length}</div>
    ${members.map(member => {
      const name = member.username || member.displayName || 'Member';
      const avatar = member.avatarURL || '';
      const col = getColor(name);
      const roleStyle = getActiveServer()?.roleStyles?.[member.role] || ROLE_DEFAULTS[member.role] || ROLE_DEFAULTS.member;
      return `
        <div class="member-card" onclick="openRichProfile('${escapeHtml(member.uid)}')">
          <div class="avatar-wrap">
            <div class="member-avatar" style="${avatar ? `background:center / cover url('${escapeHtml(avatar)}');color:transparent;` : `background:${col.bg};color:${col.fg};`}">${avatar ? '' : getInitials(name)}</div>
            ${renderStatusDot(member.profile, member.uid)}
          </div>
          <div class="member-card-main">
            <div class="member-name" style="color:${escapeHtml(roleStyle.color || col.fg)}">${escapeHtml(name)}</div>
            <div class="member-role">${escapeHtml(roleStyle.icon || '●')} ${escapeHtml(member.role || 'member')}${member.profile?.customStatus ? ` · ${escapeHtml(member.profile.customStatus)}` : ''}</div>
          </div>
          ${(canKickServerMember(member) || canBanServerMember(member) || canManageServerMemberRole(member)) ? `
            <div class="member-actions" onclick="event.stopPropagation()">
              ${canManageServerMemberRole(member) ? `<select class="member-role-select" onchange="updateServerMemberRole('${escapeHtml(member.uid)}', this.value)">${['admin', 'mod', 'member'].map(role => `<option value="${role}" ${member.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select>` : ''}
              ${canKickServerMember(member) ? `<button class="member-kick" onclick="kickServerMember('${escapeHtml(member.uid)}')">Kick</button>` : ''}
              ${canBanServerMember(member) ? `<button class="member-kick" onclick="banServerMember('${escapeHtml(member.uid)}')">Ban</button>` : ''}
            </div>` : ''}
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
    showToast('Wrong access code.', 'error');
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
    showToast('No user found with that username.', 'error');
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
  showToast('Moderation action saved.', 'success');
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
    showLanding(true);
    showAuth(false);
    lockMessenger(true);
    return;
  }

  try {
    currentProfile = await ensureUserProfile(user);
    username = currentProfile.username || '';
    if (!username) {
      showAuth(false);
      showLanding(false);
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
    showLanding(true);
    showAuth(true);
    lockMessenger(true);
  }
});

applyTheme(currentTheme);
updateDownloadCounter();
['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(eventName => {
  window.addEventListener(eventName, noteUserActivity, { passive: true });
});
window.addEventListener('offline', () => {
  setConnectionStatus('Offline');
  showToast('You are offline. Messages may fail to send.', 'error');
});
window.addEventListener('online', () => {
  setConnectionStatus('Online');
  showToast('Back online.', 'success');
});
document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('effects-paused', document.hidden);
});
window.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openGlobalSearch();
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
$('globalSearchInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') runGlobalSearch();
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
$('serverIconUploadInput')?.addEventListener('change', event => {
  uploadServerAsset(event.target.files?.[0], 'icon');
});
$('serverBannerUploadInput')?.addEventListener('change', event => {
  uploadServerAsset(event.target.files?.[0], 'banner');
});
$('profileAvatarUploadInput')?.addEventListener('change', event => {
  uploadProfileAsset(event.target.files?.[0], 'avatar');
});
$('profileBannerUploadInput')?.addEventListener('change', event => {
  uploadProfileAsset(event.target.files?.[0], 'banner');
});
$('callBar')?.addEventListener('click', event => {
  event.preventDefault();
  liveKitRoom?.startAudio?.().catch(() => {});
  playRemoteAudio();
});
$('voiceChannelBar')?.addEventListener('click', () => {
  liveKitRoom?.startAudio?.().catch(() => {});
});
$('messages')?.addEventListener('click', handleMessageActionClick);

document.querySelectorAll('.rail-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

window.addEventListener('beforeunload', () => {
  stopTyping();
  cancelVoiceMessageRecording();
  if (activeVoiceServerId && activeVoiceChannelId && currentUser) {
    deleteDoc(doc(db, 'servers', activeVoiceServerId, 'voiceChannels', activeVoiceChannelId, 'members', currentUser.uid)).catch(() => {});
  }
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
  banServerMember,
  blockUser,
  cancelFriendRequest,
  cancelReply,
  cancelVoiceMessageRecording,
  chooseFile,
  chooseImage,
  chooseProfileAsset,
  chooseServerAsset,
  closeActionMenu,
  closeActionMenuOutside,
  closeBugReportModal,
  closeBugReportModalOutside,
  closeChangelog,
  closeChangelogOutside,
  closeGlobalSearch,
  closeGlobalSearchOutside,
  closeHelpAbout,
  closeHelpAboutOutside,
  closeModal,
  closeFriendModal,
  closeFriendModalOutside,
  closeModPanel,
  closeModPanelOutside,
  closeModalOutside,
  closeProfileModal,
  closeProfileModalOutside,
  closePinnedMessages,
  closePinnedMessagesOutside,
  closeEmojiPicker,
  closeEmojiPickerOutside,
  closeNotificationsPanel,
  closeNotificationsPanelOutside,
  closeRichProfile,
  closeRichProfileOutside,
  closeRoomModal,
  closeRoomModalOutside,
  closeChannelModal,
  closeChannelModalOutside,
  closeServerModal,
  closeServerModalOutside,
  closeServerSettings,
  closeServerSettingsOutside,
  closeAuthPanel,
  copyText,
  copyMessageText,
  createChannel,
  createRoom,
  createServer,
  createServerInvite,
  declineFriendRequest,
  declineIncomingCall,
  deleteChannel,
  deleteMessage,
  editMessage,
  endCurrentCall,
  filterConvos,
  finishVoiceMessageRecording,
  handleSecondaryCreate,
  kickServerMember,
  legacyAcceptIncomingCall,
  legacyCleanupCall,
  legacyDeclineIncomingCall,
  legacyEndCurrentCall,
  legacyJoinVoiceChannel,
  legacyLeaveVoiceChannel,
  legacyStartCall,
  legacyToggleCamera,
  legacyToggleMute,
  legacyToggleVoiceDeafen,
  legacyToggleVoiceMute,
  leaveServer,
  markAllNotificationsRead,
  openModal,
  openBugReportModal,
  openChangelog,
  openCallsPanel,
  openGlobalSearch,
  openChannelModal,
  openChannelActions,
  openConversationMenu,
  openEmojiPicker,
  openFriendModal,
  openHeaderProfile,
  openHelpAbout,
  openHome,
  openModPanel,
  openDmList,
  openProfileModal,
  openPinnedMessages,
  openNotificationsPanel,
  openRichProfile,
  openRichProfileCurrent,
  openRoomModal,
  openServer,
  openServersList,
  openServerActions,
  openServerChannelResult,
  openServerMessageResult,
  openConversationMessageResult,
  openServerModal,
  openServerSettings,
  openSavedMessages,
  openAuthPanel,
  removeFriend,
  renderProfilePreview,
  renderRolePermissionEditor,
  replyToMessage,
  runModerationAction,
  runGlobalSearch,
  saveProfile,
  saveServerSettings,
  searchUsers,
  sendBugReport,
  sendMessage,
  sendFriendRequest,
  requestNotificationPermission,
  requestWindowsDownload,
  setTab,
  signOutUser,
  startChat,
  startDmFromFriend,
  startDmFromSearch,
  startVideoCall,
  startVoiceCall,
  scrollToMessage,
  scrollToDownloads,
  switchSettingsSection,
  toggleReaction,
  togglePinMessage,
  toggleScreenShare,
  toggleCamera,
  toggleMute,
  toggleMobileSidebar,
  toggleVoiceDeafen,
  toggleVoiceMessageRecording,
  toggleVoiceMute,
  insertEmoji,
  unbanServerMember,
  updateRoleStyleDraft,
  updateServerMemberRole,
  leaveVoiceChannel
});
