/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid
import org.json.JSONArray
import org.json.JSONObject

/** New fields are nested so existing backups/preferences remain compatible. */
internal object Phase3Codec {
    fun themes(o: JSONObject): List<PersonalTheme> {
        val a = o.optJSONArray("personalThemes") ?: return emptyList()
        fun colors(p: JSONObject?): Map<String, Int> = ThemeRole.entries.mapNotNull { r ->
            p?.optString(r.name)?.let(::parseThemeHex)?.let { r.name to it }
        }.toMap()
        return (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let { t ->
            val id = t.optString("id").takeIf { it.isNotBlank() } ?: return@let null
            PersonalTheme(id, t.optString("name", "Mi tema"), colors(t.optJSONObject("dark")), colors(t.optJSONObject("light")))
        } }.distinctBy { it.id }
    }
    fun style(o: JSONObject): WritingStyle {
        val s = o.optJSONObject("writingStyle") ?: return WritingStyle()
        fun c(k: String) = s.optInt(k, -1).takeIf { it in 0..98 }
        return WritingStyle(c("fg"), c("bg"), s.optBoolean("bold"), s.optBoolean("italic"), s.optBoolean("underline"), s.optBoolean("reverse"))
    }
    fun write(o: JSONObject, s: UiSettings) {
        o.put("personalThemes", JSONArray().apply { s.personalThemes.forEach { t ->
            fun colors(m: Map<String, Int>) = JSONObject().apply { m.forEach { (k, v) -> put(k, "%06X".format(v and 0xffffff)) } }
            put(JSONObject().put("id", t.id).put("name", t.name).put("dark", colors(t.darkColors)).put("light", colors(t.lightColors)))
        } })
        o.put("selectedThemeId", s.selectedThemeId)
        o.put("writingStyle", JSONObject().put("fg", s.writingStyle.foreground ?: -1).put("bg", s.writingStyle.background ?: -1)
            .put("bold", s.writingStyle.bold).put("italic", s.writingStyle.italic).put("underline", s.writingStyle.underline).put("reverse", s.writingStyle.reverse))
        o.put("encryptedLogEnabled", s.encryptedLogEnabled)
        o.put("privateRequestsEnabled", s.privateRequestsEnabled).put("privateAutoMessages", s.privateAutoMessages)
        o.put("privateRememberAccepted", s.privateRememberAccepted)
        o.put("privateWaitText", s.privateWaitText).put("privateAcceptText", s.privateAcceptText).put("privateRejectText", s.privateRejectText)
    }
}
