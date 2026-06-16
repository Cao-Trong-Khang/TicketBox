package com.ticketbox.checkin.data

import com.ticketbox.checkin.data.local.AssignmentEntity
import com.ticketbox.checkin.data.local.CheckInDao
import com.ticketbox.checkin.data.local.LocalScanLogEntity
import com.ticketbox.checkin.data.local.PreloadedTicketEntity
import com.ticketbox.checkin.data.local.PreloadedVipGuestEntity
import com.ticketbox.checkin.data.local.SnapshotEntity
import com.ticketbox.checkin.data.network.ApiLoginRequest
import com.ticketbox.checkin.data.network.ApiSyncRequest
import com.ticketbox.checkin.data.network.ApiSyncScan
import com.ticketbox.checkin.data.network.CheckInApiService
import com.ticketbox.checkin.data.session.StaffSession
import com.ticketbox.checkin.domain.LocalScanResult
import com.ticketbox.checkin.domain.ScanLogFactory
import com.ticketbox.checkin.domain.ScanValidator
import com.ticketbox.checkin.domain.SyncRetryPolicy
import java.time.Instant
import kotlinx.coroutines.flow.Flow
import retrofit2.HttpException

data class LocalScanOutcome(
    val scanLog: LocalScanLogEntity,
    val result: LocalScanResult,
    val message: String,
    val ticket: PreloadedTicketEntity? = null,
    val vipGuest: PreloadedVipGuestEntity? = null,
    val previousScan: LocalScanLogEntity? = null,
)

data class SyncSummary(
    val uploaded: Int,
    val retrying: Int,
)

sealed class LoginOutcome {
    data class Success(val assignments: List<AssignmentEntity>) : LoginOutcome()
    data object InvalidCredentials : LoginOutcome()
    data object PermissionDenied : LoginOutcome()
    data class Failure(val message: String) : LoginOutcome()
}

data class DashboardSnapshot(
    val totalTickets: Int,
    val checkedInCount: Int,
    val remainingCount: Int,
    val vipGuestCount: Int,
    val pendingOfflineCount: Int,
)

class CheckInRepository(
    private val dao: CheckInDao,
    private val api: CheckInApiService,
    private val sessionStore: StaffSession,
    private val validator: ScanValidator = ScanValidator(),
    private val scanLogFactory: ScanLogFactory = ScanLogFactory(),
    private val clock: () -> Long = { System.currentTimeMillis() },
) {
    fun observeAssignments(): Flow<List<AssignmentEntity>> = dao.observeAssignments()

    fun observeTickets(concertId: String): Flow<List<PreloadedTicketEntity>> =
        dao.observeTicketsForConcert(concertId)

    fun observeVipGuests(concertId: String): Flow<List<PreloadedVipGuestEntity>> =
        dao.observeVipGuestsForConcert(concertId)

    fun observeScanHistory(concertId: String): Flow<List<LocalScanLogEntity>> =
        dao.observeScanLogsForConcert(concertId)

    fun observeSyncQueue(concertId: String): Flow<List<LocalScanLogEntity>> =
        dao.observeSyncQueueForConcert(concertId)

    fun observePendingScanCount(concertId: String): Flow<Int> =
        dao.observePendingScanCount(concertId)

    suspend fun login(emailOrPhone: String, password: String): LoginOutcome {
        val identifier = emailOrPhone.trim()
        if (identifier.isBlank() || password.isBlank()) {
            return LoginOutcome.InvalidCredentials
        }

        return try {
            val response = api.login(ApiLoginRequest(email = identifier, password = password))
            sessionStore.setAccessToken(response.accessToken)
            val staff = api.me()
            sessionStore.setAuthenticatedStaff(
                token = response.accessToken,
                staffId = staff.id,
                staffEmail = staff.email,
            )
            val assignments = refreshAssignments()
            LoginOutcome.Success(assignments)
        } catch (error: HttpException) {
            when (error.code()) {
                401, 400 -> LoginOutcome.InvalidCredentials
                403 -> LoginOutcome.PermissionDenied
                else -> LoginOutcome.Failure(error.message())
            }
        } catch (error: java.io.IOException) {
            LoginOutcome.Failure(error.message ?: "Network unavailable")
        }
    }

    suspend fun refreshAssignments(): List<AssignmentEntity> {
        val assignments = api.assignments().map { assignment ->
            AssignmentEntity(
                assignmentId = assignment.assignmentId,
                concertId = assignment.concertId,
                title = assignment.title,
                venueName = assignment.venueName,
                status = assignment.status ?: "PUBLISHED",
                gateName = assignment.gateName,
                sourceDeviceId = assignment.sourceDeviceId,
                startsAtIso = assignment.startsAt,
                endsAtIso = assignment.endsAt,
            )
        }
        dao.upsertAssignments(assignments)
        return assignments
    }

    suspend fun preload(concertId: String): SnapshotEntity {
        val response = api.preload(concertId)
        val storedAt = clock()
        val snapshot = SnapshotEntity(
            concertId = response.concert.id,
            version = response.snapshot.version,
            generatedAtIso = response.snapshot.generatedAt,
            storedAtEpochMillis = storedAt,
        )
        val tickets = response.tickets.map { ticket ->
            PreloadedTicketEntity(
                id = ticket.id,
                concertId = response.concert.id,
                ticketCode = ticket.ticketCode,
                qrHash = ticket.qrHash,
                status = ticket.status,
                issuedAtIso = ticket.issuedAt,
                checkedInAtIso = ticket.checkedInAt,
                attendeeName = ticket.attendeeName,
                attendeeEmail = ticket.attendeeEmail,
                zoneOrSeat = ticket.zoneOrSeat,
                previousCheckInAtIso = ticket.previousCheckIn?.scannedAt,
                previousGateName = ticket.previousCheckIn?.gate,
                previousStaffName = ticket.previousCheckIn?.staffName,
                ticketTypeCode = ticket.ticketType.code,
                ticketTypeName = ticket.ticketType.name,
            )
        }
        val vipGuests = response.vipGuests.map { guest ->
            PreloadedVipGuestEntity(
                id = guest.id,
                concertId = response.concert.id,
                qrHash = guest.qrHash,
                externalGuestKey = guest.externalGuestKey,
                fullName = guest.fullName,
                email = guest.email,
                phone = guest.phone,
                sponsorSource = guest.sponsorSource,
                sponsorCompany = guest.sponsorCompany,
                invitedBy = guest.invitedBy,
                guestType = guest.guestType,
                allowedGate = guest.allowedGate,
                status = guest.status,
                checkedInAtIso = guest.checkedInAt,
                notes = guest.notes,
            )
        }

        dao.replaceSnapshot(snapshot, tickets, vipGuests)
        return snapshot
    }

    suspend fun dashboardSnapshot(concertId: String): DashboardSnapshot {
        val tickets = dao.ticketListForConcert(concertId)
        val vipGuests = dao.vipGuestListForConcert(concertId)
        val pending = dao.pendingScanCount(concertId)
        val localAccepted = dao.acceptedScanCountForConcert(concertId)
        val checkedIn = tickets.count { it.status == "USED" || it.checkedInAtIso != null } + localAccepted
        val total = tickets.size
        return DashboardSnapshot(
            totalTickets = total,
            checkedInCount = checkedIn.coerceAtMost(total),
            remainingCount = (total - checkedIn).coerceAtLeast(0),
            vipGuestCount = vipGuests.size,
            pendingOfflineCount = pending,
        )
    }

    suspend fun recordScan(concertId: String, payload: String, gateName: String?): LocalScanOutcome {
        val normalizedInput = payload.trim()
        val snapshot = dao.snapshotForConcert(concertId)
        val ticket = dao.ticketByCodeOrQrHash(concertId, normalizedInput)
        val normalizedQrHash = ticket?.qrHash ?: normalizedInput
        val vipGuest = if (ticket == null) dao.vipGuestByQrHash(concertId, normalizedInput) else null
        val anyOtherTicket = if (ticket == null) dao.ticketByCodeOrQrHashAnyConcert(normalizedInput) else null
        val acceptedLocalScanCount = dao.acceptedLocalScanCount(concertId, normalizedQrHash)
        val previousScan = dao.previousAcceptedLocalScan(concertId, normalizedQrHash)
        val initialValidation = if (anyOtherTicket != null && anyOtherTicket.concertId != concertId) {
            com.ticketbox.checkin.domain.LocalValidationResult(
                entityType = com.ticketbox.checkin.domain.LocalEntityType.Ticket,
                result = LocalScanResult.Invalid,
                message = "Ticket belongs to a different event",
            )
        } else {
            validator.validate(
                snapshot = snapshot,
                ticket = ticket,
                vipGuest = vipGuest,
                acceptedLocalScanCount = acceptedLocalScanCount,
                nowEpochMillis = clock(),
            )
        }
        val validation = if (
            vipGuest?.allowedGate != null &&
            gateName != null &&
            !vipGuest.allowedGate.equals(gateName, ignoreCase = true) &&
            (
                initialValidation.result == LocalScanResult.Accepted ||
                    initialValidation.result == LocalScanResult.StaleSnapshot
            )
        ) {
            com.ticketbox.checkin.domain.LocalValidationResult(
                entityType = com.ticketbox.checkin.domain.LocalEntityType.VipGuest,
                result = LocalScanResult.Invalid,
                message = "VIP guest is assigned to ${vipGuest.allowedGate}",
            )
        } else {
            initialValidation
        }
        val scanLog = scanLogFactory.pending(
            sourceDeviceId = sessionStore.sourceDeviceId(),
            concertId = concertId,
            qrHash = normalizedQrHash,
            validationResult = validation,
            displayCode = ticket?.ticketCode ?: vipGuest?.externalGuestKey ?: normalizedInput,
            attendeeName = ticket?.attendeeName ?: vipGuest?.fullName,
            ticketTypeName = ticket?.ticketTypeName ?: vipGuest?.guestType,
            zoneOrSeat = ticket?.zoneOrSeat ?: vipGuest?.allowedGate,
            gateName = gateName,
            previousCheckInAtIso = ticket?.previousCheckInAtIso ?: previousScan?.scannedAtEpochMillis?.toString(),
            previousGateName = ticket?.previousGateName ?: previousScan?.gateName,
            previousStaffName = ticket?.previousStaffName,
        )

        dao.insertScanLog(scanLog)

        return LocalScanOutcome(
            scanLog = scanLog,
            result = validation.result,
            message = validation.message,
            ticket = ticket,
            vipGuest = vipGuest,
            previousScan = previousScan,
        )
    }

    suspend fun syncPending(concertId: String, batchSize: Int = 100): SyncSummary {
        val now = clock()
        val pending = dao.pendingScans(concertId, now, batchSize)

        if (pending.isEmpty()) {
            return SyncSummary(uploaded = 0, retrying = 0)
        }

        val request = ApiSyncRequest(
            sourceDeviceId = sessionStore.sourceDeviceId(),
            scans = pending.map { scan ->
                ApiSyncScan(
                    localScanId = scan.localScanId,
                    qrHash = scan.qrHash,
                    entityType = scan.entityType,
                    scannedAt = Instant.ofEpochMilli(scan.scannedAtEpochMillis).toString(),
                    mode = "offline",
                    localResult = scan.localResult,
                )
            },
        )

        try {
            val response = api.sync(concertId, request)
            for (outcome in response.outcomes) {
                val localScanId = outcome.localScanId ?: continue
                dao.markSynced(
                    localScanId = localScanId,
                    backendResultCode = outcome.resultCode,
                    backendStatus = outcome.status,
                    backendCheckInId = outcome.checkInId,
                    syncedAtIso = outcome.syncedAt ?: response.syncedAt,
                    serverCheckInAtIso = outcome.serverCheckInAt,
                    message = outcome.message,
                )
            }

            return SyncSummary(uploaded = response.outcomes.size, retrying = 0)
        } catch (error: HttpException) {
            if (!SyncRetryPolicy.shouldRetry(error.code())) {
                throw error
            }

            markBatchForRetry(pending, "HTTP ${error.code()} during sync")
            return SyncSummary(uploaded = 0, retrying = pending.size)
        } catch (error: java.io.IOException) {
            markBatchForRetry(pending, error.message ?: "Network unavailable during sync")
            return SyncSummary(uploaded = 0, retrying = pending.size)
        }
    }

    suspend fun snapshotForConcert(concertId: String): SnapshotEntity? = dao.snapshotForConcert(concertId)

    suspend fun scanLogById(localScanId: String): LocalScanLogEntity? = dao.scanLogById(localScanId)

    fun staffEmail(): String = sessionStore.staffEmail() ?: "Unknown staff"

    fun sourceDeviceId(): String = sessionStore.sourceDeviceId()

    fun logout() {
        sessionStore.clearSessionCredentials()
    }

    private suspend fun markBatchForRetry(pending: List<LocalScanLogEntity>, message: String) {
        val now = clock()
        for (scan in pending) {
            val delay = SyncRetryPolicy.nextRetryDelayMillis(scan.retryCount)
            dao.markRetry(scan.localScanId, now + delay, message)
        }
    }
}
