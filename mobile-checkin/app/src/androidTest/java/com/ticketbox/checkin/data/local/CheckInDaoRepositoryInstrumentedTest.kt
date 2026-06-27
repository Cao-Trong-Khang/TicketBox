package com.ticketbox.checkin.data.local

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.ticketbox.checkin.data.CheckInRepository
import com.ticketbox.checkin.data.network.ApiAssignment
import com.ticketbox.checkin.data.network.ApiLoginRequest
import com.ticketbox.checkin.data.network.ApiLoginResponse
import com.ticketbox.checkin.data.network.ApiPreloadResponse
import com.ticketbox.checkin.data.network.ApiStaffUser
import com.ticketbox.checkin.data.network.ApiSyncRequest
import com.ticketbox.checkin.data.network.ApiSyncResponse
import com.ticketbox.checkin.data.network.CheckInApiService
import com.ticketbox.checkin.data.session.StaffSession
import com.ticketbox.checkin.domain.HistoryFilter
import com.ticketbox.checkin.domain.VipStatusFilter
import com.ticketbox.checkin.domain.deriveVipDashboardCounts
import com.ticketbox.checkin.domain.filterScanHistory
import com.ticketbox.checkin.domain.filterVipGuests
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class CheckInDaoRepositoryInstrumentedTest {
    private lateinit var database: CheckInDatabase
    private lateinit var dao: CheckInDao

    @Before
    fun createDatabase() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, CheckInDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        dao = database.checkInDao()
    }

    @After
    fun closeDatabase() {
        database.close()
    }

    @Test
    fun syncQueuePendingCountsAndRetryableRecordsAreScopedToSelectedConcert() = runBlocking {
        seedAssignmentAndSnapshot()
        dao.insertScanLog(scanLog("old-pending", "TICKET-001", "accepted", "pending", scannedAt = 1_000L))
        dao.insertScanLog(scanLog("synced", "TICKET-002", "accepted", "synced", scannedAt = 2_000L))
        dao.insertScanLog(scanLog("conflict", "TICKET-003", "accepted", "conflict", scannedAt = 3_000L))
        dao.insertScanLog(
            scanLog(
                "retry-now",
                "TICKET-004",
                "accepted",
                "failed",
                scannedAt = 4_000L,
                nextRetryAt = 4_500L,
            ),
        )
        dao.insertScanLog(
            scanLog(
                "retry-later",
                "TICKET-005",
                "accepted",
                "failed",
                scannedAt = 5_000L,
                nextRetryAt = 10_000L,
            ),
        )
        dao.insertScanLog(
            scanLog(
                "other-concert",
                "OTHER-001",
                "accepted",
                "pending",
                concertId = "concert-2",
                scannedAt = 6_000L,
            ),
        )

        assertEquals(
            listOf("retry-later", "retry-now", "conflict", "synced", "old-pending"),
            dao.observeSyncQueueForConcert("concert-1").first().map { it.localScanId },
        )
        assertEquals(3, dao.pendingScanCount("concert-1"))
        assertEquals(
            listOf("old-pending", "retry-now"),
            dao.pendingScans("concert-1", nowEpochMillis = 5_000L, limit = 10).map { it.localScanId },
        )
    }

    @Test
    fun conflictAndRetryUpdatesPreserveLocalRecordsForQueueReview() = runBlocking {
        seedAssignmentAndSnapshot()
        dao.insertScanLog(scanLog("scan-1", "TICKET-001", "accepted", "pending"))
        dao.insertScanLog(scanLog("scan-2", "TICKET-002", "accepted", "pending"))

        dao.markSynced(
            localScanId = "scan-1",
            backendResultCode = "conflict",
            backendStatus = "CONFLICT",
            backendCheckInId = "check-in-1",
            syncedAtIso = "2026-06-15T11:05:00Z",
            serverCheckInAtIso = "2026-06-15T11:00:00Z",
            message = "Ticket was already checked in on another device",
        )
        dao.markRetry(
            localScanId = "scan-2",
            nextRetryAtEpochMillis = 20_000L,
            message = "HTTP 429 during sync",
        )

        val conflict = dao.scanLogById("scan-1")
        val retry = dao.scanLogById("scan-2")

        assertEquals("conflict", conflict?.syncStatus)
        assertEquals("conflict", conflict?.backendResultCode)
        assertEquals("2026-06-15T11:00:00Z", conflict?.serverCheckInAtIso)
        assertEquals("Ticket was already checked in on another device", conflict?.message)
        assertEquals("failed", retry?.syncStatus)
        assertEquals(1, retry?.retryCount)
        assertEquals(20_000L, retry?.nextRetryAtEpochMillis)
        assertEquals("HTTP 429 during sync", retry?.message)
    }

    @Test
    fun repositoryHistoryAndVipViewsUseLocalRoomData() = runBlocking {
        seedAssignmentAndSnapshot()
        dao.upsertTickets(
            listOf(
                ticket("ticket-1", "TICKET-001", "ACTIVE"),
                ticket("ticket-2", "TICKET-002", "USED", checkedInAt = "2026-06-15T10:00:00Z"),
            ),
        )
        dao.upsertVipGuests(
            listOf(
                vipGuest("vip-1", "Anh VIP", "ACTIVE", sponsor = "Media Partner", guestType = "Press"),
                vipGuest(
                    "vip-2",
                    "Binh VIP",
                    "CHECKED_IN",
                    checkedInAt = "2026-06-15T10:00:00Z",
                    sponsor = "Artist Team",
                    guestType = "Artist Guest",
                ),
            ),
        )
        dao.insertScanLog(scanLog("success", "TICKET-001", "accepted", "synced"))
        dao.insertScanLog(scanLog("duplicate", "TICKET-002", "duplicate", "synced"))
        dao.insertScanLog(scanLog("offline", "TICKET-003", "accepted", "pending"))
        dao.insertScanLog(scanLog("conflict", "TICKET-004", "accepted", "conflict", backendResultCode = "conflict"))

        val repository = CheckInRepository(
            dao = dao,
            api = InstrumentedUnusedApi,
            sessionStore = InstrumentedSession,
        )
        val dashboard = repository.dashboardSnapshot("concert-1")
        val history = repository.observeScanHistory("concert-1").first()
        val vipGuests = repository.observeVipGuests("concert-1").first()

        assertEquals(2, dashboard.totalTickets)
        assertEquals(2, dashboard.vipGuestCount)
        assertEquals(1, dashboard.pendingOfflineCount)
        assertEquals(listOf("success"), filterScanHistory(history, HistoryFilter.Success, "TICKET-001").map { it.localScanId })
        assertEquals(listOf("offline"), filterScanHistory(history, HistoryFilter.Offline, "").map { it.localScanId })
        assertEquals(listOf("conflict"), filterScanHistory(history, HistoryFilter.Conflict, "").map { it.localScanId })

        val counts = deriveVipDashboardCounts(vipGuests)
        assertEquals(2, counts.total)
        assertEquals(1, counts.checkedIn)
        assertEquals(1, counts.remaining)
        assertEquals(
            listOf("vip-1"),
            filterVipGuests(vipGuests, "anh", "Media Partner", "Press", VipStatusFilter.Remaining).map { it.id },
        )
        assertEquals(
            listOf("vip-2"),
            filterVipGuests(vipGuests, "vip-2@example.test", "Artist Team", "Artist Guest", VipStatusFilter.CheckedIn)
                .map { it.id },
        )
    }

    private suspend fun seedAssignmentAndSnapshot() {
        dao.upsertAssignments(
            listOf(
                AssignmentEntity(
                    assignmentId = "assignment-1",
                    concertId = "concert-1",
                    title = "TicketBox Live",
                    venueName = "Saigon Arena",
                    status = "PUBLISHED",
                    gateName = "Gate A",
                    sourceDeviceId = "device-1",
                    startsAtIso = "2026-06-15T19:00:00Z",
                    endsAtIso = null,
                ),
            ),
        )
        dao.upsertSnapshot(
            SnapshotEntity(
                concertId = "concert-1",
                version = "snapshot-1",
                generatedAtIso = "2026-06-15T09:00:00Z",
                storedAtEpochMillis = 1_000L,
            ),
        )
    }

    private fun ticket(
        id: String,
        code: String,
        status: String,
        checkedInAt: String? = null,
    ) = PreloadedTicketEntity(
        id = id,
        concertId = "concert-1",
        ticketCode = code,
        qrHash = "QR-$code",
        status = status,
        issuedAtIso = "2026-06-15T09:00:00Z",
        checkedInAtIso = checkedInAt,
        attendeeName = "Attendee $code",
        zoneOrSeat = "Zone A",
        ticketTypeCode = "GA",
        ticketTypeName = "General Admission",
    )

    private fun vipGuest(
        id: String,
        name: String,
        status: String,
        checkedInAt: String? = null,
        sponsor: String,
        guestType: String,
    ) = PreloadedVipGuestEntity(
        id = id,
        concertId = "concert-1",
        qrHash = "QR-$id",
        externalGuestKey = "INVITE-$id",
        fullName = name,
        email = "$id@example.test",
        phone = "+840000$id",
        sponsorCompany = sponsor,
        guestType = guestType,
        allowedGate = "Gate A",
        status = status,
        checkedInAtIso = checkedInAt,
        notes = "Use VIP entrance",
    )

    private fun scanLog(
        localScanId: String,
        displayCode: String,
        localResult: String,
        syncStatus: String,
        concertId: String = "concert-1",
        scannedAt: Long = 1_000L,
        nextRetryAt: Long? = null,
        backendResultCode: String? = null,
    ) = LocalScanLogEntity(
        localScanId = localScanId,
        sourceDeviceId = "device-1",
        concertId = concertId,
        qrHash = "QR-$displayCode",
        displayCode = displayCode,
        attendeeName = "Attendee $displayCode",
        ticketTypeName = "General Admission",
        zoneOrSeat = "Zone A",
        gateName = "Gate A",
        entityType = "ticket",
        localResult = localResult,
        syncStatus = syncStatus,
        retryCount = if (syncStatus == "failed") 1 else 0,
        nextRetryAtEpochMillis = nextRetryAt,
        backendResultCode = backendResultCode,
        backendStatus = null,
        backendCheckInId = null,
        scannedAtEpochMillis = scannedAt,
        syncedAtIso = null,
        message = null,
    )
}

private object InstrumentedUnusedApi : CheckInApiService {
    override suspend fun login(request: ApiLoginRequest): ApiLoginResponse = error("Not used")
    override suspend fun me(): ApiStaffUser = error("Not used")
    override suspend fun assignments(): List<ApiAssignment> = error("Not used")
    override suspend fun preload(concertId: String, assignmentId: String?): ApiPreloadResponse = error("Not used")
    override suspend fun sync(concertId: String, request: ApiSyncRequest): ApiSyncResponse = error("Not used")
}

private object InstrumentedSession : StaffSession {
    override fun accessToken(): String? = "token-1"
    override fun staffEmail(): String? = "staff@example.test"
    override fun staffId(): String? = "staff-1"
    override fun isLoggedIn(): Boolean = true
    override fun setAccessToken(token: String) = Unit
    override fun setAuthenticatedStaff(token: String, staffId: String, staffEmail: String) = Unit
    override fun sourceDeviceId(): String = "device-1"
    override fun setSourceDeviceId(sourceDeviceId: String) = Unit
    override fun clearSessionCredentials() = Unit
}
