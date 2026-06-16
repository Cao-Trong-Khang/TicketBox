package com.ticketbox.checkin.domain

import com.ticketbox.checkin.data.local.PreloadedTicketEntity
import com.ticketbox.checkin.data.local.PreloadedVipGuestEntity
import com.ticketbox.checkin.data.local.SnapshotEntity

enum class LocalEntityType(val wireValue: String) {
    Ticket("ticket"),
    VipGuest("vip_guest"),
    Unknown("unknown"),
}

enum class LocalScanResult(val wireValue: String) {
    Accepted("accepted"),
    Duplicate("duplicate"),
    Invalid("invalid"),
    StaleSnapshot("stale_snapshot"),
}

data class LocalValidationResult(
    val entityType: LocalEntityType,
    val result: LocalScanResult,
    val message: String,
)

class ScanValidator(
    private val snapshotStaleAfterMillis: Long = 12 * 60 * 60 * 1000L,
) {
    fun validate(
        snapshot: SnapshotEntity?,
        ticket: PreloadedTicketEntity?,
        vipGuest: PreloadedVipGuestEntity?,
        acceptedLocalScanCount: Int,
        nowEpochMillis: Long,
    ): LocalValidationResult {
        if (snapshot == null) {
            return LocalValidationResult(
                entityType = LocalEntityType.Unknown,
                result = LocalScanResult.Invalid,
                message = "No preload snapshot is available",
            )
        }

        val entityType = when {
            ticket != null -> LocalEntityType.Ticket
            vipGuest != null -> LocalEntityType.VipGuest
            else -> LocalEntityType.Unknown
        }

        if (entityType == LocalEntityType.Unknown) {
            return LocalValidationResult(
                entityType = entityType,
                result = LocalScanResult.Invalid,
                message = "QR payload is not in the preload snapshot",
            )
        }

        if (acceptedLocalScanCount > 0) {
            return LocalValidationResult(
                entityType = entityType,
                result = LocalScanResult.Duplicate,
                message = "This payload was already scanned on this device",
            )
        }

        val status = ticket?.status ?: vipGuest?.status
        if (status == "USED" || status == "CHECKED_IN") {
            return LocalValidationResult(
                entityType = entityType,
                result = LocalScanResult.Duplicate,
                message = "This ticket or guest was already checked in",
            )
        }

        if (status == "CANCELLED") {
            return LocalValidationResult(
                entityType = entityType,
                result = LocalScanResult.Invalid,
                message = "This ticket or guest entry is canceled",
            )
        }

        if (status == "REFUNDED") {
            return LocalValidationResult(
                entityType = entityType,
                result = LocalScanResult.Invalid,
                message = "This ticket was refunded",
            )
        }

        if (status != "ACTIVE") {
            return LocalValidationResult(
                entityType = entityType,
                result = LocalScanResult.Invalid,
                message = "Ticket or guest entry is not active",
            )
        }

        if (nowEpochMillis - snapshot.storedAtEpochMillis > snapshotStaleAfterMillis) {
            return LocalValidationResult(
                entityType = entityType,
                result = LocalScanResult.StaleSnapshot,
                message = "Snapshot is stale; backend sync will make the final decision",
            )
        }

        return LocalValidationResult(
            entityType = entityType,
            result = LocalScanResult.Accepted,
            message = "Local scan accepted",
        )
    }
}
