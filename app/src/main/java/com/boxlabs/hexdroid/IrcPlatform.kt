/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid

/** Android keeps its native network routing and Keystore behavior. Desktop supplies its own adapter. */
typealias IrcNetwork = android.net.Network
internal fun ircPlatformWarning(message: String, error: Throwable) { android.util.Log.w("IrcCore", message, error) }
internal fun ircPlatformCertificate(alias: String): Pair<Boolean, Array<javax.net.ssl.KeyManager>> =
    NetworkCertificates.ensure(alias) to arrayOf(KeystoreKeyManager(alias))

internal val ircPlatformReplaySuspicionMs: Long get() = BufferLog.REPLAY_SUSPICION_MS
internal fun ircPlatformIsForeground(): Boolean = AppVisibility.isForeground

internal typealias IrcSuppressLint = android.annotation.SuppressLint
