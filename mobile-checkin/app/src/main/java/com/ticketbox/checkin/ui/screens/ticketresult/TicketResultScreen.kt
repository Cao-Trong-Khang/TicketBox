package com.ticketbox.checkin.ui.screens.ticketresult

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.ticketbox.checkin.data.LocalScanOutcome
import com.ticketbox.checkin.data.local.AssignmentEntity
import com.ticketbox.checkin.domain.LocalScanResult
import com.ticketbox.checkin.ui.components.DetailRow
import com.ticketbox.checkin.ui.components.ResultCard
import com.ticketbox.checkin.ui.components.StatusBadge
import com.ticketbox.checkin.ui.components.TicketBoxPrimaryButton
import com.ticketbox.checkin.ui.components.TicketBoxSecondaryButton
import com.ticketbox.checkin.ui.theme.TicketBoxColors
import com.ticketbox.checkin.ui.theme.TicketBoxSpacing
import com.ticketbox.checkin.ui.theme.TicketBoxStatusVariant
import com.ticketbox.checkin.ui.theme.statusColors

@Composable
fun TicketResultScreen(
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
    val variant = when {
        isOfflinePending -> TicketBoxStatusVariant.Info
        isSuccess -> TicketBoxStatusVariant.Success
        isDuplicate -> TicketBoxStatusVariant.Warning
        else -> TicketBoxStatusVariant.Error
    }
    val title = when {
        isOfflinePending -> "Recorded Offline"
        isSuccess -> "Valid Ticket"
        isDuplicate -> "Duplicate"
        else -> "Invalid Ticket"
    }
    val displayCode = outcome.scanLog.displayCode ?: outcome.scanLog.qrHash
    val palette = statusColors(variant)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(TicketBoxColors.AppBackground),
        contentPadding = PaddingValues(TicketBoxSpacing.ScreenHorizontal),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
    ) {
        item {
            ResultCard(variant = variant) {
                Text(
                    title,
                    color = palette.foreground,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                if (isOfflinePending) {
                    StatusBadge("Pending Sync", variant = TicketBoxStatusVariant.Info)
                }
                Text(outcome.message, color = TicketBoxColors.TextSecondary)
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
                    Text(
                        "Final validation happens when network returns.",
                        color = TicketBoxColors.TextSecondary,
                    )
                }
            }
        }
        if (isSuccess && isOnline) {
            item {
                TicketBoxPrimaryButton("Confirm Check-in", onConfirm)
            }
            item {
                TicketBoxSecondaryButton("Scan Next", onScanNext)
            }
        } else if (isSuccess) {
            item {
                TicketBoxPrimaryButton("Scan Next", onScanNext)
            }
        } else {
            item {
                TicketBoxPrimaryButton(if (isDuplicate) "Scan Next" else "Scan Again", onScanNext)
            }
            if (!isDuplicate) {
                item {
                    TicketBoxSecondaryButton("Manual Input", onManualInput)
                }
            }
        }
    }
}
