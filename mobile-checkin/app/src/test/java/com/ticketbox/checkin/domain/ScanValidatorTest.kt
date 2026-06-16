package com.ticketbox.checkin.domain

import com.ticketbox.checkin.data.local.PreloadedTicketEntity
import com.ticketbox.checkin.data.local.SnapshotEntity
import org.junit.Assert.assertEquals
import org.junit.Test

class ScanValidatorTest {
    private val validator = ScanValidator(snapshotStaleAfterMillis = 60_000L)
    private val snapshot = SnapshotEntity(
        concertId = "concert-1",
        version = "snapshot-1",
        generatedAtIso = "2026-08-20T10:00:00Z",
        storedAtEpochMillis = 1_000L,
    )
    private val ticket = PreloadedTicketEntity(
        id = "ticket-1",
        concertId = "concert-1",
        ticketCode = "DEMO-001",
        qrHash = "qr-1",
        status = "ACTIVE",
        issuedAtIso = "2026-06-15T10:00:00Z",
        checkedInAtIso = null,
        ticketTypeCode = "GA",
        ticketTypeName = "General Admission",
    )

    @Test
    fun validTicketWithFreshSnapshotIsAccepted() {
        val result = validator.validate(
            snapshot = snapshot,
            ticket = ticket,
            vipGuest = null,
            acceptedLocalScanCount = 0,
            nowEpochMillis = 2_000L,
        )

        assertEquals(LocalEntityType.Ticket, result.entityType)
        assertEquals(LocalScanResult.Accepted, result.result)
    }

    @Test
    fun sameDeviceDuplicateIsDetectedBeforeBackendSync() {
        val result = validator.validate(
            snapshot = snapshot,
            ticket = ticket,
            vipGuest = null,
            acceptedLocalScanCount = 1,
            nowEpochMillis = 2_000L,
        )

        assertEquals(LocalScanResult.Duplicate, result.result)
    }

    @Test
    fun alreadyUsedTicketIsDuplicate() {
        val result = validator.validate(
            snapshot = snapshot,
            ticket = ticket.copy(status = "USED", checkedInAtIso = "2026-06-15T11:00:00Z"),
            vipGuest = null,
            acceptedLocalScanCount = 0,
            nowEpochMillis = 2_000L,
        )

        assertEquals(LocalScanResult.Duplicate, result.result)
    }

    @Test
    fun canceledTicketIsInvalid() {
        val result = validator.validate(
            snapshot = snapshot,
            ticket = ticket.copy(status = "CANCELLED"),
            vipGuest = null,
            acceptedLocalScanCount = 0,
            nowEpochMillis = 2_000L,
        )

        assertEquals(LocalScanResult.Invalid, result.result)
        assertEquals("This ticket or guest entry is canceled", result.message)
    }

    @Test
    fun refundedTicketIsInvalid() {
        val result = validator.validate(
            snapshot = snapshot,
            ticket = ticket.copy(status = "REFUNDED"),
            vipGuest = null,
            acceptedLocalScanCount = 0,
            nowEpochMillis = 2_000L,
        )

        assertEquals(LocalScanResult.Invalid, result.result)
        assertEquals("This ticket was refunded", result.message)
    }

    @Test
    fun missingSnapshotRecordsInvalidLocalResult() {
        val result = validator.validate(
            snapshot = null,
            ticket = null,
            vipGuest = null,
            acceptedLocalScanCount = 0,
            nowEpochMillis = 2_000L,
        )

        assertEquals(LocalEntityType.Unknown, result.entityType)
        assertEquals(LocalScanResult.Invalid, result.result)
    }

    @Test
    fun staleSnapshotIsVisibleInLocalResult() {
        val result = validator.validate(
            snapshot = snapshot,
            ticket = ticket,
            vipGuest = null,
            acceptedLocalScanCount = 0,
            nowEpochMillis = 120_000L,
        )

        assertEquals(LocalScanResult.StaleSnapshot, result.result)
    }
}
