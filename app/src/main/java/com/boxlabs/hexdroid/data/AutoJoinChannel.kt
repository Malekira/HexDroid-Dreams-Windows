/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.data

data class AutoJoinChannel(val channel: String, val key: String? = null) {
    fun toLine(): String = if (key.isNullOrBlank()) channel else "$channel $key"
}
