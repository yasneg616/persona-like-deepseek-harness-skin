# P3 Reload / P4 Golden UI research (for the 1.2.0 layout pass)

Study notes for an original, game-flavoured layout. Nothing here is copied
art: every shape in the skin is drawn in CSS/SVG. Sources were read on
2026-11-13 (JST).

## Persona 3 Reload: visual grammar

| What the game does | Source | How the skin translates it |
| --- | --- | --- |
| Palette built on the original P3 blue; the themes are **flowing water and bubbles**, "the sea of the protagonist's mind". Pause menu shows the hero **sinking/suspended in water**. | [Automaton West, Kumagai interview][a1] | Whole screen is one sea: no header band, the conversation floats in deep-blue negative space; a drawn figure-less "light shaft" sinks from the moon. |
| Glass shards that reflect faces; **cards flipping** to reveal options. | [Automaton West][a1] | Landing: a tilted arcana card that flips in; glass headline kept. |
| Pause menu = a **short vertical list of 9 big buttons**, character floating beside it, **big background text on the left that changes with the selected button**, money top, party rail right, button prompts bottom-right. | [Kowalik breakdown][a2], [r/PERSoNA gif thread][a3] | Sidebar becomes a pause-menu list: big tilted entries, a giant outlined **echo word** of the active page (SESSION / PLUGINS / AUTOMATION) set vertically in the left sea. |
| Idle buttons carry a **water texture**; the selection cursor has **continuous idle motion**, glides between items, and **inverts the text colour**; items above the selection **shift up** to make room; buttons and cursor play a **staggered entry**. | [Kowalik][a2] | Entries rest as thin italic on a faint water wash; the selected entry swells, neighbours step aside (margin shift), the cyan ribbon keeps flowing (idle motion), entries surface one by one on page change. |
| Date chip top-right: **"5/15 Fri / After School" + moon-phase icon over a WEEKDAY banner**; in Tartarus it turns **sickly green and reads Dark Hour**. | [PlayCraft: School Entranceway][a4], [PlayCraft: Tartarus][a5] | Clock becomes the full chip: date, weekday, period, moon phase, with a WEEKDAY / DARK HOUR banner under it. |
| Dialogue: a **deep-blue slanted slab**, speaker name on a separate **tab with a TALK label**, portrait cut-in on a **jagged blue splash**; Log / Auto prompts bottom-right. | [PlayCraft: Kenji social link][a6] | Conversation title sits on a name tab marked TALK; prompts get a slanted slab; the slab's own frame is skewed while the text stays straight. |
| Battle feedback is typographic: **CRITICAL! in oversized slanted cyan type**; party is a **vertical blue rail** on the right. | [PlayCraft: battle][a7] | Section headings and the landing headline use oversized slanted display type; tool cards stack like a rail of arcana. |
| Shop screen: **vertical signage running down the left edge**, KEEP OUT tape, an evidence folder, a **red slash confirm panel**. | [PlayCraft: police station][a8] | Vertical wordmark down the far-left edge; popups and settings borrow the folder/tab construction. |
| UI design is a first-class discipline at Atlus; menus are "part of the game". | [GamesRadar][a9], [Push Square][a10] | Popups and settings get the same care as the main screen. |

## Persona 4 Golden: visual grammar

| What the game does | Source | How the skin translates it |
| --- | --- | --- |
| Soejima picked **yellow** for brightness and its double meaning (happiness, danger). The **menu with rainbows and flowers** is intentionally the flashiest screen because it is seen most. **Black-and-white patterns** mark entering the TV world (duality). Fog = obscured truth. | [Megami Tensei Wiki: Persona 4][b1] | Sidebar becomes the pause-menu stage: yellow ground, **vertical rainbow bands**, drawn flowers. TV-enter transition gets a **black/white checker** wipe. Fog kept. |
| In the TV world the screen gets a **CRT scanline halo**; menus and speech bubbles carry a **glass reflection**; the advance icon looks like a **channel knob**; post-battle spotlight like a **game show**; static overlays, antennas, fog/rain ≈ static. | [The Game Reviews, BITMAPS 57][b2] | The conversation is a **TV set**: cabinet with antennas and knobs drawn behind a straight screen (cabinet tilted, text straight); glass glare on boxes; a knob as the send affordance's ornament. |
| Exploration HUD: location name **typeset like a programme caption, white serif on a black bar riding a slanted yellow tab**; date chip = **black pill "05/22 SUN" with "Daytime" in outlined type and a yellow-ringed weather medallion**; scanline wash over everything. | [PlayCraft: dungeon HUD][b3] | Conversation title becomes a TV caption super; calendar becomes the black pill + outlined period + ringed weather medallion. |
| Battle: party rail on the right; the active member inflates into a **yellow disc wrapped in rotating COMMAND lettering**. | [PlayCraft: battle][b4] | The selected nav entry gets a yellow disc badge with rotating lettering. |
| Dialogue: brown text box, **slanted orange name plate** over its top edge (a TV name super), one orange ring as prompt; calendar always on screen. | [PlayCraft: dialogue][b5] | Popups/settings titles use the slanted orange name plate. |
| Social Link rank-up: arcana card in a **burst of yellow diamonds**, an **orange bar with a dashed rank track**, "Rank up!!" in the largest type, black name strip. | [PlayCraft: rank up][b6] | Settings rows use the orange bar + dashed track look; the landing uses a diamond burst. |
| HUD order is month/day, weekday, **time of day (largest)**, weather; when the time changes the **time text slides to the centre** of the screen. | [Cyan Light P4G analysis][b7] | Landing plays a **calendar day transition**: a strip of days slides to today, the period word in the biggest type. |
| The calendar transition **scrolls the dates**, weather shown per day. | [Megami Tensei Wiki: Calendar][b8] | Same strip, with weather glyphs per day (mood glyphs, not a forecast). |

## Layout decisions (shared constraints)

- The host DOM is not reordered: the sidebar stays the first grid column so resizing, collapsing and the drawer keep working; only its look, size and position inside the column change.
- Body text is never rotated or skewed; tilt lives on frames, pseudo-elements and the art layer.
- P5 stays byte-for-byte; every new selector is scoped to `data-dsh-persona="p3"|"p4"` or the persona overlay.
- Reduced motion stops all layers; no blinking or opacity animation.

## Round notes (reference vs. screenshot)

Three rounds per mode at 1440×900 (landing, session, row hover, collapsed, popups, settings), plus 1100×720 and 760×600 checks. Sheets: `/workspace/dsh_p34_v2/rounds/` on the build box.

**P3**
- R1: echo word, chip and slab read as P3R (cf. the pause menu's big background word [a2][a3], the date chip with moon phase [a4]). Faults: the vertical brand was two columns and ran into the leaves; the arcana card had no positioning and landed top-left; the tagline sat under the chip; TALK overlapped the title; the caustic texture in the settings dialog drowned its text.
- R2: brand made a single spine column (shop-signage grammar [a8]) with the sidebar padded for it; card placed in the water; TALK became an inline label like the dialogue name tab [a6]; menus and settings switched to a plain blue gradient with a corner glow. Remaining: the card covered the landing composer; the wordmark lost its space; CONFIG overlapped the settings title.
- R3: the landing slab now ends before the card; space restored; CONFIG inline. Small windows drop echo, shaft and card. Final pass: the hover glide was invisible under the 1.2.0 leaf background, so it got its own cyan wash plus a 12px glide (the P3R cursor glide [a2]).

**P4**
- R1: CRT cabinet, antennas, rainbow stage, days strip and ON AIR disc read as P4G (cf. the CRT and antenna motifs [b2], the calendar HUD and day transition [b3][b8], the battle command disc [b4]). Faults: the NEW SESSION pill covered the wordmark, because the leaf `margin` shorthand beat the newSession `margin-top`; the tagline sat on the cabinet knobs.
- R2: margin fixed, tagline moved to the cabinet chin between the grille and the knobs. Popups (black TV card, orange name-plate labels [b5][b6]) and settings (yellow nav with rainbow edge) checked.
- R3: small windows hide the strip and antennas and shrink the knobs and margins. The browser test caught that reduced motion did not stop the ON AIR disc: pseudo-elements inside `:is()` are invalid, so the block now lists them separately (this also fixes the 1.1.0 ribbon, tape and grain).

[a1]: https://automaton-media.com/en/news/20240207-26873/
[a2]: https://adrian-kowalik.com/projects/persona-3-reload-ui-recreation
[a3]: https://www.reddit.com/r/PERSoNA/comments/144ri9c/i_made_a_gif_of_the_p3_reloaded_pause_menu/
[a4]: https://playcraft.space/gallery/persona-3-reload/school-entranceway-daytime-exploration/
[a5]: https://playcraft.space/gallery/persona-3-reload/tartarus-exploration-hud-tziah/
[a6]: https://playcraft.space/gallery/persona-3-reload/social-link-dialogue-kenji/
[a7]: https://playcraft.space/gallery/persona-3-reload/battle-critical-hit-party/
[a8]: https://playcraft.space/gallery/persona-3-reload/police-station-weapon-shop/
[a9]: https://www.gamesradar.com/persona-3-reloads-ui-goes-hard-and-one-indie-dev-reckons-theyve-figured-out-why/
[a10]: https://www.pushsquare.com/news/2024/02/persona-3-reloads-sexy-ui-result-of-retaining-key-staff-says-atlus
[b1]: https://megatenwiki.com/wiki/Persona_4
[b2]: https://www.thegamereviews.com/article-964-bitmaps-57-japans-superior-artistic-themes.html
[b3]: https://playcraft.space/gallery/persona-4-golden/dungeon-exploration-hud-steamy/
[b4]: https://playcraft.space/gallery/persona-4-golden/battle-party-hp-sp/
[b5]: https://playcraft.space/gallery/persona-4-golden/dialogue-nanako-sings-junes/
[b6]: https://playcraft.space/gallery/persona-4-golden/social-link-rank-up/
[b7]: https://cyanl.com/post/
[b8]: https://megatenwiki.com/wiki/Calendar_in_Persona_4_Golden


## 1.3.0 — supplied reference descriptions (2026-11-13)

The parent reviewed the six user images inline and supplied the descriptions below. This executor did not open those image files; the implementation uses those observations, not a claim of direct image comparison. Existing linked web research above remains background context. All new drawing is original SVG/CSS; no game assets, logos, characters or silhouettes.

### Reference-to-implementation decisions

| Reference | Grammar retained | Application |
| --- | --- | --- |
| P4 image 1 | Lemon/orange wedges, a broad diagonal blue-sky strip, dense floating yellow serif menu, black angular negative space, tiny multicolour cursor stripe, flat flowers | `p4-perspective.svg` creates full-bleed sky, window beams and a black command plane; actual host leaves are italic Georgia/CJK serif with no pill backing; selected item has a five-colour edge stripe |
| P4 image 2 | Hallway architectural depth and rainbow floor lanes converging at an extreme vanishing point | Original perspective floor lanes converge behind the landing; no people are drawn; chat is a broad straight cream plane over the stage, not a narrow wedge |
| P4 image 3 | An enormous cropped yellow circular arc and a narrow angled cream/orange list | Cropped upper-right arc; cream project sheet, orange dividers, slim floating menu and compact date/weather badge; no invented TV cabinet/knobs/antennas |
| P3 image 4 | Cyan LEVEL UP strip sweeping upward, royal-blue/navy panels, tightly set heavy italic capitals | Page name on an oversized skewed cyan strip; a one-time upward sweep on navigation; bold condensed commands and dark angular depth |
| P3 image 5 | Monochrome-blue architectural depth with cyan accents, stacked white condensed commands | `p3-depth.svg` draws original converging planes; three real host commands stay compact; no invented fake game commands |
| P3 image 6 | Surface caustics, deep blue below, very compact skewed cyan/white commands, red selected type on a white wedge with pink tip | Surface-only caustics fading into depth; white/red/pink host selection for navigation, sessions, popups and settings; cyan ribbon remains as a subordinate underline |

### Retained supporting details / functional constraints

- P3: bubbles, moon, real local clock/moon phase, green Dark Hour, arcana tool cards and a smaller landing moon card, water-band transition.
- P4: scanlines and very light static, fog, flowers, perspective rainbow, real date/weekday/period and hour-based mood weather (not a forecast), TV-on transition and ON AIR caption. The extra seven-day strip is retired to keep the status HUD compact; the actual date/weather calendar remains.
- P5 files are unchanged; every new rule is scoped. Native controls, their labels and accessible names remain in the DOM. No host node is reordered or replaced. Message text and composer stay straight; only decorative/command display type is angled. Project/session text is not skewed.
- The existing setting for collage/plain text is unchanged. Reduced motion stops all new motion. No opacity/visibility keyframe or flashing is added.

### Three rounds per mode: silhouette, typography, hierarchy

Screenshots are generated using the host-like preview, not the live DSH app. Each 1440×900 round covers landing, chat, selection/hover, collapse, popup menus and settings. Sheets are under `/workspace/dsh_p34_v3/rounds/`.

**P3 round 1:** Much stronger match to descriptions 4–6: angular royal blue, surface water, very tight italic caps, sweeping cyan strip; no 1.2 shop-sign spine. Found that the old hero selector overrode the new white selection, and the clock crept into the native caption lane.

**P3 round 2:** Reserved the caption lane and aligned the clock. The broad chat panel is readable without the old giant vertical echo taking width. The initial specificity fix still missed the hero's full attribute chain; selected text was red but its backing remained cyan. This was caught in the stills, not waved through as a palette match.

**P3 round 3:** Matched that full selector so the landing now has the reference's red-on-white wedge with pink tip. The landing display phrase rotates around its left baseline and has breathing room above the native Chinese headline. At 1024×768 the ornamental card is hidden, chat remains >620 px wide, and native body text stays untransformed. Popup/settings repeat the same white/red/pink cursor.

**P4 round 1:** Full-bleed sky/planes/rainbow/cropped arc and serif text replace the black pill dashboard. Found old high-specificity hero CSS resurrecting the pill and spinning disc; the brand/date were partly under the native caption; project folders were too pale on cream.

**P4 round 2:** Removed that pill/disc using the correct selector; now only a tiny multicolour stripe marks selection. Moved the black negative-space plane to sit behind all three real menu items, reserved caption clearance, fixed folder/text contrast, and lightened the speech-box frame. Menus/settings read as cream/orange programme sheets, not CRT furniture.

**P4 round 3:** The giant serif phrase rotates from its left baseline, leaving the Chinese native headline separate instead of crossing it. Checked 1024×768: long native menu labels wrap rather than being replaced, cream chat/composer keep reading width, and the date/weather remains compact. Collapsed/menu/settings states checked at 1440. The TV switch-on animation is retained, not the cabinet.

### QA

- Typecheck passes; unit suite 83/83, including the unchanged P5 isolation test and a new original-art/no-external-assets check.
- Browser suite 15/16: the only failure is the already known P5 compact-nav black-border test. New reference-grammar test verifies computed P3 wedge/red type, P4 serif/no pill, no figures, HUD caption clearance, >620 px chat at 1024, unrotated body text, menu/settings fixtures and reduced motion.
- Final preview is fixture-only. No credentials, user sessions, transcript text, trust URL/token or model calls are needed for the design or test work.


## 1.4.0 — composition, not another backdrop

### P5 benchmark inspected first

Read the existing `src/client/skin.css` layout/hero/composer rules and viewed `/workspace/dsh_052/rounds/fin-desktop.png` (an earlier fixture artifact, not a live-app screenshot). P5's audacity is its hierarchy: huge deliberately cropped section type; a native command list treated as a graphic object; asymmetric paper edges; large interruptions of the background; and a compact caption integrated with the scene. The black reading field carries several separate papers rather than a dashboard full of interchangeable cards. These are compositional lessons, not P3/P4 visual assets. P5 files remain untouched.

### Different spatial systems

**P3: dive flight + right manifest.** The actual New Session/Plugins/Automation commands move out of the sidebar and become a single diagonal flight across the top. The actual project/session dock changes sides: it is now on the right, measured from the host's own width preference. Reading occupies the left/centre as independent navy papers over the water, not one large boxed conversation. A stepped transmitter dock sits below the reading axis with the real attachment/permission/plan/model/send controls. Native section title is a cyan TALK plate. Giant outlined section lettering runs partly off the lower edge; brand is small above the commands, clock/moon remain above the manifest. Collapsed state removes the right manifest and becomes a continuous left edge plus an expanded reading field.

**P4: programme stage + footer commands.** Actual navigation leaves move to a sloped black plane along the bottom, separate from the projects. The workspace is a floating cream index in the upper-left, not a full-height sidebar panel. Calendar sits above it; brand moves upper-right. The reading area is an open stage of straight cream papers, offset user speech boxes and a NEXT ON AIR composer dock, with sky/rainbow space between them. Landing is a large black typographic cut carrying yellow serif type, not a centred welcome inside a rectangle. Collapsed state drops the footer flight and reclaims the stage with a slender edge rail.

### Actual host markup and resize contract

Read the shipped host modules in `/workspace/dsh_052/host/layout.js`, `sidebar.js`, `workspace.js` and `/workspace/dsh_053/host/conversation.js`. In particular, native AppFrame fixes sidebar/main grid areas, Sidebar uses logoRow/newSession/panelList/regionArea/footArea, WorkspaceBrowser renders a separate `.fade` span, and InputBar uses GRgSLq card/scroll/grow/input plus row/tools/modes/trailing/standardControls/primary. The persona fixture now embeds the actual shipped InputBar CSS and that DOM shape, including contenteditable input, permission/plan/model and command controls. Those controls only exercise local fixture interactions; no requests are sent. The long-conversation fixture is synthetic Chinese prose with table, code, links, tool details and multiple turns, never a user's records.

P3's real sidebar is moved using grid placement, not cloned controls or DOM replacement. Native resize computes width from a positive horizontal delta. The new persona-layout helper mirrors only sidebar-handle clientX during P3's right-dock drag before the native React handler sees it; native pointer identity, capture, callbacks and persistence remain intact. P4/P5/drawers/unrelated pointers and mid-drag mode changes are excluded; dispose removes listeners. Unit tests verify this contract. The native resize handle moves to the dock's left edge. No extra fake resize control is introduced.

### Three serious iterations per mode

- **P3 R1:** right dock and top command flight finally change the silhouette, unlike 1.3's left-sidebar rectangle. Large outline type sits under the reading field. Critique: command cluster still too timid beside the P5 benchmark; caustics competed with labels; the actual workspace fade reappeared; sticky input needed containment.
- **P3 R2:** enlarged the command flight at wide sizes, retained smaller complete labels at 1024, and removed the actual WorkspaceBrowser `_fade` span. Real InputBar controls made the transmitter dock substantially different from the former SEND rectangle. At 1024×600 the reading lane was too short.
- **P3 R3:** added a dark sloped command plane, explicit scroll containment and a short-height layout. Functional Automation tasks stays complete; only decorative giant type is cropped. Composer is opaque so scrolled prose cannot bleed through it. Long fixture, keyboard, compact nav and reduced motion checked.
- **P4 R1:** footer navigation and floating project island give a different silhouette from P3. Critique: giant serif phrase crossed black/sky with inadequate contrast; the old fog visually washed over the footer; input had translucent content bleed; short windows had too little reading room.
- **P4 R2:** put yellow serif landing type on its own sharply clipped black programme plane, not a conversation box. Kept the actual Chinese headline below. Removed the project fade and restored the folder text contrast. The footer becomes the strong native command axis.
- **P4 R3:** fog moved above the footer rather than through its text, input made opaque, content confined to its scroll viewport, and short-height chrome compressed. Popup/settings and 1440/1024/short windows checked. Functional labels are never deliberately clipped.

Round sheets: `/workspace/dsh_p34_v4/rounds/`. All visual verification is fixture-only, not live DSH. No copyrighted assets, figures or silhouettes added. P3/P4 supporting details from 1.1 remain; layout now supplies the identity.

### Verification

Typecheck and 85 unit tests pass, including unchanged P5 isolation plus two new native-resize contract tests. Browser suite 16/17: only the previously documented P5 compact-nav black-border failure. New 1.4 browser checks inspect real element coordinates at 1440×900, 1024×768 and 1024×600; require right-side P3 project dock, top P3 vs bottom P4 command placement, complete unclipped functional labels, no workspace fade, scrollability, input inside scroll bounds, straight body text, keyboard editing, real toolbar local interaction, compact nav and reduced motion.


**Compact-control audit after R3:** Windows intentionally hides panelList, regionArea and footArea when collapsed. A merely decorative compact stripe would have left Plugins/Automation unavailable except through expanding. The final CSS now unhides those actual native icon sections in a 54px dock, keeps wide-only labels hidden, and leaves original button callbacks/accessibility names intact. No session-title cache or copied navigation is used. A final compact screenshot and browser assertion verify both real panel buttons have usable hit targets. The actual ConversationRoot source was also checked: content > scrollBody > Views + composerSeat matches the enhanced fixture. Final reading screenshots show synthetic long prose/table/code, not private content.


# P3 1.5.0 — the capsule is the seam

## Verified reference research, before drawing
- Official ATLUS protagonist-player replica: https://p-ch.jp/news/13279/ (P3R MP3プレイヤー レプリカ; silver cylinder, broad collar, long green display, 80mm × 20mm; a nonfunctional prop). Direct photo: https://p-ch.jp/wp-content/uploads/2024/01/20240125_img-%E2%80%93-19.png
- Sony original product photographs/specification: https://www.sony.jp/CorporateCruise/Press/200608/06-0831/ — NW-S203F silver S200F cylinder, aluminium, broad jog-shuttle collar, 1-line OLED. Photo: https://www.sony.jp/CorporateCruise/Press/200608/06-0831/img/img_001.jpg
- Sony NW-S205F official specification: https://www.sony-asia.com/electronics/support/digital-music-players-other-digital-music-players/nw-s205f/specifications — same S200-family chassis, 2GB, 15 × 96.5 × 15mm body / 20 × 96.5 × 21mm maximum.
- Community model attribution: https://www.reddit.com/r/persona3FES/comments/12abh69/sony_nws205fsony_nws203f/ and https://www.reddit.com/r/persona3reload/comments/1okcqa3/what_is_makoto_yukis_mp3/

**Identification:** the actual game accessory is the silver cylindrical capsule MP3 player evidenced by ATLUS's official replica. It is commonly associated with Sony's NW-S200 family (particularly NW-S205F); ATLUS does not identify a Sony retail model or storage capacity in that source. Therefore exact NW-S205F identification is community attribution, not an official confirmation. The official replica, not a guessed rectangular MP3 box, informs the screen/collar proportions here. Sony confirms the related real-world chassis details. This original vector study omits brand/game logos, actual song lettering and character imagery. It does not guarantee copyright avoidance; this is not legal clearance. Reference photos remain research files and are NOT in the plugin package.

## Composition / implementation
White void takes roughly 42% of the expanded scene, with a jagged diagonal edge opening into royal-blue underwater depth. The nose-down silver capsule sits directly on that edge; twin cords follow it upward. A broad metallic jog collar, dark slot, green display, seams, button and rolled end-cap are independently drawn SVG geometry with restrained refraction highlights. One 3.8s descent settles into a continuous 11s buoyancy loop whose first/last transforms match. A ripple and detached rising bubbles reinforce submergence. The device never teleports back to its starting position.

Actual New Session/Plugins/Automation controls now form a tight condensed italic stack near the seam; selected action retains red on white with pink tip. A pared-back real project/session index lives in the white plane. Black oversized cropped page type sits at the far left. Straight reading and the native composer remain on the blue side. Compact mode retains the real native icon buttons and opens more blue reading room. Native sidebar resize returns to ordinary left-dock coordinates, so the obsolete right-dock event mirror is removed. Clock/real moon phase/Dark Hour, arcana and section water wipe remain subordinate. No character/head/silhouette or game assets are embedded.

## Three critique/refinement rounds
1. Silhouette and player accuracy: establish 53%-top / 31%-bottom diagonal white wedge and player on seam; reject 1.4's top-flight/right-dock arrangement. Found black vertical type offscreen, short hero subtitle/composer collision and low index contrast.
2. Hierarchy: restore cropped black type within left margin, ink-colour index, reduce caustic/grid competition to the top-right, make short-window landing flow without composer overlap. Menus/settings and 1024 long chat checked.
3. Compact and accessibility: fix dark-on-navy icon rail to dark ink on white; preserve unobstructed native hit targets, maintain comfortable blue stage, verify Dark Hour and reduced motion. Final compact captures explicitly clicked the actual collapse button (the fixture's legacy collapsed query alone does not activate it).

QA: typecheck; 86 unit tests; browser 17/18, only existing P5 compact-nav black-border failure. Full/compact 1440 and 1024, 1024x600, synthetic long prose/table/code/tool content, popups/settings, keyboard input, reduced motion. Byte-isolation regression reconstructs the entire 1.4 CSS and matches its SHA256. P4/P5 before/after at fixed time and reduced motion: 14/14 native geometry/style matches and 14/14 zero-pixel screenshot diffs (see isolation/results.json). Earlier non-deterministic paint comparisons were replaced with controlled initial reduced-motion comparisons; no claim about live pixel identity under motion.

Visual work is fixture verification against actual host markup source, NOT live DSH visual verification. No private session content or model calls.


# 1.5.1 — the WHOLE interface goes underwater

Latest direction superseded the artwork-only request: whole-app entry, not a conversation-pane wipe. The complete AppFrame (background, title/brand, real navigation, project index, reading and composer) shares a brief perspective/depth descent. A separate body-level, pointer-transparent water mass spans the full viewport, including the caption. Its connected navy/cyan/white meniscus travels from below the screen across the entire scene and exits above it. Everything below the same surface receives transient refraction, colour/depth shift and caustics; bubbles rise clear. Refraction and caustics settle smoothly; no persistent filter touches reading text. At 4.6s the effect is removed. Entry plays only when entering P3, never on typing, message changes or normal section changes. Typing during entry settles immediately. Reduced motion starts directly at the composed final scene with no entry layer, and a live preference change stops it.

The final white/blue split is now an original continuous S-shaped water/void meniscus instead of the former diagonal polygon. It gathers around the capsule shoulder, follows the cord gesture and releases below. The capsule is smaller and subordinate to the whole-scene choreography. The old lone conversation-frame wipe is disabled.

## Capsule graphic (two context/closeup rounds)
The researched silhouette and twin earphone cord remain, but the artwork uses only flat black/navy/white/cyan/royal-blue ink, hard cel planes and a sparse play/time display. No metallic gradient, blur, product-render shadow, photographic image, logo or character. Round1 replaced the silver product rendering; round2 simplified face data, removed stripes through the screen and strengthened the dark collar silhouette against white.

## Whole-scene refinement
First motion review checked that the meniscus really crosses projects, command stack, chat/input, brand and caption in one surface. Second pass removed entry-only viewport scrollbars and made transient caustics fade away smoothly (rather than turning into dark lines); bubbles now exit fully above the viewport before cleanup. Final keyframes: entry-0350ms.png, entry-1500ms.png, entry-2700ms.png, entry-3700ms.png, entry-4500ms.png. A continuous ~15s MP4 shows full-app entry and stable submerged reading afterward.

## QA and scope
- Typecheck and89/89 unit tests pass; browser18/19, only known pre-existing P5 compact-nav black-border failure.
- Tests cover viewport/body-sibling water ownership, full AppFrame motion, unobstructed native controls, no replay on content/typing, immediate settle on input, entry/exit cleanup, live reduced motion and P4/P5 lifecycle isolation.
- 1440 and1024 fixtures, 1024x600 long conversation, compact controls, menus/settings, keyboard, reduced motion.
- Complete accepted1.4 CSS is still byte-preserved outside the P3 additions (hash regression). P4/P5 baseline comparison:14/14 native geometry/style snapshots match. Screenshot paint comparison had tiny nondeterministic differences in4/14 cases (maximum2929 pixels of1296000); do not claim all pixel-identical. See isolation/results.json.
- No P4/P5 layout/features changed. Main worktree, credentials, sessions, messages and model calls untouched; no push/clone.
- Visual review is actual-host-markup fixture only, not live DSH visual verification.

## Device reference identification (unchanged research)
Official protagonist-player replica: https://p-ch.jp/news/13279/
Sony cylinder chassis/photo: https://www.sony.jp/CorporateCruise/Press/200608/06-0831/
Sony NW-S205F specs: https://www.sony-asia.com/electronics/support/digital-music-players-other-digital-music-players/nw-s205f/specifications
ATLUS confirms the silver cylindrical MP3 prop; exact Sony NW-S205F identification is community attribution, not an ATLUS model/capacity confirmation. This original illustration does not constitute copyright clearance.


# 1.5.2 — narrow P3 title margin

P3 only. The white/blue meniscus moves far left: white is an approximately10% responsive title/void margin; blue carries all real commands, project/session index, compact icons, brand, reading and composer. The margin contains oversized cropped black page type plus two restrained graphic motifs: a00/THE FOOL arcana imprint with sparse depth staves, and clipped cyan seam slices/caustic curves. The small flat capsule and cord connect to that edge as an easter egg, not a large hero or a replacement control.

Two screenshot/critique rounds at1440 and1024, including long chat, short windows and compact mode. Round1 established the narrow split and blue native index. Critique found branding competed with the command stack in short windows and the old compact-specific selector left a white brand partly on white. Round2 moved branding to the upper reading lane, explicitly fixed compact specificity, and reduced the capsule further so its shoulder clears project labels/actions. Native functional labels are not intentionally cropped; long session/project names keep normal host ellipsis. The left-margin closeup is a detail crop, not the viewport.

Measured actual host-shaped fixture reading-stage gain vs1.5.1:
-1440x900:718.8px ->924px (+205.2px).
-1024x768:502.5px ->549.6px (+47.1px).
See reading-width-comparison.json. This is genuine reading width, not just more empty blue background. Native index remains230–300px wide; all native navigation/index/compact controls sit to the blue side. Workspace fades remain disabled.

The4.6s whole-app entry lifecycle is byte-identical to1.5.1 (unit SHA regression): one viewport-wide surface crosses caption/brand, navigation/index, chat/composer and background together on P3 entry, not per message/section. Typing settles it; reduced motion starts at the stable final composition. Clock/real moon phase/Dark Hour, bubbles, arcana and readable body text remain.

QA: typecheck;90/90 units; browser19/20, sole pre-existing P5 compact-navigation black-border failure. Tests specifically check8–13% margin budget, practical real index width, blue-side native controls/brand in both states, title clearance, real reading-width gain and no fades. Accepted1.4 stylesheet remains byte-preserved outside P3 additions. P4/P5 controlled baseline comparison:14/14 native geometry/style matches;13/14 screenshot pairs identical, one P5 hero pair differs by7 paint pixels. See isolation/results.json. No P4/P5 source/layout/features altered.

Artifacts include landing/chat/compact/short/settings PNGs, left-margin closeup, full-app entry keyframes and a~15s continuous entry film. Visual validation is actual-host-markup fixture only, NOT live DSH visual verification. No character silhouettes, credentials, private content, trust token/URL reads, model calls or messages.
