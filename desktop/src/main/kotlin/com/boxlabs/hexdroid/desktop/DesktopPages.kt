/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class,androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.boxlabs.hexdroid.desktop

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.*
import com.boxlabs.hexdroid.*
import kotlinx.coroutines.*
import java.io.File
import javax.swing.JColorChooser

@Composable internal fun NetworksPage(controller:DesktopController,onEdit:(DesktopProfile)->Unit,onImport:()->Unit,onExport:()->Unit) {
    var delete by remember { mutableStateOf<DesktopProfile?>(null) }
    Column(Modifier.fillMaxSize().padding(22.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Text("Redes e identidad",style=MaterialTheme.typography.headlineSmall)
        FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) { Button(onClick={onEdit(DesktopProfile())},modifier=Modifier.testTag("add-network")){Text("Añadir red")};OutlinedButton(onClick=onImport){Text("Importar respaldo")};OutlinedButton(onClick=onExport){Text("Exportar respaldo")} }
        if(controller.state.profiles.isEmpty())Text("Añadí tu red IRC o importá una copia JSON/ZIP de HexDroid. Los datos de Windows se guardan por separado de Android.")
        LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
            items(controller.state.profiles,key={it.id}) { p->
                val c=controller.state.connections[p.id]
                ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(15.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                    Text(p.name,style=MaterialTheme.typography.titleMedium);Text("${p.host}:${p.port} · ${if(p.useTls)"TLS" else "Sin TLS"} · ${p.nick}")
                    Text(if(c?.connected==true)"Conectado" else if(c?.connecting==true)"Conectando…" else "Desconectado",style=MaterialTheme.typography.labelMedium)
                    FlowRow(horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                        Button(onClick={if(c?.connected==true || c?.connecting==true)controller.disconnect(p.id) else { controller.select(p.id,"*server*");controller.connect(p.id) }},modifier=Modifier.testTag("connect-${p.id}")){Text(if(c?.connected==true || c?.connecting==true)"Desconectar" else "Conectar")}
                        TextButton(onClick={onEdit(p)}){Text("Editar")}
                        TextButton(onClick={onEdit(p.copy(id=java.util.UUID.randomUUID().toString(),name=p.name+" (copia)",autoConnect=false))}){Text("Duplicar")}
                        TextButton(onClick={controller.select(p.id,"*server*")}){Text("Status")}
                        TextButton(onClick={delete=p}){Text("Eliminar red")}
                    }
                } }
            }
        }
    }
    delete?.let { p->ConfirmDialog("Eliminar red", "Se eliminará el perfil ${p.name}. El historial guardado se conserva.",onConfirm={controller.deleteProfile(p.id);delete=null},onClose={delete=null}) }
}

@Composable internal fun HistoryPage(controller:DesktopController) {
    val scope=rememberCoroutineScope();var query by remember{mutableStateOf("")};var path by remember{mutableStateOf<String?>(null)};var offset by remember{mutableLongStateOf(0L)}
    var hits by remember{mutableStateOf(listOf<DesktopHistory.TextHit>())};var files by remember{mutableStateOf(listOf<HistoryConversation>())};var bytes by remember{mutableLongStateOf(0)}
    var busy by remember{mutableStateOf(false)};var menu by remember{mutableStateOf(false)};var delete by remember{mutableStateOf(false)};var revision by remember{mutableIntStateOf(0)}
    LaunchedEffect(query,path,offset,revision) { busy=true;try { withContext(Dispatchers.IO){files=controller.history.conversations();bytes=controller.history.size();hits=controller.history.searchText(query,offset,path=path)} }catch(e:Exception){if(e is CancellationException)throw e;controller.report(e.message.orEmpty())}finally{busy=false} }
    Column(Modifier.fillMaxSize().padding(20.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Text("Historial permanente",style=MaterialTheme.typography.headlineSmall)
        Text("TXT UTF-8 sin vencimiento. Los mensajes cargados en pantalla tienen un límite de memoria; los archivos guardados no.")
        Text("${files.size} conversaciones · ${"%.2f".format(bytes/1048576.0)} MiB")
        FlowRow(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
            Box { OutlinedButton(onClick={menu=true}){Text(path ?: "Todas las conversaciones")};DropdownMenu(menu,{menu=false}) { DropdownMenuItem(text={Text("Todas")},onClick={path=null;offset=0;menu=false});files.forEach { c->DropdownMenuItem(text={Text(c.path)},onClick={path=c.path;offset=0;menu=false}) } } }
            OutlinedButton(onClick={val file=chooseFile(true,"Exportar historial ZIP",arrayOf("zip"));if(file!=null)scope.launch{runCatching{withContext(Dispatchers.IO){file.outputStream().use { controller.history.export(it) }}}.onFailure{controller.report(it.message.orEmpty())}}}){Text("Exportar ZIP")}
            OutlinedButton(onClick={val file=chooseFile(false,"Restaurar historial ZIP",arrayOf("zip"));if(file!=null)scope.launch{runCatching{withContext(Dispatchers.IO){file.inputStream().use{controller.history.restore(it)}}}.onSuccess{controller.report("Restauradas $it líneas; se conservaron las anteriores");revision++}.onFailure{controller.report(it.message.orEmpty())}}}){Text("Restaurar ZIP")}
            if(path!=null)OutlinedButton(onClick={val source=HistoryFiles.resolve(controller.history.root,path!!);val dest=chooseFile(true,"Exportar conversación TXT",arrayOf("txt"));if(dest!=null)scope.launch{runCatching{withContext(Dispatchers.IO){source.copyTo(dest,overwrite=true)}}.onFailure{controller.report(it.message.orEmpty())}}}){Text("Exportar TXT")}
            TextButton(onClick={delete=true}){Text(if(path==null)"Eliminar todos" else "Eliminar conversación")}
        }
        OutlinedTextField(query,{query=it;offset=0},label={Text("Buscar palabras, nick o fecha")},modifier=Modifier.fillMaxWidth().testTag("history-search"))
        if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
        SelectionContainer(Modifier.weight(1f)) { LazyColumn(Modifier.fillMaxSize(),verticalArrangement=Arrangement.spacedBy(9.dp)) { itemsIndexed(hits) { _,hit->Column { Text(hit.path,style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.primary);Text(hit.line,fontFamily=FontFamily.Monospace,fontSize=controller.state.settings.fontSize.sp) } } } }
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) { OutlinedButton(onClick={offset=(offset-100).coerceAtLeast(0)},enabled=offset>0){Text("Anterior")};Text("Desde ${offset+1}",Modifier.padding(10.dp));OutlinedButton(onClick={offset+=100},enabled=hits.size==100){Text("Siguiente")};TextButton(onClick={java.awt.Desktop.getDesktop().open(controller.history.root)}){Text("Abrir carpeta")} }
    }
    if(delete)ConfirmDialog("Eliminar historial",if(path==null)"Se eliminarán todos los archivos de historial de Windows. Esta acción requiere tu confirmación." else "Se eliminará solo ${path}.",onConfirm={scope.launch{withContext(Dispatchers.IO){controller.history.delete(path?.let{setOf(it)} ?: files.map{it.path}.toSet())};revision++;delete=false}},onClose={delete=false})
}

@Composable internal fun ScriptsPage(controller:DesktopController) {
    var edit by remember{mutableStateOf<String?>(null)};var delete by remember{mutableStateOf<String?>(null)}
    Column(Modifier.fillMaxSize().padding(22.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Text("Scripts .hex",style=MaterialTheme.typography.headlineSmall)
        Text("Se usa el mismo intérprete que Android. Los saludos se configuran en tus propios scripts. Importar un archivo no lo activa automáticamente.")
        FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            Button(onClick={chooseFile(false,"Importar script .hex",arrayOf("hex"))?.let{runCatching{controller.importScript(it)}.onFailure{controller.report(it.message.orEmpty())}}},modifier=Modifier.testTag("import-script")){Text("Importar .hex")}
            OutlinedButton(onClick=controller::reloadScripts){Text("Recargar")}
            OutlinedButton(onClick={java.awt.Desktop.getDesktop().open(controller.store.scriptsDirectory)}){Text("Abrir carpeta / copiar scripts")}
        }
        Text("Los scripts pueden enviar comandos y mensajes. Revisá su contenido antes de activarlos. HTTPS requiere su opción independiente en Ajustes.",style=MaterialTheme.typography.bodySmall)
        LazyColumn(Modifier.weight(1f)) {
            items(controller.state.scriptFiles.toList(),key={it.first}) { (name,enabled)->Row(Modifier.fillMaxWidth().padding(vertical=5.dp),verticalAlignment=Alignment.CenterVertically) {
                Checkbox(enabled,{controller.enableScript(name,it)});Text(name,Modifier.weight(1f));TextButton(onClick={edit=name}){Text("Editar")};TextButton(onClick={delete=name}){Text("Eliminar")}
            } }
        }
        Text("Comandos registrados",style=MaterialTheme.typography.titleSmall)
        FlowRow { controller.engine.commandNames().filterNot{it.startsWith('_')}.forEach { name->TextButton(onClick={controller.scriptAction(name,emptyList())}){Text("/$name")} } }
    }
    edit?.let { name->
        val file=File(controller.store.scriptsDirectory,name);var source by remember(name){mutableStateOf(file.readText(Charsets.UTF_8))}
        AlertDialog(onDismissRequest={edit=null},modifier=Modifier.width(850.dp),title={Text(name)},text={OutlinedTextField(source,{source=it},modifier=Modifier.fillMaxWidth().heightIn(min=350.dp,max=600.dp),textStyle=LocalTextStyle.current.copy(fontFamily=FontFamily.Monospace))},confirmButton={Button(onClick={if(source.toByteArray(Charsets.UTF_8).size>1024*1024)controller.report("El script supera 1 MiB") else {com.boxlabs.hexdroid.data.SecretStore.atomicWrite(file,source.toByteArray(Charsets.UTF_8));controller.reloadScripts();edit=null}}){Text("Guardar y recargar")}},dismissButton={TextButton(onClick={edit=null}){Text("Cancelar")}})
    }
    delete?.let{name->ConfirmDialog("Eliminar script","Se eliminará $name de esta instalación de Windows.",onConfirm={controller.deleteScript(name);delete=null},onClose={delete=null})}
}

@Composable internal fun SettingsPage(controller:DesktopController) {
    val s=controller.state.settings;var editor by remember{mutableStateOf<PersonalTheme?>(null)}
    Column(Modifier.fillMaxSize().padding(22.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Text("Ajustes",style=MaterialTheme.typography.headlineSmall)
        Text("Apariencia y escritura",style=MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            FilterChip(!s.dark,{controller.settings(s.copy(dark=false,selectedTheme=""))},label={Text("Claro")})
            FilterChip(s.dark && s.selectedTheme.isBlank(),{controller.settings(s.copy(dark=true,selectedTheme=""))},label={Text("Oscuro")})
            OutlinedButton(onClick={editor=PersonalTheme()}){Text("Crear tema")}
        }
        s.themes.forEach { t->Row(verticalAlignment=Alignment.CenterVertically) {
            RadioButton(s.selectedTheme==t.id,{controller.settings(s.copy(selectedTheme=t.id))});Text(t.name,Modifier.weight(1f));TextButton(onClick={editor=t}){Text("Editar")}
            TextButton(onClick={editor=t.copy(id=java.util.UUID.randomUUID().toString(),name=t.name+" (copia)")}){Text("Duplicar")}
            TextButton(onClick={controller.settings(s.copy(themes=s.themes.filterNot{it.id==t.id},selectedTheme=if(s.selectedTheme==t.id)"" else s.selectedTheme))}){Text("Eliminar")}
        } }
        Text("Tamaño del texto: ${s.fontSize}");Slider(s.fontSize.toFloat(),{controller.settings(s.copy(fontSize=it.toInt()))},valueRange=10f..28f,steps=17)
        Text("El formato de escritura se guarda entre sesiones y se cambia en la barra de mensajes. Los temas no alteran los colores IRC recibidos.",style=MaterialTheme.typography.bodySmall)
        HorizontalDivider();Text("Notificaciones y menciones",style=MaterialTheme.typography.titleMedium)
        Toggle("Notificaciones de privados y menciones",s.notifications){controller.settings(s.copy(notifications=it))}
        Toggle("Notificar menciones incluso viendo la sala",s.notifyVisibleMentions){controller.settings(s.copy(notifyVisibleMentions=it))}
        Toggle("Resaltar menciones",s.highlight){controller.settings(s.copy(highlight=it))}
        ColorSetting("Color de las menciones",s.highlightColor){controller.settings(s.copy(highlightColor=it))}
        HorizontalDivider();Text("WHOIS — destinos simultáneos",style=MaterialTheme.typography.titleMedium)
        DestinationChoices(s.whoisDestinations,listOf(ReplyDestination.FLOATING to "Ventana flotante interna",ReplyDestination.STATUS to "Status",ReplyDestination.WINDOW to "Pestaña WHOIS",ReplyDestination.ACTIVE to "Conversación activa de la misma red")){controller.settings(s.copy(whoisDestinations=it))}
        Text("NOTICE — destinos simultáneos",style=MaterialTheme.typography.titleMedium)
        DestinationChoices(s.noticeDestinations,listOf(ReplyDestination.STATUS to "Status",ReplyDestination.WINDOW to "Notices",ReplyDestination.PRIVATE to "Privado del remitente válido",ReplyDestination.ACTIVE to "Conversación activa de la misma red",ReplyDestination.ORIGINAL to "Destino original")){controller.settings(s.copy(noticeDestinations=it))}
        HorizontalDivider();Text("Fotos",style=MaterialTheme.typography.titleMedium)
        Toggle("Mostrar avatares (incluye los automáticos de ChatZona)",s.avatars){controller.settings(s.copy(avatars=it))}
        Toggle("Mostrar avatares junto a los mensajes",s.avatarsInMessages){controller.settings(s.copy(avatarsInMessages=it))}
        Text("Se prioriza la URL de perfil/METADATA y luego la dirección de ChatZona. Con proxy se desactivan las descargas externas para respetar su ruta. Caché de cinco minutos; límite de imagen: 2 MiB.",style=MaterialTheme.typography.bodySmall)
        HorizontalDivider();Text("Historial",style=MaterialTheme.typography.titleMedium)
        Toggle("Guardar conversaciones",s.logging){controller.settings(s.copy(logging=it))}
        Toggle("Guardar conversaciones cifradas como texto descifrado",s.logEncrypted){controller.settings(s.copy(logEncrypted=it))}
        Text("Las conversaciones registradas son texto legible y pueden contener información privada. Las autenticaciones se excluyen y los secretos se redactan. No hay caducidad automática.",style=MaterialTheme.typography.bodySmall)
        Text("Copia adicional: ${s.logFolder.ifBlank{"almacenamiento privado de Windows"}}")
        Row { OutlinedButton(onClick={chooseFolder()?.let{controller.settings(s.copy(logFolder=it.absolutePath))}}){Text("Elegir carpeta")};TextButton(onClick={controller.settings(s.copy(logFolder=""))}){Text("Usar carpeta interna")} }
        Toggle("Un archivo por día",s.dailyLogs){controller.settings(s.copy(dailyLogs=it))}
        Toggle("Todas las conversaciones juntas",s.combinedLogs){controller.settings(s.copy(combinedLogs=it))}
        Text("La organización elegida recibe mensajes nuevos. El archivo privado completo se conserva para búsquedas y copias; no se mueven ni borran registros anteriores.",style=MaterialTheme.typography.bodySmall)
        HorizontalDivider();Text("Scripts",style=MaterialTheme.typography.titleMedium)
        Toggle("Permitir solicitudes HTTPS desde scripts",s.scriptNetwork){controller.settings(s.copy(scriptNetwork=it))}
        Text("Para respetar los proxies, HTTPS de scripts y sus imágenes se desactivan si hay algún perfil con proxy configurado.",style=MaterialTheme.typography.bodySmall)
        Button(onClick={controller.page("Scripts")}){Text("Abrir gestor de scripts")}
        HorizontalDivider();Button(onClick={java.awt.Desktop.getDesktop().open(controller.store.root)}){Text("Abrir carpeta de datos")}
    }
    editor?.let{t->ThemeDialog(t,s,onSave={theme->controller.settings(s.copy(themes=s.themes.filterNot{it.id==theme.id}+theme,selectedTheme=theme.id));editor=null},onClose={editor=null})}
}

@Composable private fun DestinationChoices(value:Int,choices:List<Pair<Int,String>>,onChange:(Int)->Unit) {
    choices.forEach { (bit,label)->Row(Modifier.fillMaxWidth().clickable{onChange(value xor bit)},verticalAlignment=Alignment.CenterVertically) { Checkbox(value and bit!=0,{onChange(value xor bit)});Text(label) } }
}
@Composable internal fun ColorSetting(label:String,value:Int,onChange:(Int)->Unit) {
    var hex by remember(value){mutableStateOf("#%06X".format(value and 0xffffff))}
    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
        Text(label,Modifier.weight(1f));Box(Modifier.size(30.dp).background(Color(value)))
        OutlinedTextField(hex,{hex=it;parseThemeHex(it)?.let(onChange)},singleLine=true,modifier=Modifier.width(130.dp))
        TextButton(onClick={JColorChooser.showDialog(null,label,java.awt.Color(value,true))?.let{onChange(it.rgb)}}){Text("Elegir color")}
    }
}
@Composable private fun ThemeDialog(original:PersonalTheme,settings:DesktopSettings,onSave:(PersonalTheme)->Unit,onClose:()->Unit) {
    var theme by remember(original){mutableStateOf(original)};var dark by remember{mutableStateOf(settings.dark)}
    AlertDialog(onDismissRequest=onClose,modifier=Modifier.width(740.dp),title={Text("Tema personalizado")},text={Column(Modifier.heightIn(max=550.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(9.dp)) {
        Field("Nombre",theme.name,{theme=theme.copy(name=it)})
        Toggle("Editar variante oscura",dark){dark=it}
        Column(Modifier.fillMaxWidth().background(Color(theme.color(ThemeRole.APP,dark))).padding(12.dp)) {
            Text("HexDroid Dreams — vista previa",color=Color(readableThemeText(theme.color(ThemeRole.UI_TEXT,dark),theme.color(ThemeRole.APP,dark))))
            Row { Box(Modifier.width(80.dp).height(90.dp).background(Color(theme.color(ThemeRole.SIDEBAR,dark)))){Text("Salas\nPrivados",color=Color(readableThemeText(theme.color(ThemeRole.UI_TEXT,dark),theme.color(ThemeRole.SIDEBAR,dark))))};Box(Modifier.weight(1f).height(90.dp).background(Color(theme.color(ThemeRole.CHAT,dark))).padding(8.dp)){Text("Mensaje de ejemplo",color=Color(readableThemeText(theme.color(ThemeRole.TEXT,dark),theme.color(ThemeRole.CHAT,dark))))} }
            Text("Mensaje",Modifier.fillMaxWidth().background(Color(theme.color(ThemeRole.INPUT,dark))).padding(6.dp),color=Color(readableThemeText(theme.color(ThemeRole.INPUT_TEXT,dark),theme.color(ThemeRole.INPUT,dark))))
        }
        ThemeRole.entries.forEach { role->ColorSetting(role.label,theme.color(role,dark)){color->theme=if(dark)theme.copy(darkColors=theme.darkColors+(role.name to color)) else theme.copy(lightColors=theme.lightColors+(role.name to color))} }
        TextButton(onClick={theme=theme.copy(darkColors=emptyMap(),lightColors=emptyMap())}){Text("Restaurar colores originales")}
    }},confirmButton={Button(onClick={onSave(theme)},enabled=theme.name.isNotBlank()){Text("Guardar y aplicar")}},dismissButton={TextButton(onClick=onClose){Text("Cancelar")}})
}

@Composable internal fun AboutPage() { Column(Modifier.padding(25.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(14.dp)) {
    Text("HexDroid Dreams",style=MaterialTheme.typography.headlineLarge);Text("Windows x64 · versión de escritorio 0.1.0")
    Text("Basado en HexDroidIRC. Copyright © 2026 boxlabs y contribuyentes. Se conservan los créditos y la licencia GNU GPLv3 o posterior.")
    Text("Gracias a los autores de HexDroid, Kotlin, Compose Multiplatform, kotlinx.coroutines, Bouncy Castle, SQLite JDBC, JNA y TwelveMonkeys ImageIO.")
    Text("Repositorio y código fuente: https://github.com/Malekira/HexDroidVip")
    Text("Esta primera versión de escritorio incluye el motor IRC y .hex compartidos, archivos y credenciales propios de Windows. Transferencias DCC, +AGE, reproducción multimedia y capacidades específicas de Android de los scripts no están implementadas en escritorio; se conservan en la app Android.")
    Text("El instalador incluye Java. Los datos se guardan fuera de la carpeta del programa y no se eliminan al actualizarlo. Antes de desinstalar o trasladar el equipo, exportá tus respaldos.")
} }
