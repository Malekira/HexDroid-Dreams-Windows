/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.desktop

import com.boxlabs.hexdroid.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.onEach
import java.io.File
import java.net.InetAddress
import java.security.KeyStore
import javax.net.ssl.*
import kotlin.concurrent.thread

/** Exercise the installed runtime's actual TLS provider, trust/hostname checks and IRC parser. */
internal fun packagedTlsSmoke(certificate:File,password:String) {
    System.setProperty("javax.net.ssl.trustStore",certificate.absolutePath)
    System.setProperty("javax.net.ssl.trustStorePassword",password)
    System.setProperty("javax.net.ssl.trustStoreType","PKCS12")
    val keys=KeyStore.getInstance("PKCS12");certificate.inputStream().use{keys.load(it,password.toCharArray())}
    val factory=KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());factory.init(keys,password.toCharArray())
    val context=SSLContext.getInstance("TLS");context.init(factory.keyManagers,null,null)
    val server=context.serverSocketFactory.createServerSocket(0,1,InetAddress.getLoopbackAddress())
    val worker=thread(isDaemon=true,name="packaged-tls-smoke") {
        runCatching { server.accept().use { socket->
            val reader=socket.getInputStream().bufferedReader(Charsets.UTF_8);val writer=socket.getOutputStream().bufferedWriter(Charsets.UTF_8)
            fun send(line:String){writer.write(line+"\r\n");writer.flush()}
            while(true) {
                val line=reader.readLine() ?: break
                when {
                    line.startsWith("CAP LS")->send(":srv CAP * LS :")
                    line=="CAP END"->{send(":srv 001 DemoSelf :Welcome");send(":srv 376 DemoSelf :End")}
                    line.contains("PRIVMSG #smoke :TLS test")->send(":DemoPeer!ident@host.invalid PRIVMSG DemoSelf :TLS smoke ñ")
                    line.startsWith("PING")->send(":srv PONG srv :${line.substringAfter(':')}")
                }
            }
        } }
    }
    val client=IrcClient(IrcConfig("localhost",server.localPort,true,false,"DemoSelf",null,"dreams","HexDroid Dreams"))
    client.strings=DesktopStrings::text;client.plurals=DesktopStrings::plural
    try { runBlocking {
        val received=CompletableDeferred<Unit>()
        val collect=launch { client.events().collect { event ->
            if(event is IrcEvent.Registered)client.privmsg("#smoke","TLS test")
            if(event is IrcEvent.ChatMessage && event.text=="TLS smoke ñ")received.complete(Unit)
        } }
        try { withTimeout(20_000) { received.await() } }
        finally { client.forceClose();collect.cancelAndJoin() }
    } } finally { client.forceClose();server.close();worker.join(2000) }
}
