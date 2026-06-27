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
import com.ticketbox.checkin.data.network.ApiPreloadConcert
import com.ticketbox.checkin.data.network.ApiPreloadResponse
import com.ticketbox.checkin.data.network.ApiStaffUser
import com.ticketbox.checkin.data.network.ApiSnapshot
import com.ticketbox.checkin.data.network.ApiSyncRequest
import com.ticketbox.checkin.data.network.ApiSyncResponse
import com.ticketbox.checkin.data.network.CheckInApiService
import com.ticketbox.checkin.data.session.StaffSession
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class CheckInRepositoryLoginTest {
    @Test
    fun successfulLoginStoresSessionAndAssignments() = runTest {
        val dao = FakeCheckInDao()
        val session = FakeStaffSession()
        val api = FakeCheckInApiService()
        val repository = CheckInRepository(dao, api, session)

        val outcome = repository.login("checkin@ticketbox.local", "Checkin@123456")

        assertTrue(outcome is LoginOutcome.Success)
        assertEquals("token-1", session.accessToken())
        assertEquals("staff@example.com", session.staffEmail())
        assertEquals(1, dao.assignments.value.size)
    }

    @Test
    fun invalidCredentialResponseMapsToInvalidLogin() = runTest {
        val repository = CheckInRepository(
            dao = FakeCheckInDao(),
            api = FakeCheckInApiService(loginError = httpError(401)),
            sessionStore = FakeStaffSession(),
        )

        val outcome = repository.login("bad@example.com", "bad")

        assertEquals(LoginOutcome.InvalidCredentials, outcome)
    }

    @Test
    fun permissionResponseMapsToPermissionDenied() = runTest {
        val repository = CheckInRepository(
            dao = FakeCheckInDao(),
            api = FakeCheckInApiService(assignmentsError = httpError(403)),
            sessionStore = FakeStaffSession(),
        )

        val outcome = repository.login("organizer@example.com", "password")

        assertEquals(LoginOutcome.PermissionDenied, outcome)
    }

    @Test
    fun logoutClearsSessionWithoutDeletingLocalRecords() {
        val dao = FakeCheckInDao()
        val session = FakeStaffSession()
        session.setAuthenticatedStaff(
            token = "token-1",
            staffId = "staff-1",
            staffEmail = "staff@example.com",
        )
        val repository = CheckInRepository(dao, FakeCheckInApiService(), session)

        repository.logout()

        assertEquals(null, session.accessToken())
        assertEquals(null, session.staffEmail())
        assertEquals(0, dao.localRecordMutations)
    }

    @Test
    fun preloadPassesSelectedAssignmentIdToApi() = runTest {
        val api = FakeCheckInApiService()
        val repository = CheckInRepository(FakeCheckInDao(), api, FakeStaffSession())

        val snapshot = repository.preload("concert-1", "assignment-1")

        assertEquals("concert-1", api.lastPreloadConcertId)
        assertEquals("assignment-1", api.lastPreloadAssignmentId)
        assertEquals("concert-1", snapshot.concertId)
    }

    private fun httpError(code: Int): HttpException =
        HttpException(Response.error<Any>(code, "{}".toResponseBody(null)))
}

private class FakeStaffSession : StaffSession {
    private var token: String? = null
    private var staffId: String? = null
    private var staffEmail: String? = null
    private var sourceDeviceId: String = "device-1"

    override fun accessToken(): String? = token
    override fun staffEmail(): String? = staffEmail
    override fun staffId(): String? = staffId
    override fun isLoggedIn(): Boolean = !token.isNullOrBlank()
    override fun setAccessToken(token: String) {
        this.token = token
    }
    override fun setAuthenticatedStaff(token: String, staffId: String, staffEmail: String) {
        this.token = token
        this.staffId = staffId
        this.staffEmail = staffEmail
    }
    override fun sourceDeviceId(): String = sourceDeviceId
    override fun setSourceDeviceId(sourceDeviceId: String) {
        this.sourceDeviceId = sourceDeviceId
    }
    override fun clearSessionCredentials() {
        token = null
        staffId = null
        staffEmail = null
    }
}

private class FakeCheckInApiService(
    private val loginError: HttpException? = null,
    private val assignmentsError: HttpException? = null,
) : CheckInApiService {
    var lastPreloadConcertId: String? = null
    var lastPreloadAssignmentId: String? = null

    override suspend fun login(request: ApiLoginRequest): ApiLoginResponse {
        loginError?.let { throw it }
        return ApiLoginResponse(accessToken = "token-1")
    }

    override suspend fun me(): ApiStaffUser =
        ApiStaffUser(id = "staff-1", email = "staff@example.com")

    override suspend fun assignments(): List<ApiAssignment> {
        assignmentsError?.let { throw it }
        return listOf(
            ApiAssignment(
                assignmentId = "assignment-1",
                concertId = "concert-1",
                title = "TicketBox Live",
                venueName = "Main Hall",
                status = "PUBLISHED",
                gateName = "Gate A",
                sourceDeviceId = "device-1",
                startsAt = "2026-06-15T10:00:00Z",
                endsAt = null,
            ),
        )
    }

    override suspend fun preload(concertId: String, assignmentId: String?): ApiPreloadResponse {
        lastPreloadConcertId = concertId
        lastPreloadAssignmentId = assignmentId
        return ApiPreloadResponse(
            concert = ApiPreloadConcert(
                id = concertId,
                title = "TicketBox Live",
                venueName = "Main Hall",
                venueAddress = null,
                status = "PUBLISHED",
                startsAt = "2026-06-15T10:00:00Z",
                endsAt = null,
            ),
            assignments = emptyList(),
            snapshot = ApiSnapshot(
                generatedAt = "2026-06-15T09:00:00Z",
                version = "snapshot-1",
            ),
            tickets = emptyList(),
            vipGuests = emptyList(),
        )
    }

    override suspend fun sync(concertId: String, request: ApiSyncRequest): ApiSyncResponse =
        error("Not used")
}

private class FakeCheckInDao : CheckInDao() {
    val assignments = MutableStateFlow<List<AssignmentEntity>>(emptyList())
    var localRecordMutations = 0

    override fun observeAssignments(): Flow<List<AssignmentEntity>> = assignments
    override suspend fun assignmentForConcert(concertId: String): AssignmentEntity? =
        assignments.value.firstOrNull { it.concertId == concertId }
    override suspend fun assignmentsForConcert(concertId: String): List<AssignmentEntity> =
        assignments.value.filter { it.concertId == concertId }
    override suspend fun upsertAssignments(assignments: List<AssignmentEntity>) {
        this.assignments.value = assignments
    }

    override suspend fun snapshotForConcert(concertId: String): SnapshotEntity? = null
    override suspend fun upsertSnapshot(snapshot: SnapshotEntity) = Unit
    override suspend fun deleteTicketsForConcert(concertId: String) {
        localRecordMutations += 1
    }
    override suspend fun deleteVipGuestsForConcert(concertId: String) {
        localRecordMutations += 1
    }
    override suspend fun upsertTickets(tickets: List<PreloadedTicketEntity>) {
        localRecordMutations += 1
    }
    override suspend fun upsertVipGuests(vipGuests: List<PreloadedVipGuestEntity>) {
        localRecordMutations += 1
    }
    override suspend fun ticketByQrHash(concertId: String, qrHash: String): PreloadedTicketEntity? = null
    override suspend fun ticketByCodeOrQrHash(concertId: String, input: String): PreloadedTicketEntity? = null
    override suspend fun ticketByCodeOrQrHashAnyConcert(input: String): PreloadedTicketEntity? = null
    override fun observeTicketsForConcert(concertId: String): Flow<List<PreloadedTicketEntity>> =
        MutableStateFlow(emptyList())
    override suspend fun ticketListForConcert(concertId: String): List<PreloadedTicketEntity> =
        emptyList()
    override suspend fun vipGuestByQrHash(concertId: String, qrHash: String): PreloadedVipGuestEntity? = null
    override fun observeVipGuestsForConcert(
        concertId: String,
        gateName: String?,
    ): Flow<List<PreloadedVipGuestEntity>> =
        MutableStateFlow(emptyList())
    override suspend fun vipGuestListForConcert(
        concertId: String,
        gateName: String?,
    ): List<PreloadedVipGuestEntity> =
        emptyList()
    override suspend fun acceptedLocalScanCount(concertId: String, qrHash: String): Int = 0
    override suspend fun previousAcceptedLocalScan(
        concertId: String,
        qrHash: String,
    ): LocalScanLogEntity? = null
    override fun observeScanLogsForConcert(concertId: String): Flow<List<LocalScanLogEntity>> =
        MutableStateFlow(emptyList())
    override fun observeSyncQueueForConcert(concertId: String): Flow<List<LocalScanLogEntity>> =
        MutableStateFlow(emptyList())
    override suspend fun scanLogById(localScanId: String): LocalScanLogEntity? = null
    override fun observePendingScanCount(concertId: String): Flow<Int> = MutableStateFlow(0)
    override suspend fun pendingScanCount(concertId: String): Int = 0
    override suspend fun acceptedScanCountForConcert(concertId: String): Int = 0
    override suspend fun insertScanLog(scanLog: LocalScanLogEntity) {
        localRecordMutations += 1
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
    ) {
        localRecordMutations += 1
    }
    override suspend fun markRetry(
        localScanId: String,
        nextRetryAtEpochMillis: Long,
        message: String,
    ) {
        localRecordMutations += 1
    }
}
