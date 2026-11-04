/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class,androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.boxlabs.hexdroid.desktop

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.input.*
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.*
import com.boxlabs.hexdroid.*
import com.boxlabs.hexdroid.connection.ProxyType
import com.boxlabs.hexdroid.ui.*
import kotlinx.coroutines.launch
import java.io.File

@Composable internal fun Toggle(label:String,value:Boolean,onChange:(Boolean)->Unit) {
    Row(Modifier.fillMaxWidth().clickable { onChange(!value) }.padding(vertical=5.dp),verticalAlignment=Alignment.CenterVertically) { Text(label,Modifier.weight(1f));Switch(value,onChange) }
}
@Composable internal fun Field(label:String,value:String,onChange:(String)->Unit,secret:Boolean=false,lines:Int=1,modifier:Modifier=Modifier.fillMaxWidth()) {
    OutlinedTextField(value,onChange,label={Text(label)},singleLine=lines==1,minLines=lines,visualTransformation=if(secret)PasswordVisualTransformation() else VisualTransformation.None,modifier=modifier)
}
@Composable internal fun ConfirmDialog(title:String,text:String,onConfirm:()->Unit,onClose:()->Unit) { AlertDialog(onDismissRequest=onClose,title={Text(title)},text={Text(text)},confirmButton={Button(onClick=onConfirm){Text("Confirmar")}},dismissButton={TextButton(onClick=onClose){Text("Cancelar")}}) }

@Composable internal fun ProfileDialog(controller:DesktopController,original:DesktopProfile,onClose:()->Unit) {
    var p by remember(original){mutableStateOf(original)}
    var server by remember { mutableStateOf(controller.store.secrets.get("server:${p.id}").orEmpty()) }
    var sasl by remember { mutableStateOf(controller.store.secrets.get("sasl:${p.id}").orEmpty()) }
    var proxy by remember { mutableStateOf(controller.store.secrets.get("proxy:${p.id}").orEmpty()) }
    var error by remember { mutableStateOf<String?>(null) };val scope=rememberCoroutineScope()
    val photo=if(p.avatarUrl.isNotBlank())p.avatarUrl else chatZonaAvatarUrl(p.host,controller.state.connections[p.id]?.networkName,p.nick)
    AlertDialog(onDismissRequest=onClose,modifier=Modifier.width(660.dp),title={Text("Red e identidad")},text={
        Column(Modifier.heightIn(max=560.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
            Field("Nombre de la red",p.name,{p=p.copy(name=it)})
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) { Field("Servidor",p.host,{p=p.copy(host=it)},modifier=Modifier.weight(1f));Field("Puerto",p.port.toString(),{p=p.copy(port=it.toIntOrNull() ?: 0)},modifier=Modifier.width(95.dp)) }
            Toggle("Conexión TLS",p.useTls){p=p.copy(useTls=it)}
            Field("Contraseña del servidor",server,{server=it},secret=true)
            Field("Nick",p.nick,{p=p.copy(nick=it)})
            Field("Nick alternativo",p.altNick,{p=p.copy(altNick=it)})
            Field("Usuario (ident)",p.username,{p=p.copy(username=it)})
            Field("Nombre real",p.realname,{p=p.copy(realname=it)})
            Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) { if(photo!=null)Avatar(photo,p.nick,Modifier.size(60.dp));Text("Foto de perfil") }
            Field("Dirección de la foto (HTTPS)",p.avatarUrl,{p=p.copy(avatarUrl=it)})
            Text("La URL se conserva en el respaldo. Si está vacía, ChatZona puede proporcionar una foto automática. La publicación de tu URL requiere METADATA en la red.",style=MaterialTheme.typography.bodySmall)
            Toggle("Autenticación SASL",p.saslEnabled){p=p.copy(saslEnabled=it)}
            if(p.saslEnabled) {
                Row { SaslMechanism.entries.forEach { m->FilterChip(p.saslMechanism==m,{p=p.copy(saslMechanism=m)},label={Text(m.name)}) } }
                Field("Cuenta SASL",p.saslAuthcid,{p=p.copy(saslAuthcid=it)})
                Field("Contraseña SASL",sasl,{sasl=it},secret=true)
            }
            var certificatePassword by remember { mutableStateOf("") }
            Field("Contraseña del certificado PKCS#12",certificatePassword,{certificatePassword=it},secret=true)
            TextButton(onClick={chooseFile(false,"Importar certificado PKCS#12",arrayOf("p12","pfx"))?.let { file->runCatching { controller.importCertificate(p.id,file,certificatePassword);p=p.copy(hasClientCertificate=true) }.onFailure { error=it.message } }}){Text(if(p.hasClientCertificate)"Reemplazar certificado PKCS#12" else "Importar certificado PKCS#12")}
            Field("Salas al conectar (una por línea; clave opcional tras un espacio)",p.channels,{p=p.copy(channels=it)},lines=3)
            Toggle("Reconectar automáticamente",p.autoReconnect){p=p.copy(autoReconnect=it)}
            Toggle("Conectar al iniciar",p.autoConnect){p=p.copy(autoConnect=it)}
            Text("Proxy",style=MaterialTheme.typography.titleSmall)
            Row { ProxyType.entries.forEach { type->FilterChip(p.proxyType==type,{p=p.copy(proxyType=type)},label={Text(type.name)}) } }
            if(p.proxyType!=ProxyType.NONE) { Field("Servidor proxy",p.proxyHost,{p=p.copy(proxyHost=it)});Field("Puerto proxy",p.proxyPort.toString(),{p=p.copy(proxyPort=it.toIntOrNull() ?: 0)});Field("Usuario proxy",p.proxyUsername,{p=p.copy(proxyUsername=it)});Field("Contraseña proxy",proxy,{proxy=it},secret=true) }
            Text("Las contraseñas se protegen con Windows DPAPI. Los certificados privados de Android no se trasladan en el respaldo.",style=MaterialTheme.typography.bodySmall)
        }
    },confirmButton={Button(onClick={try { p.validate();scope.launch { controller.saveProfile(p,server,sasl,proxy).join();onClose() } }catch(e:Exception){error=e.message}},modifier=Modifier.testTag("profile-save")){Text("Guardar")}},dismissButton={TextButton(onClick=onClose){Text("Cancelar")}})
}

@Composable internal fun BackupDialog(controller:DesktopController,mode:String,onClose:()->Unit) {
    var history by remember{mutableStateOf(true)};var secrets by remember{mutableStateOf(false)};var phrase by remember{mutableStateOf("")};var error by remember{mutableStateOf<String?>(null)}
    AlertDialog(onDismissRequest=onClose,title={Text(if(mode=="import")"Importar respaldo Android / PC" else "Exportar respaldo")},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
        Text(if(mode=="import")"Se combinan las redes y el historial sin borrar otras conversaciones. Desconectá antes de importar. Los scripts .hex se importan desde Scripts." else "Incluye perfiles, ajustes y URL de foto. El historial es opcional y permanece en el equipo.")
        if(mode=="export") { Toggle("Incluir historial",history){history=it};Toggle("Incluir contraseñas cifradas",secrets){secrets=it} }
        if(mode=="import" || secrets)Field("Frase de paso del respaldo (si tiene contraseñas)",phrase,{phrase=it},secret=true)
        error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
    }},confirmButton={Button(onClick={
        if(mode=="export" && secrets && phrase.length<8){error="Usá al menos 8 caracteres";return@Button}
        val file=chooseFile(mode=="export",if(mode=="export")"Guardar respaldo" else "Abrir respaldo",if(mode=="export" && !history)arrayOf("json") else arrayOf("zip","json"))
        if(file!=null){if(mode=="import")controller.importBackup(file,phrase.takeIf{it.isNotBlank()}?.toCharArray()) else controller.exportBackup(file,history,if(secrets)phrase.toCharArray() else null);onClose()}
    }){Text(if(mode=="import")"Elegir respaldo" else "Guardar respaldo")}},dismissButton={TextButton(onClick=onClose){Text("Cancelar")}})
}

@Composable internal fun IrcPalettePicker(onColor:(Int?)->Unit,onClose:()->Unit) {
    var code by remember{mutableStateOf("")}
    AlertDialog(onDismissRequest=onClose,title={Text("Colores IRC")},text={Column(Modifier.heightIn(max=430.dp).verticalScroll(rememberScrollState())) {
        FlowRow(horizontalArrangement=Arrangement.spacedBy(7.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
            (0..98).forEach { i->Box(Modifier.size(30.dp).clip(CircleShape).background(ircColor(i)).border(1.dp,MaterialTheme.colorScheme.outline,CircleShape).clickable { onColor(i);onClose() },contentAlignment=Alignment.Center){Text("$i",fontSize=9.sp,color=Color(readableThemeText(0xff000000.toInt(),MIRC_PALETTE[i])))} }
        }
        Field("Código 0–98",code,{code=it})
    }},confirmButton={Button(onClick={code.toIntOrNull()?.takeIf { it in 0..98 }?.let{onColor(it);onClose()}}){Text("Aplicar")}},dismissButton={TextButton(onClick={onColor(null);onClose()}){Text("Sin color")}})
}

@Composable internal fun TopicDialog(controller:DesktopController,buffer:DesktopBuffer,onClose:()->Unit) {
    var text by remember{mutableStateOf(TextFieldValue(buffer.topic))};var picker by remember{mutableStateOf<String?>(null)};var error by remember{mutableStateOf<String?>(null)}
    AlertDialog(onDismissRequest=onClose,modifier=Modifier.width(680.dp),title={Text("Editar tema — ${buffer.name}")},text={Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(text,{text=it},label={Text("Tema")},visualTransformation=remember{MircInputTransformation()},modifier=Modifier.fillMaxWidth().heightIn(min=130.dp).testTag("topic-editor"))
        Row { listOf("N" to '\u0002',"C" to '\u001d',"S̲" to '\u001f',"T̶" to '\u001e').forEach { (label,code)->TextButton(onClick={text=toggleFormat(text,code)}){Text(label)} };TextButton(onClick={text=clearFormat(text)}){Text("Quitar formato")} }
        Row { TextButton(onClick={picker="fg"}){Text("Color del texto")};TextButton(onClick={picker="bg"}){Text("Fondo / sombreado")} }
        Text("Seleccioná texto para darle formato. Sin selección, se aplica a lo que escribas después. El servidor valida los permisos para cambiar el tema.",style=MaterialTheme.typography.bodySmall)
        error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
    }},confirmButton={Button(onClick={try{val command=topicEditCommand(buffer.name,text.text);controller.submit(command,buffer.network,buffer.name);onClose()}catch(e:Exception){error=e.message}},enabled=controller.connected(buffer.network)){Text("Aplicar")}},dismissButton={TextButton(onClick=onClose){Text("Cancelar")}})
    picker?.let{which->IrcPalettePicker({color->text=topicColourFormat(text,if(which=="fg")color else 99,if(which=="bg")color else null)},{picker=null})}
}

@Composable internal fun Composer(controller:DesktopController,buffer:DesktopBuffer) {
    val k=controller.key(buffer.network,buffer.name);val s=controller.state.settings
    var value by remember(k){mutableStateOf(TextFieldValue(buffer.draft))};var completion by remember(k){mutableStateOf<NickCompletion?>(null)}
    var position by remember(k){mutableIntStateOf(-1)};var originalDraft by remember(k){mutableStateOf("")};var picker by remember{mutableStateOf<String?>(null)}
    LaunchedEffect(buffer.draft) { if(buffer.draft!=value.text)value=TextFieldValue(buffer.draft,TextRange(buffer.draft.length)) }
    fun update(v:TextFieldValue,manual:Boolean=true){value=v;controller.saveDraft(v.text);if(manual){completion=null;position=-1}}
    fun tab(back:Boolean=false){val c=advanceNickCompletion(value.text,value.selection.end,buffer.members,completion,back) ?: return;completion=c;update(TextFieldValue(c.text,TextRange(c.cursor)),false)}
    fun previous(){val h=controller.inputHistories[k].orEmpty();if(h.isEmpty())return;if(position==-1)originalDraft=value.text;position=(position+1).coerceAtMost(h.lastIndex);update(TextFieldValue(h[h.lastIndex-position]),false)}
    fun next(){val h=controller.inputHistories[k].orEmpty();if(position<=0){position=-1;update(TextFieldValue(originalDraft),false)}else{position--;update(TextFieldValue(h[h.lastIndex-position]),false)}}
    fun send(){val text=value.text;if(text.isBlank())return;if(!text.startsWith("/") && (!controller.connected(buffer.network) || buffer.name.startsWith('*'))){controller.report("Elegí una conversación de una red conectada");return};if(mayRecallInput(text)){val h=controller.inputHistories.getOrPut(k){mutableListOf()};h+=text;while(h.size>10)h.removeAt(0)};controller.submit(text);update(TextFieldValue(""))}
    Surface(color=Color(s.color(ThemeRole.INPUT)),contentColor=s.content(ThemeRole.INPUT)) {
        Column(Modifier.padding(9.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(3.dp)) {
                FilterChip(s.style.bold,{controller.settings(s.copy(style=s.style.copy(bold=!s.style.bold)))},label={Text("N",fontWeight=FontWeight.Bold)})
                FilterChip(s.style.italic,{controller.settings(s.copy(style=s.style.copy(italic=!s.style.italic)))},label={Text("C",fontStyle=FontStyle.Italic)})
                FilterChip(s.style.underline,{controller.settings(s.copy(style=s.style.copy(underline=!s.style.underline)))},label={Text("S",textDecoration=TextDecoration.Underline)})
                FilterChip(s.style.reverse,{controller.settings(s.copy(style=s.style.copy(reverse=!s.style.reverse)))},label={Text("Invertir")})
                TextButton(onClick={picker="fg"}){Text("Texto",color=ircColor(s.style.foreground).takeUnless { it==Color.Unspecified } ?: MaterialTheme.colorScheme.primary)}
                TextButton(onClick={picker="bg"}){Text("Fondo")}
                TextButton(onClick={controller.settings(s.copy(style=WritingStyle()))}){Text("Normal")}
                Spacer(Modifier.weight(1f));Text("Tab: completar · ↑/↓: mensajes anteriores",style=MaterialTheme.typography.labelSmall)
            }
            Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                OutlinedButton(onClick={tab()},modifier=Modifier.testTag("nick-tab"),contentPadding=PaddingValues(10.dp)){Text("⇥")}
                OutlinedTextField(value,{update(it)},label={Text("Mensaje")},modifier=Modifier.weight(1f).testTag("composer").onPreviewKeyEvent { event->
                    if(event.type!=KeyEventType.KeyDown)false else when(event.key){Key.Enter->if(!event.isShiftPressed){send();true}else false;Key.Tab->{tab(event.isShiftPressed);true};Key.DirectionUp->{previous();true};Key.DirectionDown->{next();true};else->false}
                },minLines=1,maxLines=4,visualTransformation=remember{MircInputTransformation()},textStyle=LocalTextStyle.current.copy(color=ircColor(s.style.foreground).takeUnless { it==Color.Unspecified } ?: Color(s.color(ThemeRole.INPUT_TEXT)),fontWeight=if(s.style.bold)FontWeight.Bold else FontWeight.Normal,fontStyle=if(s.style.italic)FontStyle.Italic else FontStyle.Normal,textDecoration=if(s.style.underline)TextDecoration.Underline else null))
                OutlinedButton(onClick={previous()},contentPadding=PaddingValues(10.dp),modifier=Modifier.testTag("recall")){Text("⇤")}
                Button(onClick={send()},enabled=controller.connected(buffer.network),modifier=Modifier.testTag("send-message")){Text("Enviar")}
            }
            val token=nickToken(value.text,value.selection.end)
            if(token!=null && completion==null) {
                val matches=completionMatches(buffer.members,token.prefix)
                if(matches.isNotEmpty())FlowRow { matches.take(12).forEach { nick->TextButton(onClick={val (text,cursor)=completeNickToken(value.text,token,nick);update(TextFieldValue(text,TextRange(cursor)))}){Text(nick)} } }
            }
        }
    }
    picker?.let{which->IrcPalettePicker({color->controller.settings(s.copy(style=if(which=="fg")s.style.copy(foreground=color) else s.style.copy(background=color)))},{picker=null})}
}

@Composable internal fun PhotoDialog(url:String,nick:String,onClose:()->Unit) {
    var image by remember(url){mutableStateOf<ImageBitmap?>(null)};var attempt by remember{mutableIntStateOf(0)};var loading by remember{mutableStateOf(true)}
    LaunchedEffect(url,attempt){loading=true;image=DesktopImages.load(url,true,attempt>0)?.let(::bufferedImageToBitmap);loading=false}
    AlertDialog(onDismissRequest=onClose,title={Text(nick)},text={Box(Modifier.size(540.dp,450.dp),contentAlignment=Alignment.Center){if(loading)CircularProgressIndicator() else if(image!=null)Image(image!!,nick,Modifier.fillMaxSize(),contentScale=androidx.compose.ui.layout.ContentScale.Fit) else Text("No se pudo cargar la foto. Límite: 2 MiB.")}},confirmButton={TextButton(onClick=onClose){Text("Cerrar")}},dismissButton={TextButton(onClick={attempt++}){Text("Actualizar")}})
}
