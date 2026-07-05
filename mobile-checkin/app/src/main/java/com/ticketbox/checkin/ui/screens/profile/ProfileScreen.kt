package com.ticketbox.checkin.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.ticketbox.checkin.BuildConfig
import com.ticketbox.checkin.data.CheckInRepository
import com.ticketbox.checkin.data.local.AssignmentEntity
import com.ticketbox.checkin.ui.components.DetailRow
import com.ticketbox.checkin.ui.components.EventHeader
import com.ticketbox.checkin.ui.components.ResultCard
import com.ticketbox.checkin.ui.components.TicketBoxPrimaryButton
import com.ticketbox.checkin.ui.components.TicketBoxSecondaryButton
import com.ticketbox.checkin.ui.theme.TicketBoxColors
import com.ticketbox.checkin.ui.theme.TicketBoxSpacing
import com.ticketbox.checkin.ui.theme.TicketBoxStatusVariant

@Composable
fun ProfileScreen(
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
            .background(TicketBoxColors.AppBackground),
        contentPadding = PaddingValues(TicketBoxSpacing.ScreenHorizontal),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
    ) {
        item { EventHeader(assignment) }
        item {
            Text(
                "Profile",
                color = TicketBoxColors.TextPrimary,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            ResultCard(variant = TicketBoxStatusVariant.Neutral) {
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
        item {
            TicketBoxSecondaryButton("Change Event", onBackToAssignments)
        }
        item {
            TicketBoxPrimaryButton("Logout", onLogout)
        }
    }
}
