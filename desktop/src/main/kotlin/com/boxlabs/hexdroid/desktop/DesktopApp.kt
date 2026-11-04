/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.ExperimentalFoundationApi::class)
package com.boxlabs.hexdroid.desktop

import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.*
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.*
import com.boxlabs.hexdroid.*
import kotlinx.coroutines.*
import java.awt.Toolkit
import java.awt.datatransfer.StringSelection
import java.io.File
import java.time.*
import java.time.format.DateTimeFormatter

internal val LocalDesktopSettings=staticCompositionLocalOf { DesktopSettings() }
internal fun DesktopSettings.content(role:ThemeRole)=Color(readableThemeText(color(ThemeRole.UI_TEXT),color(role)))

@Composable fun DreamsDesktop(controller:DesktopController) {
    val state=controller.state;val s=state.settings
    val scheme=if(s.dark)darkColorScheme(primary=Color(s.color(ThemeRole.BUTTON)),onPrimary=Color(readableThemeText(s.color(ThemeRole.UI_TEXT),s.color(ThemeRole.BUTTON))),primaryContainer=Color(s.color(ThemeRole.TABS)),onPrimaryContainer=s.content(ThemeRole.TABS),surfaceContainer=Color(s.color(ThemeRole.MENU)),surface=Color(s.color(ThemeRole.APP)),onSurface=s.content(ThemeRole.APP))
        else lightColorScheme(primary=Color(s.color(ThemeRole.BUTTON)),onPrimary=Color(readableThemeText(s.color(ThemeRole.UI_TEXT),s.color(ThemeRole.BUTTON))),primaryContainer=Color(s.color(ThemeRole.TABS)),onPrimaryContainer=s.content(ThemeRole.TABS),surfaceContainer=Color(s.color(ThemeRole.MENU)),surface=Color(s.color(ThemeRole.APP)),onSurface=s.content(ThemeRole.APP))
    var profileEditor by remember { mutableStateOf<DesktopProfile?>(null) }
    var backup by remember { mutableStateOf<String?>(null) }
    var topicEditor by remember { mutableStateOf<DesktopBuffer?>(null) }
    CompositionLocalProvider(LocalDesktopSettings provides s) { MaterialTheme(colorScheme=scheme) {
        Box(Modifier.fillMaxSize().background(Color(s.color(ThemeRole.APP)))) {
            Column(Modifier.fillMaxSize()) {
                Surface(color=Color(s.color(ThemeRole.TOP)),contentColor=s.content(ThemeRole.TOP)) {
                    Column(Modifier.fillMaxWidth().padding(horizontal=14.dp,vertical=5.dp)) {
                        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) { Text("HexDroid Dreams",Modifier.weight(1f),style=MaterialTheme.typography.titleLarge);Text("0.1.0 · Windows x64",style=MaterialTheme.typography.labelSmall) }
                        Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                            listOf("Redes","Chat","Historial","Scripts","Ajustes","Acerca").forEach { name->TextButton(onClick={controller.page(name)},modifier=Modifier.testTag("page-$name")) { Text(name,fontWeight=if(state.page==name)androidx.compose.ui.text.font.FontWeight.Bold else null) } }
                    }
                }
                }
                state.error?.let { error->Surface(color=MaterialTheme.colorScheme.errorContainer) {
                    Row(Modifier.fillMaxWidth().padding(8.dp),verticalAlignment=Alignment.CenterVertically) { SelectionContainer(Modifier.weight(1f)){Text(error)};TextButton(onClick=controller::dismissError){Text("Cerrar")} }
                } }
                Row(Modifier.weight(1f).fillMaxWidth()) {
                    if(state.profiles.isNotEmpty()) {
                        ConversationSidebar(controller,Modifier.width(245.dp).fillMaxHeight())
                        VerticalDivider()
                    }
                    Box(Modifier.weight(1f).fillMaxHeight()) {
                        when(state.page) {
                            "Redes"->NetworksPage(controller,onEdit={profileEditor=it},onImport={backup="import"},onExport={backup="export"})
                            "Chat"->ChatPage(controller,onTopic={topicEditor=it})
                            "Historial"->HistoryPage(controller)
                            "Scripts"->ScriptsPage(controller)
                            "Ajustes"->SettingsPage(controller)
                            "Acerca"->AboutPage()
                        }
                    }
                }
            }
            WhoisPanels(controller)
        }
        profileEditor?.let { p->ProfileDialog(controller,p,onClose={profileEditor=null}) }
        backup?.let { mode->BackupDialog(controller,mode,onClose={backup=null}) }
        topicEditor?.let { b->TopicDialog(controller,b,onClose={topicEditor=null}) }
    } }
}

@Composable private fun ConversationSidebar(controller:DesktopController,modifier:Modifier) {
    val state=controller.state;val s=state.settings
    val collapsed=remember { mutableStateMapOf<String,Boolean>() }
    Surface(modifier,color=Color(s.color(ThemeRole.SIDEBAR)),contentColor=s.content(ThemeRole.SIDEBAR)) {
        LazyColumn(Modifier.fillMaxSize().padding(8.dp),verticalArrangement=Arrangement.spacedBy(3.dp)) {
            state.profiles.forEach { p->
                item("network-${p.id}") {
                    val c=state.connections[p.id]
                    Row(Modifier.fillMaxWidth().padding(top=8.dp),verticalAlignment=Alignment.CenterVertically) {
                        TextButton(onClick={controller.select(p.id,"*server*")},modifier=Modifier.weight(1f).testTag("network-${p.id}")) { Text((if(c?.connected==true)"● " else if(c?.connecting==true)"◌ " else "○ ")+p.name,maxLines=1) }
                        TextButton(onClick={if(c?.connected==true || c?.connecting==true)controller.disconnect(p.id) else controller.connect(p.id)},contentPadding=PaddingValues(3.dp)) { Text(if(c?.connected==true || c?.connecting==true)"⏻" else "▶") }
                    }
                }
                val children=state.buffers.values.filter { it.network==p.id && it.name!="*server*" }
                val rooms=children.filter { controller.isChannel(p.id,it.name) }
                val pv=children.filter { !controller.isChannel(p.id,it.name) && !it.name.startsWith('*') }
                val other=children.filter { it.name.startsWith('*') }
                listOf(Triple("rooms","Salas",rooms),Triple("privates","Mensajes privados",pv),Triple("other","Otras ventanas",other)).forEach { (kind,title,list)->
                    if(kind!="other" || list.isNotEmpty()) {
                        val id="${p.id}-$kind"
                        item("group-$id") {
                            Row(Modifier.fillMaxWidth().heightIn(min=40.dp).testTag("group-$id").clickable { collapsed[id]=!(collapsed[id] ?: false) }.padding(start=8.dp),verticalAlignment=Alignment.CenterVertically) {
                                Text(if(collapsed[id]==true)"▸ " else "▾ ");Text(title,Modifier.weight(1f),style=MaterialTheme.typography.labelLarge)
                                val count=list.sumOf { it.unread };if(count>0)Badge { Text("$count") }
                            }
                        }
                        if(collapsed[id]!=true)items(list.sortedBy { it.name.lowercase() },key={controller.key(p.id,it.name)}) { b->
                            val selected=state.selected==controller.key(p.id,b.name)
                            Row(Modifier.fillMaxWidth().background(if(selected)MaterialTheme.colorScheme.primaryContainer else Color.Transparent)
                                .testTag("buffer-${controller.key(p.id,b.name)}").clickable { controller.select(p.id,b.name) }.padding(start=22.dp,top=5.dp,bottom=5.dp),verticalAlignment=Alignment.CenterVertically) {
                                Text(b.name,Modifier.weight(1f),maxLines=1)
                                if(b.unread>0)Badge(containerColor=if(b.highlights>0)MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary){Text("${b.unread}")}
                                TextButton(onClick={controller.closeBuffer(p.id,b.name)},contentPadding=PaddingValues(2.dp),modifier=Modifier.width(30.dp)){Text("×")}
                            }
                        }
                    }
                }
                item("divider-${p.id}"){HorizontalDivider(Modifier.padding(vertical=8.dp))}
            }
        }
    }
}

@Composable internal fun Avatar(url:String?,nick:String,modifier:Modifier=Modifier,onOpen:(String,String)->Unit={_,_->}) {
    var image by remember(url) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(url) {
        if(url==null)return@LaunchedEffect
        while(isActive) { image=DesktopImages.load(url)?.let(::bufferedImageToBitmap);delay(300_000) }
    }
    Box(modifier.size(32.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant).then(if(url!=null)Modifier.clickable { onOpen(url,nick) } else Modifier),contentAlignment=Alignment.Center) {
        if(image!=null)Image(image!!,nick,Modifier.fillMaxSize(),contentScale=androidx.compose.ui.layout.ContentScale.Crop) else Text(nick.take(1).uppercase(),style=MaterialTheme.typography.labelLarge)
    }
}
internal fun bufferedImageToBitmap(image:java.awt.image.BufferedImage):ImageBitmap {
    val bytes=java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(image,"png",bytes)
    return org.jetbrains.skia.Image.makeFromEncoded(bytes.toByteArray()).toComposeImageBitmap()
}

@Composable private fun ChatPage(controller:DesktopController,onTopic:(DesktopBuffer)->Unit) {
    val b=controller.selectedBuffer();val s=controller.state.settings;val scope=rememberCoroutineScope()
    var joinText by remember { mutableStateOf("") };var photo by remember { mutableStateOf<Pair<String,String>?>(null) }
    if(b==null) { Column(Modifier.padding(28.dp)) { Text("Elegí una red o conversación",style=MaterialTheme.typography.headlineSmall);Text("Podés conectar desde Redes o seleccionar una conversación en el panel izquierdo.") };return }
    Column(Modifier.fillMaxSize()) {
        Surface(color=Color(s.color(ThemeRole.TOP)),contentColor=s.content(ThemeRole.TOP)) {
            Row(Modifier.fillMaxWidth().padding(10.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                if(!controller.isChannel(b.network,b.name) && !b.name.startsWith('*'))Avatar(controller.avatar(b.network,b.name),b.name,onOpen={u,n->photo=u to n})
                Column(Modifier.weight(1f)) { Text("${controller.profile(b.network)?.name} — ${b.name}",style=MaterialTheme.typography.titleMedium);Text(if(controller.connected(b.network))"Conectado" else "Desconectado",style=MaterialTheme.typography.labelSmall) }
                OutlinedTextField(joinText,{joinText=it},label={Text("Sala o nick")},singleLine=true,modifier=Modifier.width(165.dp).testTag("open-target"))
                Button(onClick={if(joinText.isNotBlank()){val t=joinText.trim();controller.submit(if(controller.isChannel(b.network,t))"/join $t" else "/query $t",b.network,b.name);joinText=""}},modifier=Modifier.testTag("open-conversation")){Text("Abrir")}
                if(controller.isChannel(b.network,b.name))TextButton(onClick={onTopic(b)}){Text("Tema y formato")}
            }
        }
        if(b.topic.isNotEmpty())Surface(color=Color(s.color(ThemeRole.TOP))) { SelectionContainer { Text(ircAnnotated(b.topic,s.color(ThemeRole.TEXT),s.color(ThemeRole.TOP)),Modifier.fillMaxWidth().padding(10.dp).testTag("topic"),fontSize=s.fontSize.sp) } }
        Row(Modifier.weight(1f)) {
            val list=rememberLazyListState()
            LaunchedEffect(b.network,b.name,b.messages.size) { if(b.messages.isNotEmpty() && (list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0)>=b.messages.size-5)list.animateScrollToItem(b.messages.lastIndex) }
            LaunchedEffect(controller.state.jumpTo,b.messages) { controller.state.jumpTo?.let { id->val index=b.messages.indexOfFirst { it.id==id };if(index>=0)list.scrollToItem(index) } }
            Box(Modifier.weight(1f).fillMaxHeight().background(Color(s.color(ThemeRole.CHAT)))) {
                LazyColumn(state=list,modifier=Modifier.fillMaxSize().padding(12.dp).testTag("messages"),verticalArrangement=Arrangement.spacedBy(5.dp)) {
                    items(b.messages,key={it.id}) { m->
                        val fg=when(m.kind){"join","part","quit"->0xff909090.toInt();"notice","whois"->s.color(ThemeRole.NOTICE);"error"->0xfff44336.toInt();else->s.color(ThemeRole.TEXT)}
                        val bg=if(m.mention && s.highlight)s.highlightColor else s.color(ThemeRole.CHAT)
                        ContextMenuArea(items={listOf(ContextMenuItem("Copiar"){Toolkit.getDefaultToolkit().systemClipboard.setContents(StringSelection((m.from?.let { "<$it> " }.orEmpty())+stripIrcFormatting(m.text)),null)})}) {
                            Row(Modifier.fillMaxWidth().background(Color(bg)).padding(3.dp).testTag("message-${m.id}"),horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                                if(s.avatarsInMessages && m.from!=null)Avatar(controller.avatar(b.network,m.from),m.from,onOpen={u,n->photo=u to n})
                                val prefix=if(m.kind=="archive")"" else "[${Instant.ofEpochMilli(m.time).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("HH:mm:ss"))}] "+(m.from?.let { if(m.kind=="action")"* $it " else "<$it> " }.orEmpty())
                                SelectionContainer { Text(androidx.compose.ui.text.buildAnnotatedString { if(prefix.isNotEmpty())withStyle(androidx.compose.ui.text.SpanStyle(color=Color(readableThemeText(s.color(ThemeRole.NICK),bg)))){append(prefix)};append(ircAnnotated(m.text,readableThemeText(fg,bg),bg)) },fontFamily=FontFamily.Monospace,fontSize=s.fontSize.sp,modifier=Modifier.weight(1f)) }
                            }
                        }
                    }
                }
                VerticalScrollbar(rememberScrollbarAdapter(list),Modifier.align(Alignment.CenterEnd).fillMaxHeight())
            }
            if(controller.isChannel(b.network,b.name))Surface(Modifier.width(175.dp).fillMaxHeight(),color=Color(s.color(ThemeRole.NICKLIST)),contentColor=s.content(ThemeRole.NICKLIST)) {
                LazyColumn(Modifier.padding(6.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {
                    item { Text("${b.members.size} usuarios",style=MaterialTheme.typography.labelMedium) }
                    items(b.members.sortedBy { bareMember(it).lowercase() },key={it}) { name->
                        ContextMenuArea(items={listOf(ContextMenuItem("Privado"){controller.select(b.network,bareMember(name))},ContextMenuItem("WHOIS"){controller.whois(b.network,name)},ContextMenuItem("Mencionar"){controller.saveDraft((b.draft+" "+bareMember(name)+": ").trimStart())})}) {
                            Row(Modifier.fillMaxWidth().clickable { controller.whois(b.network,name) },verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                                if(s.avatars)Avatar(controller.avatar(b.network,name),name,onOpen={u,n->photo=u to n})
                                Text(name,maxLines=1,fontSize=13.sp)
                            }
                        }
                    }
                }
            }
        }
        if(controller.state.scriptView!=null)Surface(Modifier.fillMaxWidth().heightIn(max=300.dp),color=MaterialTheme.colorScheme.surfaceContainer) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(8.dp)) { Row { Text("Vista del script",Modifier.weight(1f));TextButton(onClick={controller.dismissScriptView()}){Text("Cerrar")} };controller.state.scriptView?.let { ScriptPanel(it,controller) } }
        }
        Composer(controller,b)
    }
    photo?.let { (url,nick)->PhotoDialog(url,nick,onClose={photo=null}) }
}

@Composable private fun WhoisPanels(controller:DesktopController) {
    val windows=controller.state.whois
    Row(Modifier.fillMaxSize().padding(8.dp),verticalAlignment=Alignment.Bottom,horizontalArrangement=Arrangement.spacedBy(6.dp)) {
        windows.filter { it.minimized }.forEach { w->FilledTonalButton(onClick={controller.updateWhois(w.copy(minimized=false))},modifier=Modifier.testTag("whois-restore-${w.nick}")){Text("WHOIS ${w.nick}")} }
    }
    windows.filterNot { it.minimized }.forEach { w->
        var x by remember(w.network,w.id){mutableFloatStateOf(w.offsetX+45f)};var y by remember(w.network,w.id){mutableFloatStateOf(w.offsetY+65f)}
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val density=LocalDensity.current
            Surface(Modifier.offset { IntOffset(x.toInt().coerceIn(0,(constraints.maxWidth-with(density){430.dp.roundToPx()}).coerceAtLeast(0)),y.toInt().coerceIn(0,(constraints.maxHeight-with(density){48.dp.roundToPx()}).coerceAtLeast(0))) }.width(430.dp).heightIn(max=(maxHeight-60.dp).coerceAtLeast(200.dp)).testTag("whois-panel-${w.nick}"),shape=MaterialTheme.shapes.large,tonalElevation=8.dp,shadowElevation=12.dp,border=BorderStroke(1.dp,MaterialTheme.colorScheme.outline)) {
                Column(Modifier.padding(12.dp)) {
                    Row(Modifier.fillMaxWidth().pointerInput(w.network,w.id){detectDragGestures { change,amount->change.consume();x+=amount.x;y+=amount.y }},verticalAlignment=Alignment.CenterVertically) {
                        Text("WHOIS — ${w.nick}",Modifier.weight(1f),style=MaterialTheme.typography.titleMedium)
                        TextButton(onClick={controller.updateWhois(w.copy(minimized=true,offsetX=x-45f,offsetY=y-65f))},modifier=Modifier.testTag("whois-minimize-${w.nick}")){Text("—")}
                        TextButton(onClick={controller.closeWhois(w)},modifier=Modifier.testTag("whois-close-${w.nick}")){Text("×")}
                    }
                    HorizontalDivider()
                    SelectionContainer(Modifier.weight(1f,false).verticalScroll(rememberScrollState())) {
                        Column(Modifier.padding(vertical=10.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                            listOf("nick" to "Nick","user" to "Ident","host" to "Host","realname" to "Nombre real","channels" to "Canales","server" to "Servidor","account" to "Cuenta","idle" to "Inactividad","signon" to "Conectado desde","connected" to "Tiempo conectado","away" to "Ausente").forEach { (key,label)->w.fields[key]?.let { Row(Modifier.fillMaxWidth()) { Text(label,Modifier.width(130.dp),style=MaterialTheme.typography.labelMedium);Text(it,Modifier.weight(1f)) } } }
                            if(w.fields.isEmpty())Text(w.lines.joinToString("\n"))
                        }
                    }
                    TextButton(onClick={Toolkit.getDefaultToolkit().systemClipboard.setContents(StringSelection(w.lines.joinToString("\n")),null)}){Text("Copiar información")}
                }
            }
        }
    }
}

@Composable internal fun StartupError(message:String,onOpenFolder:()->Unit,onClose:()->Unit) { MaterialTheme { Column(Modifier.padding(30.dp),verticalArrangement=Arrangement.spacedBy(15.dp)) { Text("No se pudieron abrir los datos de HexDroid Dreams",style=MaterialTheme.typography.headlineSmall);SelectionContainer{Text(message)};Text("Los archivos se conservan. No se reemplaza la configuración por una vacía.");Button(onClick=onOpenFolder){Text("Abrir carpeta de datos")};Button(onClick=onClose){Text("Cerrar")} } } }
