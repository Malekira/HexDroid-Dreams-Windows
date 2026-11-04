/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.desktop

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.TextDecoration
import com.boxlabs.hexdroid.*

internal val ircPalette=com.boxlabs.hexdroid.ui.MIRC_PALETTE.map { it and 0xffffff }.toIntArray()
internal fun ircColor(index:Int?):Color= index?.takeIf { it in ircPalette.indices }?.let { Color(0xff000000L or ircPalette[it].toLong()) } ?: Color.Unspecified

/** Preserve actual IRC foreground/background/style codes; theme changes do not rewrite remote colors. */
internal fun ircAnnotated(text:String,defaultFg:Int,defaultBg:Int):AnnotatedString {
    val output=AnnotatedString.Builder();var bold=false;var italic=false;var underline=false;var strike=false;var reverse=false
    var foreground:Int?=null;var background:Int?=null;var i=0;val run=StringBuilder()
    fun flush() {
        if(run.isEmpty())return
        var fg=foreground ?: defaultFg;var bg=background ?: defaultBg
        if(reverse){val previous=fg;fg=bg;bg=previous}
        // Keep explicitly-black remote text black with a readable local backdrop in dark themes.
        val explicitFg=foreground!=null
        if(explicitFg && background==null && themeContrast(fg,bg)<3.0)bg=listOf(0xff000000.toInt(),0xffffffff.toInt()).maxBy { themeContrast(fg,it) }
        val decorations=buildList { if(underline)add(TextDecoration.Underline);if(strike)add(TextDecoration.LineThrough) }
        output.pushStyle(SpanStyle(color=Color(fg),background=if(background!=null || reverse || bg!=defaultBg)Color(bg) else Color.Unspecified,
            fontWeight=if(bold)FontWeight.Bold else FontWeight.Normal,fontStyle=if(italic)FontStyle.Italic else FontStyle.Normal,
            textDecoration=if(decorations.isEmpty())null else TextDecoration.combine(decorations)))
        output.append(run.toString());output.pop();run.clear()
    }
    fun number(max:Int):String { val start=i;while(i<text.length && i-start<max && text[i].isDigit())i++;return text.substring(start,i) }
    fun color(index:String):Int?=index.toIntOrNull()?.takeIf { it in ircPalette.indices }?.let { (0xff000000L or ircPalette[it].toLong()).toInt() }
    while(i<text.length) {
        val ch=text[i++]
        when(ch) {
            '\u0002'->{flush();bold=!bold};'\u001d'->{flush();italic=!italic};'\u001f'->{flush();underline=!underline};'\u001e'->{flush();strike=!strike};'\u0016'->{flush();reverse=!reverse}
            '\u000f'->{flush();bold=false;italic=false;underline=false;strike=false;reverse=false;foreground=null;background=null}
            '\u0003'->{flush();val fg=number(2);if(fg.isEmpty()){foreground=null;background=null}else { foreground=color(fg);if(i<text.length && text[i]==',' && text.getOrNull(i+1)?.isDigit()==true){i++;background=color(number(2))} } }
            '\u0004'->{flush();val start=i;while(i<text.length && i-start<6 && text[i].isAsciiHexDigit())i++;if(i-start==6) {foreground=text.substring(start,i).toInt(16) or 0xff000000.toInt();if(text.getOrNull(i)==',' && text.length>=i+7 && text.substring(i+1,i+7).all { it.isAsciiHexDigit() }){background=text.substring(i+1,i+7).toInt(16) or 0xff000000.toInt();i+=7}} }
            else->if(!ch.isISOControl() || ch=='\n' || ch=='\t')run.append(ch)
        }
    }
    flush();return output.toAnnotatedString()
}
