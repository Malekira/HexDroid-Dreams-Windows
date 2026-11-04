/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.desktop

import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.*
import kotlinx.coroutines.launch
import java.awt.event.WindowEvent
import java.awt.event.WindowFocusListener
import java.io.File

fun main(args:Array<String>) {
    if(args.contains("--smoke-test")) { runPackagedSmoke(args);return }
    application {
        val windowState=rememberWindowState(width=1280.dp,height=840.dp)
        val scope=rememberCoroutineScope()
        var showWindow by remember { mutableStateOf<()->Unit>({}) }
        var closeApp by remember { mutableStateOf<()->Unit>({}) }
        val startup=remember { runCatching {
            val store=DesktopStore(appDirectory())
            val notifier=WindowsNotifier(onShow={showWindow()},onExit={closeApp()})
            DesktopController(store,notifier)
        } }
        Window(onCloseRequest={closeApp()},state=windowState,title="HexDroid Dreams — Windows",resizable=true) {
            val controller=startup.getOrNull()
            SideEffect {
                showWindow={windowState.isMinimized=false;window.toFront();window.requestFocus()}
                closeApp={scope.launch { controller?.shutdown();exitApplication() }}
                controller?.requestWindow={showWindow()}
            }
            DisposableEffect(window,controller) {
                window.minimumSize=java.awt.Dimension(960,640)
                val listener=object:WindowFocusListener {
                    override fun windowGainedFocus(e:WindowEvent) { controller?.windowFocused=true;com.boxlabs.hexdroid.desktopForeground=true }
                    override fun windowLostFocus(e:WindowEvent) { controller?.windowFocused=false;com.boxlabs.hexdroid.desktopForeground=false }
                }
                window.addWindowFocusListener(listener)
                onDispose { window.removeWindowFocusListener(listener) }
            }
            if(controller!=null) {
                LaunchedEffect(controller) { controller.start() }
                DreamsDesktop(controller)
            } else StartupError(startup.exceptionOrNull()?.message.orEmpty(),onOpenFolder={java.awt.Desktop.getDesktop().open(appDirectory())},onClose={closeApp()})
        }
    }
}

/** Real packaged-executable checks, isolated from the user's normal data directory. */
private fun runPackagedSmoke(args:Array<String>) {
    check(System.getProperty("os.name").startsWith("Windows")) { "This smoke test requires Windows" }
    check(System.getProperty("os.arch") in setOf("amd64","x86_64")) { "A 64-bit Windows runtime is required" }
    val index=args.indexOf("--data-dir");require(index>=0 && args.getOrNull(index+1)!=null) { "Use --data-dir with a disposable directory" }
    val directory=File(args[index+1]);check(!directory.exists()) { "Smoke data directory must not exist" }
    directory.mkdirs()
    val store=DesktopStore(directory)
    val profile=DesktopProfile(name="Red de prueba",host="irc.example.invalid",nick="DemoSelf")
    store.save(listOf(profile),DesktopSettings(dark=false))
    val secret=java.util.UUID.randomUUID().toString();store.secrets.put("smoke",secret)
    val reopened=DesktopStore(directory)
    check(reopened.load().first.single().id==profile.id && !reopened.load().second.dark)
    check(reopened.secrets.get("smoke")==secret)
    check(!File(directory,"credentials.dpapi").readText(Charsets.ISO_8859_1).contains(secret))
    DesktopHistory(directory).use { h->check(h.append(profile.id,"#demo",1_793_793_600_000L,"DemoNick01","Mensaje ñ 🙂"));check(h.searchText("ñ").size==1) }
    val certificateIndex=args.indexOf("--tls-certificate")
    require(certificateIndex>=0 && args.getOrNull(certificateIndex+1)!=null) { "A disposable TLS certificate is required" }
    packagedTlsSmoke(File(args[certificateIndex+1]),"test-only-smoke")
    File(directory,"smoke-ok.txt").writeText("DREAMS_WINDOWS_SMOKE_OK: x64 runtime, native DPAPI, profiles, UTF-8 history, verified TLS and real IRC exchange\n")
    println("DREAMS_WINDOWS_SMOKE_OK")
}
