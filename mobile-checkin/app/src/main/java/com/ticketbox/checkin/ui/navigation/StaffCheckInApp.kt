package com.ticketbox.checkin.ui.navigation

import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.ticketbox.checkin.data.CheckInRepository
import com.ticketbox.checkin.data.LocalScanOutcome
import com.ticketbox.checkin.data.LoginOutcome
import com.ticketbox.checkin.data.local.AssignmentEntity
import com.ticketbox.checkin.data.local.LocalScanLogEntity
import com.ticketbox.checkin.data.local.PreloadedVipGuestEntity
import com.ticketbox.checkin.data.session.StaffSessionStore
import com.ticketbox.checkin.domain.LocalScanResult
import com.ticketbox.checkin.domain.vipGuestDisplayState
import com.ticketbox.checkin.ui.screens.auth.LoginScreen
import com.ticketbox.checkin.ui.screens.dashboard.DashboardScreen
import com.ticketbox.checkin.ui.screens.events.AssignedEventsScreen
import com.ticketbox.checkin.ui.screens.history.HistoryScreen
import com.ticketbox.checkin.ui.screens.profile.ProfileScreen
import com.ticketbox.checkin.ui.screens.scan.ManualInputScreen
import com.ticketbox.checkin.ui.screens.scan.ScanScreen
import com.ticketbox.checkin.ui.screens.sync.OfflineModeNoticeScreen
import com.ticketbox.checkin.ui.screens.sync.SyncConflictScreen
import com.ticketbox.checkin.ui.screens.sync.SyncQueueScreen
import com.ticketbox.checkin.ui.screens.ticketresult.TicketResultScreen
import com.ticketbox.checkin.ui.screens.vip.VipGuestDetailScreen
import com.ticketbox.checkin.ui.screens.vip.VipResultScreen
import com.ticketbox.checkin.ui.screens.vip.VipScreen
import com.ticketbox.checkin.ui.theme.TicketBoxColors
import kotlinx.coroutines.launch

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

enum class StaffTab(val label: String) {
    Dashboard("Dashboard"),
    Scan("Scan"),
    Vip("VIP"),
    History("History"),
    Profile("Profile"),
}

enum class VipResultKind {
    Success,
    Duplicate,
    NotFound,
}

data class VipResultState(
    val kind: VipResultKind,
    val guest: PreloadedVipGuestEntity? = null,
    val outcome: LocalScanOutcome? = null,
    val query: String? = null,
)

@Composable
fun StaffCheckInApp(
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
                        repository.preload(assignment.concertId, assignment.assignmentId)
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
                val scans by repository.observeScanHistory(assignment.concertId).collectAsState(initial = emptyList())
                VipGuestDetailScreen(
                    assignment = assignment,
                    guest = guest,
                    statusLabel = vipGuestDisplayState(guest, scans).label,
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
                                kind = when (outcome.result) {
                                    LocalScanResult.Accepted,
                                    LocalScanResult.StaleSnapshot -> VipResultKind.Success
                                    LocalScanResult.Duplicate -> VipResultKind.Duplicate
                                    LocalScanResult.Invalid -> VipResultKind.NotFound
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
fun EventShell(
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
        containerColor = TicketBoxColors.AppBackground,
        bottomBar = {
            NavigationBar(containerColor = TicketBoxColors.AppChrome) {
                StaffTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { onTabSelected(tab) },
                        modifier = Modifier.semantics { contentDescription = "${tab.label} tab" },
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
