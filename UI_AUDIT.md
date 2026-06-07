# Phoenix Messenger UI Audit

Release candidate UI and functionality audit focused on visible controls, loading states, polish, and dead-button removal.

## Fixed Buttons

- Messages rail button now returns to Home / DMs.
- Calls rail button now opens the active call/voice controls when available, or explains that a call or voice channel must be started first.
- Saved rail button now opens pinned messages for the active chat/channel, or explains that a chat must be opened first.
- Chat header More button now gives an explicit Coming Soon toast instead of doing nothing.
- Composer Emoji button now gives an explicit Coming Soon toast instead of doing nothing.
- Footer Privacy and Terms links now give explicit Coming Soon feedback instead of being dead links.
- Start chat, create room, create server, create channel, save profile, and save server settings buttons now show loading states.
- Friend request actions now show loading states and Phoenix toasts for success/failure.
- File/photo buttons now show Phoenix toasts when no chat is open.
- Invite, moderation, DM start, and legacy voice/call errors now use Phoenix toasts instead of browser alerts.

## Removed Dead Buttons

- No active inline `onclick` controls reference missing functions.
- No visible active control is intentionally left silent.
- Unfinished visible actions were not hidden because they are useful placeholders; they now show Coming Soon feedback.

## Added Tooltips / Coming Soon

- Conversation menu: Coming Soon.
- Emoji picker: Coming Soon.
- Privacy page: Coming Soon.
- Terms page: Coming Soon.

## UI Consistency

- Button loading opacity/cursor now applies consistently across primary, ghost, mini, landing, and send buttons.
- Sidebar hover states now use smoother movement.
- Active rail, tab, conversation, server, and channel states have clearer visual emphasis.
- Primary buttons have a consistent minimum height.

## Settings Audit

- Profile settings load current values when opened.
- Profile save writes username, display name, status, custom status, bio, avatar URL, banner URL, pronouns, location, website, theme, sounds, and DM notification preference.
- Theme and notification sound preference persist through localStorage/profile state.
- Server notification setting persists in localStorage per server.

## Profile Audit

- Avatar URL, banner URL, bio, status, display name, and username are populated from the current profile.
- Profile preview updates from avatar/banner inputs.
- Saved profile values update current UI state immediately after save.

## Voice UI Audit

- Voice channel controls are wired: join by selecting a voice channel, mute, deafen, and leave.
- Calls rail button now surfaces the current voice/call state instead of doing nothing.
- Voice participant lists remain connected to Firestore/LiveKit presence.

## Messaging Audit

- Message actions remain wired: reply, copy, pin/unpin, edit own messages, delete allowed messages, and quick reactions.
- Attachment buttons validate that a chat/channel is open.
- Typing listeners are cleaned up when leaving text conversations for servers/voice channels.
- Unread badges and active state rendering remain tied to conversation/channel updates.

## Mobile Audit

- Recent RC fixes constrain app/landing width to avoid horizontal overflow.
- Mobile sidebar toggle, settings modal, call bars, toasts, and composer use safe-area spacing.
- Remaining real-device check: verify iPhone/Android keyboard behavior against the production Netlify URL.

## Remaining TODO Items

- Build real Privacy and Terms pages.
- Build a full conversation options menu for the header More button.
- Build an emoji picker or emoji autocomplete.
- Perform real two-account QA for calls, voice channels, invites, and mobile keyboard behavior.
