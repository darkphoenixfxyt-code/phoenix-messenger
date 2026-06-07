# Phoenix Messenger UI V2

Phoenix Messenger UI V2 aligns the messenger with the Phoenix Launcher v1.9
visual language while preserving the existing application behavior.

## Color System

| Token | Value | Use |
| --- | --- | --- |
| Deep Black | `#0B0D12` | Main application background |
| Phoenix Orange | `#FF6B23` | Primary actions, active states, focus glow |
| Phoenix Purple | `#8B5CF6` | Secondary accents and supporting glow |
| Panel Glass | `rgba(18, 20, 28, 0.78)` | Frosted panels and navigation surfaces |
| Subtle Border | `rgba(255, 255, 255, 0.08)` | Panel and control separation |
| Primary Text | `#F8FAFC` | Main labels and message content |
| Muted Text | `#9298A8` | Timestamps, metadata, and secondary labels |

Orange is the primary interaction color. Purple is used as a supporting accent
so active areas feel connected to Phoenix without making the interface
visually noisy.

## Components

### Launcher Navigation

- The far-left navigation uses labeled sections for Home, Friends, DMs,
  Servers, and Settings.
- The Phoenix flame marker anchors the top of the navigation.
- Active sections use an orange glow and elevated surface.
- Navigation hover states use small transforms and lightweight glow effects.

### Server Dock

- Server icons are larger and more widely spaced.
- The active server uses an orange glow and visible selection state.
- Hover transitions provide clear feedback without changing layout size.

### Top Bar

- Global search is always available from the main chat surface.
- Notifications and profile quick access are grouped on the right.
- The current presence state is shown beside the user's avatar.
- The bar uses a frosted glass surface with subtle separation from chat.

### Chat

- Incoming and outgoing messages use cleaner, softly elevated bubbles.
- Reply previews use a compact accent rail and subdued background.
- Reactions use small glass pills with clear active states.
- Timestamps and metadata use a consistent muted type treatment.

### Composer

- The message input uses an orange focus glow.
- Attachment actions remain accessible beside the input.
- The send button uses the primary Phoenix orange treatment and a small hover
  lift.

### Settings And Profiles

- Settings panels use glass cards, section headers, and consistent spacing.
- Permission checkboxes render as compact toggle switches.
- Profiles use a banner-led glass card with stronger avatar framing.
- Status indicators animate subtly while active.

### Modals

- Modals use a frosted surface, subtle orange border glow, and scale-in motion.
- Existing actions and forms are unchanged.

## Typography

- Primary font: `DM Sans`.
- Page and panel titles use stronger weights for hierarchy.
- Compact labels, timestamps, and metadata use smaller muted text.
- Letter spacing remains neutral to preserve readability.

## Animation System

- `phoenixFade` provides lightweight page and panel entry motion.
- Active status indicators use a subtle pulse.
- Buttons and icons use short hover transforms and glow transitions.
- Modal opening uses a small scale and opacity transition.
- Animations pause when the browser tab is inactive.
- `prefers-reduced-motion` disables nonessential motion.

## Responsive Behavior

- Desktop keeps the launcher navigation, server dock, conversation sidebar, and
  chat visible as distinct surfaces.
- Narrow layouts reduce navigation width while preserving section access.
- Mobile keeps the existing collapsible sidebar behavior and touch-friendly
  controls.

## Functional Boundaries

This refresh is UI-only. Firebase Authentication, Firestore messaging,
friends, rooms, servers, Cloudinary uploads, message actions, settings, and
LiveKit voice behavior remain connected to their existing handlers.

## Verification

- JavaScript syntax check: `node --check src/auth-chat.js`
- Lint: `npm run lint`
- Production build: `npm run build`
- Inline control handler and exported function audit
