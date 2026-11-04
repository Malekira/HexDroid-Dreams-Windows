/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.desktop

import com.boxlabs.hexdroid.data.SecretStore
import org.junit.Test
import org.junit.Assert.*
import java.io.File
import java.nio.file.Files

class DesktopWindowsNativeTest {
    @Test fun windowsDpapiPersistsAcrossNewInstancesWithoutPlaintextFiles() {
        assertTrue(System.getProperty("os.name").startsWith("Windows"));assertTrue(System.getProperty("os.arch") in setOf("amd64","x86_64"))
        val dir=Files.createTempDirectory("dreams-dpapi-").toFile()
        try {
            val value=java.util.UUID.randomUUID().toString();SecretStore(dir).put("test",value)
            assertEquals(value,SecretStore(dir).get("test"));assertFalse(File(dir,"credentials.dpapi").readText(Charsets.ISO_8859_1).contains(value))
            SecretStore(dir).put("test",null);assertNull(SecretStore(dir).get("test"))
        }finally{dir.deleteRecursively()}
    }
    @Test fun windowsDataDirectoryIsSeparateFromTheInstallationAndCredentialsStayOutOfJson() {
        val dir=Files.createTempDirectory("dreams-win-store-").toFile()
        try {
            val store=DesktopStore(dir);val p=DesktopProfile(id="win-demo",host="irc.example.invalid",nick="DemoSelf")
            store.secrets.put("server:${p.id}","test-only-server-password");store.save(listOf(p),DesktopSettings())
            val reopened=DesktopStore(dir);assertEquals("test-only-server-password",reopened.secrets.get("server:${p.id}"))
            assertFalse(File(dir,"settings.json").readText().contains("test-only-server-password"))
            assertEquals("HexDroidDreamsData",appDirectory().name)
        }finally{dir.deleteRecursively()}
    }
}
