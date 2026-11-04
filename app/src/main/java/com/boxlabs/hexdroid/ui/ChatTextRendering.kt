/*
* HexDroidIRC - An IRC Client for Android
* Copyright (C) 2026 boxlabs
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

package com.boxlabs.hexdroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.contextmenu.builder.item
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import com.boxlabs.hexdroid.readableThemeText
import com.boxlabs.hexdroid.themeContrast
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import com.boxlabs.hexdroid.isAsciiDigit
import com.boxlabs.hexdroid.isAsciiHexDigit
import com.boxlabs.hexdroid.parseAnsiRuns
import com.boxlabs.hexdroid.stripIrcFormatting
import com.boxlabs.hexdroid.toSpanStyle as ansiToSpanStyle

internal const val BOT_INLINE_ID = "botbadge"

internal const val STATUS_INLINE_ID = "readreceipt"

private val urlRegex = Regex("https?://\\S+")

private val chanRegex = Regex("#\\S+")

private val trailingPunct = setOf('.', ',', ';', ':', '!', '?', ')', ']', '}', '"', '\'')

private data class LinkSpan(
    val start: Int,
    val originalEnd: Int,
    val display: String,
    val tag: String,
    val annotation: String,
)

/**
 * Split sentence punctuation off the end of [token]. A closing bracket that pairs with an opening
 * one in the token stays, as in `https://en.wikipedia.org/wiki/Foo_(bar)`.
 */
private fun splitTrailingPunctuation(token: String): Pair<String, String> {
    var t = token
    val sb = StringBuilder()
    while (t.isNotEmpty() && trailingPunct.contains(t.last())) {
        val open = when (t.last()) { ')' -> '('; ']' -> '['; '}' -> '{'; else -> null }
        if (open != null && t.count { it == open } >= t.count { it == t.last() }) break
        sb.insert(0, t.last())
        t = t.dropLast(1)
    }
    return t to sb.toString()
}

/** The URLs in a message's text, without formatting codes or trailing punctuation. */
internal fun messageUrls(text: String): Sequence<String> =
    urlRegex.findAll(stripIrcFormatting(text))
        .map { splitTrailingPunctuation(it.value).first }
        .filter { it.contains("://") && !it.endsWith("://") }

private fun computeLinkSpans(text: String): List<LinkSpan> {
    // Fast path: this runs two regexes, and mIRC-coloured text (especially ASCII art) is split
    // into hundreds of short runs that each call here. If a run can't contain a URL ("://") or a
    // channel ("#"), there's nothing to find and skip the regex work entirely. Same result, far
    // less CPU when building/scrolling heavily-coloured lines.
    if (!text.contains("://") && text.indexOf('#') < 0) return emptyList()
    // Find URLs first; then find channels that are NOT inside URLs.
    val urlMatches = urlRegex.findAll(text).mapNotNull { m ->
        val raw = m.value
        val (token, _) = splitTrailingPunctuation(raw)
        if (token.isBlank()) return@mapNotNull null
        val originalEnd = m.range.last + 1
        LinkSpan(
            start = m.range.first,
            originalEnd = originalEnd,
            display = token,
            tag = ANN_URL,
            annotation = token,
        )
    }.toList()

    val urlRanges = urlMatches.map { it.start until it.originalEnd }

    val chanMatches = chanRegex.findAll(text).mapNotNull { m ->
        val start = m.range.first
        // Skip if the match is inside a URL.
        if (urlRanges.any { start in it }) return@mapNotNull null
        val raw = m.value
        val (token, _) = splitTrailingPunctuation(raw)
        if (token.isBlank()) return@mapNotNull null
        val originalEnd = m.range.last + 1
        LinkSpan(
            start = start,
            originalEnd = originalEnd,
            display = token,
            tag = ANN_CHAN,
            annotation = token,
        )
    }.toList()

    return (urlMatches + chanMatches).sortedBy { it.start }
}

private fun appendLinkified(builder: AnnotatedString.Builder, text: String, linkStyle: SpanStyle) {
    val spans = computeLinkSpans(text)
    var i = 0
    for (s in spans) {
        if (s.start < i) continue
        if (s.start > text.length) continue
        builder.append(text.substring(i, s.start))

        val displayStart = builder.length
        builder.withStyle(linkStyle) { append(s.display) }
        builder.addStringAnnotation(
            tag = s.tag,
            annotation = s.annotation,
            start = displayStart,
            end = displayStart + s.display.length
        )

        val trailingStartInSrc = s.start + s.display.length
        if (trailingStartInSrc < s.originalEnd) {
            builder.append(text.substring(trailingStartInSrc, s.originalEnd))
        }
        i = s.originalEnd
    }
    if (i < text.length) builder.append(text.substring(i))
}

// mIRC colour/style rendering
internal data class MircStyleState(
    var fg: Int? = null,
    var bg: Int? = null,
    /** 24-bit foreground from \u0004, as 0xAARRGGBB. Takes precedence over [fg]. */
    var fgHex: Int? = null,
    /** 24-bit background from \u0004, as 0xAARRGGBB. Takes precedence over [bg]. */
    var bgHex: Int? = null,
    var bold: Boolean = false,
    var italic: Boolean = false,
    var underline: Boolean = false,
    var reverse: Boolean = false,
    var strikethrough: Boolean = false,
) {
    fun reset() {
        fg = null
        bg = null
        fgHex = null
        bgHex = null
        bold = false
        italic = false
        underline = false
        reverse = false
        strikethrough = false
    }

    /** Set the palette foreground, dropping any 24-bit one it replaces. */
    fun applyFg(code: Int?) { fg = code; fgHex = null }

    /** Set the palette background, dropping any 24-bit one it replaces. */
    fun applyBg(code: Int?) { bg = code; bgHex = null }

    /** Set the 24-bit foreground, dropping any palette one it replaces. */
    fun applyFgHex(argb: Int?) { fgHex = argb; fg = null }

    /** Set the 24-bit background, dropping any palette one it replaces. */
    fun applyBgHex(argb: Int?) { bgHex = argb; bg = null }

    fun snapshot(): MircStyleState =
        MircStyleState(fg, bg, fgHex, bgHex, bold, italic, underline, reverse, strikethrough)

    fun hasAnyStyle(): Boolean =
        fg != null || bg != null || fgHex != null || bgHex != null ||
            bold || italic || underline || reverse || strikethrough
}

private data class MircRun(val text: String, val style: MircStyleState)

/** Add a local backdrop only where the topic would be unreadable, preserving IRC foregrounds. */
internal fun readableTopicSpans(text: AnnotatedString, foreground: Color, background: Color): AnnotatedString {
    val boundaries = (listOf(0, text.length) + text.spanStyles.flatMap { listOf(it.start, it.end) }).distinct().sorted()
    return buildAnnotatedString {
        append(text)
        for ((start, end) in boundaries.zipWithNext()) {
            if (start == end) continue
            var fg = foreground
            var bg = background
            for (span in text.spanStyles) {
                if (span.start <= start && span.end >= end) {
                    if (span.item.color != Color.Unspecified) fg = span.item.color
                    if (span.item.background != Color.Unspecified) bg = span.item.background
                }
            }
            if (themeContrast(fg.toArgb(), bg.toArgb()) < 4.5) {
                addStyle(SpanStyle(background = Color(readableThemeText(bg.toArgb(), fg.toArgb()))), start, end)
            }
        }
    }
}

internal fun MircStyleState.toSpanStyle(): SpanStyle {
    val fgCode = if (reverse) bg else fg
    val bgCode = if (reverse) fg else bg
    val fgArgb = if (reverse) bgHex else fgHex
    val bgArgb = if (reverse) fgHex else bgHex
    val fgColor = fgArgb?.let { Color(it) } ?: fgCode?.let(::mircColor) ?: Color.Unspecified
    val bgColor = bgArgb?.let { Color(it) } ?: bgCode?.let(::mircColor) ?: Color.Unspecified

    return SpanStyle(
        color = fgColor,
        background = bgColor,
        fontWeight = if (bold) FontWeight.Bold else null,
        fontStyle = if (italic) FontStyle.Italic else null,
        textDecoration = ircTextDecoration(underline, strikethrough),
    )
}

private fun parseMircRuns(input: String): List<MircRun> {
    if (input.isEmpty()) return emptyList()

    val out = mutableListOf<MircRun>()
    val buf = StringBuilder()
    val st = MircStyleState()

    fun flush() {
        if (buf.isNotEmpty()) {
            out += MircRun(buf.toString(), st.snapshot())
            buf.setLength(0)
        }
    }

    fun parseOneOrTwoDigits(startIndex: Int): Pair<Int?, Int> {
        var i = startIndex
        if (i >= input.length || !input[i].isAsciiDigit()) return (null to i)
        val first = input[i]
        i++
        if (i < input.length && input[i].isAsciiDigit()) {
            val num = ("$first${input[i]}").toIntOrNull()
            i++
            return (num to i)
        }
        return (first.toString().toIntOrNull() to i)
    }

    fun isHexDigit(c: Char): Boolean = c.isAsciiHexDigit()

    /**
     * Read up to six hex digits, returning the opaque colour they spell and the index after
     * them. Fewer than six is not a colour, but the digits are still consumed so this stays
     * in step with stripIrcFormatting, which the width measurement and the logs go through.
     */
    fun parseHexColor(startIndex: Int): Pair<Int?, Int> {
        var i = startIndex
        var n = 0
        while (i < input.length && n < 6 && isHexDigit(input[i])) { i++; n++ }
        if (n < 6) return (null to i)
        val rgb = input.substring(i - 6, i).toIntOrNull(16) ?: return (null to i)
        return ((0xFF shl 24) or rgb to i)
    }

    var i = 0
    while (i < input.length) {
        when (val c = input[i]) {
            '\u0003' -> { // colour
                flush()
                i++
                val (fg, ni) = parseOneOrTwoDigits(i)
                i = ni
                // Optional ,bg; only consume the comma when at least one digit follows it,
                // so text like "\x035,word" keeps its comma. Read whether or not a
                // foreground was given: art sets the background on its own with "\x03,15",
                // and leaving that form unconsumed prints the digits into the picture.
                var sawBg = false
                if (i < input.length && input[i] == ',' &&
                    i + 1 < input.length && input[i + 1].isAsciiDigit()) {
                    i++
                    val (bg, n2) = parseOneOrTwoDigits(i)
                    i = n2
                    st.applyBg(bg)
                    sawBg = true
                }
                when {
                    fg != null -> st.applyFg(fg)
                    // \x03 on its own resets colours; \x03,bg leaves the foreground alone.
                    !sawBg -> { st.applyFg(null); st.applyBg(null) }
                }
            }

            '\u0004' -> { // 24-bit colour: \x04RRGGBB[,RRGGBB]
                flush()
                i++
                val (fgHex, ni) = parseHexColor(i)
                i = ni
                var sawBg = false
                if (i < input.length && input[i] == ',' &&
                    i + 1 < input.length && isHexDigit(input[i + 1])) {
                    i++
                    val (bgHex, n2) = parseHexColor(i)
                    i = n2
                    st.applyBgHex(bgHex)
                    sawBg = true
                }
                when {
                    fgHex != null -> st.applyFgHex(fgHex)
                    !sawBg -> { st.applyFgHex(null); st.applyBgHex(null) }
                }
            }

            '\u000F' -> { // reset
                flush()
                st.reset()
                i++
            }

            '\u0002' -> { // bold
                flush(); st.bold = !st.bold; i++
            }

            '\u001D' -> { // italic
                flush(); st.italic = !st.italic; i++
            }

            '\u001F' -> { // underline
                flush(); st.underline = !st.underline; i++
            }

            '\u001E' -> { // strikethrough (IRC formatting specification)
                flush(); st.strikethrough = !st.strikethrough; i++
            }

            '\u0016' -> { // reverse
                flush(); st.reverse = !st.reverse; i++
            }

            else -> {
                // Drop other C0 controls (except common whitespace).
                if (c.code < 0x20 && c != '\n' && c != '\t' && c != '\r') {
                    i++
                } else {
                    buf.append(c)
                    i++
                }
            }
        }
    }
    flush()
    return out
}

internal fun AnnotatedString.Builder.appendIrcStyledLinkified(
    text: String,
    linkStyle: SpanStyle,
    mircColorsEnabled: Boolean,
    ansiColorsEnabled: Boolean = false,
) {
    val hasAnsi = ansiColorsEnabled && text.contains('\u001b')
    val hasMirc = mircColorsEnabled && !hasAnsi &&
        (text.contains('\u0003') || text.contains('\u0004') || text.contains('\u0002') ||
         text.contains('\u001D') || text.contains('\u001F') || text.contains('\u001E') || text.contains('\u0016'))

    when {
        hasAnsi -> {
            val runs = parseAnsiRuns(text)
            if (runs.isEmpty()) return
            for (r in runs) {
                if (r.style.hasAnyStyle()) {
                    withStyle(r.style.ansiToSpanStyle()) { appendLinkified(this, r.text, linkStyle) }
                } else {
                    appendLinkified(this, r.text, linkStyle)
                }
            }
        }
        hasMirc -> {
            val runs = parseMircRuns(text)
            if (runs.isEmpty()) return
            for (r in runs) {
                if (r.style.hasAnyStyle()) {
                    withStyle(r.style.toSpanStyle()) { appendLinkified(this, r.text, linkStyle) }
                } else {
                    appendLinkified(this, r.text, linkStyle)
                }
            }
        }
        else -> appendLinkified(this, stripIrcFormatting(text), linkStyle)
    }
}

/** Initial palette for the topic tools, using the actual first visible IRC run. */
internal fun initialTopicPalette(text: String): Pair<Int?, Int?> =
    parseMircRuns(text).firstOrNull()?.style?.let { it.fg to it.bg } ?: (null to null)

@Composable
internal fun AnnotatedClickableText(
    text: AnnotatedString,
    onAnnotationClick: (String, String) -> Unit,
    modifier: Modifier = Modifier,
    style: androidx.compose.ui.text.TextStyle = LocalTextStyle.current,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
    inlineContent: Map<String, InlineTextContent> = emptyMap(),
    onTextLayout: ((TextLayoutResult) -> Unit)? = null,
) {
    var layout: TextLayoutResult? by remember { mutableStateOf(null) }
    // rememberUpdatedState lets the gesture handler always see the latest text and
    // callback without restarting the pointerInput coroutine when they change.
    val currentText by rememberUpdatedState(text)
    val currentOnClick by rememberUpdatedState(onAnnotationClick)
    Text(
        text = text,
        style = style,
        maxLines = maxLines,
        overflow = overflow,
        inlineContent = inlineContent,
        onTextLayout = {
            layout = it
            onTextLayout?.invoke(it)
        },
        modifier = modifier.pointerInput(Unit) {
            val vc = viewConfiguration
            awaitEachGesture {
                // Don't consume gestures: allow selection (long-press/drag) to work.
                val down = awaitFirstDown(requireUnconsumed = false)
                val downPos = down.position
                val downTime = down.uptimeMillis

                val up = waitForUpOrCancellation() ?: return@awaitEachGesture
                val dt = up.uptimeMillis - downTime
                val dist = (up.position - downPos).getDistance()

                // Treat only quick taps as clicks so selection gestures don't accidentally open links.
                if (dt <= 200 && dist <= vc.touchSlop) {
                    val l = layout ?: return@awaitEachGesture
                    val offset = l.getOffsetForPosition(up.position)
                    val ann = currentText.getStringAnnotations(start = offset, end = offset).firstOrNull()
                    if (ann != null) currentOnClick(ann.tag, ann.item)
                }
            }
        }
    )
}

/** Appends the timestamp, tinted when the user has picked a colour for it. */
internal fun AnnotatedString.Builder.appendTimestamp(ts: String, color: Color?) {
    if (ts.isEmpty()) return
    if (color == null) append(ts) else withStyle(SpanStyle(color = color)) { append(ts) }
}

@Composable
internal fun IrcLinkifiedText(
    text: String,
    mircColorsEnabled: Boolean,
    ansiColorsEnabled: Boolean = false,
    linkStyle: SpanStyle,
    onAnnotationClick: (String, String) -> Unit,
    modifier: Modifier = Modifier,
    style: androidx.compose.ui.text.TextStyle = LocalTextStyle.current,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
    onTextLayout: ((TextLayoutResult) -> Unit)? = null,
    findHighlight: String? = null,  // when non-null, highlight all occurrences of this query
    findHighlightBg: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color(0xFFFFD54F),
    findHighlightFg: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color.Black,
    /** Leading characters of [text] holding the timestamp, tinted with [prefixColor]. */
    prefixLength: Int = 0,
    prefixColor: androidx.compose.ui.graphics.Color? = null,
    contrastBackground: Color? = null,
    contrastForeground: Color? = null,
) {
    val annotated = remember(text, linkStyle, mircColorsEnabled, ansiColorsEnabled, findHighlight, findHighlightBg,
        prefixLength, prefixColor, contrastBackground, contrastForeground) {
        val original = buildAnnotatedString { appendIrcStyledLinkified(text, linkStyle, mircColorsEnabled, ansiColorsEnabled) }
        val styled = if (contrastBackground != null && contrastForeground != null)
            readableTopicSpans(original, contrastForeground, contrastBackground) else original
        val base = if (prefixColor != null && prefixLength > 0 && prefixLength <= styled.length) {
            buildAnnotatedString {
                append(styled)
                addStyle(SpanStyle(color = prefixColor), 0, prefixLength)
            }
        } else {
            styled
        }
        if (findHighlight.isNullOrBlank()) return@remember base
        val plain = base.text
        val query = findHighlight.lowercase()
        val hlStyle = SpanStyle(background = findHighlightBg, color = findHighlightFg)
        buildAnnotatedString {
            append(base)
            var idx = plain.lowercase().indexOf(query)
            while (idx >= 0) {
                addStyle(hlStyle, idx, idx + query.length)
                idx = plain.lowercase().indexOf(query, idx + 1)
            }
        }
    }
    AnnotatedClickableText(
        text = annotated,
        onAnnotationClick = onAnnotationClick,
        modifier = modifier,
        style = style,
        maxLines = maxLines,
        overflow = overflow,
        onTextLayout = onTextLayout,
    )
}
