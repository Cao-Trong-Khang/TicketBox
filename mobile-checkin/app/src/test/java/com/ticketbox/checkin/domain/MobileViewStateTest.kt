package com.ticketbox.checkin.domain

import com.ticketbox.checkin.data.local.LocalScanLogEntity
import com.ticketbox.checkin.data.local.PreloadedTicketEntity
import com.ticketbox.checkin.data.local.PreloadedVipGuestEntity
import org.junit.Assert.assertEquals
import org.junit.Test

class MobileViewStateTest {
    @Test
    fun derivesDashboardCountersFromTicketsGuestsAndPendingScans() {
        val tickets = listOf(
            ticket("ticket-1", "ACTIVE"),
            ticket("ticket-2", "USED", checkedInAtIso = "2026-06-15T10:00:00Z"),
            ticket("ticket-3", "ACTIVE"),
        )
        val guests = listOf(vipGuest("guest-1"), vipGuest("guest-2"))
        val scans = listOf(
            scan("scan-1", localResult = "accepted", syncStatus = "pending"),
            scan("scan-2", localResult = "invalid", syncStatus = "failed"),
        )

        val counts = deriveDashboardCounts(tickets, guests, scans)

        assertEquals(3, counts.totalTickets)
        assertEquals(2, counts.checkedInTickets)
        assertEquals(1, counts.remainingTickets)
        assertEquals(2, counts.vipGuests)
        assertEquals(2, counts.pendingOffline)
    }

    @Test
    fun mapsHistoryRowsToOperationalStatus() {
        assertEquals(HistoryStatus.Success, historyStatus(scan("success", "accepted", "synced")))
        assertEquals(HistoryStatus.Duplicate, historyStatus(scan("dupe", "duplicate", "synced")))
        assertEquals(HistoryStatus.Invalid, historyStatus(scan("invalid", "invalid", "synced")))
        assertEquals(HistoryStatus.Pending, historyStatus(scan("pending", "accepted", "pending")))
        assertEquals(HistoryStatus.Failed, historyStatus(scan("failed", "accepted", "failed")))
        assertEquals(HistoryStatus.Conflict, historyStatus(scan("conflict", "accepted", "conflict", "conflict")))
    }

    @Test
    fun mapsSyncQueueStatusValues() {
        assertEquals(SyncQueueStatus.Pending, syncQueueStatus(scan("pending", "accepted", "pending")))
        assertEquals(SyncQueueStatus.Synced, syncQueueStatus(scan("synced", "accepted", "synced")))
        assertEquals(SyncQueueStatus.Conflict, syncQueueStatus(scan("conflict", "accepted", "conflict")))
        assertEquals(SyncQueueStatus.Failed, syncQueueStatus(scan("failed", "accepted", "failed")))
    }

    @Test
    fun authoritativeBackendOutcomesOverrideLocalAcceptedDisplayState() {
        assertEquals(HistoryStatus.Success, historyStatus(scan("backend-success", "accepted", "synced", "accepted")))
        assertEquals(HistoryStatus.Duplicate, historyStatus(scan("backend-duplicate", "accepted", "synced", "duplicate")))
        assertEquals(HistoryStatus.Invalid, historyStatus(scan("backend-invalid", "accepted", "synced", "invalid")))
        assertEquals(HistoryStatus.Conflict, historyStatus(scan("backend-conflict", "accepted", "synced", "conflict")))
    }

    @Test
    fun filtersHistoryByStatusAndTicketCode() {
        val scans = listOf(
            scan("ticket-a", "accepted", "synced"),
            scan("ticket-b", "duplicate", "synced"),
            scan("ticket-c", "accepted", "pending"),
            scan("ticket-d", "accepted", "conflict", "conflict"),
        )

        assertEquals(listOf("ticket-a"), filterScanHistory(scans, HistoryFilter.Success, "ticket-a").map { it.localScanId })
        assertEquals(listOf("ticket-c"), filterScanHistory(scans, HistoryFilter.Offline, "").map { it.localScanId })
        assertEquals(listOf("ticket-d"), filterScanHistory(scans, HistoryFilter.Conflict, "").map { it.localScanId })
    }

    @Test
    fun derivesAndFiltersVipDashboardRows() {
        val guests = listOf(
            vipGuest("guest-1", status = "ACTIVE", sponsorCompany = "Media", guestType = "Press"),
            vipGuest(
                "guest-2",
                status = "CHECKED_IN",
                checkedInAtIso = "2026-06-15T10:00:00Z",
                sponsorCompany = "Artist Team",
                guestType = "Artist Guest",
            ),
        )

        val counts = deriveVipDashboardCounts(guests)

        assertEquals(2, counts.total)
        assertEquals(1, counts.checkedIn)
        assertEquals(1, counts.remaining)
        assertEquals(listOf("Artist Team", "Media"), vipSponsors(guests))
        assertEquals(listOf("Artist Guest", "Press"), vipGuestTypes(guests))
        assertEquals(
            listOf("guest-1"),
            filterVipGuests(guests, "guest-1", "Media", "Press", VipStatusFilter.Remaining).map { it.id },
        )
    }

    private fun ticket(
        id: String,
        status: String,
        checkedInAtIso: String? = null,
    ) = PreloadedTicketEntity(
        id = id,
        concertId = "concert-1",
        ticketCode = id,
        qrHash = "qr-$id",
        status = status,
        issuedAtIso = "2026-06-15T09:00:00Z",
        checkedInAtIso = checkedInAtIso,
        ticketTypeCode = "GA",
        ticketTypeName = "General Admission",
    )

    private fun vipGuest(
        id: String,
        status: String = "ACTIVE",
        checkedInAtIso: String? = null,
        sponsorCompany: String? = null,
        guestType: String? = null,
    ) = PreloadedVipGuestEntity(
        id = id,
        concertId = "concert-1",
        qrHash = "qr-$id",
        externalGuestKey = id,
        fullName = "Guest $id",
        email = "$id@example.test",
        phone = "+840000$id",
        sponsorCompany = sponsorCompany,
        guestType = guestType,
        status = status,
        checkedInAtIso = checkedInAtIso,
    )

    private fun scan(
        id: String,
        localResult: String,
        syncStatus: String,
        backendResultCode: String? = null,
    ) = LocalScanLogEntity(
        localScanId = id,
        sourceDeviceId = "device-1",
        concertId = "concert-1",
        qrHash = "qr-$id",
        displayCode = id,
        entityType = "ticket",
        localResult = localResult,
        syncStatus = syncStatus,
        retryCount = 0,
        nextRetryAtEpochMillis = null,
        backendResultCode = backendResultCode,
        backendStatus = null,
        backendCheckInId = null,
        scannedAtEpochMillis = 1_000L,
        syncedAtIso = null,
        message = null,
    )
}
