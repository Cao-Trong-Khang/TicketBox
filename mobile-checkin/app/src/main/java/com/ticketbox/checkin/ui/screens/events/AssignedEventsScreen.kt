package com.ticketbox.checkin.ui.screens.events

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ticketbox.checkin.data.local.AssignmentEntity
import com.ticketbox.checkin.ui.components.EmptyState
import com.ticketbox.checkin.ui.components.EventCard
import com.ticketbox.checkin.ui.components.StatusBanner
import com.ticketbox.checkin.ui.theme.TicketBoxColors
import com.ticketbox.checkin.ui.theme.TicketBoxSpacing
import com.ticketbox.checkin.ui.theme.secondaryButtonColors

@Composable
fun AssignedEventsScreen(
    assignments: List<AssignmentEntity>,
    statusMessage: String,
    onRefresh: () -> Unit,
    onSelect: (AssignmentEntity) -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(TicketBoxColors.AppBackground),
        contentPadding = PaddingValues(TicketBoxSpacing.ScreenHorizontal),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Assigned Events",
                    color = TicketBoxColors.TextPrimary,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                OutlinedButton(
                    colors = secondaryButtonColors(),
                    onClick = onRefresh,
                ) {
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
