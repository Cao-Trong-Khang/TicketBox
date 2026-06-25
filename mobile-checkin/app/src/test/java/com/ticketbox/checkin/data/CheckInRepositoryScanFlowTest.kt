package com.ticketbox.checkin.data

import com.ticketbox.checkin.data.local.AssignmentEntity
import com.ticketbox.checkin.data.local.CheckInDao
import com.ticketbox.checkin.data.local.LocalScanLogEntity
import com.ticketbox.checkin.data.local.PreloadedTicketEntity
import com.ticketbox.checkin.data.local.PreloadedVipGuestEntity
import com.ticketbox.checkin.data.local.SnapshotEntity
import com.ticketbox.checkin.data.network.ApiAssignment
import com.ticketbox.checkin.data.network.ApiLoginRequest
import com.ticketbox.checkin.data.network.ApiLoginResponse
import com.ticketbox.checkin.data.network.ApiPreloadResponse
import com.ticketbox.checkin.data.network.ApiStaffUser
import com.ticketbox.checkin.data.network.ApiSyncRequest
import com.ticketbox.checkin.data.network.ApiSyncResponse
import com.ticketbox.checkin.data.network.CheckInApiService
import com.ticketbox.checkin.data.session.StaffSession
import com.ticketbox.checkin.domain.LocalScanResult
import com.ticketbox.checkin.domain.ScanValidator
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class CheckInRepositoryScanFlowTest {
    @Test
    fun manualTicketCodeRoutesToValidResultAndDurableScanLog() = runTest {
        val dao = ScanFlowFakeDao(
            snapshot = snapshot(),
            tickets = listOf(ticket()),
        )
        val repository = CheckInRepository(
            dao = dao,
            api = UnusedCheckInApiService,
            sessionStore = ScanFlowFakeSession(),
            clock = { 2_000L },
        )

        val outcome = repository.recordScan("concert-1", "TICKET-001", "Gate A")

        assertEquals(LocalScanResult.Accepted, outcome.result)
        assertEquals("TICKET-001", outcome.scanLog.displayCode)
        assertEquals("Linh Nguyen", outcome.scanLog.attendeeName)
        assertEquals("General Admission", outcome.scanLog.ticketTypeName)
        assertEquals("Zone A", outcome.scanLog.zoneOrSeat)
        assertEquals("Gate A", outcome.scanLog.gateName)
        assertEquals(listOf(outcome.scanLog), dao.scanLogs.value)
    }

    @Test
    fun wrongEventTicketIsInvalidAndStillRecorded() = runTest {
        val dao = ScanFlowFakeDao(
            snapshot = snapshot(),
            tickets = listOf(ticket(id = "ticket-2", concertId = "concert-2", ticketCode = "OTHER-001")),
        )
        val repository = CheckInRepository(
            dao = dao,
            api = UnusedCheckInApiService,
            sessionStore = ScanFlowFakeSession(),
            clock = { 2_000L },
        )

        val outcome = repository.recordScan("concert-1", "OTHER-001", "Gate A")

        assertEquals(LocalScanResult.Invalid, outcome.result)
        assertEquals("Ticket belongs to a different event", outcome.message)
        assertEquals("invalid", dao.scanLogs.value.single().localResult)
    }

    @Test
    fun localDuplicateIncludesPreviousCheckInContext() = runTest {
        val previous = scanLog(
            localScanId = "previous-scan",
            qrHash = "QR-001",
            localResult = "accepted",
            gateName = "Gate A",
        )
        val dao = ScanFlowFakeDao(
            snapshot = snapshot(),
            tickets = listOf(ticket()),
            scanLogs = listOf(previous),
        )
        val repository = CheckInRepository(
            dao = dao,
            api = UnusedCheckInApiService,
            sessionStore = ScanFlowFakeSession(),
            clock = { 2_000L },
        )

        val outcome = repository.recordScan("concert-1", "QR-001", "Gate A")

        assertEquals(LocalScanResult.Duplicate, outcome.result)
        assertSame(previous, outcome.previousScan)
        assertEquals("Gate A", outcome.scanLog.previousGateName)
        assertEquals("duplicate", outcome.scanLog.localResult)
    }

    @Test
    fun vipGuestAssignedToDifferentGateIsInvalidAndRecorded() = runTest {
        val dao = ScanFlowFakeDao(
            snapshot = snapshot(),
            vipGuests = listOf(vipGuest(allowedGate = "VIP Gate")),
        )
        val repository = CheckInRepository(
            dao = dao,
            api = UnusedCheckInApiService,
            sessionStore = ScanFlowFakeSession(),
            clock = { 2_000L },
        )

        val outcome = repository.recordScan("concert-1", "VIP-001", "Gate A")

        assertEquals(LocalScanResult.Invalid, outcome.result)
        assertEquals("VIP guest is assigned to VIP Gate", outcome.message)
        assertEquals("VIP-001", outcome.scanLog.displayCode)
        assertEquals("invalid", dao.scanLogs.value.single().localResult)
    }

    @Test
    fun rawVipExternalGuestKeyIsNotAcceptedAsQrCredential() = runTest {
        val dao = ScanFlowFakeDao(
            snapshot = snapshot(),
            vipGuests = listOf(vipGuest(allowedGate = "VIP Gate")),
        )
        val repository = CheckInRepository(
            dao = dao,
            api = UnusedCheckInApiService,
            sessionStore = ScanFlowFakeSession(),
            clock = { 2_000L },
        )

        val outcome = repository.recordScan("concert-1", "VIP-001", "VIP Gate")

        assertEquals(LocalScanResult.Invalid, outcome.result)
        assertEquals("QR payload is not in the preload snapshot", outcome.message)
        assertEquals("invalid", dao.scanLogs.value.single().localResult)
    }

    @Test
    fun canceledTicketIsInvalidAndRetainsReason() = runTest {
        val dao = ScanFlowFakeDao(
            snapshot = snapshot(),
            tickets = listOf(ticket(status = "CANCELLED")),
        )
        val repository = CheckInRepository(
            dao = dao,
            api = UnusedCheckInApiService,
            sessionStore = ScanFlowFakeSession(),
            clock = { 2_000L },
        )

        val outcome = repository.recordScan("concert-1", "TICKET-001", "Gate A")

        assertEquals(LocalScanResult.Invalid, outcome.result)
        assertEquals("This ticket or guest entry is canceled", outcome.message)
        assertEquals("invalid", outcome.scanLog.localResult)
    }

    @Test
    fun refundedTicketIsInvalidAndRetainsReason() = runTest {
        val dao = ScanFlowFakeDao(
            snapshot = snapshot(),
            tickets = listOf(ticket(status = "REFUNDED")),
        )
        val repository = CheckInRepository(
            dao = dao,
            api = UnusedCheckInApiService,
            sessionStore = ScanFlowFakeSession(),
            clock = { 2_000L },
        )

        val outcome = repository.recordScan("concert-1", "TICKET-001", "Gate A")

        assertEquals(LocalScanResult.Invalid, outcome.result)
        assertEquals("This ticket was refunded", outcome.message)
        assertEquals("invalid", outcome.scanLog.localResult)
    }

    @Test
    fun staleSnapshotClassifiesAcceptedRecordAsPendingAuthoritativeSync() = runTest {
        val dao = ScanFlowFakeDao(
            snapshot = snapshot(),
            tickets = listOf(ticket()),
        )
        val repository = CheckInRepository(
            dao = dao,
            api = UnusedCheckInApiService,
            sessionStore = ScanFlowFakeSession(),
            validator = ScanValidator(snapshotStaleAfterMillis = 500L),
            clock = { 2_000L },
        )

        val outcome = repository.recordScan("concert-1", "TICKET-001", "Gate A")

        assertEquals(LocalScanResult.StaleSnapshot, outcome.result)
        assertEquals("stale_snapshot", outcome.scanLog.localResult)
        assertEquals("pending", outcome.scanLog.syncStatus)
    }

    private fun snapshot() = SnapshotEntity(
        concertId = "concert-1",
        version = "snapshot-1",
        generatedAtIso = "2026-06-15T09:00:00Z",
        storedAtEpochMillis = 1_000L,
    )

    private fun ticket(
        id: String = "ticket-1",
        concertId: String = "concert-1",
        ticketCode: String = "TICKET-001",
        status: String = "ACTIVE",
        checkedInAtIso: String? = null,
    ) = PreloadedTicketEntity(
        id = id,
        concertId = concertId,
        ticketCode = ticketCode,
        qrHash = "QR-001",
        status = status,
        issuedAtIso = "2026-06-15T09:00:00Z",
        checkedInAtIso = checkedInAtIso,
        attendeeName = "Linh Nguyen",
        zoneOrSeat = "Zone A",
        ticketTypeCode = "GA",
        ticketTypeName = "General Admission",
    )

    private fun vipGuest(allowedGate: String?) = PreloadedVipGuestEntity(
        id = "vip-1",
        concertId = "concert-1",
        qrHash = "VIP-QR-001",
        externalGuestKey = "VIP-001",
        fullName = "VIP Guest",
        sponsorCompany = "TicketBox Partners",
        guestType = "Artist Guest",
        allowedGate = allowedGate,
        status = "ACTIVE",
        checkedInAtIso = null,
    )

    private fun scanLog(
        localScanId: String,
        qrHash: String,
        localResult: String,
        gateName: String?,
    ) = LocalScanLogEntity(
        localScanId = localScanId,
        sourceDeviceId = "device-1",
        concertId = "concert-1",
        qrHash = qrHash,
        displayCode = "TICKET-001",
        entityType = "ticket",
        localResult = localResult,
        syncStatus = "pending",
        retryCount = 0,
        nextRetryAtEpochMillis = null,
        backendResultCode = null,
        backendStatus = null,
        backendCheckInId = null,
        scannedAtEpochMillis = 1_500L,
        syncedAtIso = null,
        message = null,
        gateName = gateName,
    )
}

private class ScanFlowFakeDao(
    private val snapshot: SnapshotEntity?,
    private val tickets: List<PreloadedTicketEntity> = emptyList(),
    private val vipGuests: List<PreloadedVipGuestEntity> = emptyList(),
    scanLogs: List<LocalScanLogEntity> = emptyList(),
) : CheckInDao() {
    val scanLogs = MutableStateFlow(scanLogs)

    override fun observeAssignments(): Flow<List<AssignmentEntity>> = MutableStateFlow(emptyList())
    override suspend fun assignmentForConcert(concertId: String): AssignmentEntity? = null
    override suspend fun assignmentsForConcert(concertId: String): List<AssignmentEntity> = emptyList()
    override suspend fun upsertAssignments(assignments: List<AssignmentEntity>) = Unit
    override suspend fun snapshotForConcert(concertId: String): SnapshotEntity? =
        snapshot?.takeIf { it.concertId == concertId }
    override suspend fun upsertSnapshot(snapshot: SnapshotEntity) = Unit
    override suspend fun deleteTicketsForConcert(concertId: String) = Unit
    override suspend fun deleteVipGuestsForConcert(concertId: String) = Unit
    override suspend fun upsertTickets(tickets: List<PreloadedTicketEntity>) = Unit
    override suspend fun upsertVipGuests(vipGuests: List<PreloadedVipGuestEntity>) = Unit
    override suspend fun ticketByQrHash(concertId: String, qrHash: String): PreloadedTicketEntity? =
        tickets.firstOrNull { it.concertId == concertId && it.qrHash == qrHash }
    override suspend fun ticketByCodeOrQrHash(concertId: String, input: String): PreloadedTicketEntity? =
        tickets.firstOrNull { it.concertId == concertId && (it.qrHash == input || it.ticketCode == input) }
    override suspend fun ticketByCodeOrQrHashAnyConcert(input: String): PreloadedTicketEntity? =
        tickets.firstOrNull { it.qrHash == input || it.ticketCode == input }
    override fun observeTicketsForConcert(concertId: String): Flow<List<PreloadedTicketEntity>> =
        MutableStateFlow(tickets.filter { it.concertId == concertId })
    override suspend fun ticketListForConcert(concertId: String): List<PreloadedTicketEntity> =
        tickets.filter { it.concertId == concertId }
    override suspend fun vipGuestByQrHash(concertId: String, qrHash: String): PreloadedVipGuestEntity? =
        vipGuests.firstOrNull {
            it.concertId == concertId && it.qrHash == qrHash
        }
    override fun observeVipGuestsForConcert(concertId: String): Flow<List<PreloadedVipGuestEntity>> =
        MutableStateFlow(vipGuests.filter { it.concertId == concertId })
    override suspend fun vipGuestListForConcert(concertId: String): List<PreloadedVipGuestEntity> =
        vipGuests.filter { it.concertId == concertId }
    override suspend fun acceptedLocalScanCount(concertId: String, qrHash: String): Int =
        scanLogs.value.count {
            it.concertId == concertId &&
                it.qrHash == qrHash &&
                it.localResult in setOf("accepted", "stale_snapshot")
        }
    override suspend fun previousAcceptedLocalScan(concertId: String, qrHash: String): LocalScanLogEntity? =
        scanLogs.value
            .filter {
                it.concertId == concertId &&
                    it.qrHash == qrHash &&
                    it.localResult in setOf("accepted", "stale_snapshot")
            }
            .maxByOrNull { it.scannedAtEpochMillis }
    override fun observeScanLogsForConcert(concertId: String): Flow<List<LocalScanLogEntity>> =
        MutableStateFlow(scanLogs.value.filter { it.concertId == concertId })
    override fun observeSyncQueueForConcert(concertId: String): Flow<List<LocalScanLogEntity>> =
        MutableStateFlow(scanLogs.value.filter { it.concertId == concertId })
    override suspend fun scanLogById(localScanId: String): LocalScanLogEntity? =
        scanLogs.value.firstOrNull { it.localScanId == localScanId }
    override fun observePendingScanCount(concertId: String): Flow<Int> =
        MutableStateFlow(scanLogs.value.count { it.concertId == concertId && it.syncStatus in setOf("pending", "failed") })
    override suspend fun pendingScanCount(concertId: String): Int =
        scanLogs.value.count { it.concertId == concertId && it.syncStatus in setOf("pending", "failed") }
    override suspend fun acceptedScanCountForConcert(concertId: String): Int =
        acceptedLocalScanCount(concertId, "")
    override suspend fun insertScanLog(scanLog: LocalScanLogEntity) {
        scanLogs.value = scanLogs.value + scanLog
    }
    override suspend fun pendingScans(
        concertId: String,
        nowEpochMillis: Long,
        limit: Int,
    ): List<LocalScanLogEntity> = emptyList()
    override suspend fun markSynced(
        localScanId: String,
        backendResultCode: String,
        backendStatus: String,
        backendCheckInId: String,
        syncedAtIso: String?,
        serverCheckInAtIso: String?,
        message: String?,
    ) = Unit
    override suspend fun markRetry(
        localScanId: String,
        nextRetryAtEpochMillis: Long,
        message: String,
    ) = Unit
}


private object UnusedCheckInApiService : CheckInApiService {
    override suspend fun login(request: ApiLoginRequest): ApiLoginResponse = error("Not used")
    override suspend fun me(): ApiStaffUser = error("Not used")
    override suspend fun assignments(): List<ApiAssignment> = error("Not used")
    override suspend fun preload(concertId: String): ApiPreloadResponse = error("Not used")
    override suspend fun sync(concertId: String, request: ApiSyncRequest): ApiSyncResponse = error("Not used")
}

private class ScanFlowFakeSession : StaffSession {
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
