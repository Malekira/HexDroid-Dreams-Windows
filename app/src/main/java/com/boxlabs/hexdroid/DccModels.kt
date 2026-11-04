/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid

data class DccOffer(
    /** Network id this offer belongs to (filled by the ViewModel). */
    val netId: String = "",
    val from: String,
    val filename: String,
    val ip: String,
    val port: Int,
    val size: Long,
    /** Passive/reverse DCC token. */
    val token: Long? = null,
    /** Turbo DCC / TSEND: do not send ACKs back to the sender. */
    val turbo: Boolean = false,
    /** SDCC / SSEND: transfer is TLS-wrapped. */
    val secure: Boolean = false,
) {
    val isPassive: Boolean get() = port == 0 && token != null
}

/** Parsed CTCP DCC CHAT offer. */
data class DccChatOffer(
    /** Network id this offer belongs to (filled by the ViewModel). */
    val netId: String = "",
    val from: String,
    val protocol: String = "chat",
    val ip: String,
    val port: Int,
    /** Passive/reverse token (rare; included for forward compatibility). */
    val token: Long? = null,
    /** SDCC / SCHAT: session is TLS-wrapped. */
    val secure: Boolean = false,
) {
    val isPassive: Boolean get() = port == 0 && token != null
}

/**
 * Parsed CTCP `DCC RESUME <filename> <port> <position> [token]`, sent by the receiver for a partial
 * download; the sender answers with DCC ACCEPT. The filename may be quoted.
 */
data class DccResume(
    val filename: String,
    val port: Int,
    val position: Long,
    /** Passive/reverse token, mirroring the original SEND offer's token. Null for active. */
    val token: Long? = null,
)

/**
 * Parsed CTCP `DCC ACCEPT <filename> <port> <position> [token]`.
 *
 * The sender's reply to a RESUME. Position MUST equal what the receiver requested;
 * the receiver should verify before opening the connection.
 */
data class DccAccept(
    val filename: String,
    val port: Int,
    val position: Long,
    val token: Long? = null,
)

