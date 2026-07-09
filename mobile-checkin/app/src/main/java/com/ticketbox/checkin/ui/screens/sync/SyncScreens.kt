package com.ticketbox.checkin.ui.screens.sync

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.ticketbox.checkin.data.CheckInRepository
import com.ticketbox.checkin.data.local.AssignmentEntity
import com.ticketbox.checkin.data.local.LocalScanLogEntity
import com.ticketbox.checkin.domain.SyncQueueStatus
import com.ticketbox.checkin.domain.syncQueueStatus
import com.ticketbox.checkin.ui.components.DetailRow
import com.ticketbox.checkin.ui.components.EmptyState
import com.ticketbox.checkin.ui.components.EventHeader
import com.ticketbox.checkin.ui.components.ResultCard
import com.ticketbox.checkin.ui.components.SyncQueueCard
import com.ticketbox.checkin.ui.components.SyncStatusBanner
import com.ticketbox.checkin.ui.components.TicketBoxPrimaryButton
import com.ticketbox.checkin.ui.components.TicketBoxSecondaryButton
import com.ticketbox.checkin.ui.theme.TicketBoxColors
import com.ticketbox.checkin.ui.theme.TicketBoxSpacing
import com.ticketbox.checkin.ui.theme.TicketBoxStatusVariant
import com.ticketbox.checkin.ui.theme.statusColors

@Composable
fun OfflineModeNoticeScreen(
    repository: CheckInRepository,
    assignment: AssignmentEntity,
    onContinueOffline: () -> Unit,
    onViewSyncQueue: () -> Unit,
) {
    val pendingCount by repository.observePendingScanCount(assignment.concertId).collectAsState(initial = 0)
    val palette = statusColors(TicketBoxStatusVariant.Info)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(TicketBoxColors.AppBackground),
        contentPadding = PaddingValues(TicketBoxSpacing.ScreenHorizontal),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
    ) {
        item { EventHeader(assignment) }
        item {
            ResultCard(variant = TicketBoxStatusVariant.Info) {
                Text(
                    "Offline Mode",
                    color = palette.foreground,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text("Check-ins are saved on this device and synced later.", color = TicketBoxColors.TextSecondary)
                DetailRow("Pending Sync", pendingCount.toString())
            }
        }
        item { TicketBoxPrimaryButton("Continue Offline", onContinueOffline) }
        item { TicketBoxSecondaryButton("View Sync Queue", onViewSyncQueue) }
    }
}

@Composable
fun SyncQueueScreen(
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
            .background(TicketBoxColors.AppBackground),
        contentPadding = PaddingValues(TicketBoxSpacing.ScreenHorizontal),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
    ) {
        item { EventHeader(assignment) }
        item { SyncStatusBanner(isOnline = isOnline, pendingCount = pendingCount) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Small)) {
                TicketBoxPrimaryButton(
                    label = "Retry Sync",
                    modifier = Modifier.weight(1f),
                    enabled = pendingCount > 0,
                    onClick = {
                        enqueueSync(assignment.concertId)
                        updateStatus("Retry sync queued")
                    },
                )
                TicketBoxSecondaryButton(
                    label = "Back",
                    modifier = Modifier.weight(1f),
                    onClick = onBack,
                )
            }
        }
        if (queue.isEmpty()) {
            item { EmptyState("No sync records") }
        } else {
            items(queue, key = { it.localScanId }) { scan ->
                val status = syncQueueStatus(scan)
                SyncQueueCard(
                    scan = scan,
                    statusLabel = status.label,
                    onClick = {
                        if (status == SyncQueueStatus.Conflict) {
                            onOpenConflict(scan)
                        }
                    },
                )
            }
        }
    }
}

@Composable
fun SyncConflictScreen(
    assignment: AssignmentEntity,
    scan: LocalScanLogEntity,
    onMarkConflict: () -> Unit,
    onContactSupervisor: () -> Unit,
    onBack: () -> Unit,
) {
    val palette = statusColors(TicketBoxStatusVariant.Warning)
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(TicketBoxColors.AppBackground),
        contentPadding = PaddingValues(TicketBoxSpacing.ScreenHorizontal),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
    ) {
        item { EventHeader(assignment) }
        item {
            ResultCard(variant = TicketBoxStatusVariant.Warning) {
                Text(
                    "Sync Conflict",
                    color = palette.foreground,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    scan.message ?: "Ticket was already checked in on another device.",
                    color = TicketBoxColors.TextSecondary,
                )
                DetailRow("Ticket", scan.displayCode ?: scan.qrHash)
                DetailRow("Local Time", scan.scannedAtEpochMillis.toString())
                DetailRow("Server Time", scan.serverCheckInAtIso ?: scan.syncedAtIso ?: "Unavailable")
                DetailRow("Gate", scan.gateName ?: "Any gate")
            }
        }
        item { TicketBoxPrimaryButton("Mark as Conflict", onMarkConflict) }
        item { TicketBoxSecondaryButton("Contact Supervisor", onContactSupervisor) }
        item { TicketBoxSecondaryButton("Back", onBack) }
    }
}
