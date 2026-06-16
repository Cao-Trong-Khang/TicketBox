package com.ticketbox.checkin.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SyncRetryPolicyTest {
    @Test
    fun retriesTimeoutsNetworkLossRateLimitAndServerErrors() {
        assertTrue(SyncRetryPolicy.shouldRetry(null))
        assertTrue(SyncRetryPolicy.shouldRetry(429))
        assertTrue(SyncRetryPolicy.shouldRetry(500))
        assertFalse(SyncRetryPolicy.shouldRetry(400))
        assertFalse(SyncRetryPolicy.shouldRetry(403))
    }

    @Test
    fun usesRetryAfterBeforeExponentialBackoff() {
        assertEquals(15_000L, SyncRetryPolicy.nextRetryDelayMillis(3, retryAfterMillis = 15_000L))
        assertEquals(30_000L, SyncRetryPolicy.nextRetryDelayMillis(0))
        assertEquals(120_000L, SyncRetryPolicy.nextRetryDelayMillis(2))
    }
}
