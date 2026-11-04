/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.desktop

import com.boxlabs.hexdroid.*
import kotlinx.coroutines.*
import kotlinx.coroutines.swing.Swing
import org.junit.Test
import org.junit.Assert.*
import java.io.File
import java.nio.file.Files

class DesktopControllerTest {
    data class Notification(val title:String,val body:String,val open:()->Unit)
    class Notifier:DesktopNotifier { val calls=mutableListOf<Notification>();override fun show(title:String,text:String,onOpen:()->Unit){calls+=Notification(title,text,onOpen)} }
    private suspend fun until(predicate:()->Boolean) { withTimeout(10_000){while(!predicate())delay(20)} }
    private suspend fun model(port:Int=6697,block:suspend (DesktopController,DesktopProfile,Notifier)->Unit) {
        val dir=Files.createTempDirectory("dreams-controller-").toFile()
        val p=DesktopProfile(id="demo-network",name="Red de prueba",host=if(port==6697)"irc.example.invalid" else "127.0.0.1",port=port,useTls=port==6697,nick="DemoSelf",autoReconnect=false)
        val store=DesktopStore(dir);store.save(listOf(p),DesktopSettings())
        withContext(Dispatchers.Swing) {
            val n=Notifier();val vm=DesktopController(store,n)
            try { block(vm,p,n) } finally { vm.shutdown();dir.deleteRecursively() }
        }
    }
    @Test fun realSocketRegistrationSendingReceivingAndWhoisKeepTheRoomOpen():Unit=runBlocking {
        val server=FakeIrcServer("message-tags server-time echo-message",listOf(":srv 001 DemoSelf :Welcome",":srv 005 DemoSelf CHANTYPES=#& PREFIX=(ov)@+ NETWORK=TestNet :supported",":srv 376 DemoSelf :End"))
        try { model(server.port){vm,p,_->
            vm.connect(p.id).join();until{vm.connected(p.id)}
            vm.submit("/join #demo",p.id,"*server*").join()
            withContext(Dispatchers.IO){server.expect{it.startsWith("JOIN #demo")}}
            server.send(":DemoSelf!ident@host.invalid JOIN #demo");server.send(":srv 353 DemoSelf = #demo :@DemoSelf +DemoNick01 DemoNick02");server.send(":srv 366 DemoSelf #demo :End")
            until{vm.selectedBuffer()?.name=="#demo" && vm.selectedBuffer()?.members?.size==3}
            vm.submit("Hola ñ 🙂").join()
            withContext(Dispatchers.IO){server.expect{it.contains("PRIVMSG #demo :Hola ñ 🙂")}}
            server.send("@msgid=sent-demo-1;time=2026-11-04T12:00:00.000Z :DemoSelf!ident@host.invalid PRIVMSG #demo :Hola ñ 🙂")
            until{vm.selectedBuffer()?.messages?.any{it.text=="Hola ñ 🙂"}==true}
            vm.whois(p.id,"DemoNick01")
            withContext(Dispatchers.IO){server.expect{it.contains("WHOIS DemoNick01 DemoNick01",ignoreCase=true)}}
            server.send(":srv 311 DemoSelf DemoNick01 ident host.invalid * :Nombre de prueba")
            server.send(":srv 317 DemoSelf DemoNick01 125 ${System.currentTimeMillis()/1000-7200} :seconds idle")
            server.send(":srv 318 DemoSelf DemoNick01 :End of WHOIS")
            until{vm.state.whois.any{it.nick=="DemoNick01" && it.fields["idle"]=="2m 5s"}}
            assertEquals("#demo",vm.selectedBuffer()?.name);assertFalse(vm.state.buffers.values.any{it.name==WHOIS_BUFFER});assertTrue(vm.state.whois.single().fields.getValue("connected").contains("2h"))
        } }finally{server.close()}
    }
    @Test fun membershipEventsDoNotCountAsUnreadButChatNotifiesOnceAndOpensItsExactMessage():Unit=runBlocking {
        model { vm,p,n->
            vm.handleEvent(p.id,IrcEvent.Registered("DemoSelf"));vm.handleEvent(p.id,IrcEvent.Joined("#demo","DemoSelf"));vm.page("Redes")
            vm.handleEvent(p.id,IrcEvent.Joined("#demo","DemoNick01"));vm.handleEvent(p.id,IrcEvent.Parted("#demo","DemoNick01",reason="Salida"));vm.handleEvent(p.id,IrcEvent.Joined("#demo","DemoNick02"));vm.handleEvent(p.id,IrcEvent.Quit("DemoNick02",reason="Fin"))
            val key=vm.key(p.id,"#demo");assertEquals(0,vm.state.buffers.getValue(key).unread)
            val event=IrcEvent.ChatMessage("DemoNick03","#demo","DemoSelf: prueba",false,msgId="mention-demo-1")
            vm.handleEvent(p.id,event);vm.handleEvent(p.id,event)
            assertEquals(1,vm.state.buffers.getValue(key).unread);assertEquals(1,n.calls.size)
            n.calls.single().open();until{vm.state.jumpTo=="mention-demo-1"}
            assertEquals(key,vm.state.selected);assertEquals("Chat",vm.state.page)
            vm.settings(vm.state.settings.copy(notifyVisibleMentions=true));vm.windowFocused=true
            vm.handleEvent(p.id,event.copy(msgId="mention-demo-2"));assertEquals(2,n.calls.size)
            vm.handleEvent(p.id,event.copy(msgId="mention-demo-replay",isHistory=true));assertEquals(2,n.calls.size)
        }
    }
    @Test fun noticesReplicateAcrossValidDestinationsWithoutCreatingAServerPrivate():Unit=runBlocking {
        model { vm,p,n->
            vm.select(p.id,"#demo");vm.settings(vm.state.settings.copy(noticeDestinations=ReplyDestination.STATUS or ReplyDestination.PRIVATE or ReplyDestination.ACTIVE))
            vm.handleEvent(p.id,IrcEvent.Notice(from="DemoNick01",target="DemoSelf",text="Aviso de prueba",isPrivate=true))
            for(name in listOf("*server*","DemoNick01","#demo"))assertTrue(vm.state.buffers.getValue(vm.key(p.id,name)).messages.any{it.text=="Aviso de prueba"})
            vm.handleEvent(p.id,IrcEvent.Notice(from="server.example.invalid",target="DemoSelf",text="Aviso del servidor",isPrivate=true,isServer=true))
            assertFalse(vm.state.buffers.values.any{it.name=="server.example.invalid"});assertTrue(n.calls.isEmpty())
        }
    }
    @Test fun scriptEngineUsesTheRealRoomMembersIncludingOperatorsAndVoice():Unit=runBlocking {
        model { vm,p,_->
            vm.select(p.id,"#demo");vm.handleEvent(p.id,IrcEvent.Names("#demo",listOf("@DemoOp","+DemoVoice","DemoSelf")))
            File(vm.store.scriptsDirectory,"members.hex").writeText("alias miembros { echo ${'$'}members(#demo) }\nalias nombres { echo ${'$'}membernames(#demo) }\n",Charsets.UTF_8)
            vm.reloadScripts();vm.enableScript("members.hex",true)
            vm.submit("/miembros",p.id,"#demo").join();until{vm.selectedBuffer()?.messages?.any{it.text.contains("@DemoOp +DemoVoice")}==true}
            vm.submit("/nombres",p.id,"#demo").join();until{vm.selectedBuffer()?.messages?.any{it.text=="DemoOp DemoVoice DemoSelf"}==true}
            vm.handleEvent(p.id,IrcEvent.NamesEnd("#demo"));vm.handleEvent(p.id,IrcEvent.Names("#demo",listOf("@DemoOp","DemoSelf")));vm.handleEvent(p.id,IrcEvent.NamesEnd("#demo"))
            assertFalse(vm.selectedBuffer()!!.members.contains("+DemoVoice"))
        }
    }
    @Test fun whoisAndActiveDestinationsNeverCrossNetworksAndIdleIsNeverInvented():Unit=runBlocking {
        model { vm,p,_->
            vm.select("other-network","#other");vm.settings(vm.state.settings.copy(whoisDestinations=ReplyDestination.STATUS or ReplyDestination.ACTIVE or ReplyDestination.FLOATING))
            vm.handleEvent(p.id,IrcEvent.ServerText("Nick host",code="311",isWhoisReply=true,whoisNick="DemoNick01",whoisRequestId=1,whoisParams=listOf("DemoSelf","DemoNick01","ident","host.invalid","*"),whoisTrailing="Nombre de prueba"))
            vm.handleEvent(p.id,IrcEvent.ServerText("End",code="318",isWhoisReply=true,whoisNick="DemoNick01",whoisRequestId=1))
            assertFalse(vm.state.whois.single().fields.containsKey("idle"))
            assertTrue(vm.state.buffers.getValue(vm.key(p.id,"*server*")).messages.any{it.kind=="whois"})
            assertTrue(vm.state.buffers.getValue(vm.key("other-network","#other")).messages.isEmpty())
        }
    }
}
