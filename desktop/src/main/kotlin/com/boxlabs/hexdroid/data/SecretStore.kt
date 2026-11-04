/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.data

import com.sun.jna.platform.win32.Crypt32Util
import org.json.JSONObject
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.Base64

/** User-bound Windows DPAPI; other OSes keep secrets in memory and never write plaintext. */
class SecretStore(private val directory: File) {
    private val windows = System.getProperty("os.name").startsWith("Windows", true)
    private val file = File(directory,"credentials.dpapi")
    private var values = if (file.exists() && windows) JSONObject(String(Crypt32Util.cryptUnprotectData(file.readBytes()),Charsets.UTF_8)) else JSONObject()
    @Synchronized fun get(key: String): String? = if (values.has(key)) values.getString(key) else null
    @Synchronized fun put(key: String, value: String?) {
        if (value == null || value.isEmpty()) values.remove(key) else values.put(key,value)
        if (!windows) return
        val bytes = values.toString().toByteArray(Charsets.UTF_8)
        try { atomicWrite(file, Crypt32Util.cryptProtectData(bytes)) } finally { bytes.fill(0) }
    }
    data class StoredE2eKey(val target: String,val schemeName: String,val keyBytes: ByteArray)
    fun setE2eKey(networkId: String,target: String,schemeName: String,keyBytes: ByteArray) = put("e2e:$networkId:$target", "$schemeName:${Base64.getEncoder().encodeToString(keyBytes)}")
    fun clearE2eKey(networkId: String,target: String) = put("e2e:$networkId:$target",null)
    @Synchronized fun listE2eKeys(networkId: String): List<StoredE2eKey> {
        val prefix="e2e:$networkId:"
        return values.keySet().filter { it.startsWith(prefix) }.mapNotNull { key -> runCatching {
            val v=values.getString(key);StoredE2eKey(key.removePrefix(prefix),v.substringBefore(':'),Base64.getDecoder().decode(v.substringAfter(':')))
        }.getOrNull() }
    }
    companion object {
        fun atomicWrite(file: File, bytes: ByteArray) {
            file.parentFile.mkdirs()
            val temp=Files.createTempFile(file.parentFile.toPath(),".dreams-", ".tmp")
            try { Files.write(temp,bytes);try { Files.move(temp,file.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING) }
                catch (_: java.nio.file.AtomicMoveNotSupportedException) { Files.move(temp,file.toPath(),StandardCopyOption.REPLACE_EXISTING) }
            } finally { Files.deleteIfExists(temp) }
        }
    }
}
