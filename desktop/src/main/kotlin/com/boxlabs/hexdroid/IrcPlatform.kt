/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid

/** Optional explicit interface binding. Desktop normally follows Windows' routing table. */
interface IrcNetwork {
    fun getAllByName(host: String): Array<java.net.InetAddress>
    fun bindSocket(socket: java.net.Socket)
}
internal fun ircPlatformWarning(message: String, error: Throwable) { System.getLogger("HexDroid IRC").log(System.Logger.Level.WARNING, message, error) }
internal fun ircPlatformCertificate(alias: String): Pair<Boolean, Array<javax.net.ssl.KeyManager>> =
    throw UnsupportedOperationException("El certificado de Android Keystore no se puede trasladar a Windows. Importá un certificado PKCS#12 para SASL EXTERNAL.")

internal val ircPlatformReplaySuspicionMs: Long = 15_000L
@Volatile internal var desktopForeground = true
internal fun ircPlatformIsForeground(): Boolean = desktopForeground
object BuildConfig { const val VERSION_NAME = "Dreams Desktop 0.1.0" }

internal typealias IrcSuppressLint = kotlin.Suppress
