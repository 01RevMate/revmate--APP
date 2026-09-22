# Plan: Make every RevMate username start with @

## Goal

Every account handle should visibly start with `@`, and existing accounts should be updated so the database stores the new handle format.

## What I confirmed

- Current stored usernames include values like `Jorderz`, `JLB`, `DanTheBoosted`, `PriyaQuattro`, `SilentWatt`, `KevOnTheTools`, and `TomE70`.
- The current username uniqueness rule allows updating those values as long as each final handle is unique.
- Several screens already add `@` in text, so those need adjustment to avoid showing `@@Jorderz` after the update.

## Implementation

1. Add a small username helper for:
  - converting any entered username into a clean stored handle beginning with `@`
  - avoiding duplicate `@@`
  - displaying handles consistently
  - allowing profile lookups from either `/u/Jorderz` or `/u/@Jorderz` so older links keep working
2. Update account creation and profile editing:
  - New signups store usernames as `@name`.
  - The settings username field accepts either `name` or `@name`, then saves `@name`.
  - Existing validation and uniqueness still apply.
3. Update existing accounts:
  - Prefix every existing profile username that does not already start with `@`.
  - Do this as a data update only; no users, posts, cars, groups, messages, or listings are deleted.
4. Update visible references:
  - Profile pages, post authors, comments, messages, friends, blocked users, admin text, and prompts show a single `@`.
  - Links continue to use the stored handle.
  - Text that currently hardcodes `@${username}` is changed to avoid double prefixes.
5. Verify:
  - Existing profiles load at the new `@` URLs.
  - Old no-`@` profile URLs still resolve.
  - Signup/settings save handles with `@`.
  - Posts, comments, messages, friends, and admin lists show one `@`, not none or two.

## Technical details

- Use a database update for existing `public.profiles.username` rows where `username not like '@%'`.
- Add app-level normalization so future writes also store `@`.
- Keep route structure unchanged; no new pages or redesign.  Updated .... the system checks if a username is taken ... so sign up needs to involve a required user name in sign up an email to check for real accounts and then a password 
- &nbsp;