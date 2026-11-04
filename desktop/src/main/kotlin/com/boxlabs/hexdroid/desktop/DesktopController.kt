/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.desktop

import androidx.compose.runtime.*
import com.boxlabs.hexdroid.*
import com.boxlabs.hexdroid.crypto.*
import com.boxlabs.hexdroid.connection.ProxyType
import com.boxlabs.hexdroid.script.*
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.io.File
import java.net.URI
import java.net.http.*
import java.time.Duration
import java.util.UUID

private const val STATUS="*server*"
data class DesktopMessage(val id:String=UUID.randomUUID().toString(),val time:Long=System.currentTimeMillis(),val from:String?=null,val text:String,val kind:String="chat",val mention:Boolean=false)
data class DesktopBuffer(val network:String,val name:String,val messages:List<DesktopMessage> = emptyList(),val unread:Int=0,val highlights:Int=0,val topic:String="",val members:List<String> = emptyList(),val draft:String="")
data class DesktopConnection(val connected:Boolean=false,val connecting:Boolean=false,val nick:String="",val channelTypes:String="#&",val caseMapping:String="rfc1459",val networkName:String="",val avatars:Map<String,String> = emptyMap(),val userModes:String="")
data class DesktopState(val profiles:List<DesktopProfile>,val settings:DesktopSettings,val buffers:Map<String,DesktopBuffer> = emptyMap(),val connections:Map<String,DesktopConnection> = emptyMap(),
    val selected:String?=null,val page:String="Redes",val error:String?=null,val whois:List<WhoisWindow> = emptyList(),val scriptView:ScriptView?=null,val scriptFiles:Map<String,Boolean> = emptyMap(),val jumpTo:String?=null)

/** Desktop state lives on the Swing/Compose dispatcher; socket and disk work run off it. */
class DesktopController(val store:DesktopStore,private val notifier:DesktopNotifier,dispatcher:CoroutineDispatcher=Dispatchers.Main) {
    val scope=CoroutineScope(SupervisorJob()+dispatcher)
    val history=DesktopHistory(store.root)
    val keyStore=E2eKeyStore(store.secrets)
    private val loaded=store.load()
    var state by mutableStateOf(DesktopState(loaded.first,loaded.second));private set
    private data class Runtime(val client:IrcClient,val job:Job)
    private val runtimes=mutableMapOf<String,Runtime>()
    private val manualStops=mutableSetOf<String>()
    private val retainedDrafts=mutableMapOf<String,String>()
    private val retries=mutableMapOf<String,Int>()
    private val namesBatches=mutableSetOf<String>()
    private val whoisTimers=mutableMapOf<Pair<String,Long>,Job>()
    private val seen=LinkedHashMap<String,Long>()
    private val whoisBlocks=WhoisBlocks()
    private val scriptTimers=mutableListOf<Job>()
    private val media=mutableMapOf<String,Pair<String,File>>()
    private var closed=false
    private val persistLock=Mutex()
    var windowFocused=true
    var requestWindow:()->Unit={}
    private val http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build()
    val engine=ScriptEngine(scriptHost(),HexScriptBackend())

    init { engine.start();reloadScripts() }
    fun start() { state.profiles.filter { it.autoConnect }.forEach { connect(it.id) } }
    fun key(net:String,buffer:String):String="$net::${ircCasefold(buffer,state.connections[net]?.caseMapping ?: "rfc1459")}" 
    private fun buffer(net:String,name:String):DesktopBuffer {
        val k=key(net,name);return state.buffers[k] ?: DesktopBuffer(net,name,draft=retainedDrafts[k].orEmpty()).also { state=state.copy(buffers=state.buffers+(k to it)) }
    }
    fun selectedBuffer():DesktopBuffer?=state.selected?.let { state.buffers[it] }
    fun profile(net:String)=state.profiles.firstOrNull { it.id==net }
    fun report(text:String) { state=state.copy(error=text) }
    fun dismissScriptView() { state=state.copy(scriptView=null) }
    val inputHistories=mutableMapOf<String,MutableList<String>>()
    fun dismissError() { state=state.copy(error=null) }
    fun page(name:String) { state=state.copy(page=name) }
    fun select(net:String,name:String) {
        val b=buffer(net,name);val k=key(net,name)
        state=state.copy(selected=k,page="Chat",buffers=state.buffers+(k to b.copy(unread=0,highlights=0)))
        if(b.messages.isEmpty()) scope.launch { val entries=withContext(Dispatchers.IO) { history.tail(net,ircCasefold(name,state.connections[net]?.caseMapping ?: "rfc1459")) }
            val current=state.buffers[k] ?: return@launch
            if(current.messages.isEmpty()) state=state.copy(buffers=state.buffers+(k to current.copy(messages=entries.map { DesktopMessage("archive-${it.id}",it.time,null,it.line,"archive") }))) }
    }
    fun saveDraft(value:String) { val k=state.selected ?: return;val b=state.buffers[k] ?: return;state=state.copy(buffers=state.buffers+(k to b.copy(draft=value))) }
    fun persist()=scope.launch { try { persistLock.withLock { val snapshot=state;withContext(Dispatchers.IO) { store.save(snapshot.profiles,snapshot.settings) } } } catch(e:Exception) { report("No se pudo guardar: ${e.message}") } }
    fun settings(value:DesktopSettings) { state=state.copy(settings=value);persist() }
    fun saveProfile(p:DesktopProfile,server:String,sasl:String,proxy:String):Job=scope.launch {
        try {
            p.validate()
            withContext(Dispatchers.IO) { store.secrets.put("server:${p.id}",server);store.secrets.put("sasl:${p.id}",sasl);store.secrets.put("proxy:${p.id}",proxy) }
            state=state.copy(profiles=state.profiles.filterNot { it.id==p.id }+p);persist().join()
        } catch(e:Exception) { report(e.message ?: "No se pudo guardar la red") }
    }
    fun deleteProfile(id:String)=scope.launch { disconnect(id,false).join();state=state.copy(profiles=state.profiles.filterNot { it.id==id });persist().join() }
    fun connect(id:String):Job=scope.launch {
        if(closed || runtimes.containsKey(id))return@launch
        val p=profile(id) ?: return@launch
        try { p.validate() } catch(e:Exception) { report(e.message ?: "Perfil inválido");return@launch }
        manualStops.remove(id);buffer(id,STATUS)
        state=state.copy(connections=state.connections+(id to DesktopConnection(connecting=true,nick=p.nick)),whois=state.whois.filterNot { it.network==id })
        val cfg=try { withContext(Dispatchers.IO) { p.config(store.secrets) } } catch(e:Exception) {
            report("No se pudieron abrir las credenciales: ${e.message}");state=state.copy(connections=state.connections+(id to DesktopConnection()));return@launch
        }
        if(p.saslEnabled && p.saslMechanism==SaslMechanism.EXTERNAL && cfg.clientCert==null){report("Importá el certificado PKCS#12 de esta identidad antes de conectar");state=state.copy(connections=state.connections+(id to DesktopConnection()));return@launch}
        val client=IrcClient(cfg).apply { strings=DesktopStrings::text;plurals=DesktopStrings::plural;e2eCodec=E2eCodec(id,keyStore) }
        val job=scope.launch(start=CoroutineStart.LAZY) {
            try { client.events().collect { event->handleEvent(id,event) } }
            catch(e:CancellationException) { throw e }
            catch(e:Exception) { local(id,STATUS,"Conexión: ${e.message}") }
            finally {
                client.forceClose();runtimes.remove(id)
                state=state.copy(connections=state.connections+(id to (state.connections[id] ?: DesktopConnection()).copy(connected=false,connecting=false)))
                if(!closed && id !in manualStops && profile(id)?.autoReconnect==true) {
                    val attempt=(retries[id] ?: 0)+1;retries[id]=attempt
                    delay((2_000L shl attempt.coerceAtMost(5)).coerceAtMost(60_000));if(!closed && id !in manualStops)connect(id)
                }
            }
        }
        runtimes[id]=Runtime(client,job);job.start()
    }
    fun disconnect(id:String,returnToNetworks:Boolean=true)=scope.launch {
        manualStops+=id
        runtimes[id]?.let { r->runCatching { r.client.sendRaw("QUIT :HexDroid Dreams") };delay(200);r.client.forceClose();r.job.cancelAndJoin() }
        state.buffers.filterValues { it.network==id }.forEach { (k,b)->retainedDrafts[k]=b.draft }
        val selectedIsThis=state.selected?.startsWith("$id::")==true
        state=state.copy(buffers=state.buffers.filterValues { it.network!=id },selected=if(selectedIsThis)null else state.selected,
            page=if(selectedIsThis && returnToNetworks)"Redes" else state.page,whois=state.whois.filterNot { it.network==id })
    }
    fun closeBuffer(net:String,name:String)=scope.launch {
        if(name==STATUS){disconnect(net).join();return@launch}
        if(isChannel(net,name) && connected(net))runtimes[net]?.client?.sendRaw("PART $name")
        val k=key(net,name);retainedDrafts.remove(k);state=state.copy(buffers=state.buffers-k)
        if(state.selected==k)select(net,STATUS)
    }
    fun connected(net:String)=state.connections[net]?.connected==true
    fun isChannel(net:String,name:String)=name.firstOrNull()?.let { it in (state.connections[net]?.channelTypes ?: "#&") }==true
    private fun own(net:String)=state.connections[net]?.nick ?: profile(net)?.nick.orEmpty()
    private fun ownNick(net:String,nick:String)=ircCasefold(own(net),state.connections[net]?.caseMapping ?: "rfc1459")==ircCasefold(bareMember(nick),state.connections[net]?.caseMapping ?: "rfc1459")
    private suspend fun local(net:String,buffer:String,text:String,kind:String="status")=add(net,buffer,DesktopMessage(text=text,kind=kind),count=false,log=false)
    private suspend fun add(net:String,name:String,message:DesktopMessage,count:Boolean=true,log:Boolean=true,replay:Boolean=false,encrypted:Boolean=false):Boolean {
        val k=key(net,name);val b=buffer(net,name)
        if(log && !name.startsWith('*') && (!encrypted || state.settings.logEncrypted)) {
            try {
                val accepted=withContext(Dispatchers.IO) { history.append(net,k.substringAfter("::"),message.time,message.from.orEmpty(),message.text,message.id.takeUnless { it.startsWith("local-") },replay,state.settings,profile(net)?.name ?: net) }
                if(!accepted)return false
            } catch(e:Exception) { report(e.message ?: "No se pudo registrar el mensaje") }
        }
        val visible=state.selected==k && state.page=="Chat" && windowFocused
        val current=state.buffers[k] ?: b
        val m=current.copy(messages=(current.messages+message).takeLast(1500),unread=current.unread+if(count && !visible && !replay)1 else 0,highlights=current.highlights+if(count && !visible && !replay && message.mention)1 else 0)
        state=state.copy(buffers=state.buffers+(k to m));return true
    }
    private fun isMention(net:String,text:String):Boolean {
        val nick=own(net);if(nick.isBlank())return false
        return Regex("(?i)(?<![\\w\\[\\]\\\\`_^{|}-])${Regex.escape(nick)}(?![\\w\\[\\]\\\\`_^{|}-])").containsMatchIn(stripIrcFormatting(text))
    }
    fun submit(text:String,network:String?=null,target:String?=null,applyStyle:Boolean=true):Job=scope.launch {
        val b=selectedBuffer();val net=network ?: b?.network ?: return@launch;val dest=target ?: b?.name ?: STATUS
        if(text.isBlank())return@launch
        try {
            val transformed=engine.onInput(InputEvent(net,dest,text));if(transformed.halted)return@launch
            val t=transformed.text.trim();val cmd=t.substringBefore(' ').removePrefix("/").lowercase();val args=t.substringAfter(' ',"")
            if(t.startsWith('/') && engine.runCommand(cmd,args,net,dest))return@launch
            if(t.startsWith('/')) {
                when(cmd) {
                    "query" -> { require(isReplyNick(args.trim())) { "Nick no válido" };select(net,args.trim()) }
                    "close" -> closeBuffer(net,dest).join()
                    "clear" -> { val k=key(net,dest);state.buffers[k]?.let { state=state.copy(buffers=state.buffers+(k to it.copy(messages=emptyList()))) } }
                    "disconnect","quit" -> disconnect(net).join()
                    "connect","reconnect" -> { disconnect(net,false).join();connect(net).join() }
                    "echo" -> local(net,dest,args)
                    "setkey" -> {
                        val parts=args.split(' ',limit=2);require(parts.size==2) { "Uso: /setkey AGM clave-base64 o /setkey FISH frase" }
                        val scheme=E2eScheme.fromName(parts[0]);require(scheme==E2eScheme.AGM || scheme==E2eScheme.BLOWFISH) { "Esquema no admitido" }
                        val bytes=if(scheme==E2eScheme.AGM)java.util.Base64.getDecoder().decode(parts[1]) else parts[1].toByteArray(Charsets.UTF_8)
                        require(if(scheme==E2eScheme.AGM)bytes.size==32 else bytes.size in 4..56) { "Longitud de clave no válida" }
                        withContext(Dispatchers.IO) { keyStore.set(net,dest,E2eKeyStore.Entry(scheme,bytes)) };local(net,dest,"Cifrado configurado para esta conversación")
                    }
                    "delkey" -> { withContext(Dispatchers.IO) { keyStore.clear(net,dest) };local(net,dest,"Cifrado retirado") }
                    else -> {
                        val c=runtimes[net]?.client ?: error("La red no está conectada")
                        require(connected(net)) { "La red todavía no está registrada" }
                        if(cmd=="whois")c.handleSlashCommand(whoisCommand(t.removePrefix("/"),true),dest)
                        else c.handleSlashCommand(normalizeJoinAlias(t.removePrefix("/"),state.connections[net]?.channelTypes ?: "#&"),dest)
                    }
                }
            } else {
                require(!dest.startsWith('*')) { "Elegí una sala o un privado para enviar mensajes" }
                require(connected(net)) { "La red no está conectada" }
                val c=runtimes.getValue(net).client
                val styled=if(applyStyle)state.settings.style.apply(t) else t
                val id=c.privmsg(dest,styled)
                if(!c.hasCap("echo-message")) {
                    val ownResult=engine.onText(TextEvent(net,dest,own(net),styled,false,!isChannel(net,dest),true))
                    if(!ownResult.halted)add(net,dest,DesktopMessage("local-${id ?: UUID.randomUUID()}",from=own(net),text=ownResult.text),count=false,encrypted=keyStore.get(net,dest)!=null)
                }
            }
        } catch(e:Exception) { if(e is CancellationException)throw e;report(e.message ?: "No se pudo ejecutar") }
    }
    fun whois(net:String,nick:String) { submit("/whois ${bareMember(nick)}",net,selectedBuffer()?.takeIf { it.network==net }?.name ?: STATUS) }
    fun updateWhois(window:WhoisWindow) { state=state.copy(whois=state.whois.map { if(it.network==window.network && it.id==window.id)window else it }) }
    fun closeWhois(window:WhoisWindow) { state=state.copy(whois=state.whois.filterNot { it.network==window.network && it.id==window.id }) }
    fun avatar(net:String,nick:String):String? {
        val p=profile(net) ?: return null;if(p.proxyType!=ProxyType.NONE || !state.settings.avatars)return null
        val n=bareMember(nick);val c=state.connections[net]
        val explicit=if(ownNick(net,n))p.avatarUrl.takeIf { it.isNotBlank() } else null
        return explicit ?: c?.avatars?.get(n.lowercase()) ?: chatZonaAvatarUrl(p.host,c?.networkName,n)
    }
    private fun ignored(net:String,nick:String)=profile(net)?.ignoredNicks?.any { mask->
        val regex=Regex("(?i)^"+Regex.escape(mask).replace("*","\\E.*\\Q").replace("?","\\E.\\Q")+"$")
        regex.matches(nick)
    }==true

    internal suspend fun handleEvent(net:String,event:IrcEvent) {
        when(event) {
            is IrcEvent.Connected -> local(net,STATUS,"Conectado a ${event.server}")
            is IrcEvent.Registered -> {
                retries.remove(net);state=state.copy(connections=state.connections+(net to (state.connections[net] ?: DesktopConnection()).copy(connected=true,connecting=false,nick=event.nick)))
                local(net,STATUS,"Registrado como ${event.nick}")
                runtimes[net]?.client?.let { c->if(c.hasCap("draft/metadata-2")){c.sendMetadata("*","SUB","avatar");profile(net)?.avatarUrl?.takeIf { it.isNotBlank() }?.let { c.setOwnMetadata("avatar",it) } } }
                engine.dispatch("CONNECT",EventData(net,STATUS))
            }
            is IrcEvent.Disconnected -> { state=state.copy(connections=state.connections+(net to (state.connections[net] ?: DesktopConnection()).copy(connected=false,connecting=false)));local(net,STATUS,event.reason ?: "Desconectado");engine.dispatch("DISCONNECT",EventData(net,STATUS,text=event.reason.orEmpty())) }
            is IrcEvent.Status -> if(event.text.isNotBlank())local(net,STATUS,event.text)
            is IrcEvent.Error -> local(net,STATUS,event.message,"error")
            is IrcEvent.ISupport -> state=state.copy(connections=state.connections+(net to (state.connections[net] ?: DesktopConnection()).copy(channelTypes=event.chantypes,caseMapping=event.caseMapping,networkName=event.networkName ?: state.connections[net]?.networkName.orEmpty())))
            is IrcEvent.Names -> { val b=buffer(net,event.channel);val k=key(net,event.channel);val names=((if(namesBatches.add(k))emptyList() else b.members)+event.names).distinctBy { ircCasefold(bareMember(it),state.connections[net]?.caseMapping ?: "rfc1459") };state=state.copy(buffers=state.buffers+(k to b.copy(members=names))) }
            is IrcEvent.NamesEnd -> { namesBatches.remove(key(net,event.channel)) }
            is IrcEvent.ChannelUserMode -> if(!event.isHistory && event.prefix!=null) {
                val k=key(net,event.channel);state.buffers[k]?.let { b->state=state.copy(buffers=state.buffers+(k to b.copy(members=b.members.map { n->if(bareMember(n).equals(event.nick,true)) {
                    val prefixes=n.takeWhile { it in "~&@%+" }.filterNot { it==event.prefix }+(if(event.adding)event.prefix else "")
                    prefixes.toSet().sortedBy { "~&@%+".indexOf(it) }.joinToString("")+bareMember(n)
                } else n }))) }
            }
            is IrcEvent.Joined -> {
                val b=buffer(net,event.channel);val k=key(net,event.channel)
                if(!event.isHistory && !b.members.any { bareMember(it).equals(event.nick,true) })state=state.copy(buffers=state.buffers+(k to b.copy(members=b.members+event.nick)))
                add(net,event.channel,DesktopMessage(time=event.timeMs ?: System.currentTimeMillis(),text="→ JOIN ${event.nick}${event.userHost?.let { " ($it)" }.orEmpty()}",kind="join"),count=false,replay=event.isHistory)
                if(ownNick(net,event.nick) && !event.isHistory)select(net,event.channel)
                if(!event.isHistory)engine.dispatch("JOIN",EventData(net,event.channel,event.nick,fields=mapOf("host" to event.userHost.orEmpty())))
            }
            is IrcEvent.Parted -> {
                val k=key(net,event.channel);state.buffers[k]?.takeIf { !event.isHistory }?.let { b->state=state.copy(buffers=state.buffers+(k to b.copy(members=b.members.filterNot { bareMember(it).equals(event.nick,true) }))) }
                add(net,event.channel,DesktopMessage(time=event.timeMs ?: System.currentTimeMillis(),text="← PART ${event.nick}${event.userHost?.let { " ($it)" }.orEmpty()} ${event.reason.orEmpty()}",kind="part"),count=false,replay=event.isHistory)
                if(!event.isHistory)engine.dispatch("PART",EventData(net,event.channel,event.nick,text=event.reason.orEmpty()))
            }
            is IrcEvent.Quit -> {
                state.buffers.values.filter { it.network==net && it.members.any { n->bareMember(n).equals(event.nick,true) } }.forEach { b->
                    val k=key(net,b.name);if(!event.isHistory)state=state.copy(buffers=state.buffers+(k to b.copy(members=b.members.filterNot { bareMember(it).equals(event.nick,true) })))
                    add(net,b.name,DesktopMessage(time=event.timeMs ?: System.currentTimeMillis(),text="← QUIT ${event.nick}${event.userHost?.let { " ($it)" }.orEmpty()} ${event.reason.orEmpty()}",kind="quit"),count=false,replay=event.isHistory)
                };if(!event.isHistory)engine.dispatch("QUIT",EventData(net,STATUS,event.nick,event.reason.orEmpty()))
            }
            is IrcEvent.NickChanged -> {
                state.buffers.values.filter { it.network==net && it.members.any { n->bareMember(n).equals(event.oldNick,true) } }.forEach { b->
                    val k=key(net,b.name);if(!event.isHistory)state=state.copy(buffers=state.buffers+(k to b.copy(members=b.members.map { if(bareMember(it).equals(event.oldNick,true))it.dropLast(event.oldNick.length)+event.newNick else it })))
                    local(net,b.name,"${event.oldNick} ahora se llama ${event.newNick}")
                }
                if(!event.isHistory && ownNick(net,event.oldNick))state=state.copy(connections=state.connections+(net to (state.connections[net] ?: DesktopConnection()).copy(nick=event.newNick)))
                if(!event.isHistory) {
                    val oldKey=key(net,event.oldNick);val newKey=key(net,event.newNick)
                    state.buffers[oldKey]?.let { query->val other=state.buffers[newKey];state=state.copy(buffers=state.buffers-oldKey+(newKey to query.copy(name=event.newNick,messages=((other?.messages.orEmpty())+query.messages).sortedBy { it.time })),selected=if(state.selected==oldKey)newKey else state.selected) }
                    engine.dispatch("NICK",EventData(net,STATUS,event.oldNick,event.newNick))
                }
            }
            is IrcEvent.Topic -> setTopic(net,event.channel,event.topic.orEmpty())
            is IrcEvent.TopicReply -> setTopic(net,event.channel,event.topic.orEmpty())
            is IrcEvent.ChatMessage -> incomingChat(net,event)
            is IrcEvent.Notice -> {
                if(ignored(net,event.from))return
                val source=if(isChannel(net,event.target))key(net,event.target) else key(net,if(!event.isServer && isReplyNick(event.from))event.from else STATUS)
                val destinations=replyDestinations(state.settings.noticeDestinations,net,NOTICES_BUFFER,state.selected.orEmpty(),event.from,source,event.isServer,resolve={key(net,it)})
                val transformed=if(event.isHistory)TextResult(event.text,false) else engine.onText(TextEvent(net,event.target,event.from,event.text,false,event.isPrivate,ownNick(net,event.from)))
                if(!transformed.halted)for(k in destinations)add(net,k.substringAfter("::"),DesktopMessage(time=event.timeMs ?: System.currentTimeMillis(),from=event.from,text=transformed.text,kind="notice"),log=false,replay=event.isHistory)
                engine.dispatch("NOTICE",EventData(net,event.target,event.from,event.text,isPrivate=event.isPrivate))
            }
            is IrcEvent.ServerText -> {
                if(event.isWhoisReply && event.whoisNick!=null) {
                    val id=event.whoisRequestId ?: 0L;val windowId=net to id
                    val existing=state.whois.firstOrNull { it.network==net && it.id==id }
                    val fields=existing?.fields.orEmpty()+whoisFields(event.code,event.whoisParams,event.whoisTrailing,System.currentTimeMillis()/1000)
                    if(state.settings.whoisDestinations and ReplyDestination.FLOATING!=0) {
                        val w=existing?.copy(fields=fields,lines=existing.lines+event.text) ?: WhoisWindow(id,net,event.whoisNick,fields,listOf(event.text))
                        state=state.copy(whois=mergeWhoisWindow(state.whois,w))
                    }
                    val destinations=replyDestinations(state.settings.whoisDestinations,net,WHOIS_BUFFER,state.selected.orEmpty(),null,resolve={key(net,it)})
                    if(!whoisBlocks.contains(net,id))whoisTimers[windowId]=scope.launch { delay(10_000);flushWhois(net,id) }
                    whoisBlocks.add(net,id,event.whoisNick,destinations,event.text,fields=fields)
                    if(event.code=="318"){whoisTimers.remove(windowId)?.cancel();flushWhois(net,id)}
                } else {
                    val target=event.bufferName ?: STATUS
                    val result=engine.onNumeric(NumericEvent(net,target,event.code.orEmpty(),event.text))
                    if(!result.halted)local(net,target,result.text)
                }
            }
            is IrcEvent.MetadataChanged -> if(event.key=="avatar") {
                val c=state.connections[net] ?: DesktopConnection();val n=event.target.lowercase()
                state=state.copy(connections=state.connections+(net to c.copy(avatars=if(event.value==null)c.avatars-n else c.avatars+(n to event.value))))
            }
            is IrcEvent.OwnUserModes -> state=state.copy(connections=state.connections+(net to (state.connections[net] ?: DesktopConnection()).copy(userModes=event.modes)))
            is IrcEvent.Kicked -> { local(net,event.channel,"${event.victim} fue expulsado por ${event.byNick.orEmpty()}: ${event.reason.orEmpty()}");engine.dispatch("KICK",EventData(net,event.channel,event.byNick,event.reason.orEmpty())) }
            is IrcEvent.DccOfferEvent,is IrcEvent.DccChatOfferEvent -> local(net,STATUS,"Se recibió una oferta DCC. Esta versión de escritorio no realiza transferencias DCC.")
            is IrcEvent.TlsHostnameMismatch -> local(net,STATUS,"TLS rechazado: el certificado no corresponde al servidor ${event.expected}","error")
            is IrcEvent.TlsFingerprintChanged -> local(net,STATUS,"TLS rechazado: cambió la huella del certificado","error")
            else -> Unit
        }
    }
    private suspend fun flushWhois(net:String,id:Long) { whoisBlocks.finish(net,id)?.let { done->for(k in done.destinations)local(net,k.substringAfter("::"),done.lines.joinToString("\n"),"whois") };whoisTimers.remove(net to id) }
    fun importCertificate(id:String,file:File,password:String) {
        require(file.length()<=2*1024*1024) { "El certificado supera 2 MiB" }
        val bytes=file.readBytes();val keyStore=java.security.KeyStore.getInstance("PKCS12")
        bytes.inputStream().use { keyStore.load(it,password.toCharArray()) }
        require(keyStore.aliases().toList().any { keyStore.isKeyEntry(it) }) { "El archivo no contiene una clave privada" }
        store.secrets.put("clientCert:$id",java.util.Base64.getEncoder().encodeToString(bytes));store.secrets.put("clientCertPassword:$id",password);bytes.fill(0)
    }
    private fun setTopic(net:String,name:String,topic:String) { val b=buffer(net,name);state=state.copy(buffers=state.buffers+(key(net,name) to b.copy(topic=topic))) }
    private suspend fun incomingChat(net:String,e:IrcEvent.ChatMessage) {
        if(ignored(net,e.from))return
        val target=if(e.isPrivate)if(ownNick(net,e.from))e.target else e.from else e.target
        val own=ownNick(net,e.from)
        val dedup=e.msgId?.let { "$net\u0000$it" }
        if(dedup!=null && seen.containsKey(dedup))return
        if(dedup!=null){seen[dedup]=System.currentTimeMillis();while(seen.size>10_000)seen.remove(seen.keys.first())}
        val result=if(e.isHistory)TextResult(e.text,false) else engine.onText(TextEvent(net,target,e.from,e.text,e.isAction,e.isPrivate,own));if(result.halted)return
        val mention=!own && isMention(net,result.text)
        val message=DesktopMessage(e.msgId ?: UUID.randomUUID().toString(),e.timeMs ?: System.currentTimeMillis(),e.from,result.text,if(e.isAction)"action" else "chat",mention)
        if(!add(net,target,message,count=!own,log=true,replay=e.isHistory,encrypted=e.encryption!=null))return
        val visible=windowFocused && state.page=="Chat" && state.selected==key(net,target)
        if(!own && !e.isHistory && state.settings.notifications && (e.isPrivate && !visible || mention && (!visible || state.settings.notifyVisibleMentions))) {
            notifier.show("${profile(net)?.name}: $target", "${e.from}: ${stripIrcFormatting(result.text)}") { scope.launch { select(net,target);val k=key(net,target);val b=state.buffers.getValue(k);if(b.messages.none { it.id==message.id })state=state.copy(buffers=state.buffers+(k to b.copy(messages=b.messages+message)));state=state.copy(jumpTo=message.id);requestWindow() } }
        }
    }
    fun scriptAction(name:String,args:List<String>) { val b=selectedBuffer();if(!engine.runCommand(name,args.joinToString(" "),b?.network,b?.name))engine.dispatch("SIGNAL:${name.uppercase()}",EventData(b?.network.orEmpty(),b?.name.orEmpty(),args=args)) }
    fun reloadScripts() {
        val enabledFile=File(store.scriptsDirectory,"enabled.json")
        val enabled=if(enabledFile.exists())JSONObject(enabledFile.readText()) else JSONObject()
        engine.resetHandlers()
        val files=store.scriptsDirectory.listFiles()?.filter { it.extension.equals("hex",true) }?.sortedBy { it.name }.orEmpty()
        state=state.copy(scriptFiles=files.associate { it.name to enabled.optBoolean(it.name) })
        for(file in files)if(enabled.optBoolean(file.name))engine.loadScript(file.name,file.readText(Charsets.UTF_8))?.let { report("${file.name}: $it") }
    }
    fun enableScript(name:String,enabled:Boolean) {
        val flags=JSONObject(state.scriptFiles).put(name,enabled)
        File(store.scriptsDirectory,"enabled.json").writeText(flags.toString(),Charsets.UTF_8);reloadScripts()
    }
    fun importScript(file:File) {
        require(file.extension.equals("hex",true) && file.length()<=1024*1024) { "Elegí un script .hex de hasta 1 MiB" }
        require(file.name !in state.scriptFiles) { "Ya existe ese script; renombralo antes de importar" }
        file.copyTo(File(store.scriptsDirectory,file.name));reloadScripts()
    }
    fun deleteScript(name:String) { require(File(name).name==name && name.endsWith(".hex",true));File(store.scriptsDirectory,name).delete();reloadScripts() }
    fun exportBackup(file:File,includeHistory:Boolean,passphrase:CharArray?=null)=scope.launch {
        try { withContext(Dispatchers.IO) { val json=store.backupJson(state.profiles,state.settings,passphrase);file.outputStream().use { out->if(includeHistory)ConversationBackup.write(out,json){history.export(it)} else out.write(json.toByteArray(Charsets.UTF_8)) } };report("Respaldo exportado a ${file.name}") }
        catch(e:Exception){report("No se pudo exportar: ${e.message}")}finally{passphrase?.fill('\u0000')}
    }
    fun importBackup(file:File,passphrase:CharArray?=null)=scope.launch {
        try {
            require(runtimes.isEmpty()) { "Desconectá las redes antes de importar un respaldo" }
            val loaded=withContext(Dispatchers.IO) { ConversationBackup.read(file.inputStream(),store.root).use { content->
                val plan=store.planImport(content.json,passphrase)
                val lines=content.history?.inputStream()?.use { history.restore(it) } ?: 0
                plan to lines
            } }
            val plan=loaded.first
            withContext(Dispatchers.IO) { plan.profiles.forEach { p->val previous=profile(p.id);if(previous!=null && previous.host!=p.host)listOf("server","sasl","proxy","clientCert","clientCertPassword").forEach { store.secrets.put("$it:${p.id}",null) } };store.importSecrets(plan) }
            state=state.copy(profiles=state.profiles.filterNot { old->plan.profiles.any { it.id==old.id } }+plan.profiles,settings=plan.settings)
            persist().join();report("Importadas ${plan.profiles.size} redes y ${loaded.second} líneas de historial. Revisá las credenciales y los certificados antes de conectar.")
        }catch(e:Exception){report("No se pudo importar: ${e.message}")}finally{passphrase?.fill('\u0000')}
    }
    suspend fun shutdown() {
        closed=true;manualStops.addAll(runtimes.keys);val running=runtimes.values.toList();running.forEach { it.client.forceClose();it.job.cancel() }
        running.forEach { it.job.join() };engine.shutdown();withContext(Dispatchers.IO) { history.close() };notifier.close();scope.cancel()
    }
    private fun scriptHost():ScriptHost=object:ScriptHost {
        override fun echo(network:String?,buffer:String?,from:String?,text:String) { scope.launch { val b=selectedBuffer();val net=network ?: b?.network ?: return@launch;add(net,buffer ?: b?.name ?: STATUS,DesktopMessage(from=from,text=text,kind="script"),count=false,log=false) } }
        override fun sendMessage(network:String?,buffer:String,text:String) { submit(text,network,buffer,applyStyle=false) }
        override fun sendRaw(network:String?,line:String) { scope.launch { runtimes[network ?: selectedBuffer()?.network]?.client?.sendRaw(line) } }
        override fun getSetting(key:String):String?=state.settings.json().opt(key)?.toString()
        override fun nick(network:String?):String?=(network ?: selectedBuffer()?.network)?.let(::own)
        override fun members(network:String?,channel:String):List<String> = (network ?: selectedBuffer()?.network)?.let { state.buffers[key(it,channel)]?.members }.orEmpty()
        override fun activeNetwork():String?=selectedBuffer()?.network
        override fun activeBuffer():String?=selectedBuffer()?.name
        override fun isNetworkAllowed(url:String)=state.settings.scriptNetwork && validDesktopImageUrl(url) && state.profiles.none { it.proxyType!=ProxyType.NONE }
        override fun runOnScriptThread(block:()->Unit) { scope.launch { block() } }
        override fun logDebug(scriptName:String?,message:String)=echo(null,"*scripts*",scriptName,message)
        override fun appCommand(network:String?,buffer:String?,line:String) { submit(line,network,buffer,applyStyle=false) }
        override fun uiIntent(kind:String,args:List<String>) { if(kind=="toast")report(args.joinToString(" ")) else echo(null,"*scripts*",null,"La acción de interfaz $kind no está disponible en escritorio") }
        override fun postDelayed(delayMs:Long,block:()->Unit) {
            require(scriptTimers.size<4096) { "Demasiados temporizadores pendientes" }
            val job=scope.launch(start=CoroutineStart.LAZY) { delay(delayMs.coerceAtLeast(0));block() }
            scriptTimers+=job;job.invokeOnCompletion { scriptTimers.remove(job) };job.start()
        }
        override fun mountView(view:ScriptView) { state=state.copy(scriptView=view) }
        override fun capability(name:String,args:List<String>):String { echo(null,"*scripts*",null,"La capacidad $name no está disponible en escritorio");return "" }
        override fun httpRequest(req:ScriptHttpRequest,onResult:(ScriptHttpResponse)->Unit) { scope.launch(Dispatchers.IO) {
            val response=runCatching {
                require(isNetworkAllowed(req.url)) { "HTTP no autorizado" }
                val b=HttpRequest.newBuilder(URI(req.url)).timeout(Duration.ofSeconds(20));req.headers.forEach { (k,v)->b.header(k,v) }
                val request=if(req.method.equals("POST",true))b.header("Content-Type",req.contentType ?: "text/plain; charset=UTF-8").POST(HttpRequest.BodyPublishers.ofString(req.body.orEmpty())).build() else b.GET().build()
                val r=http.send(request,HttpResponse.BodyHandlers.ofInputStream());val body=r.body().use { it.readNBytes(1024*1024+1) };require(body.size<=1024*1024) { "Respuesta HTTP demasiado grande" }
                ScriptHttpResponse(r.statusCode() in 200..299,r.statusCode(),String(body,Charsets.UTF_8),location=r.headers().firstValue("Location").orElse(null))
            }.getOrElse { ScriptHttpResponse(false,0,"",it.message) };onResult(response)
        } }
        override fun mediaPick(network:String?,buffer:String?,mimeFilter:String,owner:String,userInitiated:Boolean,onResult:(ScriptMediaRef?)->Unit) {
            scope.launch { val file=chooseFile(title="Archivo para el script $owner",extensions=arrayOf("png","jpg","gif","txt"));val token=UUID.randomUUID().toString();if(file!=null)media[token]=owner to file;onResult(file?.let { ScriptMediaRef(token,it.name,java.nio.file.Files.probeContentType(it.toPath()) ?: "application/octet-stream",it.length()) }) }
        }
        override fun mediaUpload(req:ScriptUploadRequest,onResult:(ScriptHttpResponse)->Unit) {
            onResult(ScriptHttpResponse(false,0,"","La carga HTTP de archivos desde scripts no está implementada en escritorio"))
        }
        override fun shutdown() { scriptTimers.toList().forEach(Job::cancel);scriptTimers.clear();media.clear();whoisTimers.values.forEach(Job::cancel);whoisTimers.clear() }
    }
}
