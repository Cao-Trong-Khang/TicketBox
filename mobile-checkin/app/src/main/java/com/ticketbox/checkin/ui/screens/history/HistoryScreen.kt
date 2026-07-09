package com.ticketbox.checkin.ui.screens.history

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.ticketbox.checkin.data.CheckInRepository
import com.ticketbox.checkin.data.local.AssignmentEntity
import com.ticketbox.checkin.data.local.LocalScanLogEntity
import com.ticketbox.checkin.domain.HistoryFilter
import com.ticketbox.checkin.domain.HistoryStatus
import com.ticketbox.checkin.domain.filterScanHistory
import com.ticketbox.checkin.domain.historyStatus
import com.ticketbox.checkin.ui.components.EmptyState
import com.ticketbox.checkin.ui.components.EventHeader
import com.ticketbox.checkin.ui.components.FilterChip
import com.ticketbox.checkin.ui.components.ScanHistoryCard
import com.ticketbox.checkin.ui.components.SearchField
import com.ticketbox.checkin.ui.theme.TicketBoxColors
import com.ticketbox.checkin.ui.theme.TicketBoxSpacing

@Composable
fun HistoryScreen(
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
            .background(TicketBoxColors.AppBackground),
        contentPadding = PaddingValues(TicketBoxSpacing.ScreenHorizontal),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
    ) {
        item { EventHeader(assignment) }
        item {
            Text(
                "Scan History",
                color = TicketBoxColors.TextPrimary,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            SearchField(
                value = query,
                onValueChange = { query = it },
                label = "Search ticket code",
            )
        }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Small)) {
                items(HistoryFilter.entries, key = { it.name }) { option ->
                    FilterChip(
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
                val status = historyStatus(scan)
                ScanHistoryCard(
                    scan = scan,
                    statusLabel = status.name,
                    onClick = {
                        if (status == HistoryStatus.Conflict) {
                            onOpenConflict(scan)
                        }
                    },
                )
            }
        }
    }
}
