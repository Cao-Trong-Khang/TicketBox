package com.ticketbox.checkin.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ScanLogFactoryTest {
    @Test
    fun createsDurablePendingLogBeforeBackendSyncOutcomeExists() {
        val factory = ScanLogFactory(
            idProvider = { "local-scan-1" },
            clock = { 123_000L },
        )
        val validation = LocalValidationResult(
            entityType = LocalEntityType.Ticket,
            result = LocalScanResult.Accepted,
            message = "Local scan accepted",
        )

        val log = factory.pending(
            sourceDeviceId = "device-a",
            concertId = "concert-1",
            qrHash = "qr-1",
            validationResult = validation,
        )

        assertEquals("local-scan-1", log.localScanId)
        assertEquals("device-a", log.sourceDeviceId)
        assertEquals("pending", log.syncStatus)
        assertEquals("accepted", log.localResult)
        assertEquals(0, log.retryCount)
        assertNull(log.backendResultCode)
        assertNull(log.backendCheckInId)
        assertEquals(123_000L, log.scannedAtEpochMillis)
    }

    @Test
    fun carriesDisplayMetadataForResultAndHistoryScreens() {
        val factory = ScanLogFactory(
            idProvider = { "local-scan-2" },
            clock = { 456_000L },
        )
        val validation = LocalValidationResult(
            entityType = LocalEntityType.Ticket,
            result = LocalScanResult.Duplicate,
            message = "Duplicate",
        )

        val log = factory.pending(
            sourceDeviceId = "device-a",
            concertId = "concert-1",
            qrHash = "qr-2",
            validationResult = validation,
            displayCode = "TICKET-002",
            attendeeName = "Linh Nguyen",
            ticketTypeName = "VIP",
            zoneOrSeat = "Zone A",
            gateName = "Gate 1",
            previousCheckInAtIso = "2026-06-15T11:00:00Z",
            previousGateName = "Gate 1",
            previousStaffName = "staff@example.com",
        )

        assertEquals("TICKET-002", log.displayCode)
        assertEquals("Linh Nguyen", log.attendeeName)
        assertEquals("VIP", log.ticketTypeName)
        assertEquals("Zone A", log.zoneOrSeat)
        assertEquals("Gate 1", log.gateName)
        assertEquals("2026-06-15T11:00:00Z", log.previousCheckInAtIso)
        assertEquals("staff@example.com", log.previousStaffName)
    }
}
