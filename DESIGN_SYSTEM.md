# kuraat — UI/UX Design System & Screen Specification

> **Source of truth:** `kuraat — Mobile App UI Screens.pdf` (project root, 28 pages).
> Page 1 = design tokens, type and components. Page 2 = product catalogue (dummy data). Pages 3–28 = 26 mobile screens.
>
> Every screen in the PDF is a flattened 3× raster of a **390 × 844 pt** frame (iPhone 14 class). All
> measurements in this document are in **design pixels (pt)** and were taken directly from those rasters
> (pixel distance ÷ 3). Values marked **(est.)** were measured from anti-aliased/JPEG-compressed pixels and are
> estimates; everything else is stated explicitly in the PDF.

---

## A. Design overview

### A.1 Application
**kuraat** ("كُرات — شريك الجمعات", *"Your partner for every gathering"*) is a premium Saudi sweets brand
(truffles, cakes, pastries, breakfast). The app lets a customer:

1. Create an account with a **WhatsApp one-time code** (optionally set a password), or sign in with password / WhatsApp code.
2. Browse a small curated catalogue, view rich product detail (3 photos, weight, dimensions, allergens) and zoom photos.
3. Check out in three steps (**Cart → Delivery → Payment**), pay by card (incl. Mada) or cash on delivery.
4. See which **branch** the order will be delivered from — the branch is chosen automatically from the delivery
   address and stock ("Delivery branch is chosen in the backend from the address and stock").
5. Track orders, manage account, password and saved addresses, browse branches and read notifications.

Currency is **SAR**; prices include **15 % VAT** (e.g. total SAR 328.00 → "Includes VAT SAR 42.78" = 328 × 15/115).
Phone numbers use the **+966** prefix and the `50 123 4821` grouping.

### A.2 Design philosophy
- **Warm, editorial, premium.** Cream canvas, sand tints and a deep maroon brand colour; photography of the
  gift boxes carries the emotion. Little ornamentation besides the brand **circle pattern**.
- **Calm hierarchy.** One strong maroon primary action per screen, usually pinned to the bottom.
- **Branch transparency.** Almost every commerce screen restates *"Will be delivered from Kuraat · Al Khobar Corniche"* —
  this is a core product idea, not decoration.
- **Soft geometry.** Pill buttons and chips, generously rounded cards (14–20 pt), circular icon buttons.
- **Flat surfaces.** Cards are white with a 1 pt warm border and **no drop shadow**; shadows are reserved for
  floating elements (cart FAB, dialogs, sticky bottom bars).

### A.3 Brand rules (quoted from the guide, page 1)
- Logo stays a **solid colour** — white on maroon, maroon on cream. Never a gradient, stretched or rotated.
- **Gradients only as backgrounds** and only between shades of the same colour (maroon → deeper maroon).
- **Circle pattern:** maroon *or* orange, never both in one design.
- Colour proportions: Cream/Sand **60 %**, Maroon/Deep maroon/Orange **30 %**, Rose/Pink/Hot pink **10 %**.
- Brand typeface **Bahij TheSansArabic**; mockups use **Source Sans 3** + **Noto Sans Arabic** as stand-ins.

### A.4 Principles for implementation
1. Reproduce the PDF; do not restyle. When the PDF is silent, reuse an existing pattern from another screen.
2. Use tokens only (no ad-hoc hex values, sizes or radii in components).
3. Mobile (< 768 px) renders the PDF layout 1:1. Larger screens *re-flow* the same components (multi-column),
   never re-skin them.
4. Every visible control must work (navigation, validation, state change, feedback).

---

## B. Colour system

### B.1 Brand palette (exact, from page 1)
| Token | Name | HEX | Role (per guide) |
|---|---|---|---|
| `cream` | Cream | `#FBF5EF` | App background · 60 % |
| `sand` | Sand | `#F3DDD0` | Cards, chips, tints · 60 % |
| `maroon` | Maroon | `#781232` | Primary: buttons, headers · 30 % |
| `maroon-deep` | Deep maroon | `#491121` | Headings, gradients · 30 % |
| `orange` | Orange | `#C8542D` | Accent (graphics only) · 30 % |
| `orange-light` | Light orange | `#DC785A` | Accent tint |
| `rose` | Rose | `#D7466D` | Highlights · 10 % |
| `pink` | Pink | `#F59698` | Highlights · 10 % |
| `hot-pink` | Hot pink | `#ED3B5C` | Alerts / sale · 10 % |

### B.2 Functional colours (measured from screens)
| Token | HEX | Usage |
|---|---|---|
| `surface` | `#FFFFFF` | Cards, inputs, chips (off), icon buttons, bottom action bar |
| `sand-soft` | `#F7E9E0` (est.) | Unread notification row (sand 50 % over cream) |
| `ink` | `#491121` | Headings, card titles, input values, prices in summaries, totals (measured ≈ `#42101F`, i.e. Deep maroon after AA) |
| `copy` | `#5A3A41` (est.) | Long-form paragraphs (product description, addresses, info notes) |
| `muted` | `#73575D` (est.) | Secondary text: subtitles, meta ("30 pcs · 480 g"), captions, row labels |
| `placeholder` | `#8E747B` (est.) | Input placeholder text |
| `maroon` | `#781232` | Form labels, links, prices on cards, active chip/segment fill, icons |
| `border` | `#E6D3C9` (est.) | Input / secondary-control border (1 pt) |
| `border-subtle` | `#EEE1D8` (est.) | Card border (1 pt) |
| `divider` | `#EBD9CF` (est.) | Row dividers, summary divider |
| `focus-ring` | `rgba(120,18,50,.10)` | 3 pt ring outside focused input (renders `#EFDDDB` on cream) |
| `overlay` | `rgba(64,15,30,.66)` (est.) | Modal scrim (page 18) |
| `viewer-bg` | `#2B0A13` (est.) | Full-screen image zoom background |
| `on-dark-glass` | `rgba(255,255,255,.14)` + border `rgba(255,255,255,.35)` | Back button on maroon headers, icon on maroon cards |

### B.3 Gradients & pattern
- **Maroon header gradient** (auth headers, profile header, splash, banners, confirmed header, branch card):
  `linear-gradient(165deg, #8A1A3E 0%, #781232 45%, #4F1124 100%)` (est. — sampled top-left `#8C1A3E`, bottom-right `#521125`).
- **Circle pattern** — a checkerboard of 44 pt squares; each square holds a centred circle (≈ 72 % of the square).
  Square and circle tones alternate (A-square/B-circle, B-square/A-circle). Tones are ±4–6 % luminance of the base:
  - on maroon: dark `rgba(0,0,0,.07)` / light `rgba(255,255,255,.035)`; the pattern fades out toward the title area
    (top-visible on headers, bottom-visible on splash).
  - on cream (Payment successful): sand `#F3DDD0` at ≈ 45 % opacity, fading out downward.
  - Splash uses a larger 52 pt cell.

### B.4 Semantic states (derived — the PDF shows no explicit error/warning UI)
| State | Colour | Notes |
|---|---|---|
| Success | `maroon` (+ sand tint backgrounds) | The PDF expresses success with maroon checks (Payment successful, Verified tag, Delivered tag). No green is used anywhere. |
| Error / alert | `hot-pink` `#ED3B5C` | Guide reserves Hot pink for "Alerts / sale". Used for field error border/text and destructive confirmation emphasis. |
| Warning / medium | `maroon` text | Password "Medium" hint is rendered in maroon in the PDF. |
| Info | `sand` background + `body` text + maroon icon | Info banners (Cart note, Password screen). |
| Disabled | 45 % opacity of the component | Unchecked password rule uses a faded maroon check (page 7). |

---

## C. Typography

### C.1 Families
| Role | Production | Web build (stand-in, as in the mockups) |
|---|---|---|
| Latin | Bahij TheSansArabic | **Source Sans 3** (400, 500, 600, 700) |
| Arabic | Bahij TheSansArabic | **Noto Sans Arabic** (500, 700) — splash/brand line `كُرات شريك الجمعات` |

Fonts are self-hosted (`@fontsource`) so the demo works offline. Swapping in Bahij = one change in `tokens.js` + `index.css`.

### C.2 Scale (page 1 declares Title 28/700, Heading 20/700, Body 15/400, Label 13/600, Caption 12/400; the rest are measured)
| Token | Size / line-height / weight | Used for |
|---|---|---|
| `display` | 30 / 34 / 700 | Maroon header titles: "Create your account", "Verify your number", "Hello, welcome back" (white) |
| `title` | 28 / 34 / 700 | "Welcome to kuraat", "Payment successful", "Order confirmed!" |
| `h1` | 24 / 30 / 700 | Product name on detail, "No orders yet", profile name (22) |
| `heading` | 20 / 26 / 700 | Section titles ("Our sweets", "Our branches"), screen-header titles ("My cart") |
| `h3` | 18 / 24 / 700 | Sub-sections ("Description", "Deliver to", "Payment method", "Your items") |
| `body-lg` | 16 / 24 / 400 | Product description paragraphs |
| `input` | 16 / 22 / 500 | Input values |
| `button` | 16 / 20 / 700 | Large buttons |
| `body` | 15 / 22 / 400 | Default body, subtitles, list text |
| `body-strong` | 15 / 20 / 600–700 | Card titles, list item titles, row values |
| `small` | 14 / 20 / 400–600 | Chips, secondary buttons, meta rows, step labels |
| `label` | 13 / 18 / 600 | Form labels (maroon), meta (muted, 400) |
| `caption` | 12 / 16 / 400 | VAT line, timestamps, helper text |
| `overline` | 12 / 16 / 700, `+0.08em`, uppercase | "NEW COLLECTION", "TODAY", "EARLIER" |
| `tag` | 12 / 16 / 700 | Tags/badges ("Default", "Preparing", "2.4 km") |

Text colours: headings `ink`; paragraphs `copy`; meta `muted`; labels/links/prices `maroon`; on maroon → white
(secondary lines white 75–80 %). Letter-spacing 0 except `overline`.

---

## D. Spacing & layout

### D.1 Grid & spacing (base unit 4 pt)
| Token | Value | Where |
|---|---|---|
| Screen gutter (app) | **20** | Home, product, cart, profile, lists |
| Screen gutter (auth sheet) | **24** | Sign up / OTP / password / sign in forms |
| Status-bar safe area | 54 | Top of first row (header buttons at y = 54) |
| Label → field | 8 | |
| Field → next label | 20 | |
| Card → card (stack) | 12 | Cart items, orders, addresses, branches |
| Grid gap | 16 | 2-column product grid |
| Section gap | 24–28 | Between home sections |
| Card padding | 14–16 | Product card 14; list cards 16 |
| Bottom action bar | padding 16/20, safe-area 24 | White, top shadow |

### D.2 Radii
| Token | Value | Used for |
|---|---|---|
| `r-xs` | 8 | Small thumbnails (order item 44 pt), tag "Default" uses pill |
| `r-sm` | 12 | Icon tiles (42 pt), thumbnails on hero (50 pt), OTP boxes use 14 |
| `r-md` | 14 | Inputs, OTP cells, spec tiles, promo field |
| `r-lg` | 16 | Info banners, branch strip, "Will be delivered from" card |
| `r-xl` | 20 | Content cards (product, cart item, summary, order, address, branch), map |
| `r-2xl` | 24 | Home promo banner |
| `r-sheet` | 28 | Top corners of overlapping sheets, dialog |
| `r-pill` | 9999 | Buttons, chips, search bar, tags, stepper, toggle |

### D.3 Elevation
| Token | Value | Used for |
|---|---|---|
| none | border `1px border-subtle` | All cards (flat) |
| `shadow-fab` | `0 12px 28px -8px rgba(73,17,33,.45)` | Floating cart button |
| `shadow-bar` | `0 -8px 24px rgba(73,17,33,.06)` | Sticky bottom action bar |
| `shadow-dialog` | `0 24px 60px -12px rgba(43,10,19,.40)` | Dialogs, sheets |
| `shadow-float` | `0 4px 14px rgba(73,17,33,.10)` | White pills over imagery (zoom pill, "Use current location") |
| `ring-focus` | `0 0 0 3px rgba(120,18,50,.10)` + border `maroon` | Focused input |

### D.4 Responsive adaptation (web)
| Breakpoint | Behaviour |
|---|---|
| `< 768` (mobile) | Exact PDF layout. Fixed bottom action bars, cart FAB, full-bleed hero, overlapping sheets. |
| `768–1023` (tablet) | Same mobile layout centred in a 640 pt column; product grid 3 columns; dialogs centred. |
| `≥ 1024` (desktop) | Persistent top **app bar** (logo · search · branches · notifications · cart · avatar). Content max-width 1200. Multi-column re-flow: product grid 3–4 cols, product detail 2 cols (gallery / info + inline purchase bar), checkout 2 cols (steps content / sticky order summary), branches 2 cols (sticky map / list), auth screens split (maroon brand panel / form). Account forms stay in a 640 pt column (forms are not stretched). Cart FAB hidden (cart lives in the app bar). |

---

## E. Component specifications

| Component | Spec |
|---|---|
| **Primary button** | Height 54, pill, fill `maroon`, text white `button` 16/700, optional leading icon 20 (WhatsApp, lock) or trailing chevron. Pressed: `#5F0E28`. Disabled: 45 % opacity. Loading: spinner replaces label. |
| **Secondary button** | Height 54, pill, transparent/white fill, 1 pt `maroon` border, `maroon` text 16/700. |
| **Small buttons** | Height 46 ("Edit/Delete", "Call/Directions"), 44 ("Shop now", white fill, maroon text), 15/600, leading 18 icon. |
| **Text link** | `maroon` 15/700 ("Sign in", "See all", "Read more", "Manage", "Edit number"); muted lead-in text + bold maroon link. |
| **Icon button** | 44 circle, white fill, 1 pt `border-subtle`, maroon 20 icon (back, bell, heart, expand). On maroon: glass variant. On imagery: white 90 %. |
| **Avatar** | Circle, `maroon` fill, white initials 700: 44 (app bar), 76 (profile; cream fill + maroon text on maroon header), 104 (account, with 32 pencil badge). |
| **Text input** | Height 52, `r-md`, white fill, 1 pt `border`, padding 16, leading icon 20 maroon, value `input` 16/500 ink, placeholder `placeholder`. Focus: maroon border + 3 pt focus ring. Error: hot-pink border + 13/600 hot-pink message below. Trailing: eye toggle, lock, "Verified" tag, chevron (select). |
| **Phone field** | Country box 80 × 52 ("+966 ⌄") + 12 gap + number input. Format `50 123 4821`. |
| **Search bar** | Height 52, pill, white, 1 pt border, search icon, placeholder; trailing 40 maroon filter button (home). |
| **Segmented control** | Height 52, `r-md` track `sand`, 4 pt inset, active pill `maroon` (white 15/700), inactive maroon 15/600. Gender: Male/Female/Other; Sign-in: Password/WhatsApp code. |
| **Chip** | Height 36, pill, padding 16, 14/600. Off: white + 1 pt border, maroon text. On: maroon fill, white text. Horizontally scrollable row. |
| **Tag / badge** | Height 22–24, pill, padding 10, `tag` 12/700. Light: sand fill + maroon text ("Milk", "Branch", "Delivered" with check, "Verified"). Dark: maroon fill + white ("Default", "Preparing", "Nearest to you", "2.4 km"). Counter badge on FAB: 20 circle white-on-maroon with cream ring. |
| **Quantity stepper** | Pill track `sand`, 4 pt padding, two 36 white circles with − / + (maroon 18 icon), value 16/700 ink between. Large (product bar) 44 circles. |
| **Toggle** | 46 × 26 track, knob 22 white. On: maroon. Off: sand. |
| **Radio** | 22 circle, 1.5 pt border (`border` off / `maroon` on), 10 maroon dot when on. |
| **Checkbox rule** | 22 maroon circle with white check (met) / 45 %-opacity version (unmet) + 15/400 text. |
| **Strength meter** | 4 segments, 4 pt high, 6 gap, pill. Filled `maroon`, empty `sand`. Caption 13/600 maroon. |
| **OTP input** | 6 cells, 48 × 61, `r-md`, white, 1 pt border, digit 24/600 ink; active cell maroon border + ring. |
| **Card** | White, 1 pt `border-subtle`, `r-xl` 20, padding 16. No shadow. |
| **Tinted card / info banner** | `sand` fill, `r-lg` 16, padding 16, leading icon (20 maroon) or 44 white circle icon; text `body` 14–15. |
| **Product card** | Width = half grid (167 on 390 frame), `r-xl`, white, border. Image 158 tall (cover) with 34 white heart button (top-right, 8 inset). Body padding 14: title 15/600 ink (2 lines max), meta 13 muted, price 16/700 maroon + 36 maroon "+" circle. |
| **Branch strip** (home) | `sand` 64 tall, `r-lg`; 44 white circle store icon; small muted line + bold ink line; dark tag "2.4 km". |
| **Promo banner** | 132 tall, `r-2xl`, maroon gradient + pattern; overline (white 80 %), title 22/700 white, white "Shop now ›" 44 button; circular photo 108 with 3 pt cream ring. |
| **Screen header** | 44 back button (left) · centred title `heading` 20/700 ink · optional right element (44 icon button, "3 items" sand tag, status tag, "Mark all read" link). Top 54. |
| **Maroon header (auth/profile)** | Gradient + pattern, height ≈ 246; 44 glass back button at (20, 54); title `display` white at y ≈ 148, 24 gutter. Followed by cream **sheet** overlapping by 28 with `r-sheet` top corners. |
| **Checkout stepper** | 3 steps: 24 circle (current: maroon + white number; done: maroon + white check; todo: sand + maroon number) + 14/600 label; connectors 1.5 pt (done maroon, todo `divider`). |
| **Radio card** (address, payment) | White card, 1 pt border; selected: 1.5 pt maroon border. Radio left, title 16/700 + tag, body 15, meta 13 muted. Payment rows have 42 sand icon tiles. |
| **Summary rows** | Label 15 muted ←→ value 15/600 ink; total row 16/700 ink with value 22/700 maroon; caption VAT line right-aligned. |
| **Timeline** | 22 nodes: done = maroon fill + white check; current = maroon ring + dot; todo = `border` ring. Connector 2 pt (done maroon, todo divider). Title 16/700 (todo: muted), time 13 muted. |
| **Bottom action bar** | White, `shadow-bar`, padding 16 20 24; holds full-width primary button, or stepper + Add to cart + Buy now, or "Total · 3 items / SAR 328.00" row + Pay button. |
| **Floating cart button** | 64 circle maroon, `shadow-fab`, white bag icon 26, counter badge top-right. Bottom-right 20/24 inset. |
| **Dialog** | White, `r-sheet` 28, padding 24, `shadow-dialog`, centred over `overlay`; 72 sand icon circle; centred text; primary + link actions. |
| **Bottom sheet** (derived) | Same surface as dialog, anchored to bottom on mobile with 28 top radius and grab handle; centred dialog ≥ 768. |
| **Toast** (derived) | Ink `#491121` pill, white 14/600 text, maroon-tint icon; slides from bottom above action bars; auto-hides 2.6 s. |
| **Empty state** | 226 concentric illustration (sand ring 226 + white disc 156 + 60 maroon line icon + scattered sand dots), `h1` title, `body` muted text, 54 primary button (auto width ≈ 248). |
| **Map illustration** | `r-xl`, sand blocks, cream roads, maroon pins (selected larger), orange "you are here" dot with halo; "Use current location" white pill floating bottom-right. |
| **Contact footer** (home) | Maroon gradient + pattern, `r-sheet` top corners; title 20/700 white; rows with 44 glass icon circle + caption (white 75 %) + value 15/700 white. |

Icons: 1.75 pt stroke line icons, 20 pt default (Lucide matches the PDF style). WhatsApp glyph is a brand mark drawn as custom SVG.

---

## F. Screen-by-screen documentation

Coordinates refer to the 390 × 844 frame. "→" denotes navigation.

### 01 · Splash (page 3)
1. **Purpose:** brand moment while the app boots / restores the session.
2. **Layout:** full-bleed maroon gradient; circle pattern visible at top and strongly at the bottom, fading toward the centre.
3. **Components:** white logo (≈ 216 wide) centred at y ≈ 340; 40 × 1 pt divider (white 40 %); tagline "Your partner for every gathering" (white 80 %, 17/400); Arabic line "كُرات شريك الجمعات" (white, 22/700 Noto Sans Arabic); pager dots at bottom (active 26 × 6 pill white, inactive 6 pt white 40 %).
4. **Interaction:** auto-advances (~2.4 s, dots animate as a progress indicator); tap anywhere skips.
5. **Navigation:** → Home if a session exists, otherwise → Welcome.
6. **Responsive:** identical at all sizes (content centred).

### 02 · Welcome (page 4)
1. **Purpose:** entry choice — create account or sign in.
2. **Layout:** hero photo (Truffle Box · Classic) top 55 %; cream sheet (`r-sheet` top) from y ≈ 410.
3. **Components:** maroon logo (≈ 132 wide); title "Welcome to kuraat" (`title`, ink); subtitle "Fresh truffles, cakes and pastries, delivered from the branch nearest you." (`body` muted, centred); Primary "Create an account"; Secondary "Sign in" (12 gap); legal line 13 muted with bold maroon "Terms" and "Privacy Policy".
4. **Interactions:** Create → Sign up; Sign in → Sign in; Terms / Privacy open an in-app dialog.
5. **Responsive:** desktop splits 50/50 — hero photo fills the left panel, sheet content centred on the right.

### 03 · Sign up (page 5)
1. **Purpose:** collect name, mobile, gender, delivery address; send WhatsApp code.
2. **Layout:** maroon header (back + "Create your account") + sheet with fields (24 gutter).
3. **Components:** Full name (user icon); Mobile number (+966 box + number; helper with WhatsApp icon "We will send a 6-digit code on WhatsApp"); Gender segmented (Male / Female / Other); Delivery address (map-pin icon) + "Use my current location" link (crosshair icon); Primary "Continue with WhatsApp" (WhatsApp icon); "Already have an account? **Sign in**".
4. **Validation:** name ≥ 2 chars; Saudi mobile 9 digits starting with 5; gender required; address ≥ 5 chars; number not already registered.
5. **Interactions:** current location → locating state → fills address; submit → loading → OTP.
6. **Navigation:** back → Welcome; → Verify (purpose sign-up); "Sign in" → Sign in.
7. **Responsive:** desktop split — maroon header becomes a full-height left brand panel holding back button + title; form on the right (max 440).

### 04 · WhatsApp OTP — "Verify your number" (page 6)
1. **Purpose:** confirm phone ownership.
2. **Components:** 60 sand circle with WhatsApp icon; "Code sent on WhatsApp to" (muted) + **+966 50 123 4821** (17/700 ink) + "Edit number" link; 6 OTP cells; "Resend code in **00:42**" countdown (becomes "Resend code" link at 0); Primary "Verify & continue"; divider with "Did not get the code on WhatsApp?"; Secondary "Set a password instead" (key icon); caption "You can still sign in with a WhatsApp code later."
3. **Interactions:** auto-advance between cells, paste 6 digits, backspace to previous; verify enabled when 6 digits; wrong code shows error state; resend restarts 60 s timer.
4. **Navigation:** Edit number → back to previous form; Verify → Home (sign-up/sign-in), → Set password (reset), → Account (phone change); "Set a password instead" → Set password (sign-up only; hidden for other purposes).

### 05 · Set your password (page 7)
1. **Purpose:** optional fallback credential "Used when WhatsApp codes do not arrive".
2. **Components:** New password (lock + eye) with strength meter + caption "Strong password"; Confirm password (eye-off); rule checklist (At least 8 characters · Upper and lower case letters · A number · A symbol, for example ! or #); Primary "Create account"; caption "Your password lets you sign in without a WhatsApp code."
3. **Validation:** first three rules required; symbol recommended; confirmation must match.
4. **Navigation:** back → OTP; Create account → Home (account created, signed in). In reset mode title stays, button reads "Save password" → Home.

### 06 · Sign in (page 8)
1. **Purpose:** returning users.
2. **Components:** header "Hello, welcome back"; segmented Password | WhatsApp code; Mobile number (+966); Password (lock + eye) + "Forgot password?" link (right); Primary "Sign in"; "or" divider; Secondary "Get a code on WhatsApp" (WhatsApp icon); "New to kuraat? **Sign up**".
3. **WhatsApp code tab:** password field hidden; primary becomes "Send code on WhatsApp".
4. **Validation & errors:** unknown number, wrong password, no password set (suggest WhatsApp code).
5. **Navigation:** → Home; WhatsApp code → OTP (sign-in); Forgot → OTP (reset) → Set password; Sign up → Sign up.

### 07 · Home (page 9) and 08 · Home scrolled (page 10)
1. **Purpose:** discovery hub.
2. **Layout (top → bottom):** header row (44 bell button with notification dot · centred maroon logo ≈ 116 · 44 avatar "SM"); search bar with filter button; nearest-branch strip; promo banner; "Our sweets" + "See all"; category chips (All, Truffles, Cakes, Pastries, Breakfast); 2-column product grid (6 products); "Our branches" + "View all ›" with horizontally scrolling branch cards (≈ 254 wide: "Branch" tag, distance, name 17/700, address muted, "Open · 10 AM – 12 AM" with clock); maroon "Contact us" footer (Head office, Support 9 AM – 11 PM +966 13 555 0100, Email care@kuraat.com); floating cart button with count. When scrolled, header row stays pinned with a 1 pt divider.
3. **Interactions:** bell → Notifications; avatar → Profile; search filters products live (empty state when nothing matches); filter → sort/category sheet; branch strip → Branches; Shop now → Truffles collection; chips filter; card → Product detail; heart toggles favourite (persisted); "+" adds 1 to cart with toast; See all → resets filters to "All"; View all / branch card → Branches; contact rows → tel/mailto/maps; FAB → Cart.
4. **Responsive:** desktop app bar replaces header row; banner + branch strip side-by-side; grid 3 columns (4 at ≥ 1280); branches grid; contact footer as 3-column band.

### 09 · Product detail (page 11)
1. **Layout:** full-bleed hero (≈ 375 tall) with 44 white back (left), heart and expand buttons (right); thumbnails (3 × 50, active white border) bottom-left; "⊕ 1 / 3 · Tap to zoom" white pill bottom-right. Cream sheet overlaps hero (top radius 28).
2. **Content:** name (`h1` ink) + price (22/700 maroon) on one row; subtitle (muted, e.g. "Signature gift box · Contains milk, nuts"); 3 spec tiles (Weight · Pieces · Dimensions; label 13 muted / value 15/700 ink); "Will be delivered from" sand card (truck icon, branch name, "Closest to you · In stock · Today, 5 – 7 PM"); Description (3-line clamp) + "Read more".
3. **Bottom bar:** quantity stepper · secondary "Add to cart" (bag icon) · primary "Buy now".
4. **Interactions:** swipe/thumb to change photo; hero tap / expand / pill → Image zoom; heart toggles favourite; Read more expands (screen 10); Add to cart → toast + badge; Buy now → adds and opens Cart.
5. **Responsive:** desktop two columns — gallery (sticky) left; info right with inline purchase bar.

### 10 · Product detail — expanded (page 12)
Same screen after "Read more" and scrolling: compact sticky header (back · product name 20/700 · heart) appears once the hero scrolls away. Shows full Description (two paragraphs), **Product details** table card (Net weight, Dimensions (L × W × H), Pieces, Shelf life, Storage — label muted / value 15/600 ink), **Ingredients & allergens** paragraph + allergen tags (Milk, Nuts, Soy, May contain gluten — sand tags), and the "Will be delivered from" card. Bottom bar unchanged.

### 11 · Image zoom (page 13)
1. **Layout:** `viewer-bg` full screen; top row: 44 glass close (×), counter "2 / 3" (white 16/700), 44 glass share; zoomable image; right-side vertical glass control rail (zoom in, zoom out, fit); zoom badge "175 %" bottom-left; slider row (− icon, track with white knob, + icon); thumbnails (active: white 2 pt border); hint "Pinch or double-tap to zoom · drag to pan" (white 70 %, 13).
2. **Interactions:** wheel/pinch/slider/buttons zoom 100–300 %; double-click toggles 100/200 %; drag pans when zoomed; thumbnails/arrow keys switch photo; Esc/close returns; share uses the native share sheet or copies the link.

### 12 · Cart (page 14)
1. **Components:** header (back · "My cart" · "3 items" sand tag); checkout stepper (1 current); item cards (88 thumbnail `r-sm`, name 16/700, meta 13 muted, "From Al Khobar · Corniche" maroon 13/600 with store icon, stepper, line total 16/700 ink, trash icon top-right); promo row (tag-icon input "Promo code" + 54 secondary "Apply"); summary card (Subtotal (n items), Delivery, divider, **Total** + SAR value, "Includes VAT SAR x"); sand note "Both items are available at **Kuraat · Al Khobar Corniche**, your nearest branch. Stock is confirmed at checkout."; bottom bar "Continue to delivery ›".
2. **Interactions:** qty ± (min 1; − at 1 asks to remove), delete with undo toast, promo validation (valid / invalid / applied state with remove), totals recalculate live.
3. **Empty cart (derived from empty-state pattern):** "Your cart is empty" + "Start shopping".
4. **Responsive:** desktop — items left, promo + summary + CTA in a sticky right column.

### 13 · Delivery details (page 15)
1. **Components:** header "Delivery details"; stepper (Cart done ✓, 2 current); "Deliver to" + "Manage" link; address radio cards (label 16/700 + "Default" dark tag, address 15 body, "Name · phone" 13 muted); dashed "+ Add new address" tile (1 pt dashed border, 54 tall); "Phone number for this delivery" (+966 field) + caption "The courier will call this number on arrival."; sand branch card "Will be delivered from **Kuraat · Al Khobar Corniche**" + "2.4 km" dark tag (recomputed per selected address); bottom bar "Continue to payment ›".
2. **Navigation:** Manage → Saved addresses; Add new address → Edit address (new) → back to Delivery with the new address selected.

### 14 · Payment (page 16)
1. **Components:** stepper (✓ ✓ 3); "Payment method"; radio cards: **Credit / debit card** (Visa, Mastercard, Mada) expands to Card number (card icon + lock), Expiry (MM / YY), CVV, "Save this card for next time" toggle; **Cash on delivery** ("Pay when your order arrives"); bottom bar "Total · 3 items  SAR 328.00" + primary "🔒 Pay SAR 328.00".
2. **Validation:** Luhn card number, future expiry, 3–4 digit CVV.
3. **Interaction:** processing state (button spinner, inputs locked) → Payment successful; declined card shows an inline error.
4. **Deliberate deviation (19 Nov 2026) — card is paid on RSOF's secure payment page:** the card radio no longer expands
   to card fields (no card number, expiry, CVV or "Save this card" in the app). Subtitle "Mada, Visa, Mastercard · on a
   secure payment page"; when selected, a muted line "After paying, come back here. We'll check your payment for you."
   The bottom bar reads "🔒 Continue to payment · SAR …" (the order is placed first, then paid). While card payment is
   not working (the kuraat server's `GET /checkout/payment-options` says `card: false`) the card radio is greyed out
   (50 % opacity, subtitle "Card payment is not available right now") and cash on delivery / pay at branch is chosen.
   Do not re-add the card form when "matching the PDF".

### 15 · Payment successful (page 17)
Cream with sand circle pattern fading downward; 126 sand halo + 104 maroon circle + white check; title "Payment successful"; "SAR 328.00 paid with Visa •••• 4242"; details card (Transaction ID, Date, Method, Amount); WhatsApp receipt note; "Confirming your order with the branch…" + progress bar (4 pt, maroon on sand) that fills, then primary "Continue" (enabled when confirmed) → Order confirmed. Cash on delivery shows "Order placed" wording with method "Cash on delivery".
**Card not paid yet (19 Nov 2026):** the same cream page without the check halo: title "Complete your payment", "Order #…",
then a white card ("Complete your payment" h3, "Your order is placed. Pay SAR … on the secure payment page to confirm it.",
primary "🔒 Pay SAR …" that opens RSOF's page — a new tab on the web, the phone's browser in the app —, secondary
"I've paid · Check again", muted return hint) and a ghost "View my order". The same card sits at the top of the order
detail screen while the order waits for its payment; order cards in the list add a bold hotpink "Waiting for payment"
under the total. Once paid it is the normal "Payment successful" page ("SAR … paid by card", details card with Order
number instead of Transaction ID). The WhatsApp line always reads "Your order details have been sent to your WhatsApp"
(RSOF sends no payment receipt).

### 16 · Order confirmed + branch popup (page 18)
1. **Underlying screen:** maroon header with pattern, 72 white circle + maroon check, "Order confirmed!" (`title` white), "Order #KR-20418 · Today, 12:21" (white 80 %). Sheet: sand "Estimated delivery / Today, 5:00 – 7:00 PM" card; "Your items" rows (56 thumbnail, name, "Qty n"); white "Delivering to" card; two buttons side-by-side: Secondary "Track order", Primary "Back to home".
2. **Popup (opens automatically):** 72 sand circle store icon; "Your order will be delivered from"; **Kuraat · Al Khobar Corniche** (22/700 ink); branch address (muted); sand note with pin "Chosen for your delivery address, 2.4 km away. Stock confirmed at this branch."; Primary "Got it" (closes); link "View branch details" → Branches (branch highlighted).
3. **Navigation:** Track order → Order detail; Back to home → Home.

### 17 · Profile (page 19)
Maroon header (back · "Profile" white 20/700), 76 cream avatar "SM", name 22/700 white, phone white 80 %. Sheet with 4 menu cards (44 sand icon circle, title 16/700, subtitle 14 muted, chevron): Account ("Name, phone number, gender"), Password ("Set or change your password"), Orders ("View your previous orders"), Saved addresses ("3 saved addresses" — live count). Secondary "Log out" (log-out icon) → confirm dialog → Welcome.

### 18 · Account (page 20)
104 avatar with pencil badge (choose photo → preview, persisted); Full name; "Mobile number (WhatsApp)" with phone icon + "✓ Verified" sand tag, helper "Changing your number needs a new WhatsApp code."; "Email (optional)" with mail icon; Gender segmented; "Default address" card (pin tile, chevron → Saved addresses); bottom bar "Save changes" (disabled until changed; loading → toast). Changing the number → OTP (change-phone) before saving.

### 19 · Password (page 21)
Sand info banner ("Signed up with a WhatsApp code? **Set a password** to sign in without one. No current password is needed the first time."); Current password (hidden when the user has no password yet); New password with meter + hint "Medium: add a symbol to make it stronger"; Confirm new password; link "Forgot your current password? Get a WhatsApp code" → OTP (reset); bottom bar "Update password" (or "Set password").

### 20 · My orders (page 22)
Header "My orders"; chips All / Ongoing / Delivered; order cards: "#KR-20418" (17/700) + date (13 muted), status tag (Preparing = dark; Out for delivery = dark; Delivered = light with check), up to 3 thumbnails (48, `r-sm`), "n items" + total 18/700; sand branch row "Will be delivered from / Delivered from" + branch name + chevron. Card → Order detail; branch row → Branches.

### 21 · My orders — empty (page 23)
Empty-state illustration with package icon; "No orders yet"; "When you place an order it will appear here, together with the branch it was delivered from."; Primary "Start shopping" → Home. Also used for an empty filter tab.

### 22 · Order detail / tracking (page 24)
Header "Order #KR-20418" + status tag. Timeline card: Order confirmed (12:21) · Preparing at the branch (12:25) · Out for delivery (Estimated 4:30 PM) · Delivered (Estimated 5:00 – 7:00 PM). Maroon branch card (pattern) with glass store icon, "Will be delivered from", branch name, address, two outline-white pills "Call branch" (tel:) and "Directions" (maps). Items card (thumb, name, Qty, price), divider, Delivery, Total (incl. VAT). Info card: Deliver to, Phone, Payment. Status advances in real time from the order timestamps.

### 23 · Saved addresses (page 25)
Address cards: 40 sand icon tile (pin for Home/Other, store for Office), label 17/700, "Default" tag, address 15 body, "Name · phone" 13 muted, two 46 pill buttons "✎ Edit" / "🗑 Delete" (confirm dialog; default cannot be deleted until another default exists → auto-reassign). Bottom bar "+ Add new address".

### 24 · Edit address (page 26)
Map illustration (166 tall) with maroon pin and "Use current location" pill; Label chips Home / Office / Other (Other reveals a custom name field); Address (pin icon); District + City (select ⌄) side-by-side; Landmark (optional) with placeholder "Near Al Rakah Park"; Phone for this address (phone icon); "Make this my default address" toggle; "🗑 Delete this address" link (edit mode only); bottom bar "Save address". New mode title: "Add address".

### 25 · Our branches (page 27)
Search "Search by city or area"; city chips All / Al Khobar / Dammam / Riyadh (+ Dhahran, Al Ahsa, Jeddah on scroll); map with pins (selected/nearest pin larger) and "you" dot; branch cards (name 17/700, "Nearest to you" dark tag on the closest, address muted, clock + "Open · 10 AM – 12 AM" + "· 2.4 km", Secondary "Call" + Primary "Directions", 46 tall). Pin click highlights and scrolls to its card. Empty state for no matches.

### 26 · Notifications (page 28)
Header "Notifications" + "Mark all read" link (2-line, right). Sections TODAY / EARLIER (`overline` muted). Rows: 40 sand icon circle (package, credit-card, gift, truck, tag, lock), title 15/700 ink, body 14 muted, time 12 muted, unread rows on `sand-soft` with a 8 maroon dot on the right. Tap → marks read and opens the related screen.

---

## G. Navigation flow

```
Splash ──(session?)──► Home
   └──► Welcome ─► Sign up ─► Verify (WhatsApp OTP) ─► Home
            │            └──────► Set password (instead) ─► Home
            └──► Sign in ─(password)────────────────────► Home
                     ├─(WhatsApp code)─► Verify ────────► Home
                     └─(Forgot password)► Verify ─► Set password ─► Home

Home ─► Notifications ─► (Order detail | Product | Password | Home)
     ─► Profile ─► Account (─► Verify for number change) | Password (─► Verify reset) | My orders ─► Order detail | Saved addresses ─► Edit/Add address
     ─► Product detail ─► Image zoom
     ─► Branches
     ─► Cart ─► Delivery ─(Manage)► Saved addresses / (Add) ► Add address
                       ─► Payment ─► Payment successful ─► Order confirmed (+ branch popup)
                                                             ├─► Track order ─► Order detail
                                                             ├─► View branch details ─► Branches
                                                             └─► Back to home ─► Home
```
- **Entry:** `/` Splash. **Main navigation:** mobile — Home header (bell / avatar), floating cart, in-content links; desktop — app bar.
- **Back navigation:** every non-root screen has a 44 back button → previous history entry (falls back to a logical parent when opened directly).
- **Guards:** signed-out users are redirected to Welcome; signed-in users skip auth screens; Delivery/Payment require a non-empty cart; Success/Confirmed require an order id.
- **Conditional:** Splash branching; OTP purpose (sign-up / sign-in / reset / change phone); Password screen shows "Current password" only if one exists; Edit address delete only in edit mode; Continue on Success enabled after branch confirmation.

---

## H. Design restrictions (must not be violated)

1. Use only the palette in §B; never introduce new hues (no green success, no blue links).
2. Logo: solid white on maroon or solid maroon on cream; never gradient, recoloured, stretched or rotated.
3. Gradients only as backgrounds and only maroon → deeper maroon.
4. Circle pattern: maroon (or sand on cream) — never mix with orange in one view.
5. Orange / light orange are graphics-only accents (map "you" dot) — never text or buttons.
6. Primary buttons are 54 pt pills in maroon with white bold text; secondary are maroon-outlined pills. Do not change heights/radii.
7. Cards are flat (white + 1 pt warm border); do not add drop shadows to cards.
8. Keep the "Will be delivered from <branch>" messaging wherever the PDF shows it.
9. Keep text hierarchy: deep-maroon headings, muted secondary text, maroon labels/links/prices.
10. Keep 20 pt app gutters / 24 pt auth gutters on mobile; consistent 12 pt card stacks and 16 pt grid gaps.
11. Icons: thin line icons, maroon; no filled/duotone icon sets.
12. Do not add screens or features not implied by the PDF; derived states (errors, empty cart, toasts, filter sheet) must reuse existing components.
13. Arabic brand line uses Arabic typeface; do not machine-translate other UI.
14. Currency format: `SAR 185` on cards/detail, `SAR 185.00` in cart, checkout, receipts and orders.

### Ambiguities & conservative decisions
| Topic | Decision |
|---|---|
| Splash pager dots (3) | Treated as a boot progress indicator (no onboarding slides exist in the PDF). |
| Filter button on Home search | Opens a bottom sheet with Sort + Category chips (reuses chip/sheet styling). |
| "See all" | Resets filters and scrolls to the full grid (no separate catalogue screen exists). |
| UPI | **Removed** (17 Nov 2026, product decision): the app serves Saudi Arabia, where UPI (an India-only system) is not used. The PDF's UPI card is not built; payment is card (Visa, Mastercard, Mada) or cash on delivery. |
| Home "Deliver to" row | **Added** (17 Nov 2026, product decision; exception to rule 12). Between the Home header and the search bar on phones/tablets, top of the content on desktop: 40 sand `IconTile` (map pin) · "Deliver to" `label` muted · "Home · Al Rakah, Al Khobar" 15/700 ink + maroon chevron-down. Opens a bottom sheet "Deliver to" with the Delivery screen's address radio cards (PDF 13), the dashed "+ Add new address" tile and a "Manage saved addresses" link. The chosen address drives Home's nearest branch, is pre-selected at checkout and becomes the default. No addresses → "Add a delivery address" (+) opens Add address and comes back to Home. |
| Favourites, Notifications (26), promo codes | **Removed** (18 Nov 2026, product decision): no Favourites screen or hearts, no Notifications screen or bell (Home header keeps the logo centred), no promo-code field in the cart. Do not re-add them when matching the PDF. |
| My orders status filter + refresh | **Changed** (18 Nov 2026, product decision): the All / Ongoing / Delivered chips (PDF 20) become one "Show" pill (chip styling: white, 1 pt `line` border, maroon 15/600 text, chevron) that opens the status groups — All orders, Placed, Needs attention, Preparing, Ready for pickup, On the way, Completed, Cancelled (web: native select; mobile: bottom sheet radio list). A 44 refresh `IconButton` (refresh-cw, spins while busy) sits in the My orders and Order tracking headers. On phones the tracking status tag moves above the timeline so the order number fits the header. Status labels come from the server (never RSOF names). |
| Category pills | Shown only when every product has a category; otherwise no chips row and no Category section in the filter sheet (18 Nov 2026). |
| Branch being confirmed | **Derived state** (18 Nov 2026): RSOF assigns the branch after the order is placed. Until then the existing parts show it, with no new visuals — order card sand row ("Will be delivered from" · **Branch being confirmed**, no chevron, not a link); tracking maroon branch card (same header, explanatory `small` text, no Call/Directions pills); order-confirmed popup ("The nearest branch with your items", muted line, sand pin note, Primary "Got it", link "Track order"); payment success line "Sent to the nearest branch". The PDF versions show as soon as RSOF assigns a branch. |
| Delivery or branch pickup | **Added** (18 Nov 2026, product decision; exception to rule 12, built only from existing parts). Delivery details (PDF 13) gets the sign-in `SegmentedControl` at the top — "Delivery" · "Branch pickup" (52 high, sand track, maroon active pill). Delivery is the PDF screen. Pickup: header "Pickup details"; sand `InfoBanner` (store icon) "Collect your order from the branch we confirm after you order — usually the nearest one with your items. Show your order number at the counter."; phone field "Phone number for this order" (helper "We use it to reach you about your pickup."); `DeliveryFromCard` labelled "Likely pickup branch" with the distance tag when the server can estimate one; no address list. The Order summary has no Delivery row (no fee) and comes priced by the server. |
| Pay now / Pay at branch | **Added** (18 Nov 2026). Payment (PDF 14) for pickup offers two radio cards instead of Card / Cash on delivery: "Pay now" (card icon · "Credit / debit card · Visa, Mastercard, Mada", the card form) and "Pay at branch" (store icon · "Pay when you collect your order", hint "Please pay SAR 313.00 at the pickup counter when you collect your order."). Pay at branch's button reads "Place order · SAR 313.00" like cash on delivery; payment success (PDF 15) says "Order placed" · "Pay SAR 313.00 at the branch when you collect your order" with Method "Pay at branch" and Amount due. The payment gateway is still simulated. |
| Pickup order screens | **Derived states** (18 Nov 2026). Tracker steps: Order confirmed · Preparing at the branch · **Ready for pickup** · **Picked up** (real times only, no estimates). Tag "Ready for pickup" / "Picked up" (check). Order card and maroon branch card say "Pick up from" / "Picked up from". Order tracking adds a white `Card` above the branch card, centred: "Show this at the pickup counter" (label), the order number `#KR-20418` in 28/700 maroon, help `small` muted "Staff can find it by the number 20418 or your phone number." (ongoing orders only). The info card reads Collect from · Phone · Payment (no Deliver to, no Delivery row, no delivery-code note). Order confirmed (PDF 16): the sand "Estimated delivery" card becomes "Pickup · Show #KR-20418 at the pickup counter", "Delivering to" becomes "Collect from <branch or Branch being confirmed>", and the popup leads with "Pick up your order from". |
| Confirmed screen content under the popup | Reconstructed from visible edges + extracted text (estimated delivery, items, delivering to, two buttons). |
| Error / empty-cart / toast states | Not drawn in the PDF; built from existing tokens/components (hot pink = alert per guide). |
| Product prices | Card/detail show integers ("SAR 185"); checkout shows 2 decimals ("SAR 185.00"), as in the PDF. |
| Delivery fee | SAR 15.00 flat (from the PDF). VAT 15 % included in prices. |
| Delivery window | Rounded slot ≥ 4.5 h ahead within branch hours (12:21 → "Today, 5:00 – 7:00 PM" as in PDF). Orders placed after ~6:30 PM get "Tomorrow, 12:00 – 2:00 PM" and are prepared that morning. |
| iOS status-bar space | The PDF reserves 54 pt at the top for the phone status bar. In a browser that space would be empty, so the web build starts headers 16 pt from the top; all other spacing is unchanged. |
| Hidden header subtitles | The PDF text layer contains subtitles under the auth titles ("Join kuraat in under a minute", "Enter the 6-digit code", …) that are covered by the sheet on phones. They stay hidden on phones and are shown in the desktop brand panel. |
| Auth title wrapping | Titles wrap onto two lines exactly as in the PDF ("Create your / account") by limiting the title width to 232 pt. |
| "n items" on order cards | The PDF counts units in the cart ("Subtotal (3 items)") but distinct products on one order card ("2 items"). The build counts units everywhere, so the cart and the order always agree. |
| Home card photos | The PDF crops the Truffle Box cards tightly into the tray; the source photos are only ~340 px, so cards show the full box image to stay sharp. |
| Branch choice when stock is missing | Nearest branch that stocks every item, but only within 25 km of the nearest branch; otherwise the nearest branch. In the PDF, Praline is out at Corniche, so it ships from Dhahran (6.8 km) — order KR-20291. |
| Order status | Derived from the clock: Confirmed → Preparing (+4 min) → Out for delivery (slot − 30 min) → Delivered. The PDF shows the order a few minutes after checkout ("Preparing"). |
| Account phone field | Editable in place; the tag reads "Verified" for the current number and "Needs code" once edited — saving sends a WhatsApp code first. |
| Save buttons | Always enabled, as drawn; saving with no changes shows "Your details are up to date". |

---

## I. Implementation map (client)

| Design element | Where it lives in `client/` |
|---|---|
| Tokens (§B–§D) | `src/theme/tokens.js` → consumed by `tailwind.config.js` (plain JS, reusable by `mobile/`) |
| Fonts, base styles, utilities | `src/index.css` |
| Logo, circle pattern, avatar, WhatsApp glyph | `src/components/ui/Brand.jsx` |
| Buttons, icon buttons | `src/components/ui/Button.jsx`, `IconButton.jsx` |
| Inputs (text, password, phone, select) | `src/components/ui/Field.jsx` |
| Segmented control, chips, tags, stepper, toggle, radio, progress | `src/components/ui/Controls.jsx` |
| OTP cells, strength meter + rules | `src/components/ui/OtpInput.jsx`, `PasswordStrength.jsx` |
| Cards, info banner, icon tile, summary rows | `src/components/ui/Surface.jsx` |
| Dialog, bottom sheet, confirm dialog | `src/components/ui/Modal.jsx` |
| Empty state illustration | `src/components/ui/EmptyState.jsx` |
| Screen header, bottom action bar, auth layout, desktop app bar | `src/components/layout/*` |
| Screens 01–26 | `src/pages/{auth,shop,checkout,account}/*` (file header comments carry the PDF screen number) |
