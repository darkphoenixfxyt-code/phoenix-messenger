# Phoenix Messenger v1.4 Final

Phoenix Messenger v1.4 is the final major community feature release before
development shifts toward Phoenix Browser.

## Features

- Firebase Authentication, profiles, presence, friends, DMs, rooms, servers,
  channels, roles, invites, and moderation.
- Live Firestore messages with replies, edit/delete, reactions, pins, unread
  badges, typing indicators, attachments, and Cloudinary uploads.
- LiveKit DM calls, voice channels, video, mute/deafen, speaking indicators,
  reconnect handling, and screen sharing.
- Phoenix AI local assistant for loaded conversation summaries, server
  summaries, reply suggestions, questions, and moderation review.
- Community Discovery for public and featured servers.
- Cloudinary-backed custom server emojis.
- Advanced profiles with badges, mutual friends, mutual servers, profile
  themes, status, activity, banners, and avatars.
- Server Dashboard with members, tracked messages, active voice users,
  channels, growth estimate, and discovery status.

## Easter Eggs

- `phoenix` opens the Phoenix risen panel.
- `440255` unlocks the local Founder badge.
- `/ai` opens the Phoenix AI teaser.
- `/launcher` opens the Phoenix Launcher tribute.
- Ten Phoenix mark clicks toggle Aurora Mode.
- Seven version-label clicks open developer credits.

## Phoenix AI Notes

Phoenix AI v1.4 runs locally over messages already loaded in the browser. It
does not transmit conversation content to a third-party AI provider and does
not automatically perform moderation actions.

## Roadmap

- Optional hosted AI model integration with explicit privacy controls.
- Rich custom emoji reactions and emoji management.
- Deeper server analytics.
- Desktop auto-updates, tray support, and deep links.
- Phoenix Browser integration.

## Known Issues

- Local Phoenix AI summaries are heuristic and limited to loaded messages.
- Server dashboard message counts rely on counters available on channel data.
- Custom server emoji upload requires the v1.4 Firestore rules to be deployed.
- Windows installers must be built on Windows; macOS DMG/app bundles must be
  built on macOS.
