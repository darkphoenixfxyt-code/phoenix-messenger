# Phoenix Messenger v1 Release Candidate Checklist

Version: v1.0.0-rc.1

## Accounts and Profiles

- [ ] Google login
- [ ] Email login and account creation
- [ ] Username setup
- [ ] Online, Idle, Do Not Disturb, and Invisible presence
- [ ] Automatic idle after inactivity
- [ ] Custom status message
- [ ] Rich profile shows About Me, join date, friend since, mutual friends, and mutual servers

## Messaging

- [ ] Create and open DM
- [ ] Send, edit, delete, reply, react, and copy messages
- [ ] Pin and unpin messages
- [ ] Open pinned messages panel and jump to a message
- [ ] Send image, file, and voice message
- [ ] Typing indicator and unread badges
- [ ] DM notifications
- [ ] Mention notifications

## Servers

- [ ] Create server and default channels
- [ ] Upload server icon and banner
- [ ] Edit server description
- [ ] Set vanity invite code
- [ ] Create and join invite
- [ ] Create text and voice channels
- [ ] Configure server notification preference
- [ ] Edit role permissions, colors, icons, and hierarchy
- [ ] Assign a lower role to a server member
- [ ] Owner/admin kick member
- [ ] Ban member and confirm invite rejoin is blocked
- [ ] Unban member from Server Settings
- [ ] Owner/mod delete another user's message
- [ ] Non-owner leave server

## Search

- [ ] Search users
- [ ] Search servers
- [ ] Search channels
- [ ] Search recent messages across accessible DMs and server channels

## Voice

- [ ] Join and leave server voice
- [ ] Mute and deafen
- [ ] Speaking indicators
- [ ] DM voice call
- [ ] DM video call
- [ ] Voice reconnect and cleanup

## Mobile and Performance

- [ ] Sidebar and channel drawer work on phone
- [ ] Input bar remains visible with mobile keyboard
- [ ] Large message list remains responsive
- [ ] Images lazy-load
- [ ] Switching servers/channels does not duplicate listeners
- [ ] Logout and tab close clean up voice

## Production

- [ ] Firestore rules deployed
- [ ] Netlify environment variables configured
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npx netlify build --offline`
- [ ] Test production URL in normal and private browser windows
