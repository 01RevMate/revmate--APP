# Plan: Edit-mode photo controls + button spacing on the profile page

## What you asked for
1. Tapping "Edit profile" turns on edit mode: a "Change cover" overlay appears over the cover photo, and a camera overlay appears over the profile picture — these are how you change the photos.
2. Outside edit mode, no camera icons or overlays show on the cover photo or profile picture.
3. On other people's profiles, the Message / Add Friend / Block buttons move down so they sit clear of the cover photo instead of crowding it.

## Changes

### src/components/EditableImage.tsx
- Add an optional `showTrigger` prop (default: keep current behaviour).
- When `showTrigger` is false, render the image/children normally but hide the camera overlay button entirely (no hover overlay either).
- Keep the existing styling: dark overlay with icon + "Change cover" text on desktop, floating white pill on mobile.

### src/routes/u.$username.tsx
- Pass `showTrigger={editing}` to the cover `EditableImage` and the avatar `EditableImage`, so the camera overlays only appear after the owner taps "Edit profile".
- The "Edit profile" button becomes the single entry point for changing cover photo, profile picture, bio, persona and links; tapping "Close" exits edit mode and hides the overlays again.
- Visitor buttons (Message, Add Friend, Block): add top margin / adjust alignment so the row sits lower, below the cover overlap (move from the current `mb-2` aligned-to-bottom position to a lower offset, e.g. align to the username line rather than the avatar bottom edge).

## Notes
- No database or interface changes elsewhere; only these two files.
- Verified afterwards with a typecheck and a preview check on a profile page, both as the owner (edit mode on/off) and as a visitor.
