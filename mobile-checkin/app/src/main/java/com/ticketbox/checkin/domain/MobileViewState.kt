package com.ticketbox.checkin.domain

import com.ticketbox.checkin.data.local.LocalScanLogEntity
import com.ticketbox.checkin.data.local.PreloadedTicketEntity
import com.ticketbox.checkin.data.local.PreloadedVipGuestEntity

data class DashboardCounts(
    val totalTickets: Int,
    val checkedInTickets: Int,
    val remainingTickets: Int,
    val vipGuests: Int,
    val pendingOffline: Int,
)

enum class HistoryStatus {
    Success,
    Invalid,
    Duplicate,
    Offline,
    Conflict,
    Pending,
    Synced,
    Failed,
}

enum class HistoryFilter(val label: String) {
    All("All"),
    Success("Success"),
    Invalid("Invalid"),
    Duplicate("Duplicate"),
    Offline("Offline"),
    Conflict("Conflict"),
}

enum class SyncQueueStatus(val label: String) {
    Pending("Pending"),
    Synced("Synced"),
    Conflict("Conflict"),
    Failed("Failed"),
}

enum class VipStatusFilter(val label: String) {
    All("All"),
    CheckedIn("Checked In"),
    Remaining("Remaining"),
}

data class VipDashboardCounts(
    val total: Int,
    val checkedIn: Int,
    val remaining: Int,
)

fun deriveDashboardCounts(
    tickets: List<PreloadedTicketEntity>,
    vipGuests: List<PreloadedVipGuestEntity>,
    scans: List<LocalScanLogEntity>,
): DashboardCounts {
    val locallyAccepted = scans.count {
        it.localResult == LocalScanResult.Accepted.wireValue ||
            it.localResult == LocalScanResult.StaleSnapshot.wireValue
    }
    val checkedIn = (tickets.count { it.status == "USED" || it.checkedInAtIso != null } + locallyAccepted)
        .coerceAtMost(tickets.size)
    return DashboardCounts(
        totalTickets = tickets.size,
        checkedInTickets = checkedIn,
        remainingTickets = (tickets.size - checkedIn).coerceAtLeast(0),
        vipGuests = vipGuests.size,
        pendingOffline = scans.count { it.syncStatus == "pending" || it.syncStatus == "failed" },
    )
}

fun historyStatus(scan: LocalScanLogEntity): HistoryStatus {
    return when {
        scan.syncStatus == "conflict" || scan.backendResultCode == "conflict" -> HistoryStatus.Conflict
        scan.syncStatus == "failed" -> HistoryStatus.Failed
        scan.syncStatus == "pending" -> HistoryStatus.Pending
        scan.localResult == LocalScanResult.Duplicate.wireValue ||
            scan.backendResultCode == "duplicate" -> HistoryStatus.Duplicate
        scan.localResult == LocalScanResult.Invalid.wireValue ||
            scan.backendResultCode == "invalid" -> HistoryStatus.Invalid
        scan.localResult == LocalScanResult.Accepted.wireValue ||
            scan.localResult == LocalScanResult.StaleSnapshot.wireValue ||
            scan.backendResultCode == "accepted" -> HistoryStatus.Success
        else -> HistoryStatus.Synced
    }
}

fun syncQueueStatus(scan: LocalScanLogEntity): SyncQueueStatus {
    return when (scan.syncStatus) {
        "synced" -> SyncQueueStatus.Synced
        "conflict" -> SyncQueueStatus.Conflict
        "failed" -> SyncQueueStatus.Failed
        else -> SyncQueueStatus.Pending
    }
}

fun filterScanHistory(
    scans: List<LocalScanLogEntity>,
    filter: HistoryFilter,
    query: String,
): List<LocalScanLogEntity> {
    val normalizedQuery = query.trim().lowercase()
    return scans.filter { scan ->
        val matchesFilter = when (filter) {
            HistoryFilter.All -> true
            HistoryFilter.Success -> historyStatus(scan) == HistoryStatus.Success
            HistoryFilter.Invalid -> historyStatus(scan) == HistoryStatus.Invalid
            HistoryFilter.Duplicate -> historyStatus(scan) == HistoryStatus.Duplicate
            HistoryFilter.Offline -> scan.syncStatus == "pending" || scan.syncStatus == "failed"
            HistoryFilter.Conflict -> historyStatus(scan) == HistoryStatus.Conflict
        }
        val code = scan.displayCode ?: scan.qrHash
        val matchesQuery = normalizedQuery.isBlank() ||
            code.lowercase().contains(normalizedQuery) ||
            scan.qrHash.lowercase().contains(normalizedQuery)
        matchesFilter && matchesQuery
    }
}

fun deriveVipDashboardCounts(guests: List<PreloadedVipGuestEntity>): VipDashboardCounts {
    val checkedIn = guests.count { it.status == "CHECKED_IN" || it.checkedInAtIso != null }
    return VipDashboardCounts(
        total = guests.size,
        checkedIn = checkedIn,
        remaining = (guests.size - checkedIn).coerceAtLeast(0),
    )
}

fun vipSponsors(guests: List<PreloadedVipGuestEntity>): List<String> =
    guests.mapNotNull { it.sponsorCompany ?: it.sponsorSource }
        .filter { it.isNotBlank() }
        .distinct()
        .sorted()

fun vipGuestTypes(guests: List<PreloadedVipGuestEntity>): List<String> =
    guests.mapNotNull { it.guestType }
        .filter { it.isNotBlank() }
        .distinct()
        .sorted()

fun filterVipGuests(
    guests: List<PreloadedVipGuestEntity>,
    query: String,
    sponsor: String?,
    guestType: String?,
    statusFilter: VipStatusFilter,
): List<PreloadedVipGuestEntity> {
    val normalizedQuery = query.trim().lowercase()
    return guests.filter { guest ->
        val sponsorLabel = guest.sponsorCompany ?: guest.sponsorSource
        val checkedIn = guest.status == "CHECKED_IN" || guest.checkedInAtIso != null
        val matchesStatus = when (statusFilter) {
            VipStatusFilter.All -> true
            VipStatusFilter.CheckedIn -> checkedIn
            VipStatusFilter.Remaining -> !checkedIn
        }
        val searchable = listOfNotNull(
            guest.fullName,
            guest.phone,
            guest.email,
            guest.externalGuestKey,
            guest.qrHash,
        ).joinToString(" ").lowercase()
        val matchesQuery = normalizedQuery.isBlank() || searchable.contains(normalizedQuery)
        val matchesSponsor = sponsor == null || sponsorLabel == sponsor
        val matchesType = guestType == null || guest.guestType == guestType
        matchesQuery && matchesSponsor && matchesType && matchesStatus
    }
}
