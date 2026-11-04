/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.desktop

import com.boxlabs.hexdroid.*
import java.io.*
import java.sql.DriverManager
import java.time.*
import java.time.format.DateTimeFormatter
import java.util.UUID

/** Append-only UTF-8 archive; SQLite indexes content and IDs on disk, independently of UI scrollback. */
class DesktopHistory(directory:File):Closeable {
    val root=File(directory,"logs").apply { mkdirs() }
    private val db=DriverManager.getConnection("jdbc:sqlite:${File(directory,"history.db").absolutePath}")
    init { db.createStatement().use { s->s.execute("PRAGMA journal_mode=WAL");s.execute("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, net TEXT, buffer TEXT, time INTEGER, sender TEXT, body TEXT, line TEXT, msgid TEXT, signature TEXT)");s.execute("CREATE UNIQUE INDEX IF NOT EXISTS mid ON messages(net,buffer,msgid) WHERE msgid IS NOT NULL");s.execute("CREATE INDEX IF NOT EXISTS signature ON messages(net,buffer,signature)");s.execute("CREATE TABLE IF NOT EXISTS archive_signatures(path TEXT, signature TEXT, PRIMARY KEY(path,signature))");s.execute("CREATE TABLE IF NOT EXISTS archive_files(path TEXT PRIMARY KEY, size INTEGER)") } }
    data class Entry(val id:Long,val net:String,val buffer:String,val time:Long,val sender:String,val body:String,val line:String)
    fun path(net:String,buffer:String)="network-${historyDigest(net).take(24)}/${safeName(buffer)}.txt"
    private fun safeName(value:String):String {
        var sanitized=value.map { if(it in "<>:\"/\\|?*" || it.isISOControl()) '_' else it }.joinToString("")
        val reserved=sanitized.substringBefore('.').uppercase()
        if(reserved in setOf("CON","PRN","AUX","NUL") || (reserved.length==4 && (reserved.startsWith("COM") || reserved.startsWith("LPT")) && reserved.last().isDigit()))sanitized="nick-$sanitized"
        return uniqueHistoryFileBase(value,sanitized)
    }
    @Synchronized fun append(net:String,buffer:String,time:Long,sender:String,body:String,msgId:String?=null,replay:Boolean=false,settings:DesktopSettings=DesktopSettings(),networkName:String=net):Boolean {
        if(!settings.logging || buffer.startsWith('*'))return true
        val safe=safeHistoryText(buffer,body) ?: return true
        val line="[${Instant.ofEpochMilli(time).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"))}] <$sender> ${encodeHistoryBody(safe)}"
        val signature=historyDigest(line)
        val relative=path(net,buffer);val canonical=HistoryFiles.resolve(root,relative)
        indexFile(relative,canonical)
        if(replay && db.prepareStatement("SELECT 1 FROM archive_signatures WHERE path=? AND signature=?").use { p->p.setString(1,relative);p.setString(2,signature);p.executeQuery().use { it.next() } })return false
        val inserted=db.prepareStatement("INSERT OR IGNORE INTO messages(net,buffer,time,sender,body,line,msgid,signature) VALUES(?,?,?,?,?,?,?,?)").use { p->p.setString(1,net);p.setString(2,buffer);p.setLong(3,time);p.setString(4,sender);p.setString(5,safe);p.setString(6,line);p.setString(7,msgId);p.setString(8,signature);p.executeUpdate()>0 }
        if(!inserted)return false
        val file=HistoryFiles.resolve(root,path(net,buffer));file.parentFile.mkdirs();file.appendText(line+"\n",Charsets.UTF_8)
        db.prepareStatement("INSERT OR IGNORE INTO archive_signatures VALUES(?,?)").use { p->p.setString(1,relative);p.setString(2,signature);p.executeUpdate() }
        recordSize(relative,file)
        if(settings.logFolder.isNotBlank() || settings.dailyLogs || settings.combinedLogs) {
            val output=if(settings.logFolder.isNotBlank())File(settings.logFolder) else File(root.parentFile,"organized-logs")
            val day=if(settings.dailyLogs)"--"+Instant.ofEpochMilli(time).atZone(ZoneId.systemDefault()).toLocalDate() else ""
            val folder=if(settings.combinedLogs)"Historial" else safeName(networkName)+"--"+historyDigest(net).take(8)
            val target=File(File(output,folder),(if(settings.combinedLogs)"todo" else safeName(buffer))+day+".txt")
            try { target.parentFile.mkdirs();target.appendText((if(settings.combinedLogs)"[$networkName / $buffer] " else "")+line+"\n",Charsets.UTF_8) }
            catch(e:IOException) { throw IOException("La copia privada se conservó; no se pudo escribir en la carpeta elegida: ${e.message}",e) }
        }
        return true
    }
    @Synchronized fun search(query:String,offset:Int=0,limit:Int=100):List<Entry> = db.prepareStatement("SELECT * FROM messages WHERE instr(lower(line),lower(?))>0 ORDER BY time DESC,id DESC LIMIT ? OFFSET ?").use { p->p.setString(1,query);p.setInt(2,limit.coerceIn(1,500));p.setInt(3,offset.coerceAtLeast(0));p.executeQuery().use { r->buildList { while(r.next())add(Entry(r.getLong("id"),r.getString("net"),r.getString("buffer"),r.getLong("time"),r.getString("sender"),r.getString("body"),r.getString("line"))) } } }
    @Synchronized fun tail(net:String,buffer:String,limit:Int=200):List<Entry> {
        val file=HistoryFiles.resolve(root,path(net,buffer));if(!file.exists())return emptyList()
        val lines=RandomAccessFile(file,"r").use { raf ->
            val chunks=java.util.ArrayDeque<ByteArray>();var position=raf.length();var newlines=0
            while(position>0 && newlines<=limit) {
                val length=minOf(65536L,position).toInt();position-=length;val chunk=ByteArray(length)
                raf.seek(position);raf.readFully(chunk);newlines+=chunk.count { it==10.toByte() };chunks.addFirst(chunk)
            }
            val output=ByteArrayOutputStream();chunks.forEach { output.write(it) }
            String(output.toByteArray(),Charsets.UTF_8).trimEnd('\n','\r').lines().takeLast(limit)
        }
        return lines.mapIndexed { i,line->Entry(i.toLong(),net,buffer,0,"",line,line) }
    }
    private fun recordSize(path:String,file:File) { db.prepareStatement("INSERT OR REPLACE INTO archive_files VALUES(?,?)").use { p->p.setString(1,path);p.setLong(2,file.length());p.executeUpdate() } }
    private fun indexFile(path:String,file:File) {
        if(!file.exists())return
        val size=db.prepareStatement("SELECT size FROM archive_files WHERE path=?").use { p->p.setString(1,path);p.executeQuery().use { if(it.next())it.getLong(1) else -1L } }
        if(size==file.length())return
        db.autoCommit=false
        try {
            db.prepareStatement("INSERT OR IGNORE INTO archive_signatures VALUES(?,?)").use { p->file.useLines { lines->lines.forEach { line->p.setString(1,path);p.setString(2,historyDigest(line));p.executeUpdate() } } }
            recordSize(path,file);db.commit()
        }catch(e:Exception){db.rollback();throw e}finally{db.autoCommit=true}
    }
    data class TextHit(val path:String,val line:String)
    fun conversations()=HistoryFiles.list(root)
    @Synchronized fun searchText(query:String,offset:Long=0,limit:Int=100,path:String?=null):List<TextHit> {
        val terms=query.trim().split(Regex("\\s+")).filter { it.isNotEmpty() };val hits=mutableListOf<TextHit>();var matched=0L
        for(c in conversations().filter { path==null || it.path==path }) {
            HistoryFiles.resolve(root,c.path).useLines { lines ->
                val it=lines.iterator()
                while(it.hasNext() && hits.size<limit) { val line=it.next();if(terms.all { term->line.contains(term,true) }){if(matched++>=offset)hits+=TextHit(c.path,line)} }
            }
            if(hits.size>=limit)break
        }
        return hits
    }
    @Synchronized fun delete(paths:Set<String>) {
        paths.forEach { path->HistoryFiles.resolve(root,path).delete();db.prepareStatement("DELETE FROM archive_signatures WHERE path=?").use { it.setString(1,path);it.executeUpdate() };db.prepareStatement("DELETE FROM archive_files WHERE path=?").use { it.setString(1,path);it.executeUpdate() } }
        val targets=mutableListOf<Pair<String,String>>()
        db.createStatement().use { statement->statement.executeQuery("SELECT DISTINCT net,buffer FROM messages").use { r->while(r.next()) { val net=r.getString(1);val buffer=r.getString(2);if(path(net,buffer) in paths)targets+=net to buffer } } }
        db.prepareStatement("DELETE FROM messages WHERE net=? AND buffer=?").use { p->targets.forEach { (net,b)->p.setString(1,net);p.setString(2,b);p.executeUpdate() } }
    }
    fun size():Long=root.walkTopDown().filter { it.isFile }.sumOf { it.length() }
    @Synchronized fun export(out:OutputStream)=HistoryFiles.export(root,HistoryFiles.list(root).map { it.path }.toSet(),out)
    @Synchronized fun restore(input:InputStream):Int {
        val staging=File(root.parentFile,"restore-${UUID.randomUUID()}")
        try {
            val paths=HistoryFiles.stage(root,input,staging,allowEmpty=true)
            var added=0
            for(path in paths) {
                val dest=HistoryFiles.resolve(root,path);dest.parentFile.mkdirs()
                // Count occurrences on disk: merging must preserve two legitimate identical
                // messages in the same second, while restoring the same backup stays idempotent.
                db.createStatement().use { it.execute("DROP TABLE IF EXISTS temp.import_lines");it.execute("CREATE TEMP TABLE import_lines (line TEXT PRIMARY KEY, existing INTEGER NOT NULL DEFAULT 0, seen INTEGER NOT NULL DEFAULT 0)") }
                db.prepareStatement("INSERT INTO import_lines(line,existing) VALUES(?,1) ON CONFLICT(line) DO UPDATE SET existing=existing+1").use { insert->
                    if(dest.exists())dest.useLines { lines->lines.forEach { insert.setString(1,it);insert.executeUpdate() } }
                }
                HistoryFiles.resolve(staging,path).useLines { lines->
                    FileOutputStream(dest,true).bufferedWriter(Charsets.UTF_8).use { out->
                        db.prepareStatement("INSERT INTO import_lines(line,seen) VALUES(?,1) ON CONFLICT(line) DO UPDATE SET seen=seen+1 RETURNING seen>existing").use { insert->
                            lines.forEach { line->insert.setString(1,line);val append=insert.executeQuery().use { it.next() && it.getBoolean(1) };if(append){out.appendLine(line);added++} }
                        }
                    }
                }
            }
            paths.forEach { indexFile(it,HistoryFiles.resolve(root,it)) }
            return added
        } finally { staging.deleteRecursively() }
    }
    @Synchronized override fun close() { db.close() }
}
