/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.desktop

import com.boxlabs.hexdroid.*
import com.boxlabs.hexdroid.connection.*
import com.boxlabs.hexdroid.data.*
import org.json.*
import java.io.File
import java.util.UUID

internal fun appDirectory(): File = File(System.getenv("LOCALAPPDATA") ?: File(System.getProperty("user.home"), ".local/share").path, "HexDroidDreamsData")
internal fun JSONArray.strings() = (0 until length()).map { getString(it) }
internal fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }

data class DesktopProfile(
    val id: String = UUID.randomUUID().toString(), val name: String = "Mi red", val host: String = "", val port: Int = 6697,
    val useTls: Boolean = true, val nick: String = "", val altNick: String = "", val username: String = "dreams", val realname: String = "HexDroid Dreams",
    val hasClientCertificate: Boolean = false, val saslEnabled: Boolean = false, val saslMechanism: SaslMechanism = SaslMechanism.PLAIN, val saslAuthcid: String = "",
    val channels: String = "", val avatarUrl: String = "", val autoReconnect: Boolean = true, val autoConnect: Boolean = false,
    val proxyType: ProxyType = ProxyType.NONE, val proxyHost: String = "", val proxyPort: Int = 9050, val proxyUsername: String = "",
    val bouncerKind: BouncerKind = BouncerKind.NONE, val bouncerNetworkName: String = "", val bouncerClientId: String = "desktop",
    val ignoredNicks: List<String> = emptyList(), val extra: String = "{}",
) {
    fun validate() {
        require(name.isNotBlank() && host.isNotBlank() && nick.isNotBlank()) { "Completá nombre, servidor y nick" }
        require(port in 1..65535 && !host.any { it.isWhitespace() || it.isISOControl() } && !nick.any { it.isWhitespace() || it.isISOControl() }) { "Servidor, puerto o nick no válidos" }
        require(username.isNotBlank() && !username.any { it.isWhitespace() || it.isISOControl() }) { "Ident no válido" }
        require(avatarUrl.isBlank() || validDesktopImageUrl(avatarUrl)) { "La foto debe tener una URL HTTPS válida" }
        require(saslMechanism != SaslMechanism.EXTERNAL || !saslEnabled || hasClientCertificate) { "SASL EXTERNAL requiere importar un certificado PKCS#12 en este equipo" }
        if (proxyType != ProxyType.NONE) require(proxyHost.isNotBlank() && proxyPort in 1..65535) { "Completá el proxy" }
    }
    fun json(): JSONObject = JSONObject(extra).apply {
        listOf("serverPassword","saslPassword","proxyPassword","serviceAuthCommand").forEach(::remove)
        put("id",id);put("name",name);put("host",host);put("port",port);put("useTls",useTls);put("allowInvalidCerts",false)
        put("nick",nick);put("altNick",altNick);put("username",username);put("realname",realname);put("avatarUrl",avatarUrl)
        put("desktopClientCertificate",hasClientCertificate);put("saslEnabled",saslEnabled);put("saslMechanism",saslMechanism.name);put("saslAuthcid",saslAuthcid)
        put("autoJoin",JSONArray(channels.lines().map(String::trim).filter(String::isNotEmpty)))
        put("autoReconnect",autoReconnect);put("autoConnect",autoConnect)
        put("proxyType",proxyType.name);put("proxyHost",proxyHost);put("proxyPort",proxyPort);put("proxyUsername",proxyUsername)
        put("bouncerKind",bouncerKind.name);put("bouncerNetworkName",bouncerNetworkName);put("bouncerClientId",bouncerClientId)
        put("ignoredNicks",JSONArray(ignoredNicks))
    }
    fun config(secrets: SecretStore): IrcConfig = IrcConfig(host,port,useTls,false,nick,altNick.ifBlank { null },username,realname,
        clientCert=secrets.get("clientCert:$id")?.let { TlsClientCert(java.util.Base64.getDecoder().decode(it),secrets.get("clientCertPassword:$id")) },
        serverPassword=secrets.get("server:$id"), sasl=if(saslEnabled) SaslConfig.Enabled(saslMechanism,saslAuthcid.ifBlank { nick },secrets.get("sasl:$id")) else SaslConfig.Disabled,
        autoJoin=channels.lines().filter { it.isNotBlank() }.map { val a=it.trim().split(Regex("\\s+"),limit=2);AutoJoinChannel(a[0],a.getOrNull(1)) },
        proxy=ProxyConfig(proxyType,proxyHost,proxyPort,proxyUsername.ifBlank { null },secrets.get("proxy:$id")),
        isBouncer=bouncerKind!=BouncerKind.NONE || JSONObject(extra).optBoolean("isBouncer"),bouncerKind=bouncerKind,bouncerNetworkName=bouncerNetworkName.ifBlank { null },bouncerClientId=bouncerClientId.ifBlank { null },
        encoding=JSONObject(extra).optString("encoding","auto"))
    companion object {
        fun from(o: JSONObject): DesktopProfile = DesktopProfile(
            id=o.optString("id").ifBlank { UUID.randomUUID().toString() },name=o.optString("name","Mi red"),host=o.getString("host"),port=o.optInt("port",6697),
            useTls=o.optBoolean("useTls",true),nick=o.optString("nick"),altNick=o.optString("altNick"),username=o.optString("username","dreams"),realname=o.optString("realname","HexDroid Dreams"),
            hasClientCertificate=o.optBoolean("desktopClientCertificate"),saslEnabled=o.optBoolean("saslEnabled"),saslMechanism=runCatching { SaslMechanism.valueOf(o.optString("saslMechanism","PLAIN")) }.getOrDefault(SaslMechanism.PLAIN),saslAuthcid=o.optString("saslAuthcid"),
            channels=o.optJSONArray("autoJoin")?.strings()?.joinToString("\n").orEmpty(),avatarUrl=o.optString("avatarUrl"),autoReconnect=o.optBoolean("autoReconnect",true),autoConnect=o.optBoolean("autoConnect"),
            proxyType=ProxyType.valueOf(o.optString("proxyType","NONE")),proxyHost=o.optString("proxyHost"),proxyPort=o.optInt("proxyPort",9050),proxyUsername=o.optString("proxyUsername"),
            bouncerKind=BouncerKind.valueOf(o.optString("bouncerKind","NONE")),bouncerNetworkName=o.optString("bouncerNetworkName"),bouncerClientId=o.optString("bouncerClientId","desktop"),
            ignoredNicks=o.optJSONArray("ignoredNicks")?.strings().orEmpty(),extra=o.toString())
    }
}

data class DesktopSettings(
    val dark: Boolean = true, val notifications: Boolean = true, val notifyVisibleMentions: Boolean = false, val highlight: Boolean = true,
    val highlightColor: Int = 0xffffd54f.toInt(), val logging: Boolean = true, val logEncrypted: Boolean = false, val logFolder: String = "",
    val dailyLogs: Boolean = false, val combinedLogs: Boolean = false, val avatars: Boolean = true, val avatarsInMessages: Boolean = false,
    val scriptNetwork: Boolean = false, val whoisDestinations: Int = ReplyDestination.FLOATING, val noticeDestinations: Int = ReplyDestination.STATUS or ReplyDestination.ACTIVE,
    val style: WritingStyle = WritingStyle(), val themes: List<PersonalTheme> = emptyList(), val selectedTheme: String = "",
    val fontSize: Int = 15, val extra: String = "{}",
) {
    fun json(): JSONObject = JSONObject(extra).apply {
        put("themeMode",if(dark)"DARK" else "LIGHT");put("notificationsEnabled",notifications);put("notifyMentionsWhileVisible",notifyVisibleMentions)
        put("mentionHighlightEnabled",highlight);put("mentionHighlightColor","%06X".format(highlightColor and 0xffffff))
        put("loggingEnabled",logging);put("encryptedLogEnabled",logEncrypted);put("desktopLogFolder",logFolder);put("logDailyFiles",dailyLogs);put("logCombineConversations",combinedLogs)
        put("chatZonaAvatarsEnabled",avatars);put("chatZonaAvatarsInMessages",avatarsInMessages);put("desktopScriptNetwork",scriptNetwork)
        put("whoisDestinations",whoisDestinations);put("noticeDestinations",noticeDestinations);put("selectedThemeId",selectedTheme);put("desktopFontSize",fontSize)
        put("writingStyle",JSONObject().put("fg",style.foreground ?: -1).put("bg",style.background ?: -1).put("bold",style.bold).put("italic",style.italic).put("underline",style.underline).put("reverse",style.reverse))
        put("personalThemes",JSONArray(themes.map { t ->
            fun colors(m:Map<String,Int>)=JSONObject().apply { m.forEach { (k,v)->put(k,"%06X".format(v and 0xffffff)) } }
            JSONObject().put("id",t.id).put("name",t.name).put("dark",colors(t.darkColors)).put("light",colors(t.lightColors))
        }))
    }
    fun color(role:ThemeRole):Int = themes.firstOrNull { it.id==selectedTheme }?.color(role,dark) ?: if(dark)role.dark else role.light
    companion object {
        fun from(o: JSONObject): DesktopSettings {
            val w=o.optJSONObject("writingStyle") ?: JSONObject()
            fun col(k:String)=w.optInt(k,-1).takeIf { it in 0..98 }
            val themes=o.optJSONArray("personalThemes")?.objects()?.map { t ->
                fun colors(k:String)=t.optJSONObject(k)?.let { c -> c.keySet().mapNotNull { key->parseThemeHex(c.optString(key))?.let { key to it } }.toMap() }.orEmpty()
                PersonalTheme(t.optString("id",UUID.randomUUID().toString()),t.optString("name","Mi tema"),colors("dark"),colors("light"))
            }.orEmpty()
            return DesktopSettings(dark=o.optString("themeMode","DARK")!="LIGHT",notifications=o.optBoolean("notificationsEnabled",true),notifyVisibleMentions=o.optBoolean("notifyMentionsWhileVisible"),
                highlight=o.optBoolean("mentionHighlightEnabled",true),highlightColor=parseThemeHex(o.optString("mentionHighlightColor","FFD54F")) ?: 0xffffd54f.toInt(),
                logging=o.optBoolean("loggingEnabled",true),logEncrypted=o.optBoolean("encryptedLogEnabled"),logFolder=o.optString("desktopLogFolder"),dailyLogs=o.optBoolean("logDailyFiles"),combinedLogs=o.optBoolean("logCombineConversations"),
                avatars=o.optBoolean("chatZonaAvatarsEnabled",true),avatarsInMessages=o.optBoolean("chatZonaAvatarsInMessages"),scriptNetwork=o.optBoolean("desktopScriptNetwork"),
                whoisDestinations=o.optInt("whoisDestinations",ReplyDestination.FLOATING),noticeDestinations=o.optInt("noticeDestinations",ReplyDestination.STATUS or ReplyDestination.ACTIVE),
                style=WritingStyle(col("fg"),col("bg"),w.optBoolean("bold"),w.optBoolean("italic"),w.optBoolean("underline"),w.optBoolean("reverse")),
                themes=themes,selectedTheme=o.optString("selectedThemeId"),fontSize=o.optInt("desktopFontSize",15).coerceIn(10,28),extra=o.toString())
        }
    }
}

class DesktopStore(val root: File) {
    val secrets=SecretStore(root)
    val scriptsDirectory=File(root,"scripts").apply { mkdirs() }
    private val file=File(root,"settings.json")
    init { root.mkdirs() }
    fun load(): Pair<List<DesktopProfile>,DesktopSettings> {
        if(!file.exists())return emptyList<DesktopProfile>() to DesktopSettings()
        val obj=JSONObject(file.readText(Charsets.UTF_8))
        return (obj.optJSONArray("networks")?.objects()?.map(DesktopProfile::from).orEmpty() to DesktopSettings.from(obj.optJSONObject("settings") ?: JSONObject()))
    }
    fun save(profiles:List<DesktopProfile>,settings:DesktopSettings) = SecretStore.atomicWrite(file, backupJson(profiles,settings).toByteArray(Charsets.UTF_8))
    fun backupJson(profiles:List<DesktopProfile>,settings:DesktopSettings, passphrase:CharArray?=null):String {
        val o=JSONObject().put("app","HexDroid").put("version",7).put("minCompatVersion",1).put("desktopVersion","0.1.0")
            .put("settings",settings.json()).put("networks",JSONArray(profiles.map(DesktopProfile::json)))
        if(passphrase!=null) {
            require(passphrase.size>=BackupCrypto.MIN_PASSPHRASE_LENGTH) { "La frase requiere al menos 8 caracteres" }
            val plain=JSONObject();profiles.forEach { p ->val sec=JSONObject();listOf("server","sasl","proxy","clientCert","clientCertPassword").forEach { k->secrets.get("$k:${p.id}")?.let { sec.put(k,it) } };if(sec.length()>0)plain.put(p.id,sec) }
            val bytes=plain.toString().toByteArray(Charsets.UTF_8)
            val sealed=try { BackupCrypto.seal(bytes,passphrase) }finally { bytes.fill(0) }
            o.put("encryptedSecrets",JSONObject().put("v",1).put("kdf","argon2id").put("t",sealed.iterations).put("m",sealed.memoryKb).put("p",sealed.parallelism).put("salt",sealed.salt).put("iv",sealed.iv).put("data",sealed.data))
        }
        return o.toString(2)
    }
    data class ImportPlan(val profiles:List<DesktopProfile>,val settings:DesktopSettings,val secrets:JSONObject)
    fun planImport(json:String,passphrase:CharArray?=null):ImportPlan {
        val o=JSONObject(json);require(o.optString("app")=="HexDroid" && o.optInt("minCompatVersion",1)<=7) { "Respaldo no compatible" }
        val profiles=o.getJSONArray("networks").objects().map(DesktopProfile::from)
        require(profiles.map { it.id }.distinct().size==profiles.size) { "Redes duplicadas en el respaldo" }
        profiles.forEach { require(it.host.isNotBlank() && it.port in 1..65535 && it.nick.isNotBlank()) { "Perfil de red inválido" } }
        val encrypted=o.optJSONObject("encryptedSecrets")
        val secrets=if(encrypted!=null) {
            require(passphrase!=null) { "Este respaldo requiere su frase de paso" }
            require(encrypted.optString("kdf")=="argon2id" && encrypted.optInt("v")==1) { "Cifrado no compatible" }
            val bytes=BackupCrypto.open(BackupCrypto.Sealed(encrypted.getInt("t"),encrypted.getInt("m"),encrypted.getInt("p"),encrypted.getString("salt"),encrypted.getString("iv"),encrypted.getString("data")),passphrase)
            try { JSONObject(String(bytes,Charsets.UTF_8)) } finally { bytes.fill(0) }
        } else JSONObject()
        return ImportPlan(profiles,DesktopSettings.from(o.optJSONObject("settings") ?: JSONObject()),secrets)
    }
    fun importSecrets(plan:ImportPlan) { plan.secrets.keySet().forEach { id->val v=plan.secrets.getJSONObject(id);listOf("server","sasl","proxy","clientCert","clientCertPassword").forEach { k->if(v.has(k))secrets.put("$k:$id",v.getString(k)) } } }
}
