/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.desktop

import com.boxlabs.hexdroid.*
import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*
import java.io.*
import java.nio.file.Files
import java.util.zip.*

class DesktopStorageTest {
    private fun temp()=Files.createTempDirectory("dreams-desktop-test-").toFile()
    @Test fun profilesThemesAndWritingStyleSurviveAStoreRestart() {
        val dir=temp();try {
            val store=DesktopStore(dir);val profile=DesktopProfile(id="network-demo",host="irc.example.invalid",nick="DemoSelf",avatarUrl="https://images.example.invalid/avatar.png")
            val theme=PersonalTheme(name="Tema de prueba",darkColors=mapOf(ThemeRole.CHAT.name to 0xff123456.toInt()))
            val settings=DesktopSettings(dark=false,style=WritingStyle(4,2,true,true,true,true),themes=listOf(theme),selectedTheme=theme.id,dailyLogs=true,combinedLogs=true)
            store.save(listOf(profile),settings)
            val (networks,restored)=DesktopStore(dir).load()
            assertEquals(profile.id,networks.single().id);assertEquals(profile.avatarUrl,networks.single().avatarUrl)
            assertEquals(settings.style,restored.style);assertEquals(theme,restored.themes.single());assertEquals(theme.id,restored.selectedTheme);assertTrue(restored.dailyLogs && restored.combinedLogs)
        }finally{dir.deleteRecursively()}
    }
    @Test fun androidCompatibleEncryptedBackupImportsWithoutLeakingPasswordsInSettings() {
        val dir=temp();try {
            val store=DesktopStore(dir);val p=DesktopProfile(id="network-demo",host="irc.example.invalid",nick="DemoSelf")
            store.secrets.put("sasl:${p.id}","test-only-sasl-value")
            val json=store.backupJson(listOf(p),DesktopSettings(),"test-only-passphrase".toCharArray())
            assertFalse(json.contains("test-only-sasl-value"))
            val plan=store.planImport(json,"test-only-passphrase".toCharArray())
            assertEquals("test-only-sasl-value",plan.secrets.getJSONObject(p.id).getString("sasl"))
            assertThrows(Exception::class.java){store.planImport(json,"wrong-test-passphrase".toCharArray())}
            store.save(plan.profiles,plan.settings)
            assertFalse(File(dir,"settings.json").readText().contains("test-only-sasl-value"))
        }finally{dir.deleteRecursively()}
    }
    @Test fun androidBackupPreservesProfileIdentityUnknownOptionsAndItsAvatar() {
        val dir=temp();try {
            val json=JSONObject().put("app","HexDroid").put("version",7).put("minCompatVersion",1).put("settings",JSONObject().put("writingStyle",JSONObject().put("fg",6).put("bold",true))).put("networks",org.json.JSONArray().put(JSONObject().put("id","android-demo").put("host","irc.example.invalid").put("nick","DemoSelf").put("avatarUrl","https://images.example.invalid/photo.png").put("futureOption","preserved").put("autoJoin",org.json.JSONArray().put("#demo key-test"))))
            val plan=DesktopStore(dir).planImport(json.toString())
            assertEquals("#demo key-test",plan.profiles.single().channels)
            assertEquals("https://images.example.invalid/photo.png",plan.profiles.single().avatarUrl)
            assertEquals("preserved",plan.profiles.single().json().getString("futureOption"));assertTrue(plan.settings.style.bold);assertEquals(6,plan.settings.style.foreground)
        }finally{dir.deleteRecursively()}
    }
    @Test fun utf8HistoryHasTimestampNickContentAndPersistentMessageIdDeduplication() {
        val dir=temp();try {
            DesktopHistory(dir).use { h->assertTrue(h.append("demo","#sala",1_793_793_600_000,"DemoNick01","Hola ñ 🙂","msg-1"));assertFalse(h.append("demo","#sala",1_793_793_600_000,"DemoNick01","Hola ñ 🙂","msg-1",true)) }
            DesktopHistory(dir).use { h->
                assertFalse(h.append("demo","#sala",1_793_793_600_000,"DemoNick01","Hola ñ 🙂","msg-1",true))
                val file=HistoryFiles.resolve(h.root,h.path("demo","#sala"));val line=file.readLines().single()
                assertTrue(line.matches(Regex("\\[\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}:\\d{2}] <DemoNick01> Hola ñ 🙂")))
                assertEquals(1,h.searchText("DemoNick01 ñ").size)
            }
        }finally{dir.deleteRecursively()}
    }
    @Test fun historyRestoreIsAppendOnlyDeduplicatedAndRejectsTraversalBeforeWriting() {
        val dir=temp();try { DesktopHistory(dir).use { h->
            h.append("demo","#sala",1_793_793_600_000,"DemoNick01","Original")
            val path=h.path("demo","#sala");val file=HistoryFiles.resolve(h.root,path);val before=file.readText()
            fun zip(name:String,body:String):ByteArray { val out=ByteArrayOutputStream();ZipOutputStream(out).use{z->z.putNextEntry(ZipEntry(name));z.write(body.toByteArray(Charsets.UTF_8));z.closeEntry()};return out.toByteArray() }
            val incoming=zip(path,before+"[04/11/2026 12:00:01] <DemoNick02> Importado 🙂\n")
            assertEquals(1,h.restore(incoming.inputStream()));assertEquals(0,h.restore(incoming.inputStream()));assertEquals(2,file.readLines().size);assertTrue(file.readText().startsWith(before))
            val bytes=file.readBytes();assertThrows(IllegalArgumentException::class.java){h.restore(zip("../escape.txt","invalid").inputStream())};assertArrayEquals(bytes,file.readBytes())
        } }finally{dir.deleteRecursively()}
    }
    @Test fun importingMoreThanFiveThousandLinesKeepsEverythingAndExportCanBeRestoredAgain() {
        val dir=temp();val other=temp();try { DesktopHistory(dir).use { h->
            val out=ByteArrayOutputStream();ZipOutputStream(out).use{z->z.putNextEntry(ZipEntry(h.path("demo","#sala")));repeat(6001){z.write("[04/11/2026 12:00:00] <DemoNick01> Línea $it ñ 🙂\n".toByteArray(Charsets.UTF_8))};z.closeEntry()}
            assertEquals(6001,h.restore(out.toByteArray().inputStream()));assertEquals(100,h.searchText("Línea").size)
            val exported=ByteArrayOutputStream();h.export(exported)
            DesktopHistory(other).use { restored->assertEquals(6001,restored.restore(exported.toByteArray().inputStream()));assertTrue(restored.searchText("Línea 6000").single().line.contains("🙂")) }
        } }finally{dir.deleteRecursively();other.deleteRecursively()}
    }
    @Test fun groupedDailyLogsAreIndependentOfTheCanonicalArchiveAndWindowsNamesAreSafe() {
        val dir=temp();val output=temp();try { DesktopHistory(dir).use { h->
            val s=DesktopSettings(logFolder=output.path,dailyLogs=true,combinedLogs=true)
            h.append("network-demo","#sala",1_793_793_600_000,"DemoNick01","Texto ñ",settings=s,networkName="Red de prueba")
            val files=output.walkTopDown().filter{it.isFile}.toList();assertEquals(1,files.size);assertTrue(files.single().name.matches(Regex("todo--\\d{4}-\\d{2}-\\d{2}\\.txt")));assertTrue(files.single().readText().contains("[Red de prueba / #sala]"))
            assertTrue(HistoryFiles.resolve(h.root,h.path("network-demo","#sala")).exists())
            assertTrue(h.path("network-demo","CON").substringAfter('/').startsWith("nick-CON"));assertEquals("#people.txt",h.path("network-demo","#people").substringAfter('/'))
        } }finally{dir.deleteRecursively();output.deleteRecursively()}
    }
    @Test fun authCommandsAndTokensAreExcludedOrRedactedFromEveryLogCopy() {
        val dir=temp();try { DesktopHistory(dir).use { h->
            h.append("demo","NickServ",1,"DemoSelf","IDENTIFY test-only-password")
            h.append("demo","#sala",2,"DemoSelf","/identify test-only-password")
            h.append("demo","#sala",3,"DemoNick01","token=test-only-token")
            val all=h.root.walkTopDown().filter{it.isFile}.joinToString{it.readText()}
            assertFalse(all.contains("test-only-password"));assertFalse(all.contains("test-only-token"));assertTrue(all.contains("[REDACTADO]"))
        } }finally{dir.deleteRecursively()}
    }
    @Test fun imageLimitsAndIrcColorsAreRealAndIndependentOfVisualThemes() {
        assertTrue(validDesktopImageUrl("https://images.example.invalid/photo.png"));assertFalse(validDesktopImageUrl("http://images.example.invalid/a"));assertFalse(validDesktopImageUrl("https://user:pass@images.example.invalid/a"))
        assertThrows(IllegalArgumentException::class.java){DesktopImages.decode(ByteArray(DesktopImages.MAX_BYTES+1),128)}
        val image=java.awt.image.BufferedImage(2048,1024,java.awt.image.BufferedImage.TYPE_INT_RGB);val bytes=ByteArrayOutputStream();javax.imageio.ImageIO.write(image,"png",bytes)
        val small=DesktopImages.decode(bytes.toByteArray(),128)!!;assertTrue(small.width<=256 && small.height<=256)
        val text=ircAnnotated("\u000304Rojo\u000f normal",0xffffffff.toInt(),0xff000000.toInt())
        assertEquals("Rojo normal",text.text);assertEquals(androidx.compose.ui.graphics.Color.Red,text.spanStyles.first().item.color)
    }
}
