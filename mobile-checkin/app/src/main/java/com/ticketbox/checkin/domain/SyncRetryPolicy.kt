package com.ticketbox.checkin.domain

object SyncRetryPolicy {
    fun shouldRetry(httpCode: Int?): Boolean {
        return httpCode == null || httpCode == 429 || httpCode >= 500
    }

    fun nextRetryDelayMillis(retryCount: Int, retryAfterMillis: Long? = null): Long {
        if (retryAfterMillis != null && retryAfterMillis > 0) {
            return retryAfterMillis
        }

        val exponent = retryCount.coerceIn(0, 6)
        return 30_000L * (1L shl exponent)
    }
}
