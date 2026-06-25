package com.ticketbox.checkin

import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ticketbox.checkin.data.CheckInRepository
import com.ticketbox.checkin.data.LocalScanOutcome
import com.ticketbox.checkin.data.LoginOutcome
import com.ticketbox.checkin.data.local.AssignmentEntity
import com.ticketbox.checkin.data.local.CheckInDatabase
import com.ticketbox.checkin.data.local.LocalScanLogEntity
import com.ticketbox.checkin.data.local.PreloadedTicketEntity
import com.ticketbox.checkin.data.local.PreloadedVipGuestEntity
import com.ticketbox.checkin.data.network.CheckInApiClient
import com.ticketbox.checkin.data.session.StaffSessionStore
import com.ticketbox.checkin.domain.LocalScanResult
import com.ticketbox.checkin.domain.HistoryFilter
import com.ticketbox.checkin.domain.HistoryStatus
import com.ticketbox.checkin.domain.SyncQueueStatus
import com.ticketbox.checkin.domain.VipStatusFilter
import com.ticketbox.checkin.domain.deriveDashboardCounts
import com.ticketbox.checkin.domain.deriveVipDashboardCounts
import com.ticketbox.checkin.domain.filterScanHistory
import com.ticketbox.checkin.domain.filterVipGuests
import com.ticketbox.checkin.domain.historyStatus
import com.ticketbox.checkin.domain.syncQueueStatus
import com.ticketbox.checkin.domain.vipGuestTypes
import com.ticketbox.checkin.domain.vipSponsors
import com.ticketbox.checkin.sync.CheckInSyncWorker
import com.ticketbox.checkin.ui.scan.QrCameraPreview
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sessionStore = StaffSessionStore(this)
        val repository = CheckInRepository(
            dao = CheckInDatabase.get(this).checkInDao(),
            api = CheckInApiClient.create(sessionStore),
            sessionStore = sessionStore,
        )

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    StaffCheckInApp(
                        repository = repository,
                        sessionStore = sessionStore,
                        enqueueSync = { concertId -> CheckInSyncWorker.enqueue(this, concertId) },
                    )
                }
            }
        }
    }
}

private enum class AppStep {
    Login,
    Assignments,
    EventShell,
    ManualInput,
    Result,
    OfflineNotice,
    SyncQueue,
    SyncConflict,
    VipDetail,
    VipResult,
}

internal enum class StaffTab(val label: String) {
    Dashboard("Dashboard"),
    Scan("Scan"),
    Vip("VIP"),
    History("History"),
    Profile("Profile"),
}

internal enum class VipResultKind {
    Success,
    Duplicate,
    NotFound,
}

internal data class VipResultState(
    val kind: VipResultKind,
    val guest: PreloadedVipGuestEntity? = null,
    val outcome: LocalScanOutcome? = null,
    val query: String? = null,
)

@Composable
private fun StaffCheckInApp(
    repository: CheckInRepository,
    sessionStore: StaffSessionStore,
    enqueueSync: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val assignments by repository.observeAssignments().collectAsState(initial = emptyList())
    val isOnline by rememberIsOnline()
    var step by remember { mutableStateOf(if (sessionStore.isLoggedIn()) AppStep.Assignments else AppStep.Login) }
    var selectedAssignment by remember { mutableStateOf<AssignmentEntity?>(null) }
    var selectedTab by remember { mutableStateOf(StaffTab.Dashboard) }
    var statusMessage by remember { mutableStateOf("Ready") }
    var resultOutcome by remember { mutableStateOf<LocalScanOutcome?>(null) }
    var selectedSyncRecord by remember { mutableStateOf<LocalScanLogEntity?>(null) }
    var selectedVipGuest by remember { mutableStateOf<PreloadedVipGuestEntity?>(null) }
    var vipResultState by remember { mutableStateOf<VipResultState?>(null) }
    var offlineNoticeDismissedForConcert by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(sessionStore.isLoggedIn()) {
        if (sessionStore.isLoggedIn()) {
            runCatching { repository.refreshAssignments() }
        }
    }

    LaunchedEffect(isOnline, selectedAssignment?.concertId, step) {
        val assignment = selectedAssignment
        if (isOnline) {
            offlineNoticeDismissedForConcert = null
        } else if (
            assignment != null &&
            step == AppStep.EventShell &&
            offlineNoticeDismissedForConcert != assignment.concertId
        ) {
            step = AppStep.OfflineNotice
        }
    }

    when (step) {
        AppStep.Login -> LoginScreen(
            onLogin = { emailOrPhone, password ->
                scope.launch {
                    statusMessage = "Signing in"
                    when (val outcome = repository.login(emailOrPhone, password)) {
                        is LoginOutcome.Success -> {
                            statusMessage = "Signed in"
                            selectedAssignment = outcome.assignments.firstOrNull()
                            step = AppStep.Assignments
                        }
                        LoginOutcome.InvalidCredentials -> statusMessage = "Invalid login"
                        LoginOutcome.PermissionDenied -> statusMessage = "Check-in Staff account required"
                        is LoginOutcome.Failure -> statusMessage = outcome.message
                    }
                }
            },
            statusMessage = statusMessage,
        )
        AppStep.Assignments -> AssignedEventsScreen(
            assignments = assignments,
            statusMessage = statusMessage,
            onRefresh = {
                scope.launch {
                    statusMessage = runCatching {
                        repository.refreshAssignments()
                        "Assignments refreshed"
                    }.getOrElse { it.message ?: "Could not load assignments" }
                }
            },
            onSelect = { assignment ->
                selectedAssignment = assignment
                selectedTab = StaffTab.Dashboard
                scope.launch {
                    statusMessage = runCatching {
                        repository.preload(assignment.concertId)
                        "Event ready"
                    }.getOrElse { it.message ?: "Preload failed" }
                    step = AppStep.EventShell
                }
            },
        )
        AppStep.EventShell -> {
            val assignment = selectedAssignment
            if (assignment == null) {
                step = AppStep.Assignments
            } else {
                EventShell(
                    repository = repository,
                    assignment = assignment,
                    selectedTab = selectedTab,
                    isOnline = isOnline,
                    statusMessage = statusMessage,
                    enqueueSync = enqueueSync,
                    onTabSelected = { selectedTab = it },
                    onOpenManualInput = { step = AppStep.ManualInput },
                    onShowResult = {
                        if (it.result == LocalScanResult.Accepted || it.result == LocalScanResult.StaleSnapshot) {
                            enqueueSync(assignment.concertId)
                        }
                        resultOutcome = it
                        step = AppStep.Result
                    },
                    onOpenSyncQueue = { step = AppStep.SyncQueue },
                    onOpenConflict = {
                        selectedSyncRecord = it
                        step = AppStep.SyncConflict
                    },
                    onSelectVipGuest = {
                        selectedVipGuest = it
                        step = AppStep.VipDetail
                    },
                    onVipNotFound = { query ->
                        vipResultState = VipResultState(kind = VipResultKind.NotFound, query = query)
                        step = AppStep.VipResult
                    },
                    onSelectTab = {
                        selectedTab = it
                        step = AppStep.EventShell
                    },
                    onBackToAssignments = { step = AppStep.Assignments },
                    onLogout = {
                        repository.logout()
                        selectedAssignment = null
                        resultOutcome = null
                        selectedSyncRecord = null
                        selectedVipGuest = null
                        vipResultState = null
                        statusMessage = "Logged out"
                        step = AppStep.Login
                    },
                    updateStatus = { statusMessage = it },
                )
            }
        }
        AppStep.ManualInput -> {
            val assignment = selectedAssignment
            if (assignment == null) {
                step = AppStep.Assignments
            } else {
                ManualInputScreen(
                    assignment = assignment,
                    isOnline = isOnline,
                    onBack = { step = AppStep.EventShell },
                    onValidate = { code ->
                        scope.launch {
                            val outcome = repository.recordScan(
                                concertId = assignment.concertId,
                                payload = code,
                                gateName = assignment.gateName,
                            )
                            if (
                                outcome.result == LocalScanResult.Accepted ||
                                outcome.result == LocalScanResult.StaleSnapshot
                            ) {
                                enqueueSync(assignment.concertId)
                            }
                            resultOutcome = outcome
                            step = AppStep.Result
                        }
                    },
                )
            }
        }
        AppStep.Result -> {
            val assignment = selectedAssignment
            val outcome = resultOutcome
            if (assignment == null || outcome == null) {
                step = AppStep.EventShell
            } else {
                TicketResultScreen(
                    assignment = assignment,
                    outcome = outcome,
                    isOnline = isOnline,
                    onConfirm = {
                        enqueueSync(assignment.concertId)
                        statusMessage = "Check-in queued"
                    },
                    onScanNext = {
                        selectedTab = StaffTab.Scan
                        step = AppStep.EventShell
                    },
                    onManualInput = { step = AppStep.ManualInput },
                )
            }
        }
        AppStep.OfflineNotice -> {
            val assignment = selectedAssignment
            if (assignment == null) {
                step = AppStep.Assignments
            } else {
                OfflineModeNoticeScreen(
                    repository = repository,
                    assignment = assignment,
                    onContinueOffline = {
                        offlineNoticeDismissedForConcert = assignment.concertId
                        selectedTab = StaffTab.Scan
                        step = AppStep.EventShell
                    },
                    onViewSyncQueue = {
                        offlineNoticeDismissedForConcert = assignment.concertId
                        step = AppStep.SyncQueue
                    },
                )
            }
        }
        AppStep.SyncQueue -> {
            val assignment = selectedAssignment
            if (assignment == null) {
                step = AppStep.Assignments
            } else {
                SyncQueueScreen(
                    repository = repository,
                    assignment = assignment,
                    isOnline = isOnline,
                    enqueueSync = enqueueSync,
                    onBack = { step = AppStep.EventShell },
                    onOpenConflict = {
                        selectedSyncRecord = it
                        step = AppStep.SyncConflict
                    },
                    updateStatus = { statusMessage = it },
                )
            }
        }
        AppStep.SyncConflict -> {
            val assignment = selectedAssignment
            val scan = selectedSyncRecord
            if (assignment == null || scan == null) {
                step = AppStep.SyncQueue
            } else {
                SyncConflictScreen(
                    assignment = assignment,
                    scan = scan,
                    onMarkConflict = {
                        statusMessage = "Conflict marked"
                        step = AppStep.SyncQueue
                    },
                    onContactSupervisor = {
                        statusMessage = "Supervisor review needed"
                        step = AppStep.SyncQueue
                    },
                    onBack = { step = AppStep.SyncQueue },
                )
            }
        }
        AppStep.VipDetail -> {
            val assignment = selectedAssignment
            val guest = selectedVipGuest
            if (assignment == null || guest == null) {
                step = AppStep.EventShell
            } else {
                VipGuestDetailScreen(
                    assignment = assignment,
                    guest = guest,
                    onBack = { step = AppStep.EventShell },
                    onConfirm = {
                        scope.launch {
                            val payload = guest.qrHash ?: guest.externalGuestKey ?: guest.fullName
                            val outcome = repository.recordScan(
                                concertId = assignment.concertId,
                                payload = payload,
                                gateName = assignment.gateName,
                            )
                            if (
                                outcome.result == LocalScanResult.Accepted ||
                                outcome.result == LocalScanResult.StaleSnapshot
                            ) {
                                enqueueSync(assignment.concertId)
                            }
                            vipResultState = VipResultState(
                                kind = if (
                                    outcome.result == LocalScanResult.Accepted ||
                                    outcome.result == LocalScanResult.StaleSnapshot
                                ) {
                                    VipResultKind.Success
                                } else if (outcome.result == LocalScanResult.Duplicate) {
                                    VipResultKind.Duplicate
                                } else {
                                    VipResultKind.NotFound
                                },
                                guest = guest,
                                outcome = outcome,
                            )
                            step = AppStep.VipResult
                        }
                    },
                )
            }
        }
        AppStep.VipResult -> {
            val assignment = selectedAssignment
            val state = vipResultState
            if (assignment == null || state == null) {
                step = AppStep.EventShell
            } else {
                VipResultScreen(
                    assignment = assignment,
                    state = state,
                    onCheckNext = {
                        selectedTab = StaffTab.Vip
                        step = AppStep.EventShell
                    },
                    onSearchAgain = {
                        selectedTab = StaffTab.Vip
                        step = AppStep.EventShell
                    },
                    onContactSupervisor = {
                        statusMessage = "Supervisor review needed"
                        selectedTab = StaffTab.Vip
                        step = AppStep.EventShell
                    },
                )
            }
        }
    }
}

@Composable
internal fun LoginScreen(
    onLogin: (String, String) -> Unit,
    statusMessage: String,
) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Text("Staff Check-in", style = MaterialTheme.typography.headlineMedium)
        }
        item {
            OutlinedTextField(
                value = identifier,
                onValueChange = { identifier = it },
                label = { Text("Email or phone") },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None),
            )
        }
        item {
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = PasswordVisualTransformation(),
            )
        }
        item {
            Button(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                onClick = { onLogin(identifier, password) },
                enabled = identifier.isNotBlank() && password.isNotBlank(),
            ) {
                Text("Log In")
            }
        }
        item {
            StatusBanner(statusMessage)
        }
    }
}

@Composable
internal fun AssignedEventsScreen(
    assignments: List<AssignmentEntity>,
    statusMessage: String,
    onRefresh: () -> Unit,
    onSelect: (AssignmentEntity) -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Assigned Events", style = MaterialTheme.typography.headlineSmall)
                OutlinedButton(onClick = onRefresh) {
                    Text("Refresh")
                }
            }
        }
        item {
            StatusBanner(statusMessage)
        }
        if (assignments.isEmpty()) {
            item {
                EmptyState("No assigned events")
            }
        } else {
            items(assignments, key = { it.assignmentId }) { assignment ->
                EventCard(assignment = assignment, onClick = { onSelect(assignment) })
            }
        }
    }
}

@Composable
internal fun EventShell(
    repository: CheckInRepository,
    assignment: AssignmentEntity,
    selectedTab: StaffTab,
    isOnline: Boolean,
    statusMessage: String,
    enqueueSync: (String) -> Unit,
    onTabSelected: (StaffTab) -> Unit,
    onOpenManualInput: () -> Unit,
    onShowResult: (LocalScanOutcome) -> Unit,
    onOpenSyncQueue: () -> Unit,
    onOpenConflict: (LocalScanLogEntity) -> Unit,
    onSelectVipGuest: (PreloadedVipGuestEntity) -> Unit,
    onVipNotFound: (String) -> Unit,
    onSelectTab: (StaffTab) -> Unit,
    onBackToAssignments: () -> Unit,
    onLogout: () -> Unit,
    updateStatus: (String) -> Unit,
) {
    Scaffold(
        bottomBar = {
            NavigationBar {
                StaffTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { onTabSelected(tab) },
                        label = { Text(tab.label) },
                        icon = { Text(tab.label.first().toString()) },
                    )
                }
            }
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when (selectedTab) {
                StaffTab.Dashboard -> DashboardScreen(
                    repository = repository,
                    assignment = assignment,
                    isOnline = isOnline,
                    statusMessage = statusMessage,
                    enqueueSync = enqueueSync,
                    onStartScan = { onSelectTab(StaffTab.Scan) },
                    onVip = { onSelectTab(StaffTab.Vip) },
                    onHistory = { onSelectTab(StaffTab.History) },
                    onOpenSyncQueue = onOpenSyncQueue,
                    updateStatus = updateStatus,
                )
                StaffTab.Scan -> ScanScreen(
                    repository = repository,
                    assignment = assignment,
                    isOnline = isOnline,
                    onOpenManualInput = onOpenManualInput,
                    onShowResult = onShowResult,
                )
                StaffTab.Vip -> VipScreen(
                    repository = repository,
                    assignment = assignment,
                    onSelectGuest = onSelectVipGuest,
                    onNotFound = onVipNotFound,
                    updateStatus = updateStatus,
                )
                StaffTab.History -> HistoryScreen(
                    repository = repository,
                    assignment = assignment,
                    onOpenConflict = onOpenConflict,
                )
                StaffTab.Profile -> ProfileScreen(
                    repository = repository,
                    assignment = assignment,
                    isOnline = isOnline,
                    onBackToAssignments = onBackToAssignments,
                    onLogout = onLogout,
                )
            }
        }
    }
}

@Composable
internal fun DashboardScreen(
    repository: CheckInRepository,
    assignment: AssignmentEntity,
    isOnline: Boolean,
    statusMessage: String,
    enqueueSync: (String) -> Unit,
    onStartScan: () -> Unit,
    onVip: () -> Unit,
    onHistory: () -> Unit,
    onOpenSyncQueue: () -> Unit,
    updateStatus: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val tickets by repository.observeTickets(assignment.concertId).collectAsState(initial = emptyList())
    val vipGuests by repository.observeVipGuests(assignment.concertId).collectAsState(initial = emptyList())
    val history by repository.observeScanHistory(assignment.concertId).collectAsState(initial = emptyList())
    val pendingCount by repository.observePendingScanCount(assignment.concertId).collectAsState(initial = 0)
    val counts = deriveDashboardCounts(tickets, vipGuests, history)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { EventHeader(assignment) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Tickets", counts.totalTickets.toString(), Modifier.weight(1f))
                StatCard("Checked In", counts.checkedInTickets.toString(), Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Remaining", counts.remainingTickets.toString(), Modifier.weight(1f))
                StatCard("VIP", counts.vipGuests.toString(), Modifier.weight(1f))
            }
        }
        item {
            SyncStatusBanner(isOnline = isOnline, pendingCount = pendingCount)
        }
        item {
            PrimaryAction("Start QR Scan", onStartScan)
            Spacer(Modifier.height(8.dp))
            SecondaryAction("VIP Guest List", onVip)
            Spacer(Modifier.height(8.dp))
            SecondaryAction("Scan History", onHistory)
            Spacer(Modifier.height(8.dp))
            SecondaryAction("Sync Queue", onOpenSyncQueue)
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                modifier = Modifier.fillMaxWidth().height(52.dp),
                onClick = {
                    enqueueSync(assignment.concertId)
                    updateStatus("Sync queued")
                },
            ) {
                Text("Sync Now")
            }
        }
        item {
            StatusBanner(statusMessage)
        }
        item {
            LaunchedEffect(assignment.concertId, tickets.size, vipGuests.size, history.size, pendingCount) {
                runCatching { repository.dashboardSnapshot(assignment.concertId) }
            }
        }
    }
}

@Composable
internal fun ScanScreen(
    repository: CheckInRepository,
    assignment: AssignmentEntity,
    isOnline: Boolean,
    onOpenManualInput: () -> Unit,
    onShowResult: (LocalScanOutcome) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var payload by remember { mutableStateOf("") }
    var flashEnabled by remember { mutableStateOf(false) }
    var scanningEnabled by remember { mutableStateOf(true) }
    var isValidating by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { EventHeader(assignment) }
        item { StatusBanner(if (isOnline) "Online" else "Offline") }
        item {
            QrCameraPreview(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(260.dp),
                torchEnabled = flashEnabled,
                scanningEnabled = scanningEnabled && !isValidating,
                onQrDetected = { scannedValue ->
                    payload = scannedValue
                    scanningEnabled = false
                    error = null
                },
                onCameraError = { message ->
                    error = message
                },
            )
        }
        item {
            OutlinedTextField(
                value = payload,
                onValueChange = { value ->
                    payload = value
                    scanningEnabled = value.isBlank()
                    error = null
                },
                label = { Text("Scanned QR or ticket code") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    modifier = Modifier.weight(1f).height(52.dp),
                    onClick = { flashEnabled = !flashEnabled },
                ) {
                    Text(if (flashEnabled) "Turn Flash Off" else "Turn Flash On")
                }
                OutlinedButton(
                    modifier = Modifier.weight(1f).height(52.dp),
                    onClick = onOpenManualInput,
                ) {
                    Text("Manual")
                }
            }
        }
        item {
            Button(
                modifier = Modifier.fillMaxWidth().height(56.dp),
                enabled = payload.isNotBlank() && !isValidating,
                onClick = {
                    val input = payload.trim()
                    if (input.isBlank()) {
                        error = "Enter or scan a code"
                        return@Button
                    }

                    scope.launch {
                        isValidating = true
                        runCatching {
                            repository.recordScan(
                                concertId = assignment.concertId,
                                payload = input,
                                gateName = assignment.gateName,
                            )
                        }.onSuccess { outcome ->
                            payload = ""
                            onShowResult(outcome)
                        }.onFailure { throwable ->
                            error = throwable.message ?: "Could not validate QR code"
                            scanningEnabled = true
                        }
                        isValidating = false
                    }
                },
            ) {
                Text(if (isValidating) "Validating..." else "Validate")
            }
        }
        error?.let { message ->
            item { StatusBanner(message, Color(0xFFFFEBEE)) }
        }
    }
}

@Composable
internal fun ManualInputScreen(
    assignment: AssignmentEntity,
    isOnline: Boolean,
    onBack: () -> Unit,
    onValidate: (String) -> Unit,
) {
    var code by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { EventHeader(assignment) }
        item { StatusBanner(if (isOnline) "Online" else "Offline") }
        item {
            Text("Manual Ticket Input", style = MaterialTheme.typography.headlineSmall)
        }
        item {
            OutlinedTextField(
                value = code,
                onValueChange = {
                    code = it
                    error = null
                },
                label = { Text("Ticket code") },
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Button(
                modifier = Modifier.fillMaxWidth().height(56.dp),
                onClick = {
                    if (code.isBlank()) {
                        error = "Ticket code is required"
                    } else {
                        onValidate(code)
                    }
                },
            ) {
                Text("Validate")
            }
        }
        item {
            OutlinedButton(modifier = Modifier.fillMaxWidth().height(52.dp), onClick = onBack) {
                Text("Back to Scan")
            }
        }
        error?.let { item { StatusBanner(it, Color(0xFFFFEBEE)) } }
    }
}

@Composable
internal fun OfflineModeNoticeScreen(
    repository: CheckInRepository,
    assignment: AssignmentEntity,
    onContinueOffline: () -> Unit,
    onViewSyncQueue: () -> Unit,
) {
    val pendingCount by repository.observePendingScanCount(assignment.concertId).collectAsState(initial = 0)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { EventHeader(assignment) }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFE3F2FD))) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("Offline Mode", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text("Check-ins are saved on this device and synced later.")
                    DetailRow("Pending Sync", pendingCount.toString())
                }
            }
        }
        item { PrimaryAction("Continue Offline", onContinueOffline) }
        item { SecondaryAction("View Sync Queue", onViewSyncQueue) }
    }
}

@Composable
internal fun SyncQueueScreen(
    repository: CheckInRepository,
    assignment: AssignmentEntity,
    isOnline: Boolean,
    enqueueSync: (String) -> Unit,
    onBack: () -> Unit,
    onOpenConflict: (LocalScanLogEntity) -> Unit,
    updateStatus: (String) -> Unit,
) {
    val queue by repository.observeSyncQueue(assignment.concertId).collectAsState(initial = emptyList())
    val pendingCount by repository.observePendingScanCount(assignment.concertId).collectAsState(initial = 0)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { EventHeader(assignment) }
        item { SyncStatusBanner(isOnline = isOnline, pendingCount = pendingCount) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    modifier = Modifier.weight(1f).height(52.dp),
                    onClick = {
                        enqueueSync(assignment.concertId)
                        updateStatus("Retry sync queued")
                    },
                    enabled = pendingCount > 0,
                ) {
                    Text("Retry Sync")
                }
                OutlinedButton(modifier = Modifier.weight(1f).height(52.dp), onClick = onBack) {
                    Text("Back")
                }
            }
        }
        if (queue.isEmpty()) {
            item { EmptyState("No sync records") }
        } else {
            items(queue, key = { it.localScanId }) { scan ->
                SyncQueueRow(
                    scan = scan,
                    onClick = {
                        if (syncQueueStatus(scan) == SyncQueueStatus.Conflict) {
                            onOpenConflict(scan)
                        }
                    },
                )
            }
        }
    }
}

@Composable
internal fun SyncConflictScreen(
    assignment: AssignmentEntity,
    scan: LocalScanLogEntity,
    onMarkConflict: () -> Unit,
    onContactSupervisor: () -> Unit,
    onBack: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { EventHeader(assignment) }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0))) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("Sync Conflict", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(scan.message ?: "Ticket was already checked in on another device.")
                    DetailRow("Ticket", scan.displayCode ?: scan.qrHash)
                    DetailRow("Local Time", scan.scannedAtEpochMillis.toString())
                    DetailRow("Server Time", scan.serverCheckInAtIso ?: scan.syncedAtIso ?: "Unavailable")
                    DetailRow("Gate", scan.gateName ?: "Any gate")
                }
            }
        }
        item { PrimaryAction("Mark as Conflict", onMarkConflict) }
        item { SecondaryAction("Contact Supervisor", onContactSupervisor) }
        item { SecondaryAction("Back", onBack) }
    }
}

@Composable
internal fun TicketResultScreen(
    assignment: AssignmentEntity,
    outcome: LocalScanOutcome,
    isOnline: Boolean,
    onConfirm: () -> Unit,
    onScanNext: () -> Unit,
    onManualInput: () -> Unit,
) {
    val isSuccess = outcome.result == LocalScanResult.Accepted || outcome.result == LocalScanResult.StaleSnapshot
    val isDuplicate = outcome.result == LocalScanResult.Duplicate
    val isOfflinePending = isSuccess && !isOnline
    val background = when {
        isOfflinePending -> Color(0xFFE3F2FD)
        isSuccess -> Color(0xFFE8F5E9)
        isDuplicate -> Color(0xFFFFF3E0)
        else -> Color(0xFFFFEBEE)
    }
    val title = when {
        isOfflinePending -> "Recorded Offline"
        isSuccess -> "Valid Ticket"
        isDuplicate -> "Duplicate"
        else -> "Invalid Ticket"
    }
    val displayCode = outcome.scanLog.displayCode ?: outcome.scanLog.qrHash

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            TicketResultCard(background = background) {
                Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                if (isOfflinePending) {
                    StatusBadge("Pending Sync")
                }
                Text(outcome.message)
                DetailRow("Ticket", displayCode)
                DetailRow("Attendee", outcome.scanLog.attendeeName ?: "Unknown")
                DetailRow("Type", outcome.scanLog.ticketTypeName ?: "N/A")
                DetailRow("Zone/Seat", outcome.scanLog.zoneOrSeat ?: outcome.scanLog.ticketTypeName ?: "N/A")
                DetailRow("Event", assignment.title)
                DetailRow("Gate", assignment.gateName ?: "Any gate")
                if (isDuplicate) {
                    DetailRow(
                        "Previous",
                        outcome.scanLog.previousCheckInAtIso
                            ?: outcome.previousScan?.scannedAtEpochMillis?.toString()
                            ?: "Already checked in",
                    )
                    DetailRow("Previous gate", outcome.scanLog.previousGateName ?: "Unknown")
                    DetailRow("Previous staff", outcome.scanLog.previousStaffName ?: "Unknown")
                }
                if (isOfflinePending) {
                    Text("Final validation happens when network returns.")
                }
            }
        }
        if (isSuccess && isOnline) {
            item {
                Button(
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    onClick = onConfirm,
                ) {
                    Text("Confirm Check-in")
                }
            }
            item {
                OutlinedButton(modifier = Modifier.fillMaxWidth().height(52.dp), onClick = onScanNext) {
                    Text("Scan Next")
                }
            }
        } else if (isSuccess) {
            item {
                Button(modifier = Modifier.fillMaxWidth().height(56.dp), onClick = onScanNext) {
                    Text("Scan Next")
                }
            }
        } else {
            item {
                Button(modifier = Modifier.fillMaxWidth().height(56.dp), onClick = onScanNext) {
                    Text(if (isDuplicate) "Scan Next" else "Scan Again")
                }
            }
            if (!isDuplicate) {
                item {
                    OutlinedButton(modifier = Modifier.fillMaxWidth().height(52.dp), onClick = onManualInput) {
                        Text("Manual Input")
                    }
                }
            }
        }
    }
}

@Composable
internal fun VipScreen(
    repository: CheckInRepository,
    assignment: AssignmentEntity,
    onSelectGuest: (PreloadedVipGuestEntity) -> Unit,
    onNotFound: (String) -> Unit,
    updateStatus: (String) -> Unit,
) {
    val guests by repository.observeVipGuests(assignment.concertId).collectAsState(initial = emptyList())
    var query by remember { mutableStateOf("") }
    var sponsorFilter by remember { mutableStateOf<String?>(null) }
    var typeFilter by remember { mutableStateOf<String?>(null) }
    var statusFilter by remember { mutableStateOf(VipStatusFilter.All) }
    val counts = deriveVipDashboardCounts(guests)
    val sponsors = vipSponsors(guests)
    val guestTypes = vipGuestTypes(guests)
    val filteredGuests = filterVipGuests(
        guests = guests,
        query = query,
        sponsor = sponsorFilter,
        guestType = typeFilter,
        statusFilter = statusFilter,
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { EventHeader(assignment) }
        item { Text("VIP Guests", style = MaterialTheme.typography.headlineSmall) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Total VIP", counts.total.toString(), Modifier.weight(1f))
                StatCard("Checked In", counts.checkedIn.toString(), Modifier.weight(1f))
            }
        }
        item {
            StatCard("Remaining VIP", counts.remaining.toString(), Modifier.fillMaxWidth())
        }
        item {
            SearchBar(
                value = query,
                onValueChange = { query = it },
                label = "Search name, phone, email, invite",
            )
        }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(VipStatusFilter.entries, key = { it.name }) { filter ->
                    FilterButton(
                        label = filter.label,
                        selected = statusFilter == filter,
                        onClick = { statusFilter = filter },
                    )
                }
            }
        }
        if (sponsors.isNotEmpty()) {
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        FilterButton(
                            label = "All Sponsors",
                            selected = sponsorFilter == null,
                            onClick = { sponsorFilter = null },
                        )
                    }
                    items(sponsors, key = { it }) { sponsor ->
                        FilterButton(
                            label = sponsor,
                            selected = sponsorFilter == sponsor,
                            onClick = { sponsorFilter = sponsor },
                        )
                    }
                }
            }
        }
        if (guestTypes.isNotEmpty()) {
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        FilterButton(
                            label = "All Types",
                            selected = typeFilter == null,
                            onClick = { typeFilter = null },
                        )
                    }
                    items(guestTypes, key = { it }) { guestType ->
                        FilterButton(
                            label = guestType,
                            selected = typeFilter == guestType,
                            onClick = { typeFilter = guestType },
                        )
                    }
                }
            }
        }
        if (guests.isEmpty()) {
            item { EmptyState("No VIP guests loaded") }
        } else if (filteredGuests.isEmpty()) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0))) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text("Guest Not Found", style = MaterialTheme.typography.titleLarge)
                        Text("No VIP guest matches this search.")
                        PrimaryAction("Search Again") {
                            query = ""
                            sponsorFilter = null
                            typeFilter = null
                            statusFilter = VipStatusFilter.All
                        }
                        SecondaryAction("Contact Supervisor") {
                            updateStatus("Supervisor review needed")
                            onNotFound(query.ifBlank { "VIP guest" })
                        }
                    }
                }
            }
        } else {
            items(filteredGuests, key = { it.id }) { guest ->
                VipGuestRow(guest, onClick = { onSelectGuest(guest) })
            }
        }
    }
}

@Composable
internal fun HistoryScreen(
    repository: CheckInRepository,
    assignment: AssignmentEntity,
    onOpenConflict: (LocalScanLogEntity) -> Unit,
) {
    val history by repository.observeScanHistory(assignment.concertId).collectAsState(initial = emptyList())
    var query by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf(HistoryFilter.All) }
    val filteredHistory = filterScanHistory(history, filter, query)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { EventHeader(assignment) }
        item { Text("Scan History", style = MaterialTheme.typography.headlineSmall) }
        item {
            SearchBar(
                value = query,
                onValueChange = { query = it },
                label = "Search ticket code",
            )
        }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(HistoryFilter.entries, key = { it.name }) { option ->
                    FilterButton(
                        label = option.label,
                        selected = filter == option,
                        onClick = { filter = option },
                    )
                }
            }
        }
        if (history.isEmpty()) {
            item { EmptyState("No scans yet") }
        } else if (filteredHistory.isEmpty()) {
            item { EmptyState("No matching scans") }
        } else {
            items(filteredHistory, key = { it.localScanId }) { scan ->
                HistoryRow(
                    scan = scan,
                    onClick = {
                        if (historyStatus(scan) == HistoryStatus.Conflict) {
                            onOpenConflict(scan)
                        }
                    },
                )
            }
        }
    }
}

@Composable
internal fun ProfileScreen(
    repository: CheckInRepository,
    assignment: AssignmentEntity,
    isOnline: Boolean,
    onBackToAssignments: () -> Unit,
    onLogout: () -> Unit,
) {
    val pendingCount by repository.observePendingScanCount(assignment.concertId).collectAsState(initial = 0)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Text("Profile", style = MaterialTheme.typography.headlineSmall) }
        item {
            Card {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    DetailRow("Staff", repository.staffEmail())
                    DetailRow("Role", "Check-in Staff")
                    DetailRow("Event", assignment.title)
                    DetailRow("Gate", assignment.gateName ?: "Any gate")
                    DetailRow("Device", repository.sourceDeviceId())
                    DetailRow("App", BuildConfig.VERSION_NAME)
                    DetailRow("Network", if (isOnline) "Online" else "Offline")
                    DetailRow("Sync", if (pendingCount > 0) "Pending $pendingCount" else "Synced")
                    DetailRow("Cache", "Preload retained")
                }
            }
        }
        item {
            OutlinedButton(modifier = Modifier.fillMaxWidth().height(52.dp), onClick = onBackToAssignments) {
                Text("Change Event")
            }
        }
        item {
            Button(modifier = Modifier.fillMaxWidth().height(56.dp), onClick = onLogout) {
                Text("Logout")
            }
        }
    }
}

@Composable
internal fun VipGuestDetailScreen(
    assignment: AssignmentEntity,
    guest: PreloadedVipGuestEntity,
    onBack: () -> Unit,
    onConfirm: () -> Unit,
) {
    val sponsor = guest.sponsorCompany ?: guest.invitedBy ?: guest.sponsorSource
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { EventHeader(assignment) }
        item {
            Card {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(guest.fullName, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    DetailRow("Phone", guest.phone ?: "N/A")
                    DetailRow("Email", guest.email ?: "N/A")
                    DetailRow("Sponsor", sponsor)
                    DetailRow("Invited By", guest.invitedBy ?: "N/A")
                    DetailRow("Type", guest.guestType ?: "VIP")
                    DetailRow("Allowed Gate", guest.allowedGate ?: assignment.gateName ?: "Any gate")
                    DetailRow("Status", guest.status)
                    DetailRow("Notes", guest.notes ?: "N/A")
                }
            }
        }
        item {
            Button(
                modifier = Modifier.fillMaxWidth().height(56.dp),
                onClick = onConfirm,
            ) {
                Text("Confirm VIP Check-in")
            }
        }
        item { SecondaryAction("Back", onBack) }
    }
}

@Composable
internal fun VipResultScreen(
    assignment: AssignmentEntity,
    state: VipResultState,
    onCheckNext: () -> Unit,
    onSearchAgain: () -> Unit,
    onContactSupervisor: () -> Unit,
) {
    val guest = state.guest
    val outcome = state.outcome
    val isSuccess = state.kind == VipResultKind.Success
    val background = when (state.kind) {
        VipResultKind.Success -> Color(0xFFE8F5E9)
        VipResultKind.Duplicate -> Color(0xFFFFF3E0)
        VipResultKind.NotFound -> Color(0xFFFFEBEE)
    }
    val title = when (state.kind) {
        VipResultKind.Success -> "VIP Checked In"
        VipResultKind.Duplicate -> "VIP Already Checked In"
        VipResultKind.NotFound -> "VIP Guest Not Found"
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { EventHeader(assignment) }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = background)) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(outcome?.message ?: "No matching VIP guest is loaded for this event.")
                    DetailRow("Guest", guest?.fullName ?: state.query ?: "Unknown")
                    DetailRow("Type", guest?.guestType ?: outcome?.scanLog?.ticketTypeName ?: "VIP")
                    DetailRow("Time", outcome?.scanLog?.scannedAtEpochMillis?.toString() ?: "N/A")
                    DetailRow("Gate", assignment.gateName ?: "Any gate")
                }
            }
        }
        if (isSuccess) {
            item { PrimaryAction("Check in next VIP guest", onCheckNext) }
        } else {
            item { PrimaryAction("Search Again", onSearchAgain) }
            item { SecondaryAction("Contact Supervisor", onContactSupervisor) }
        }
    }
}

@Composable
private fun EventCard(assignment: AssignmentEntity, onClick: () -> Unit) {
    Card(onClick = onClick) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(assignment.title, style = MaterialTheme.typography.titleLarge)
            Text(assignment.venueName)
            Text("Gate: ${assignment.gateName ?: "Any gate"}")
            Text("Date: ${assignment.startsAtIso}")
            StatusBadge(assignment.status)
        }
    }
}

@Composable
private fun EventHeader(assignment: AssignmentEntity) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(assignment.title, style = MaterialTheme.typography.titleLarge)
            Text("${assignment.venueName} / ${assignment.gateName ?: "Any gate"}")
            StatusBadge(assignment.status)
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(label, style = MaterialTheme.typography.labelLarge)
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun StatusBadge(label: String) {
    val color = when {
        label.contains("success", ignoreCase = true) ||
            label.contains("active", ignoreCase = true) ||
            label.contains("synced", ignoreCase = true) ||
            label.contains("checked", ignoreCase = true) -> Color(0xFFE8F5E9)
        label.contains("invalid", ignoreCase = true) ||
            label.contains("failed", ignoreCase = true) ||
            label.contains("error", ignoreCase = true) ||
            label.contains("cancel", ignoreCase = true) -> Color(0xFFFFEBEE)
        label.contains("duplicate", ignoreCase = true) ||
            label.contains("conflict", ignoreCase = true) -> Color(0xFFFFF3E0)
        else -> Color(0xFFE3F2FD)
    }
    Text(
        text = label,
        modifier = Modifier
            .background(color, RoundedCornerShape(6.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp),
        style = MaterialTheme.typography.labelLarge,
    )
}

@Composable
private fun SyncStatusBanner(isOnline: Boolean, pendingCount: Int) {
    val message = "${if (isOnline) "Online" else "Offline"} / " +
        "${if (pendingCount > 0) "Pending Sync" else "Synced"} / Pending $pendingCount"
    val color = if (!isOnline || pendingCount > 0) Color(0xFFE3F2FD) else Color(0xFFE8F5E9)
    StatusBanner(message = message, color = color)
}

@Composable
private fun StatusBanner(message: String, color: Color = Color(0xFFE3F2FD)) {
    Card(colors = CardDefaults.cardColors(containerColor = color)) {
        Text(
            text = message,
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
        )
    }
}

@Composable
private fun SearchBar(value: String, onValueChange: (String) -> Unit, label: String) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None),
    )
}

@Composable
private fun FilterButton(label: String, selected: Boolean, onClick: () -> Unit) {
    if (selected) {
        Button(modifier = Modifier.height(44.dp), onClick = onClick) {
            Text(label)
        }
    } else {
        OutlinedButton(modifier = Modifier.height(44.dp), onClick = onClick) {
            Text(label)
        }
    }
}

@Composable
private fun TicketResultCard(background: Color, content: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = background)) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            content()
        }
    }
}

@Composable
private fun PrimaryAction(label: String, onClick: () -> Unit) {
    Button(modifier = Modifier.fillMaxWidth().height(56.dp), onClick = onClick) {
        Text(label)
    }
}

@Composable
private fun SecondaryAction(label: String, onClick: () -> Unit) {
    OutlinedButton(modifier = Modifier.fillMaxWidth().height(52.dp), onClick = onClick) {
        Text(label)
    }
}

@Composable
private fun EmptyState(label: String) {
    Card {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(label)
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, modifier = Modifier.weight(0.4f), fontWeight = FontWeight.SemiBold)
        Text(value, modifier = Modifier.weight(0.6f), textAlign = TextAlign.End)
    }
}

@Composable
private fun SyncQueueRow(scan: LocalScanLogEntity, onClick: () -> Unit) {
    val status = syncQueueStatus(scan)
    val color = when (status) {
        SyncQueueStatus.Pending -> Color(0xFFE3F2FD)
        SyncQueueStatus.Synced -> Color(0xFFE8F5E9)
        SyncQueueStatus.Conflict -> Color(0xFFFFF3E0)
        SyncQueueStatus.Failed -> Color(0xFFFFEBEE)
    }
    Card(colors = CardDefaults.cardColors(containerColor = color), onClick = onClick) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(scan.displayCode ?: scan.qrHash, style = MaterialTheme.typography.titleMedium)
                StatusBadge(status.label)
            }
            Text("Time: ${scan.scannedAtEpochMillis}")
            Text("Gate: ${scan.gateName ?: "Any gate"}")
            scan.message?.let { Text(it) }
        }
    }
}

@Composable
private fun VipGuestRow(guest: PreloadedVipGuestEntity, onClick: () -> Unit) {
    Card(onClick = onClick) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(guest.fullName, style = MaterialTheme.typography.titleMedium)
                Text(guest.sponsorCompany ?: guest.sponsorSource)
                Text("${guest.guestType ?: "VIP"} / ${guest.externalGuestKey ?: guest.qrHash ?: "No invite code"}")
            }
            StatusBadge(guest.status)
        }
    }
}

@Composable
private fun HistoryRow(scan: LocalScanLogEntity, onClick: () -> Unit) {
    val color = when {
        historyStatus(scan) == HistoryStatus.Success -> Color(0xFFE8F5E9)
        historyStatus(scan) == HistoryStatus.Duplicate -> Color(0xFFFFF3E0)
        historyStatus(scan) == HistoryStatus.Conflict -> Color(0xFFFFF3E0)
        historyStatus(scan) == HistoryStatus.Pending -> Color(0xFFE3F2FD)
        historyStatus(scan) == HistoryStatus.Failed -> Color(0xFFFFEBEE)
        historyStatus(scan) == HistoryStatus.Invalid -> Color(0xFFFFEBEE)
        else -> Color(0xFFF5F5F5)
    }
    Card(colors = CardDefaults.cardColors(containerColor = color), onClick = onClick) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(scan.displayCode ?: scan.qrHash, style = MaterialTheme.typography.titleMedium)
            Text("${historyStatus(scan)} / ${scan.syncStatus}")
            Text("Gate: ${scan.gateName ?: "Any gate"}")
            Text("Time: ${scan.scannedAtEpochMillis}")
        }
    }
}

@Composable
private fun rememberIsOnline(): State<Boolean> {
    val context = LocalContext.current
    val connectivityManager = remember {
        context.getSystemService(ConnectivityManager::class.java)
    }
    val isOnline = remember {
        mutableStateOf(connectivityManager.hasInternet())
    }

    DisposableEffect(connectivityManager) {
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                isOnline.value = connectivityManager.hasInternet()
            }

            override fun onLost(network: Network) {
                isOnline.value = connectivityManager.hasInternet()
            }

            override fun onCapabilitiesChanged(
                network: Network,
                networkCapabilities: NetworkCapabilities,
            ) {
                isOnline.value = connectivityManager.hasInternet()
            }
        }

        connectivityManager.registerDefaultNetworkCallback(callback)
        onDispose {
            runCatching { connectivityManager.unregisterNetworkCallback(callback) }
        }
    }

    return isOnline
}

private fun ConnectivityManager.hasInternet(): Boolean {
    val network = activeNetwork ?: return false
    val capabilities = getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
}
