package com.ticketbox.checkin.ui.screens.vip

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import com.ticketbox.checkin.data.local.PreloadedVipGuestEntity
import com.ticketbox.checkin.domain.VipStatusFilter
import com.ticketbox.checkin.domain.deriveVipDashboardCounts
import com.ticketbox.checkin.domain.filterVipGuests
import com.ticketbox.checkin.domain.vipGuestDisplayState
import com.ticketbox.checkin.domain.vipGuestTypes
import com.ticketbox.checkin.domain.vipSponsors
import com.ticketbox.checkin.ui.components.DetailRow
import com.ticketbox.checkin.ui.components.EmptyState
import com.ticketbox.checkin.ui.components.EventHeader
import com.ticketbox.checkin.ui.components.FilterChip
import com.ticketbox.checkin.ui.components.ResultCard
import com.ticketbox.checkin.ui.components.SearchField
import com.ticketbox.checkin.ui.components.StatisticCard
import com.ticketbox.checkin.ui.components.TicketBoxPrimaryButton
import com.ticketbox.checkin.ui.components.TicketBoxSecondaryButton
import com.ticketbox.checkin.ui.components.VipGuestCard
import com.ticketbox.checkin.ui.navigation.VipResultKind
import com.ticketbox.checkin.ui.navigation.VipResultState
import com.ticketbox.checkin.ui.theme.TicketBoxColors
import com.ticketbox.checkin.ui.theme.TicketBoxSpacing
import com.ticketbox.checkin.ui.theme.TicketBoxStatusVariant
import com.ticketbox.checkin.ui.theme.statusColors

@Composable
fun VipScreen(
    repository: CheckInRepository,
    assignment: AssignmentEntity,
    onSelectGuest: (PreloadedVipGuestEntity) -> Unit,
    onNotFound: (String) -> Unit,
    updateStatus: (String) -> Unit,
) {
    val guests by repository.observeVipGuests(
        assignment.concertId,
        assignment.gateName,
    ).collectAsState(initial = emptyList())
    val scans by repository.observeScanHistory(assignment.concertId).collectAsState(initial = emptyList())
    var query by remember { mutableStateOf("") }
    var sponsorFilter by remember { mutableStateOf<String?>(null) }
    var typeFilter by remember { mutableStateOf<String?>(null) }
    var statusFilter by remember { mutableStateOf(VipStatusFilter.All) }
    val counts = deriveVipDashboardCounts(guests, scans)
    val sponsors = vipSponsors(guests)
    val guestTypes = vipGuestTypes(guests)
    val filteredGuests = filterVipGuests(
        guests = guests,
        query = query,
        sponsor = sponsorFilter,
        guestType = typeFilter,
        statusFilter = statusFilter,
        scans = scans,
    )

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
                "VIP Guests",
                color = TicketBoxColors.TextPrimary,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Small)) {
                StatisticCard("Total VIP", counts.total.toString(), Modifier.weight(1f))
                StatisticCard("Checked In", counts.checkedIn.toString(), Modifier.weight(1f))
            }
        }
        item {
            StatisticCard("Remaining VIP", counts.remaining.toString(), Modifier.fillMaxWidth())
        }
        item {
            SearchField(
                value = query,
                onValueChange = { query = it },
                label = "Search name, phone, email, invite",
            )
        }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Small)) {
                items(VipStatusFilter.entries, key = { it.name }) { filter ->
                    FilterChip(
                        label = filter.label,
                        selected = statusFilter == filter,
                        onClick = { statusFilter = filter },
                    )
                }
            }
        }
        if (sponsors.isNotEmpty()) {
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Small)) {
                    item {
                        FilterChip(
                            label = "All Sponsors",
                            selected = sponsorFilter == null,
                            onClick = { sponsorFilter = null },
                        )
                    }
                    items(sponsors, key = { it }) { sponsor ->
                        FilterChip(
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
                LazyRow(horizontalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Small)) {
                    item {
                        FilterChip(
                            label = "All Types",
                            selected = typeFilter == null,
                            onClick = { typeFilter = null },
                        )
                    }
                    items(guestTypes, key = { it }) { guestType ->
                        FilterChip(
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
                ResultCard(variant = TicketBoxStatusVariant.Warning) {
                    Text(
                        "Guest Not Found",
                        color = statusColors(TicketBoxStatusVariant.Warning).foreground,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Text("No VIP guest matches this search.", color = TicketBoxColors.TextSecondary)
                    TicketBoxPrimaryButton(
                        label = "Search Again",
                        onClick = {
                        query = ""
                        sponsorFilter = null
                        typeFilter = null
                        statusFilter = VipStatusFilter.All
                        },
                    )
                    TicketBoxSecondaryButton(
                        label = "Contact Supervisor",
                        onClick = {
                        updateStatus("Supervisor review needed")
                        onNotFound(query.ifBlank { "VIP guest" })
                        },
                    )
                }
            }
        } else {
            items(filteredGuests, key = { it.id }) { guest ->
                VipGuestCard(
                    guest = guest,
                    statusLabel = vipGuestDisplayState(guest, scans).label,
                    onClick = { onSelectGuest(guest) },
                )
            }
        }
    }
}

@Composable
fun VipGuestDetailScreen(
    assignment: AssignmentEntity,
    guest: PreloadedVipGuestEntity,
    statusLabel: String = guest.status,
    onBack: () -> Unit,
    onConfirm: () -> Unit,
) {
    val sponsor = guest.sponsorCompany ?: guest.invitedBy ?: guest.sponsorSource
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(TicketBoxColors.AppBackground),
        contentPadding = PaddingValues(TicketBoxSpacing.ScreenHorizontal),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
    ) {
        item { EventHeader(assignment) }
        item {
            ResultCard(variant = TicketBoxStatusVariant.Neutral) {
                Text(
                    guest.fullName,
                    color = TicketBoxColors.TextPrimary,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                DetailRow("Phone", guest.phone ?: "N/A")
                DetailRow("Email", guest.email ?: "N/A")
                DetailRow("Sponsor", sponsor)
                DetailRow("Invited By", guest.invitedBy ?: "N/A")
                DetailRow("Type", guest.guestType ?: "VIP")
                DetailRow("Allowed Gate", guest.allowedGate ?: assignment.gateName ?: "Any gate")
                DetailRow("Status", statusLabel)
                DetailRow("Notes", guest.notes ?: "N/A")
            }
        }
        item {
            TicketBoxPrimaryButton("Confirm VIP Check-in", onConfirm)
        }
        item { TicketBoxSecondaryButton("Back", onBack) }
    }
}

@Composable
fun VipResultScreen(
    assignment: AssignmentEntity,
    state: VipResultState,
    onCheckNext: () -> Unit,
    onSearchAgain: () -> Unit,
    onContactSupervisor: () -> Unit,
) {
    val guest = state.guest
    val outcome = state.outcome
    val isSuccess = state.kind == VipResultKind.Success
    val variant = when (state.kind) {
        VipResultKind.Success -> TicketBoxStatusVariant.Success
        VipResultKind.Duplicate -> TicketBoxStatusVariant.Warning
        VipResultKind.NotFound -> TicketBoxStatusVariant.Error
    }
    val title = when (state.kind) {
        VipResultKind.Success -> "VIP Checked In"
        VipResultKind.Duplicate -> "VIP Already Checked In"
        VipResultKind.NotFound -> "VIP Guest Not Found"
    }
    val palette = statusColors(variant)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(TicketBoxColors.AppBackground),
        contentPadding = PaddingValues(TicketBoxSpacing.ScreenHorizontal),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
    ) {
        item { EventHeader(assignment) }
        item {
            ResultCard(variant = variant) {
                Text(
                    title,
                    color = palette.foreground,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    outcome?.message ?: "No matching VIP guest is loaded for this event.",
                    color = TicketBoxColors.TextSecondary,
                )
                DetailRow("Guest", guest?.fullName ?: state.query ?: "Unknown")
                DetailRow("Type", guest?.guestType ?: outcome?.scanLog?.ticketTypeName ?: "VIP")
                DetailRow("Time", outcome?.scanLog?.scannedAtEpochMillis?.toString() ?: "N/A")
                DetailRow("Gate", assignment.gateName ?: "Any gate")
            }
        }
        if (isSuccess) {
            item { TicketBoxPrimaryButton("Check in next VIP guest", onCheckNext) }
        } else {
            item { TicketBoxPrimaryButton("Search Again", onSearchAgain) }
            item { TicketBoxSecondaryButton("Contact Supervisor", onContactSupervisor) }
        }
    }
}
