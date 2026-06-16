package com.ticketbox.checkin

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import com.ticketbox.checkin.data.CheckInRepository
import com.ticketbox.checkin.data.LocalScanOutcome
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
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class MobileScreensComposeTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun loginAndAssignedEventsScreensShowStaffOnlyEntryFlow() {
        var loginRequest: Pair<String, String>? = null

        composeRule.setContent {
            MaterialTheme {
                LoginScreen(
                    onLogin = { emailOrPhone, password -> loginRequest = emailOrPhone to password },
                    statusMessage = "Invalid login",
                )
            }
        }

        composeRule.onNodeWithText("Staff Check-in").assertIsDisplayed()
        composeRule.onNodeWithText("Invalid login").assertIsDisplayed()
        composeRule.onAllNodes(hasSetTextAction())[0].performTextInput("staff@example.test")
        composeRule.onAllNodes(hasSetTextAction())[1].performTextInput("CorrectHorse1!")
        composeRule.onNodeWithText("Log In").performClick()
        assertEquals("staff@example.test" to "CorrectHorse1!", loginRequest)

        composeRule.setContent {
            MaterialTheme {
                AssignedEventsScreen(
                    assignments = listOf(assignment()),
                    statusMessage = "Check-in Staff account required",
                    onRefresh = {},
                    onSelect = {},
                )
            }
        }

        composeRule.onNodeWithText("Assigned Events").assertIsDisplayed()
        composeRule.onNodeWithText("Check-in Staff account required").assertIsDisplayed()
        composeRule.onNodeWithText("TicketBox Live").assertIsDisplayed()
        composeRule.onNodeWithText("Gate: Gate A").assertIsDisplayed()
        composeRule.onNodeWithText("Other Concert").assertDoesNotExist()
    }

    @Test
    fun eventShellDashboardShowsBottomNavigationCountersAndActions() {
        var selectedTab: StaffTab? = null
        var syncQueuedFor: String? = null
        val repository = repository(
            tickets = listOf(
                ticket("ticket-1", "TICKET-001", "ACTIVE"),
                ticket("ticket-2", "TICKET-002", "USED", checkedInAtIso = "2026-06-15T10:00:00Z"),
            ),
            vipGuests = listOf(vipGuest("vip-1", "VIP Guest One")),
            scanLogs = listOf(scanLog("scan-1", "TICKET-001", "accepted", "pending")),
        )

        composeRule.setContent {
            MaterialTheme {
                EventShell(
                    repository = repository,
                    assignment = assignment(),
                    selectedTab = StaffTab.Dashboard,
                    isOnline = true,
                    statusMessage = "Ready",
                    enqueueSync = { syncQueuedFor = it },
                    onTabSelected = { selectedTab = it },
                    onOpenManualInput = {},
                    onShowResult = {},
                    onOpenSyncQueue = {},
                    onOpenConflict = {},
                    onSelectVipGuest = {},
                    onVipNotFound = {},
                    onSelectTab = { selectedTab = it },
                    onBackToAssignments = {},
                    onLogout = {},
                    updateStatus = {},
                )
            }
        }

        composeRule.onNodeWithText("Dashboard").assertExists()
        composeRule.onNodeWithText("Scan").assertExists()
        composeRule.onNodeWithText("VIP").assertExists()
        composeRule.onNodeWithText("History").assertExists()
        composeRule.onNodeWithText("Profile").assertExists()
        composeRule.onNodeWithText("TicketBox Live").assertIsDisplayed()
        composeRule.onNodeWithText("Saigon Arena / Gate A").assertIsDisplayed()
        composeRule.onNodeWithText("Tickets").assertIsDisplayed()
        composeRule.onNodeWithText("Checked In").assertIsDisplayed()
        composeRule.onNodeWithText("Remaining").assertIsDisplayed()
        composeRule.onNodeWithText("Online / Pending Sync / Pending 1").assertIsDisplayed()
        composeRule.onNodeWithText("Start QR Scan").performClick()
        assertEquals(StaffTab.Scan, selectedTab)

        composeRule.onNodeWithText("Sync Now").performScrollTo().performClick()
        assertEquals("concert-1", syncQueuedFor)
    }

    @Test
    fun scanAndManualInputScreensRouteValidationAndEmptyInput() {
        var manualOpened = false
        var scanOutcome: LocalScanOutcome? = null
        var manualCode: String? = null
        val repository = repository(tickets = listOf(ticket()))

        composeRule.setContent {
            MaterialTheme {
                ScanScreen(
                    repository = repository,
                    assignment = assignment(),
                    isOnline = false,
                    onOpenManualInput = { manualOpened = true },
                    onShowResult = { scanOutcome = it },
                )
            }
        }

        composeRule.onNodeWithText("QR Scan Area").assertIsDisplayed()
        composeRule.onNodeWithText("Offline").assertIsDisplayed()
        composeRule.onNodeWithText("Flash Off").performClick()
        composeRule.onNodeWithText("Flash On").assertIsDisplayed()
        composeRule.onNodeWithText("Manual").performClick()
        assertTrue(manualOpened)
        composeRule.onAllNodes(hasSetTextAction())[0].performTextInput("TICKET-001")
        composeRule.onNodeWithText("Validate").performClick()
        composeRule.waitUntil(timeoutMillis = 5_000) { scanOutcome != null }
        assertEquals(LocalScanResult.Accepted, scanOutcome?.result)

        composeRule.setContent {
            MaterialTheme {
                ManualInputScreen(
                    assignment = assignment(),
                    isOnline = true,
                    onBack = {},
                    onValidate = { manualCode = it },
                )
            }
        }

        composeRule.onNodeWithText("Manual Ticket Input").assertIsDisplayed()
        composeRule.onNodeWithText("Validate").performClick()
        composeRule.onNodeWithText("Ticket code is required").assertIsDisplayed()
        composeRule.onAllNodes(hasSetTextAction())[0].performTextInput("TICKET-001")
        composeRule.onNodeWithText("Validate").performClick()
        assertEquals("TICKET-001", manualCode)
    }

    @Test
    fun resultScreensSeparateValidInvalidAndDuplicateActions() {
        composeRule.setContent {
            MaterialTheme {
                TicketResultScreen(
                    assignment = assignment(),
                    outcome = outcome(LocalScanResult.Accepted, "accepted", "Local scan accepted"),
                    isOnline = true,
                    onConfirm = {},
                    onScanNext = {},
                    onManualInput = {},
                )
            }
        }

        composeRule.onNodeWithText("Valid Ticket").assertIsDisplayed()
        composeRule.onNodeWithText("Confirm Check-in").assertIsDisplayed()
        composeRule.onNodeWithText("TICKET-001").assertIsDisplayed()
        composeRule.onNodeWithText("Linh Nguyen").assertIsDisplayed()

        composeRule.setContent {
            MaterialTheme {
                TicketResultScreen(
                    assignment = assignment(),
                    outcome = outcome(LocalScanResult.Invalid, "invalid", "Ticket belongs to a different event"),
                    isOnline = true,
                    onConfirm = {},
                    onScanNext = {},
                    onManualInput = {},
                )
            }
        }

        composeRule.onNodeWithText("Invalid Ticket").assertIsDisplayed()
        composeRule.onNodeWithText("Ticket belongs to a different event").assertIsDisplayed()
        composeRule.onNodeWithText("Scan Again").assertIsDisplayed()
        composeRule.onNodeWithText("Manual Input").assertIsDisplayed()

        composeRule.setContent {
            MaterialTheme {
                TicketResultScreen(
                    assignment = assignment(),
                    outcome = outcome(LocalScanResult.Duplicate, "duplicate", "Already checked in"),
                    isOnline = true,
                    onConfirm = {},
                    onScanNext = {},
                    onManualInput = {},
                )
            }
        }

        composeRule.onNodeWithText("Duplicate").assertIsDisplayed()
        composeRule.onNodeWithText("Previous").assertIsDisplayed()
        composeRule.onNodeWithText("2026-06-15T10:00:00Z").assertIsDisplayed()
        composeRule.onNodeWithText("Previous staff").assertIsDisplayed()
        composeRule.onNodeWithText("Confirm Check-in").assertDoesNotExist()
    }

    @Test
    fun vipHistoryAndProfileScreensStayScopedToSelectedAssignment() {
        var logoutClicked = false
        val repository = repository(
            vipGuests = listOf(
                vipGuest("vip-1", "VIP Guest One", sponsorCompany = "TicketBox Partners", guestType = "Artist Guest"),
                vipGuest("vip-2", "VIP Guest Two", status = "CHECKED_IN", checkedInAtIso = "2026-06-15T10:00:00Z"),
            ),
            scanLogs = listOf(
                scanLog("scan-1", "TICKET-001", "accepted", "synced"),
                scanLog("scan-2", "TICKET-002", "duplicate", "synced"),
                scanLog("scan-3", "TICKET-003", "accepted", "pending"),
            ),
        )

        composeRule.setContent {
            MaterialTheme {
                VipScreen(
                    repository = repository,
                    assignment = assignment(),
                    onSelectGuest = {},
                    onNotFound = {},
                    updateStatus = {},
                )
            }
        }

        composeRule.onNodeWithText("VIP Guests").assertIsDisplayed()
        composeRule.onNodeWithText("Total VIP").assertIsDisplayed()
        composeRule.onNodeWithText("Remaining VIP").assertIsDisplayed()
        composeRule.onNodeWithText("VIP Guest One").performScrollTo().assertIsDisplayed()
        composeRule.onNodeWithText("TicketBox Partners").assertIsDisplayed()
        composeRule.onAllNodes(hasSetTextAction())[0].performTextInput("missing guest")
        composeRule.onNodeWithText("Guest Not Found").performScrollTo().assertIsDisplayed()

        composeRule.setContent {
            MaterialTheme {
                HistoryScreen(
                    repository = repository,
                    assignment = assignment(),
                    onOpenConflict = {},
                )
            }
        }

        composeRule.onNodeWithText("Scan History").assertIsDisplayed()
        composeRule.onNodeWithText("TICKET-001").performScrollTo().assertIsDisplayed()
        composeRule.onNodeWithText("Duplicate").performScrollTo().performClick()
        composeRule.onNodeWithText("TICKET-002").performScrollTo().assertIsDisplayed()

        composeRule.setContent {
            MaterialTheme {
                ProfileScreen(
                    repository = repository,
                    assignment = assignment(),
                    isOnline = false,
                    onBackToAssignments = {},
                    onLogout = { logoutClicked = true },
                )
            }
        }

        composeRule.onNodeWithText("Profile").assertIsDisplayed()
        composeRule.onNodeWithText("staff@example.test").assertIsDisplayed()
        composeRule.onNodeWithText("Check-in Staff").assertIsDisplayed()
        composeRule.onNodeWithText("Pending 1").assertIsDisplayed()
        composeRule.onNodeWithText("Preload retained").assertIsDisplayed()
        composeRule.onNodeWithText("Logout").performClick()
        assertTrue(logoutClicked)
    }

    @Test
    fun offlineNoticeResultQueueAndConflictScreensShowRecoveryActions() {
        var continuedOffline = false
        var openedQueue = false
        var syncQueuedFor: String? = null
        var openedConflict: LocalScanLogEntity? = null
        val conflictRecord = scanLog(
            localScanId = "scan-conflict",
            displayCode = "TICKET-004",
            localResult = "accepted",
            syncStatus = "conflict",
            message = "Ticket was already checked in on another device",
            backendResultCode = "conflict",
            serverCheckInAtIso = "2026-06-15T11:00:00Z",
        )
        val repository = repository(
            scanLogs = listOf(
                scanLog("scan-pending", "TICKET-001", "accepted", "pending"),
                scanLog("scan-failed", "TICKET-002", "accepted", "failed"),
                conflictRecord,
            ),
        )

        composeRule.setContent {
            MaterialTheme {
                OfflineModeNoticeScreen(
                    repository = repository,
                    assignment = assignment(),
                    onContinueOffline = { continuedOffline = true },
                    onViewSyncQueue = { openedQueue = true },
                )
            }
        }

        composeRule.onNodeWithText("Offline Mode").assertIsDisplayed()
        composeRule.onNodeWithText("Check-ins are saved on this device and synced later.").assertIsDisplayed()
        composeRule.onNodeWithText("Pending Sync").assertIsDisplayed()
        composeRule.onNodeWithText("2").assertIsDisplayed()
        composeRule.onNodeWithText("Continue Offline").performClick()
        composeRule.onNodeWithText("View Sync Queue").performClick()
        assertTrue(continuedOffline)
        assertTrue(openedQueue)

        composeRule.setContent {
            MaterialTheme {
                TicketResultScreen(
                    assignment = assignment(),
                    outcome = outcome(LocalScanResult.Accepted, "accepted", "Local scan accepted"),
                    isOnline = false,
                    onConfirm = {},
                    onScanNext = {},
                    onManualInput = {},
                )
            }
        }

        composeRule.onNodeWithText("Recorded Offline").assertIsDisplayed()
        composeRule.onNodeWithText("Pending Sync").assertIsDisplayed()
        composeRule.onNodeWithText("Final validation happens when network returns.").assertIsDisplayed()
        composeRule.onNodeWithText("Scan Next").assertIsDisplayed()
        composeRule.onNodeWithText("Confirm Check-in").assertDoesNotExist()

        composeRule.setContent {
            MaterialTheme {
                SyncQueueScreen(
                    repository = repository,
                    assignment = assignment(),
                    isOnline = false,
                    enqueueSync = { syncQueuedFor = it },
                    onBack = {},
                    onOpenConflict = { openedConflict = it },
                    updateStatus = {},
                )
            }
        }

        composeRule.onNodeWithText("Offline / Pending Sync / Pending 2").assertIsDisplayed()
        composeRule.onNodeWithText("Retry Sync").performClick()
        assertEquals("concert-1", syncQueuedFor)
        composeRule.onNodeWithText("TICKET-004").performScrollTo().performClick()
        assertEquals("scan-conflict", openedConflict?.localScanId)

        composeRule.setContent {
            MaterialTheme {
                SyncConflictScreen(
                    assignment = assignment(),
                    scan = conflictRecord,
                    onMarkConflict = {},
                    onContactSupervisor = {},
                    onBack = {},
                )
            }
        }

        composeRule.onNodeWithText("Sync Conflict").assertIsDisplayed()
        composeRule.onNodeWithText("Ticket was already checked in on another device").assertIsDisplayed()
        composeRule.onNodeWithText("2026-06-15T11:00:00Z").assertIsDisplayed()
        composeRule.onNodeWithText("Mark as Conflict").assertIsDisplayed()
        composeRule.onNodeWithText("Contact Supervisor").assertIsDisplayed()
    }

    @Test
    fun vipDetailAndResultScreensShowSuccessDuplicateAndNotFoundStates() {
        var confirmed = false
        val guest = vipGuest(
            id = "vip-1",
            fullName = "VIP Guest One",
            sponsorCompany = "TicketBox Partners",
            guestType = "Artist Guest",
        )

        composeRule.setContent {
            MaterialTheme {
                VipGuestDetailScreen(
                    assignment = assignment(),
                    guest = guest,
                    onBack = {},
                    onConfirm = { confirmed = true },
                )
            }
        }

        composeRule.onNodeWithText("VIP Guest One").assertIsDisplayed()
        composeRule.onNodeWithText("vip-1@example.test").assertIsDisplayed()
        composeRule.onNodeWithText("TicketBox Partners").assertIsDisplayed()
        composeRule.onNodeWithText("Artist Guest").assertIsDisplayed()
        composeRule.onNodeWithText("Confirm VIP Check-in").performClick()
        assertTrue(confirmed)

        composeRule.setContent {
            MaterialTheme {
                VipResultScreen(
                    assignment = assignment(),
                    state = VipResultState(
                        kind = VipResultKind.Success,
                        guest = guest,
                        outcome = outcome(LocalScanResult.Accepted, "accepted", "Local scan accepted"),
                    ),
                    onCheckNext = {},
                    onSearchAgain = {},
                    onContactSupervisor = {},
                )
            }
        }

        composeRule.onNodeWithText("VIP Checked In").assertIsDisplayed()
        composeRule.onNodeWithText("Check in next VIP guest").assertIsDisplayed()

        composeRule.setContent {
            MaterialTheme {
                VipResultScreen(
                    assignment = assignment(),
                    state = VipResultState(
                        kind = VipResultKind.Duplicate,
                        guest = guest,
                        outcome = outcome(LocalScanResult.Duplicate, "duplicate", "This guest was already checked in"),
                    ),
                    onCheckNext = {},
                    onSearchAgain = {},
                    onContactSupervisor = {},
                )
            }
        }

        composeRule.onNodeWithText("VIP Already Checked In").assertIsDisplayed()
        composeRule.onNodeWithText("This guest was already checked in").assertIsDisplayed()
        composeRule.onNodeWithText("Search Again").assertIsDisplayed()
        composeRule.onNodeWithText("Contact Supervisor").assertIsDisplayed()

        composeRule.setContent {
            MaterialTheme {
                VipResultScreen(
                    assignment = assignment(),
                    state = VipResultState(
                        kind = VipResultKind.NotFound,
                        query = "unknown@example.test",
                    ),
                    onCheckNext = {},
                    onSearchAgain = {},
                    onContactSupervisor = {},
                )
            }
        }

        composeRule.onNodeWithText("VIP Guest Not Found").assertIsDisplayed()
        composeRule.onNodeWithText("unknown@example.test").assertIsDisplayed()
        composeRule.onNodeWithText("Search Again").assertIsDisplayed()
        composeRule.onNodeWithText("Contact Supervisor").assertIsDisplayed()
    }

    private fun repository(
        tickets: List<PreloadedTicketEntity> = emptyList(),
        vipGuests: List<PreloadedVipGuestEntity> = emptyList(),
        scanLogs: List<LocalScanLogEntity> = emptyList(),
    ) = CheckInRepository(
        dao = UiFakeDao(
            assignments = listOf(assignment()),
            tickets = tickets,
            vipGuests = vipGuests,
            scanLogs = scanLogs,
        ),
        api = UiUnusedApiService,
        sessionStore = UiFakeSession(),
        clock = { 2_000L },
    )

    private fun assignment() = AssignmentEntity(
        assignmentId = "assignment-1",
        concertId = "concert-1",
        title = "TicketBox Live",
        venueName = "Saigon Arena",
        status = "PUBLISHED",
        gateName = "Gate A",
        sourceDeviceId = "device-1",
        startsAtIso = "2026-06-15T19:00:00Z",
        endsAtIso = null,
    )

    private fun ticket(
        id: String = "ticket-1",
        ticketCode: String = "TICKET-001",
        status: String = "ACTIVE",
        checkedInAtIso: String? = null,
    ) = PreloadedTicketEntity(
        id = id,
        concertId = "concert-1",
        ticketCode = ticketCode,
        qrHash = "QR-$ticketCode",
        status = status,
        issuedAtIso = "2026-06-15T09:00:00Z",
        checkedInAtIso = checkedInAtIso,
        attendeeName = "Linh Nguyen",
        zoneOrSeat = "Zone A",
        ticketTypeCode = "GA",
        ticketTypeName = "General Admission",
    )

    private fun vipGuest(
        id: String,
        fullName: String,
        status: String = "ACTIVE",
        checkedInAtIso: String? = null,
        sponsorCompany: String? = null,
        guestType: String? = null,
    ) = PreloadedVipGuestEntity(
        id = id,
        concertId = "concert-1",
        qrHash = "QR-$id",
        externalGuestKey = "INVITE-$id",
        fullName = fullName,
        email = "$id@example.test",
        phone = "+840000$id",
        sponsorCompany = sponsorCompany,
        guestType = guestType,
        allowedGate = "Gate A",
        status = status,
        checkedInAtIso = checkedInAtIso,
    )

    private fun outcome(
        result: LocalScanResult,
        localResult: String,
        message: String,
    ) = LocalScanOutcome(
        scanLog = scanLog(
            localScanId = "scan-result",
            displayCode = "TICKET-001",
            localResult = localResult,
            syncStatus = "pending",
            message = message,
            previousCheckInAtIso = "2026-06-15T10:00:00Z",
            previousGateName = "Gate A",
            previousStaffName = "staff@example.test",
        ),
        result = result,
        message = message,
    )

    private fun scanLog(
        localScanId: String,
        displayCode: String,
        localResult: String,
        syncStatus: String,
        message: String? = null,
        previousCheckInAtIso: String? = null,
        previousGateName: String? = null,
        previousStaffName: String? = null,
        backendResultCode: String? = null,
        serverCheckInAtIso: String? = null,
    ) = LocalScanLogEntity(
        localScanId = localScanId,
        sourceDeviceId = "device-1",
        concertId = "concert-1",
        qrHash = "QR-$displayCode",
        displayCode = displayCode,
        attendeeName = "Linh Nguyen",
        ticketTypeName = "General Admission",
        zoneOrSeat = "Zone A",
        gateName = "Gate A",
        previousCheckInAtIso = previousCheckInAtIso,
        previousGateName = previousGateName,
        previousStaffName = previousStaffName,
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
        serverCheckInAtIso = serverCheckInAtIso,
        message = message,
    )
}

private class UiFakeDao(
    assignments: List<AssignmentEntity>,
    tickets: List<PreloadedTicketEntity>,
    vipGuests: List<PreloadedVipGuestEntity>,
    scanLogs: List<LocalScanLogEntity>,
) : CheckInDao() {
    private val assignments = MutableStateFlow(assignments)
    private val tickets = MutableStateFlow(tickets)
    private val vipGuests = MutableStateFlow(vipGuests)
    private val scanLogs = MutableStateFlow(scanLogs)
    private val pendingCount = MutableStateFlow(countPending(scanLogs))
    private val snapshot = SnapshotEntity(
        concertId = "concert-1",
        version = "snapshot-1",
        generatedAtIso = "2026-06-15T09:00:00Z",
        storedAtEpochMillis = 1_000L,
    )

    override fun observeAssignments(): Flow<List<AssignmentEntity>> = assignments
    override suspend fun assignmentForConcert(concertId: String): AssignmentEntity? =
        assignments.value.firstOrNull { it.concertId == concertId }
    override suspend fun assignmentsForConcert(concertId: String): List<AssignmentEntity> =
        assignments.value.filter { it.concertId == concertId }
    override suspend fun upsertAssignments(assignments: List<AssignmentEntity>) {
        this.assignments.value = assignments
    }
    override suspend fun snapshotForConcert(concertId: String): SnapshotEntity? =
        snapshot.takeIf { it.concertId == concertId }
    override suspend fun upsertSnapshot(snapshot: SnapshotEntity) = Unit
    override suspend fun deleteTicketsForConcert(concertId: String) {
        tickets.value = tickets.value.filterNot { it.concertId == concertId }
    }
    override suspend fun deleteVipGuestsForConcert(concertId: String) {
        vipGuests.value = vipGuests.value.filterNot { it.concertId == concertId }
    }
    override suspend fun upsertTickets(tickets: List<PreloadedTicketEntity>) {
        this.tickets.value = this.tickets.value + tickets
    }
    override suspend fun upsertVipGuests(vipGuests: List<PreloadedVipGuestEntity>) {
        this.vipGuests.value = this.vipGuests.value + vipGuests
    }
    override suspend fun ticketByQrHash(concertId: String, qrHash: String): PreloadedTicketEntity? =
        tickets.value.firstOrNull { it.concertId == concertId && it.qrHash == qrHash }
    override suspend fun ticketByCodeOrQrHash(concertId: String, input: String): PreloadedTicketEntity? =
        tickets.value.firstOrNull { it.concertId == concertId && (it.qrHash == input || it.ticketCode == input) }
    override suspend fun ticketByCodeOrQrHashAnyConcert(input: String): PreloadedTicketEntity? =
        tickets.value.firstOrNull { it.qrHash == input || it.ticketCode == input }
    override fun observeTicketsForConcert(concertId: String): Flow<List<PreloadedTicketEntity>> =
        MutableStateFlow(tickets.value.filter { it.concertId == concertId })
    override suspend fun ticketListForConcert(concertId: String): List<PreloadedTicketEntity> =
        tickets.value.filter { it.concertId == concertId }
    override suspend fun vipGuestByQrHash(concertId: String, qrHash: String): PreloadedVipGuestEntity? =
        vipGuests.value.firstOrNull {
            it.concertId == concertId && (it.qrHash == qrHash || it.externalGuestKey == qrHash)
        }
    override fun observeVipGuestsForConcert(concertId: String): Flow<List<PreloadedVipGuestEntity>> =
        MutableStateFlow(vipGuests.value.filter { it.concertId == concertId })
    override suspend fun vipGuestListForConcert(concertId: String): List<PreloadedVipGuestEntity> =
        vipGuests.value.filter { it.concertId == concertId }
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
    override fun observePendingScanCount(concertId: String): Flow<Int> = pendingCount
    override suspend fun pendingScanCount(concertId: String): Int = pendingCount.value
    override suspend fun acceptedScanCountForConcert(concertId: String): Int =
        scanLogs.value.count { it.concertId == concertId && it.localResult in setOf("accepted", "stale_snapshot") }
    override suspend fun insertScanLog(scanLog: LocalScanLogEntity) {
        scanLogs.value = scanLogs.value + scanLog
        pendingCount.value = countPending(scanLogs.value)
    }
    override suspend fun pendingScans(
        concertId: String,
        nowEpochMillis: Long,
        limit: Int,
    ): List<LocalScanLogEntity> =
        scanLogs.value
            .filter { it.concertId == concertId && it.syncStatus in setOf("pending", "failed") }
            .take(limit)
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

    private fun countPending(scans: List<LocalScanLogEntity>): Int =
        scans.count { it.syncStatus in setOf("pending", "failed") }
}

private object UiUnusedApiService : CheckInApiService {
    override suspend fun login(request: ApiLoginRequest): ApiLoginResponse = error("Not used")
    override suspend fun me(): ApiStaffUser = error("Not used")
    override suspend fun assignments(): List<ApiAssignment> = error("Not used")
    override suspend fun preload(concertId: String): ApiPreloadResponse = error("Not used")
    override suspend fun sync(concertId: String, request: ApiSyncRequest): ApiSyncResponse = error("Not used")
}

private class UiFakeSession : StaffSession {
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
