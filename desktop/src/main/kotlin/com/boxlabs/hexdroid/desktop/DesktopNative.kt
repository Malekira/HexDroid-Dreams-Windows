/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.desktop

import java.awt.*
import java.awt.image.BufferedImage
import java.io.*
import java.net.URI
import java.net.http.*
import java.time.Duration
import javax.imageio.ImageIO
import javax.swing.JFileChooser
import javax.swing.filechooser.FileNameExtensionFilter
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

internal fun validDesktopImageUrl(value:String):Boolean=runCatching {
    val u=URI(value);u.scheme=="https" && !u.host.isNullOrBlank() && u.rawUserInfo==null && !value.any { it.isISOControl() }
}.getOrDefault(false)

/** HTTPS, bounded downloads, sampled decode, bounded cache, negative caching and concurrent requests. */
object DesktopImages {
    const val MAX_BYTES=2*1024*1024
    private val client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build()
    private data class Cached(val image:BufferedImage?,val loaded:Long)
    private val cache=object:LinkedHashMap<String,Cached>(16,.75f,true){override fun removeEldestEntry(e:MutableMap.MutableEntry<String,Cached>?)=size>68}
    private val slots=Semaphore(4)
    suspend fun load(url:String,full:Boolean=false,refresh:Boolean=false):BufferedImage?=withContext(Dispatchers.IO) {
        if(!validDesktopImageUrl(url))return@withContext null
        val key="$full:$url";val now=System.currentTimeMillis()
        synchronized(cache) { cache[key]?.takeIf { !refresh && now-it.loaded < if(it.image==null)30_000 else 300_000 } }?.let { return@withContext it.image }
        val image=slots.withPermit { runCatching { download(url,if(full)1024 else 128,0) }.getOrNull() }
        synchronized(cache) { cache[key]=Cached(image,System.currentTimeMillis()) };image
    }
    private fun download(url:String,edge:Int,redirects:Int):BufferedImage? {
        require(validDesktopImageUrl(url))
        val response=client.send(HttpRequest.newBuilder(URI(url)).timeout(Duration.ofSeconds(10)).header("User-Agent","HexDroid-Dreams-Desktop/0.1").GET().build(),HttpResponse.BodyHandlers.ofInputStream())
        return response.body().use { stream ->
            if(response.statusCode() in setOf(301,302,303,307,308)) {
                require(redirects<3);val location=response.headers().firstValue("Location").orElseThrow();return@use download(URI(url).resolve(location).toString(),edge,redirects+1)
            }
            require(response.statusCode() in 200..299)
            require(response.headers().firstValueAsLong("Content-Length").orElse(0)<=MAX_BYTES)
            val bytes=stream.readNBytes(MAX_BYTES+1);require(bytes.size<=MAX_BYTES)
            decode(bytes,edge)
        }
    }
    internal fun decode(bytes:ByteArray,edge:Int):BufferedImage? {
        require(bytes.size<=MAX_BYTES)
        return ImageIO.createImageInputStream(ByteArrayInputStream(bytes)).use { input ->
            val reader=ImageIO.getImageReaders(input).asSequence().firstOrNull() ?: return@use null
            try {
                reader.input=input
                val scale=maxOf(reader.getWidth(0),reader.getHeight(0))/edge
                val p=reader.defaultReadParam;p.setSourceSubsampling(maxOf(1,scale),maxOf(1,scale),0,0)
                reader.read(0,p)
            } finally { reader.dispose() }
        }
    }
}

interface DesktopNotifier:AutoCloseable { fun show(title:String,text:String,onOpen:()->Unit);override fun close() {} }
class WindowsNotifier(private val onShow:()->Unit,private val onExit:()->Unit):DesktopNotifier {
    private var target:(()->Unit)?=null
    private val icon:TrayIcon?=if(SystemTray.isSupported()) {
        val image=BufferedImage(32,32,BufferedImage.TYPE_INT_ARGB);image.createGraphics().apply { color=Color(0x00BFA5);fillRoundRect(0,0,32,32,8,8);color=Color.BLACK;font=Font(Font.SANS_SERIF,Font.BOLD,24);drawString("D",6,25);dispose() }
        val menu=PopupMenu().apply { add(MenuItem("Abrir HexDroid Dreams").apply { addActionListener { onShow() } });add(MenuItem("Salir").apply { addActionListener { onExit() } }) }
        TrayIcon(image,"HexDroid Dreams",menu).apply { isImageAutoSize=true;addActionListener { (target ?: onShow).invoke() };SystemTray.getSystemTray().add(this) }
    } else null
    override fun show(title:String,text:String,onOpen:()->Unit) { EventQueue.invokeLater { target=onOpen;icon?.displayMessage(title,text.take(400),TrayIcon.MessageType.INFO);Toolkit.getDefaultToolkit().beep() } }
    override fun close() { icon?.let { EventQueue.invokeLater { SystemTray.getSystemTray().remove(it) } } }
}
internal fun chooseFile(save:Boolean=false,title:String="Seleccionar archivo",extensions:Array<String> = arrayOf("json","zip")):File? {
    val chooser=JFileChooser().apply { dialogTitle=title;fileFilter=FileNameExtensionFilter(extensions.joinToString(", "),*extensions) }
    val result=if(save)chooser.showSaveDialog(null) else chooser.showOpenDialog(null)
    val file=chooser.selectedFile?.takeIf { result==JFileChooser.APPROVE_OPTION } ?: return null
    if(save && file.exists() && javax.swing.JOptionPane.showConfirmDialog(null,"El archivo existe. ¿Reemplazarlo?","Guardar",javax.swing.JOptionPane.YES_NO_OPTION)!=javax.swing.JOptionPane.YES_OPTION)return null
    return file
}
internal fun chooseFolder():File?=JFileChooser().apply { fileSelectionMode=JFileChooser.DIRECTORIES_ONLY;dialogTitle="Carpeta de historial" }.let { c->if(c.showOpenDialog(null)==JFileChooser.APPROVE_OPTION)c.selectedFile else null }
