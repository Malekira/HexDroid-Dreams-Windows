/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package com.boxlabs.hexdroid.desktop

import androidx.compose.ui.test.*
import androidx.compose.ui.graphics.asSkiaBitmap
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.text.TextRange
import com.boxlabs.hexdroid.*
import kotlinx.coroutines.*
import kotlinx.coroutines.swing.Swing
import org.junit.*
import org.junit.Assert.*
import java.io.File
import java.nio.file.Files

class DesktopUiTest {
    @get:Rule val ui=createComposeRule()
    private lateinit var directory:File
    private lateinit var vm:DesktopController
    private val net="desktop-ui-demo"
    @Before fun setup():Unit=runBlocking {
        directory=Files.createTempDirectory("dreams-ui-").toFile()
        val store=DesktopStore(directory);store.save(listOf(DesktopProfile(id=net,name="Red de prueba",host="irc.example.invalid",nick="OwnDemo",autoReconnect=false)),DesktopSettings(logging=false,notifications=false,avatars=false))
        withContext(Dispatchers.Swing) {
            vm=DesktopController(store,DesktopControllerTest.Notifier())
            vm.handleEvent(net,IrcEvent.Registered("OwnDemo"));vm.handleEvent(net,IrcEvent.Joined("#demo","OwnDemo"));vm.handleEvent(net,IrcEvent.Names("#demo",listOf("OwnDemo","@DemoOne","+DemoTwo")));vm.handleEvent(net,IrcEvent.NamesEnd("#demo"))
            vm.handleEvent(net,IrcEvent.ChatMessage("DemoOne","#demo","Mensaje de prueba ñ 🙂",false,msgId="ui-message-1"))
            vm.handleEvent(net,IrcEvent.ChatMessage("DemoTwo","OwnDemo","Privado de prueba",true,msgId="ui-private-1"))
        }
        ui.setContent { DreamsDesktop(vm) }
    }
    @After fun cleanup():Unit=runBlocking { withContext(Dispatchers.Swing){vm.shutdown()};directory.deleteRecursively();Unit }
    @Test fun desktopTreesFoldIndependentlyAndTheAppRendersARealChatScreenshot() {
        ui.onNodeWithTag("group-$net-rooms").assertIsDisplayed().performClick()
        ui.onNodeWithTag("buffer-$net::#demo").assertDoesNotExist()
        ui.onNodeWithTag("buffer-$net::demotwo").assertIsDisplayed()
        ui.onNodeWithTag("group-$net-privates").performClick()
        ui.onNodeWithTag("buffer-$net::demotwo").assertDoesNotExist()
        ui.onNodeWithTag("group-$net-rooms").performClick()
        ui.onNodeWithTag("message-ui-message-1").assertIsDisplayed()
        val image=ui.onRoot().captureToImage()
        val skia=org.jetbrains.skia.Image.makeFromBitmap(image.asSkiaBitmap())
        val bytes=skia.encodeToData(org.jetbrains.skia.EncodedImageFormat.PNG)!!.bytes
        File("build/reports/desktop-chat.png").apply { parentFile.mkdirs();writeBytes(bytes) }
    }
    @Test fun completionRequiresAChoiceAndTabCyclesWhileKeepingSurroundingText() {
        val input=ui.onNodeWithTag("composer")
        input.performTextReplacement("Antes Dem después");input.performTextInputSelection(TextRange(9))
        input.assertTextContains("Antes Dem después")
        ui.onNodeWithTag("nick-tab").performClick();input.assertTextContains("Antes DemoOne después")
        ui.onNodeWithTag("nick-tab").performClick();input.assertTextContains("Antes DemoTwo después")
        input.performTextReplacement("Texto");input.performClick();input.performKeyInput { pressKey(Key.Backspace) };input.assertTextContains("Text")
    }
    @Test fun floatingWhoisKeepsTheRoomBehindItAndCanMinimizeRestoreAndClose():Unit=runBlocking {
        withContext(Dispatchers.Swing) {
            vm.handleEvent(net,IrcEvent.ServerText("WHOIS de prueba",code="311",isWhoisReply=true,whoisNick="DemoOne",whoisRequestId=1,whoisParams=listOf("OwnDemo","DemoOne","ident","host.invalid","*"),whoisTrailing="Nombre de prueba"))
            vm.handleEvent(net,IrcEvent.ServerText("Idle de prueba",code="317",isWhoisReply=true,whoisNick="DemoOne",whoisRequestId=1,whoisParams=listOf("OwnDemo","DemoOne","125")))
            vm.handleEvent(net,IrcEvent.ServerText("Final",code="318",isWhoisReply=true,whoisNick="DemoOne",whoisRequestId=1))
        }
        ui.onNodeWithTag("whois-panel-DemoOne").assertIsDisplayed();ui.onNodeWithText("2m 5s").assertIsDisplayed()
        ui.onNodeWithTag("whois-minimize-DemoOne").performClick();ui.onNodeWithTag("whois-panel-DemoOne").assertDoesNotExist()
        ui.onNodeWithTag("message-ui-message-1").assertIsDisplayed()
        ui.onNodeWithTag("whois-restore-DemoOne").performClick();ui.onNodeWithTag("whois-panel-DemoOne").assertIsDisplayed()
        ui.onNodeWithTag("whois-close-DemoOne").performClick();ui.onNodeWithTag("whois-panel-DemoOne").assertDoesNotExist()
        ui.runOnIdle { assertEquals("#demo",vm.selectedBuffer()?.name);assertFalse(vm.state.buffers.values.any{it.name==WHOIS_BUFFER}) }
    }
    @Test fun settingsHistoryAndScriptsAreRealNavigablePages() {
        ui.onNodeWithTag("page-Ajustes").performClick();ui.onNodeWithText("Notificaciones de privados y menciones").performScrollTo().assertIsDisplayed()
        ui.onNodeWithTag("page-Historial").performClick();ui.onNodeWithTag("history-search").performTextReplacement("DemoNick")
        ui.onNodeWithTag("page-Scripts").performClick();ui.onNodeWithTag("import-script").assertIsDisplayed()
        ui.onNodeWithTag("page-Redes").performClick();ui.onNodeWithTag("add-network").assertIsDisplayed()
    }
}
