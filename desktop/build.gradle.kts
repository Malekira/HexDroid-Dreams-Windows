import org.jetbrains.compose.desktop.application.dsl.TargetFormat

plugins {
    kotlin("jvm") version "2.3.10"
    id("org.jetbrains.kotlin.plugin.compose") version "2.3.10"
    id("org.jetbrains.compose") version "1.10.1"
}

kotlin { jvmToolchain(21) }
val sharedNames = listOf(
    "DccModels.kt", "DccParsing.kt", "StsPolicy.kt", "ui/IrcInputCodec.kt", "ui/IrcPalette.kt", "CallerId.kt", "ChannelTopic.kt", "MembershipEvent.kt", "IrcConfig.kt", "IrcCore.kt", "IrcConnect.kt", "IrcEvent.kt", "IrcParser.kt", "IrcWire.kt", "IrcNumerics.kt", "IrcNumericText.kt",
    "IrcMessageHandler.kt", "IrcSession.kt", "IrcSoju.kt", "IrcSlashCommands.kt", "ConnectionConstants.kt", "SocksProxy.kt", "EncodingHelper.kt",
    "SaslPrep.kt", "ScramSha256.kt", "IrcFormatting.kt", "WhoisPresentation.kt", "ReplyRouting.kt", "ChatZonaAvatars.kt", "ComposerRecall.kt",
    "PersonalPhase2.kt", "PersonalPresentation.kt", "DreamsChat.kt", "HistoryFiles.kt", "ConversationBackup.kt", "data/AutoJoinChannel.kt", "data/BackupCrypto.kt",
    "crypto/AesGcm.kt", "crypto/E2eFingerprint.kt", "crypto/Crockford32.kt", "crypto/E2eScheme.kt", "crypto/E2eCodec.kt", "crypto/E2eKeyStore.kt", "crypto/E2eCipher.kt", "crypto/AesGcmCipher.kt", "crypto/BlowfishCipher.kt",
    "script/ScriptEngine.kt", "script/ScriptBackend.kt", "script/ScriptHost.kt", "script/HexScriptBackend.kt", "script/HexParser.kt", "script/HexVal.kt", "script/HexView.kt",
)
val generatedSources = layout.buildDirectory.dir("generated/shared")
val sourceRoot = file("../app/src/main/java/com/boxlabs/hexdroid")
val generateShared by tasks.registering {
    inputs.files(sharedNames.map { File(sourceRoot, it) })
    inputs.files(fileTree("../app/src/main/res/values") { include("*.xml") }, fileTree("../app/src/main/res/values-es") { include("*.xml") })
    outputs.dir(generatedSources)
    doLast {
        val output = generatedSources.get().asFile
        output.deleteRecursively(); output.mkdirs()
        sharedNames.forEach { name -> File(output, "com/boxlabs/hexdroid/$name").apply { parentFile.mkdirs() }.writeText(File(sourceRoot, name).readText()) }
        val all = sharedNames.joinToString("\n") { File(sourceRoot, it).readText() }
        val strings = Regex("R\\.string\\.(\\w+)").findAll(all).map { it.groupValues[1] }.toSortedSet()
        val plurals = Regex("R\\.plurals\\.(\\w+)").findAll(all).map { it.groupValues[1] }.toSortedSet()
        fun resources(path: String): Map<String, org.w3c.dom.Element> {
            val factory = javax.xml.parsers.DocumentBuilderFactory.newInstance()
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
            val result = mutableMapOf<String, org.w3c.dom.Element>()
            file(path).listFiles()?.filter { it.extension == "xml" }?.sortedBy { it.name }?.forEach { resource ->
                val doc = factory.newDocumentBuilder().parse(resource)
                val nodes = doc.documentElement.childNodes
                for (i in 0 until nodes.length) (nodes.item(i) as? org.w3c.dom.Element)?.let { if (it.hasAttribute("name")) result[it.getAttribute("name")] = it }
            }
            return result
        }
        val en = resources("../app/src/main/res/values"); val es = resources("../app/src/main/res/values-es")
        fun quoted(raw: String): String = "\"" + raw.replace("\\n", "\n").replace("\\'", "'").replace("\\\"", "\"")
            .replace("\\", "\\\\").replace("\"", "\\\"").replace("$", "\\$").replace("\n", "\\n").replace("\r", "\\r") + "\""
        val code = buildString {
            appendLine("/* Generated from the original GPLv3 Android resources. */\npackage com.boxlabs.hexdroid")
            appendLine("object R { object string {"); strings.forEachIndexed { i, n -> appendLine("const val $n = ${i+1}") }; appendLine("} object plurals {")
            plurals.forEachIndexed { i, n -> appendLine("const val $n = ${strings.size+i+1}") }; appendLine("} }")
            appendLine("object DesktopStrings { private val texts = mapOf(")
            strings.forEach { n -> appendLine("R.string.$n to ${quoted((es[n] ?: en[n] ?: error("Missing resource $n")).textContent)},") }; appendLine(")")
            appendLine("private val quantities = mapOf<Int, Pair<String,String>>(")
            plurals.forEach { n ->
                val node = es[n] ?: en[n] ?: error("Missing plural $n"); val entries = node.getElementsByTagName("item")
                var one="";var other="";for (i in 0 until entries.length) { val e=entries.item(i) as org.w3c.dom.Element; if(e.getAttribute("quantity")=="one")one=e.textContent;if(e.getAttribute("quantity")=="other")other=e.textContent }
                appendLine("R.plurals.$n to (${quoted(one.ifBlank { other })} to ${quoted(other)}),")
            };appendLine(")")
            appendLine("fun text(id: Int, args: Array<out Any?>): String = format(texts[id] ?: id.toString(), args)")
            appendLine("fun plural(id: Int, count: Int, args: Array<out Any?>): String { val p = quantities[id] ?: return id.toString(); return format(if(count==1)p.first else p.second,args) }")
            appendLine("private fun format(text: String,args: Array<out Any?>): String = runCatching { String.format(java.util.Locale.forLanguageTag(\"es\"),text,*args) }.getOrElse { text } }")
        }
        File(output,"com/boxlabs/hexdroid/DesktopStrings.kt").writeText(code)
    }
}
kotlin.sourceSets.main { kotlin.srcDir(generatedSources) }
tasks.named("compileKotlin") { dependsOn(generateShared) }

dependencies {
    implementation(compose.desktop.currentOs)
    implementation(compose.material3)
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-swing:1.10.1")
    implementation("org.json:json:20251224")
    implementation("com.twelvemonkeys.imageio:imageio-webp:3.12.0")
    implementation("org.xerial:sqlite-jdbc:3.51.1.0")
    implementation("net.java.dev.jna:jna-platform:5.18.1")
    implementation("org.bouncycastle:bcprov-jdk18on:1.81")
    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
    testImplementation(compose.desktop.uiTestJUnit4)
}
val generatedTests=layout.buildDirectory.dir("generated/shared-tests")
val generateSharedTests by tasks.registering {
    val names=listOf("TestIrcServer.kt","IrcClientRepliesTest.kt","RedactRawLineTest.kt","ComposerRecallTest.kt","ChannelTopicTest.kt","ConversationBackupTest.kt","Dreams109AvatarTest.kt","Dreams107FormatTest.kt")
    val root=file("../app/src/test/java/com/boxlabs/hexdroid")
    inputs.files(names.map { File(root,it) });outputs.dir(generatedTests)
    doLast { val out=generatedTests.get().asFile;out.deleteRecursively();out.mkdirs();names.forEach { File(out,it).writeText(File(root,it).readText()) } }
}
kotlin.sourceSets.test { kotlin.srcDir(generatedTests) }
tasks.named("compileTestKotlin") { dependsOn(generateSharedTests) }
tasks.test {
    useJUnit();exclude("**/*UiTest*","**/*WindowsNativeTest*")
    testLogging { events("passed","failed","skipped") }
}
val uiTest by tasks.registering(Test::class) {
    description="Real Compose Desktop UI tests";group="verification"
    testClassesDirs=sourceSets.test.get().output.classesDirs;classpath=sourceSets.test.get().runtimeClasspath
    useJUnit();include("**/*UiTest*");systemProperty("skiko.renderApi","SOFTWARE")
    testLogging { events("passed","failed","skipped") }
}
val windowsTest by tasks.registering(Test::class) {
    description="Windows native DPAPI integration tests";group="verification"
    testClassesDirs=sourceSets.test.get().output.classesDirs;classpath=sourceSets.test.get().runtimeClasspath
    useJUnit();include("**/*WindowsNativeTest*")
    testLogging { events("passed","failed","skipped") }
}

compose.desktop {
    application {
        mainClass = "com.boxlabs.hexdroid.desktop.MainKt"
        nativeDistributions {
            targetFormats(TargetFormat.Msi)
            packageName = "HexDroid Dreams"
            packageVersion = "0.1.0"
            vendor = "HexDroid Dreams contributors; original HexDroid by boxlabs"
            description = "HexDroid Dreams — cliente IRC para Windows"
            licenseFile.set(file("resources/common/COPYING.rtf"))
            appResourcesRootDir.set(project.layout.projectDirectory.dir("resources"))
            modules("java.sql", "java.net.http", "java.desktop", "java.naming", "java.xml", "jdk.crypto.ec", "jdk.unsupported", "jdk.charsets", "jdk.localedata")
            windows { menuGroup = "HexDroid Dreams"; shortcut = true; perUserInstall = true; upgradeUuid = "57387ab7-4f9c-49b8-a484-ddcb0fa4fdd0" }
        }
    }
}
