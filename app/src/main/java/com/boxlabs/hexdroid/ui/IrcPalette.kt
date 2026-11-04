/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.ui
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextDecoration

/**
 * The 99-entry mIRC colour palette (codes 0-98), from
 * https://modern.ircdocs.horse/formatting.html#color. 0-15 are the original colours, 16-97 the
 * extended grid, and 98 is "default", rendered as white.
 */
internal val MIRC_PALETTE: IntArray = intArrayOf(
    // ── 0–15: classic mIRC palette ────────────────────────────────────────────
    0xFFFFFFFF.toInt(), //  0  White
    0xFF000000.toInt(), //  1  Black
    0xFF00007F.toInt(), //  2  Blue (navy)
    0xFF009300.toInt(), //  3  Green
    0xFFFF0000.toInt(), //  4  Red
    0xFF7F0000.toInt(), //  5  Brown (maroon)
    0xFF9C009C.toInt(), //  6  Purple
    0xFFFC7F00.toInt(), //  7  Orange
    0xFFFFFF00.toInt(), //  8  Yellow
    0xFF00FC00.toInt(), //  9  Light green (lime)
    0xFF009393.toInt(), // 10  Teal
    0xFF00FFFF.toInt(), // 11  Light cyan (aqua)
    0xFF0000FC.toInt(), // 12  Light blue (royal)
    0xFFFF00FF.toInt(), // 13  Pink (magenta / fuchsia)
    0xFF7F7F7F.toInt(), // 14  Grey
    0xFFD2D2D2.toInt(), // 15  Light grey
    // ── 16–27: darkest shades (row 1 of extended block) ──────────────────────
    0xFF470000.toInt(), // 16  Dark maroon
    0xFF472100.toInt(), // 17  Very dark orange
    0xFF474700.toInt(), // 18  Dark olive
    0xFF324700.toInt(), // 19  Very dark green
    0xFF004732.toInt(), // 20  Very dark teal-green
    0xFF00472C.toInt(), // 21  Very dark teal (alt)
    0xFF004747.toInt(), // 22  Very dark teal
    0xFF002747.toInt(), // 23  Very dark slate blue
    0xFF000047.toInt(), // 24  Very dark navy
    0xFF2E0047.toInt(), // 25  Very dark violet
    0xFF470047.toInt(), // 26  Very dark purple-magenta
    0xFF47002A.toInt(), // 27  Very dark crimson
    // ── 28–39: dark shades (row 2) ───────────────────────────────────────────
    0xFF740000.toInt(), // 28  Dark red
    0xFF743A00.toInt(), // 29  Dark brown-orange
    0xFF747400.toInt(), // 30  Dark yellow-olive
    0xFF517400.toInt(), // 31  Dark chartreuse
    0xFF007400.toInt(), // 32  Dark green
    0xFF007449.toInt(), // 33  Dark sea-green
    0xFF007474.toInt(), // 34  Dark teal
    0xFF004074.toInt(), // 35  Dark dodger blue
    0xFF000074.toInt(), // 36  Dark blue
    0xFF4B0074.toInt(), // 37  Dark purple-blue
    0xFF740074.toInt(), // 38  Dark magenta
    0xFF740045.toInt(), // 39  Dark hot pink
    // ── 40–51: mid shades (row 3) ────────────────────────────────────────────
    0xFFB50000.toInt(), // 40  Medium red
    0xFFB56300.toInt(), // 41  Medium orange
    0xFFB5B500.toInt(), // 42  Medium yellow-green
    0xFF7DB500.toInt(), // 43  Chartreuse
    0xFF00B500.toInt(), // 44  Medium green
    0xFF00B573.toInt(), // 45  Medium mint
    0xFF00B5B5.toInt(), // 46  Medium teal
    0xFF0063B5.toInt(), // 47  Medium dodger blue
    0xFF0000B5.toInt(), // 48  Medium blue
    0xFF7500B5.toInt(), // 49  Medium violet
    0xFFB500B5.toInt(), // 50  Medium magenta
    0xFFB5006B.toInt(), // 51  Medium hot pink
    // ── 52–63: bright / saturated (row 4) ────────────────────────────────────
    0xFFFF0000.toInt(), // 52  Bright red
    0xFFFF9200.toInt(), // 53  Bright orange / gold
    0xFFFFFF00.toInt(), // 54  Bright yellow
    0xFFB9FF00.toInt(), // 55  Bright yellow-green
    0xFF00FF00.toInt(), // 56  Bright lime green
    0xFF00FFA8.toInt(), // 57  Bright spring green
    0xFF00FFFF.toInt(), // 58  Bright cyan / aqua
    0xFF009BFF.toInt(), // 59  Bright azure / sky blue
    0xFF0000FF.toInt(), // 60  Bright blue
    0xFFAD00FF.toInt(), // 61  Bright electric purple
    0xFFFF00FF.toInt(), // 62  Bright magenta / fuchsia
    0xFFFF0092.toInt(), // 63  Bright rose / hot pink
    // ── 64–75: light / pastel (row 5) ────────────────────────────────────────
    0xFFFF6666.toInt(), // 64  Light red
    0xFFFFB466.toInt(), // 65  Light orange / peach
    0xFFFFFF66.toInt(), // 66  Light yellow
    0xFFCCFF66.toInt(), // 67  Light chartreuse
    0xFF66FF66.toInt(), // 68  Light green
    0xFF66FFB4.toInt(), // 69  Light mint
    0xFF66FFFF.toInt(), // 70  Light cyan
    0xFF66B4FF.toInt(), // 71  Light sky blue
    0xFF6666FF.toInt(), // 72  Light blue-purple
    0xFFCC66FF.toInt(), // 73  Light violet
    0xFFFF66FF.toInt(), // 74  Light magenta / orchid
    0xFFFF66B4.toInt(), // 75  Light pink
    // ── 76–87: very light / near-white pastels (row 6) ───────────────────────
    0xFFFFB4B4.toInt(), // 76  Very light red / salmon
    0xFFFFDEB4.toInt(), // 77  Very light orange / bisque
    0xFFFFFFB4.toInt(), // 78  Very light yellow / cream
    0xFFE6FFB4.toInt(), // 79  Very light chartreuse / honeydew
    0xFFB4FFB4.toInt(), // 80  Very light green / mint cream
    0xFFB4FFE6.toInt(), // 81  Very light mint / azure-mint
    0xFFB4FFFF.toInt(), // 82  Very light cyan / azure
    0xFFB4DEFF.toInt(), // 83  Very light sky blue / alice blue
    0xFFB4B4FF.toInt(), // 84  Very light lavender
    0xFFDEB4FF.toInt(), // 85  Very light violet / lavender blush
    0xFFFFB4FF.toInt(), // 86  Very light magenta / thistle
    0xFFFFB4DE.toInt(), // 87  Very light pink / lavender rose
    // ── 88–98: greyscale ramp (row 7) ────────────────────────────────────────
    0xFF000000.toInt(), // 88  Black
    0xFF141414.toInt(), // 89  Near-black
    0xFF282828.toInt(), // 90  Very dark grey
    0xFF3C3C3C.toInt(), // 91  Dark grey
    0xFF505050.toInt(), // 92  Dark-mid grey
    0xFF646464.toInt(), // 93  Mid grey
    0xFF787878.toInt(), // 94  Mid-light grey
    0xFF8C8C8C.toInt(), // 95  Light-mid grey
    0xFFA0A0A0.toInt(), // 96  Light grey
    0xFFB4B4B4.toInt(), // 97  Pale grey
    0xFFC8C8C8.toInt(), // 98  Silver / near-white (spec "default" alias)
)

internal fun mircColor(code: Int): Color? =
    MIRC_PALETTE.getOrNull(code)?.let { Color(it.toLong() and 0xFFFFFFFFL) }

/** How many mIRC colour codes are defined (0-based, inclusive of 0). */
internal const val MIRC_COLOR_COUNT = 99

internal fun ircTextDecoration(underline: Boolean, strikethrough: Boolean): TextDecoration? = when {
    underline && strikethrough -> TextDecoration.combine(listOf(TextDecoration.Underline, TextDecoration.LineThrough))
    underline -> TextDecoration.Underline
    strikethrough -> TextDecoration.LineThrough
    else -> null
}

