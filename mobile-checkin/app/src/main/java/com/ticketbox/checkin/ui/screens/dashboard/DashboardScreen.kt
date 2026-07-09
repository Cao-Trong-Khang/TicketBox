package com.ticketbox.checkin.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ticketbox.checkin.data.CheckInRepository
import com.ticketbox.checkin.data.local.AssignmentEntity
import com.ticketbox.checkin.domain.deriveDashboardCounts
import com.ticketbox.checkin.ui.components.EventHeader
import com.ticketbox.checkin.ui.components.StatisticCard
import com.ticketbox.checkin.ui.components.StatusBanner
import com.ticketbox.checkin.ui.components.SyncStatusBanner
import com.ticketbox.checkin.ui.components.TicketBoxPrimaryButton
import com.ticketbox.checkin.ui.components.TicketBoxSecondaryButton
import com.ticketbox.checkin.ui.theme.TicketBoxColors
import com.ticketbox.checkin.ui.theme.TicketBoxSpacing

@Composable
fun DashboardScreen(
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
    val tickets by repository.observeTickets(assignment.concertId).collectAsState(initial = emptyList())
    val vipGuests by repository.observeVipGuests(
        assignment.concertId,
        assignment.gateName,
    ).collectAsState(initial = emptyList())
    val history by repository.observeScanHistory(assignment.concertId).collectAsState(initial = emptyList())
    val pendingCount by repository.observePendingScanCount(assignment.concertId).collectAsState(initial = 0)
    val counts = deriveDashboardCounts(tickets, vipGuests, history)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(TicketBoxColors.AppBackground),
        contentPadding = PaddingValues(TicketBoxSpacing.ScreenHorizontal),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
    ) {
        item { EventHeader(assignment) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Small)) {
                StatisticCard("Tickets", counts.totalTickets.toString(), Modifier.weight(1f))
                StatisticCard("Checked In", counts.checkedInTickets.toString(), Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Small)) {
                StatisticCard("Remaining", counts.remainingTickets.toString(), Modifier.weight(1f))
                StatisticCard("VIP", counts.vipGuests.toString(), Modifier.weight(1f))
            }
        }
        item {
            SyncStatusBanner(isOnline = isOnline, pendingCount = pendingCount)
        }
        item {
            TicketBoxPrimaryButton("Start QR Scan", onStartScan)
            Spacer(Modifier.height(8.dp))
            TicketBoxSecondaryButton("VIP Guest List", onVip)
            Spacer(Modifier.height(8.dp))
            TicketBoxSecondaryButton("Scan History", onHistory)
            Spacer(Modifier.height(8.dp))
            TicketBoxSecondaryButton("Sync Queue", onOpenSyncQueue)
            Spacer(Modifier.height(8.dp))
            TicketBoxSecondaryButton(
                label = "Sync Now",
                onClick = {
                    enqueueSync(assignment.concertId)
                    updateStatus("Sync queued")
                },
            )
        }
        item {
            StatusBanner(statusMessage)
        }
        item {
            LaunchedEffect(
                assignment.concertId,
                assignment.gateName,
                tickets.size,
                vipGuests.size,
                history.size,
                pendingCount,
            ) {
                runCatching { repository.dashboardSnapshot(assignment.concertId, assignment.gateName) }
            }
        }
    }
}
