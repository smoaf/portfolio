# Site GUI: decisions and build (6 Oct 2026)

On the preview page: https://claude.ai/artifact/DBbr3R7miiUED3joKHY2si (viewer.html, sections "site GUI" and "every GUI element in the site style").

## Decisions (Smo)
- Look after Smo's reference (Downloads/Screenshot 2026-10-06 at 12.40.46.png): name stacked top left, bold and a little extended, both lines set to the same width; menu as small spaced capitals top right. Semi-transparent strip over the 3D scene.
- Name: SIMON WINKLER. `fitName()` letter-spaces the shorter line (SIMON) so it ends flush with WINKLER.
- Categories roll down inside the same see-through strip.
- Settings (Day/Night, Roof, Places, Sky, Reset) behind a small settings icon, bottom right.
- No small card on arrival (Smo: redundant): picking a room flies there and the content panel opens right away.
- The 3D pauses only while a text or content panel is open, never otherwise.
- All GUI elements share one style: glass, Archivo (extended), spaced capitals; no mono boxes (place bar, Places markers, hover names, settings, Sky panel, kickers).
- Night: the darkest night colour stays the turquoise of the backdrop or brighter (sky zenith as bright as the horizon; night ground light tinted turquoise).

## Structure
- Work: Research → library; Products → office; Technology & AI → workshop; Media & installations → showroom; New: museum & curation → new module. Hovering an entry shows the place's name over its building; clicking flies there.
- Play: 3D printer → workshop (starts a new print). More activities later.
- About: About Simon → hub; CV (panel, PDF later); The station (panel).
- Contact: Get in touch → relay station.

## Content model
- Tap a building or pick a menu entry: the camera flies there, then the content panel opens: right half on laptops (below the header, menu stays usable), a sheet over the lower 62 % on phones. The place bar and settings icon hide while it is open. The 3D pauses after the panel has slid in and resumes on close.
- After closing, the place name in the bottom bar reopens the panel.
- Every content item gets an "Open as page" link to a plain full page (not built yet).
- Small interactive things (printer, fire) stay inside the 3D.

## Style
- Glass tokens: light glass by day (rgba(246,243,238,0.58), strong 0.86), dark glass at night (rgba(22,24,28,0.5)), white hairlines, blur 10px. Archivo variable (wdth 62–125): name 700 at width 116, menu 400 at width 108 with 0.17em tracking, small caps labels at width 108 with 0.16em tracking.
- Phones (≤720px): "Menu" button opens one list with all categories; content as a bottom sheet.

## Status
- All texts are placeholders and marked as such. Content data: `MENU` and `PAGES` in viewer.html, to move into the content data file.
- Tested headless on desktop (1400 px) and phone (390 px): menu, roll-down, flight with panel on arrival, close and reopen from the place bar, pause and resume, settings icon, Places markers, night colours. No page errors. (Google Fonts are blocked in the test setup, so test renders show a fallback font.)

## Open
- Real texts, images, videos per room; contact details; CV PDF.
- Plain full pages ("Open as page").
- Whether the blur stays: check frame rate on an older phone.
