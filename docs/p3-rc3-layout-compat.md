# P3 rc3 layout compatibility repair

The running Desktop bundle was verified as DSH0.2.2-rc.3, in `DeepSeek Harness Desktop`, not the old0.2.2-rc.1 installation. Desktop skin1.5.8 and calling-card1.5.7 had identical client hashes before repair: `d636b66bf08a6c81adb56236b72aad1321b17ab8c72d855651ef9e30a82c8c4c`. The existing1.5.8 edits only extended engine compatibility; they did not repair layout.

Vendor source now renders:

- `SidebarRoot > newSessionRow > [data-slot="sidebar.session.action"] > button`
- `SidebarRoot > scrollRegion > scrollArea > panelList + regionArea`
- `AppFrame > centerCol > mainPanel > ConversationRoot`
- `ConversationContent > scrollBody > composerSeat > composerStack > HeroShell + workspace row + input bar`

The old simplified fixture omitted these intermediate constraints. Old P3 viewport-based absolute positions were applied inside the new scroll containing block. An earlier `scrollRegion {padding-inline-start:min(7.5vw,105px)}` compounded sidebar indentation. A100% button inside an unsized native HOC flex slot collapsed to24px. The native hero is an inline title group inside the composer stack, not a separate block headline. Native root height100% plus decorative margins overflowed the viewport. Whole-button textContent also includes the aria-hidden Ctrl+N shortcut.

The repair is P3/rc3-scoped. It identifies only genuine native new-session/panel buttons, stores clean visible labels separately, gives the real slot/scroll wrappers deterministic flex geometry, keeps project browsing independent, bounds root height after margins, stacks the hero title/badge, and masks the scrolling reading area behind the sticky composer. Native events, React ownership, menus, project/session rows and input controls are not replaced or reparented. Initial immersion and route water effects remain unchanged.

`preview/native-rc3.html` is generated from the actual vendor SidebarRoot, AppFrame and ConversationContent/HeroShell return trees, using synthetic hook snapshots and slot content, with the actual rc3 module/global CSS and three embedded global fonts. Wide and collapsed sidebar markup are separately rendered from the native component. Action services and inner secondary-page content are isolated fixture stand-ins; no live/private sessions or authenticated app were inspected. This is stronger structural validation, not a claim of live visual verification.

Regression coverage includes1024x657,1440x900, short windows, native compact markup, both Chinese/English labels, actual native navigation targets, popup state, bounded chat/composer and shortcut exclusion. P4/P5 remain outside the compatibility selector gate.
