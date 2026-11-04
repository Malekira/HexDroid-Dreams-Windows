/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid
import java.io.*
import java.security.MessageDigest
import java.util.zip.*

internal fun historyDigest(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

/** Sanitisation/truncation must never merge different valid IRC targets into one file. */
internal fun uniqueHistoryFileBase(original: String, sanitized: String): String {
    if (original == sanitized && sanitized.toByteArray(Charsets.UTF_8).size <= 200) return sanitized
    val prefix = StringBuilder()
    var bytes = 0
    val points = sanitized.codePoints().iterator()
    while (points.hasNext()) {
        val point = points.nextInt()
        if (point in 0xd800..0xdfff) continue // A legacy UTF-16 truncation can leave an isolated surrogate.
        val chars = String(Character.toChars(point))
        val size = chars.toByteArray(Charsets.UTF_8).size
        if (bytes + size > 160) break
        prefix.append(chars); bytes += size
    }
    return "$prefix--${historyDigest(original).take(16)}"
}

/** Excludes authentication exchanges; redacts accidental credential assignments in conversation text. */
internal fun safeHistoryText(buffer: String, text: String): String? {
    if (bareMember(buffer).lowercase() in setOf("nickserv", "authserv", "chanserv", "operserv")) return null
    val clean = stripIrcFormatting(text)
    if (Regex("(?i)^\\s*(?:/|(?:PRIVMSG\\s+\\S+\\s+:))?(?:identify|authenticate|pass|oper|sasl|login|auth)\\b").containsMatchIn(clean)) return null
    return clean.replace(Regex("(?i)\\b(password|passwd|contraseña|token|secret|api[_-]?key|authorization)\\s*[:=]\\s*[^\\s]+"), "$1=[REDACTADO]")
        .replace(Regex("(?i)\\bBearer\\s+[^\\s]+"), "Bearer [REDACTADO]")
        .replace(Regex("(?i)([a-z][a-z0-9+.-]*://)[^\\s/@]+:[^\\s/@]+@"), "$1[REDACTADO]@")
}

data class HistoryConversation(val path: String, val bytes: Long)
data class HistoryPage(val lines: List<String>, val next: Long?)

/** Streaming utilities: history size never sets a scrollback or retention limit. */
internal object HistoryFiles {
    fun resolve(root: File, path: String): File {
        require(path.split('/').size == 2 && path.endsWith(".txt") && '\\' !in path && '\u0000' !in path) { "Ruta de historial no válida" }
        val f = File(root, path).canonicalFile
        require(f.path.startsWith(root.canonicalPath + File.separator) && f.parentFile != root.canonicalFile) { "Ruta fuera del historial" }
        return f
    }
    fun list(root: File): List<HistoryConversation> = root.walkTopDown().filter { it.isFile && it.extension == "txt" && it.relativeTo(root).invariantSeparatorsPath.split('/').size == 2 }
        .map { HistoryConversation(it.relativeTo(root).invariantSeparatorsPath, it.length()) }.sortedBy { it.path }.toList()
    fun page(root: File, path: String, query: String, offset: Long, size: Int = 100): HistoryPage {
        val terms = query.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        val result = mutableListOf<String>()
        var count = 0L
        var next: Long? = null
        resolve(root, path).bufferedReader(Charsets.UTF_8).useLines { lines ->
            val it = lines.iterator()
            while (it.hasNext()) {
                val line = it.next(); val pos = count++
                if (pos < offset || !terms.all { line.contains(it, true) }) continue
                if (result.size == size) { next = pos; break }
                result += line
            }
        }
        return HistoryPage(result, next)
    }
    fun export(root: File, paths: Set<String>, out: OutputStream) {
        ZipOutputStream(out.buffered()).use { z ->
            paths.sorted().forEach { path ->
                val f = resolve(root, path)
                z.putNextEntry(ZipEntry(path)); f.inputStream().use { it.copyTo(z) }; z.closeEntry()
            }
        }
    }
    /** Validate the entire archive before touching stored conversations. Disk space is the real limit. */
    fun stage(root: File, input: InputStream, staging: File, allowEmpty: Boolean = false): List<String> {
        val paths = mutableListOf<String>()
        input.buffered().use { buffered ->
            buffered.mark(4)
            val signature = List(4) { buffered.read() }
            buffered.reset()
            require(signature == listOf(0x50, 0x4b, 3, 4) || signature == listOf(0x50, 0x4b, 5, 6)) { "La copia no es un ZIP de historial" }
            ZipInputStream(buffered).use { z ->
                while (true) {
                    val entry = z.nextEntry ?: break
                    if (entry.isDirectory) { z.closeEntry(); continue }
                    resolve(root, entry.name) // rejects traversal and foreign backup types
                    require(entry.name !in paths) { "Archivo duplicado en la copia" }
                    val out = resolve(staging, entry.name); out.parentFile!!.mkdirs()
                    out.outputStream().use { z.copyTo(it) }; z.closeEntry()
                    // Reject binary/corrupt content, including malformed UTF-8, before merging anything.
                    val decoder = Charsets.UTF_8.newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                    InputStreamReader(out.inputStream(), decoder).buffered().useLines { lines -> lines.forEach { require('\u0000' !in it) { "El historial no es texto" } } }
                    paths += entry.name
                }
            }
        }
        require(allowEmpty || paths.isNotEmpty()) { "La copia no contiene conversaciones compatibles" }
        return paths
    }
}

