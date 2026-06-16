package com.ticketbox.checkin.domain

interface QrScanner {
    suspend fun scan(): String?
}

class ManualQrScanner : QrScanner {
    override suspend fun scan(): String? = null
}
