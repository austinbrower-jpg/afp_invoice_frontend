# 09 — Brand assets

Source: `battle-bound-branding.zip`, the BBB LLC web logo pack. The original zip had 258
files, 26 unique before size and SVG variants. After the cleanup described below, the
reference pack in `brand-assets/logo/` holds 40 files: 8 elements (`battle`, `bound`,
`bullets`, `top-bullet`, `bottom-bullet`, `circle-b`, `mark`, `wordmark`) times
black/white times 2000x2000/3000x1000, 32 PNGs, plus `logo-horizontal` and `logo-square`,
each in black/white but only at their one natural size, wide for horizontal, square for
square, 4 more PNGs, plus the 4 SVGs for those same two lockups in both colors. 32+4+4=40,
confirmed against the actual file count in this folder. `public/brand/` holds 4 more: the
non-dimensioned copies the app actually imports.

## Entity, decided

**Battle Bound Branding LLC is the contracting entity.** AFP is a BBB client, invoices go
out on BBB letterhead with the LLC as remit-to, and payment goes to the business account.
The earlier "keep it separate from the Command Center" reasoning in `02-architecture.md`
was about tooling convenience, a second Vercel project and a second auth boundary, not
about hiding that BBB is the party billing. The branding belongs here.

This settles the remit-to side of gap 4 in `07-data-gaps.md`: the remit-to name and
address are BBB LLC's. The AP contact and payment instructions on AFP's side are still
missing from Notion and still block a real invoice. See gap 4.

Everything below is live, not conditional.

## Layout

```
public/brand/          shipped, imported by the app
brand-assets/logo/     full pack, reference only, never served
```

`public/brand/` holds only the four assets the app uses. The rest stays in
`brand-assets/` so it is in version control and out of the bundle.

## What ships

| File | Size | Where |
|---|---|---|
| `bbb-logo-horizontal-black.png` | 3000x1000 | Invoice letterhead. Black on white paper. |
| `bbb-logo-horizontal-white.png` | 3000x1000 | App console header, on the dark background. |
| `bbb-mark-black.png` | 2000x2000 | Reserved. |
| `bbb-mark-white.png` | 2000x2000 | Favicon source. |

Place the letterhead logo at roughly 1.6in wide in the invoice header, left of the
"Invoice" heading or replacing it. At that size the 3000px source prints at about 1875 DPI
equivalent, which is far past what any printer resolves. Do not upscale, do not use the
2000x2000 square variant in a horizontal slot.

## Use the PNGs, not the SVGs

The four SVG files in the pack are not real vectors.

`bbb-logo-horizontal-black.svg` is 292 KB and contains 27 paths **plus four embedded
base64 rasters** totaling about 211 KB, sized 2409x795 and 2536x763. So the wordmark is
vector and the emblem is a bitmap in an SVG wrapper. It does not scale losslessly, it is
larger than the PNG, and it gains nothing.

The 3000x1000 PNG is 123 KB, has a real alpha channel, and is high enough resolution for
any print use this tool will ever have. Use it.

The SVGs are kept in `brand-assets/` because they are the closest thing to a source file
in this pack. If a true vector logo ever gets made, replace them.

## Palette

The pack is monochrome. Black `#000000` and white, transparent alpha, nothing else. There
is no brand color in these files.

The indigo accent in the prototype (`#6366f1`) is **not a BBB color**. It comes from the
`Color` property on the AFP client row in Notion, so it is the client's accent, not yours.
That is correct for a document you send to AFP, and it should not be swapped for a BBB
color without a reason.

Invoice paper stays black on white. A logo, a rule, and the client accent on the service
period band is the entire visual system. Resist adding more.

## The full pack

Ten elements, each in black and white. Eight of them ship at both 2000x2000 and
3000x1000 (32 PNGs). The two lockups are the exception, each shipped at only its natural
aspect, `logo-horizontal` at 3000x1000 and `logo-square` at 2000x2000 (4 more PNGs), plus
an SVG per lockup per color (4 SVGs). 32 + 4 + 4 = 40, the file count in
`brand-assets/logo/`:

| Element | What it is |
|---|---|
| `logo-horizontal` | Full lockup, wide. **The one you want.** |
| `logo-square` | Full lockup, square |
| `mark` | Emblem alone |
| `wordmark` | Type alone |
| `battle` / `bound` | Individual words |
| `circle-b` | Circular B badge |
| `bullets` / `top-bullet` / `bottom-bullet` | Decorative elements |

The single-word and bullet variants exist for the website. They have no use on an invoice
and importing them into `public/` would only grow the bundle.

## Cleanup applied

The original zip had problems worth not reintroducing:

- Every filename carried a `_   ` prefix, an underscore followed by three spaces. That
  breaks web paths, breaks shell commands, and breaks imports. Stripped.
- The pack was present three times: once real, once under `_extracted/`, once under
  `__MACOSX/`. 258 files, 26 unique. Deduplicated.
- `.DS_Store` files throughout. Removed. Add them to `.gitignore`.
- `-transparent` in every filename described the alpha channel, which every PNG here has.
  It carried no information. Dropped.

Names are now `bbb-{element}-{black|white}-{dimensions}.png` in the reference pack and
`bbb-{element}-{black|white}.png` in `public/brand/`.
