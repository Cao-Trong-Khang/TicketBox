package com.ticketbox.checkin.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "assignments", indices = [Index("concertId"), Index("sourceDeviceId")])
data class AssignmentEntity(
    @PrimaryKey val assignmentId: String,
    val concertId: String,
    val title: String,
    val venueName: String,
    val status: String = "PUBLISHED",
    val gateName: String?,
    val sourceDeviceId: String?,
    val startsAtIso: String,
    val endsAtIso: String?,
)

@Entity(tableName = "snapshots")
data class SnapshotEntity(
    @PrimaryKey val concertId: String,
    val version: String,
    val generatedAtIso: String,
    val storedAtEpochMillis: Long,
)

@Entity(
    tableName = "preloaded_tickets",
    indices = [Index(value = ["concertId", "qrHash"], unique = true), Index("status")],
)
data class PreloadedTicketEntity(
    @PrimaryKey val id: String,
    val concertId: String,
    val ticketCode: String,
    val qrHash: String,
    val status: String,
    val issuedAtIso: String,
    val checkedInAtIso: String?,
    val attendeeName: String? = null,
    val attendeeEmail: String? = null,
    val zoneOrSeat: String? = null,
    val previousCheckInAtIso: String? = null,
    val previousGateName: String? = null,
    val previousStaffName: String? = null,
    val ticketTypeCode: String,
    val ticketTypeName: String,
)

@Entity(
    tableName = "preloaded_vip_guests",
    indices = [Index(value = ["concertId", "qrHash"], unique = true), Index("status")],
)
data class PreloadedVipGuestEntity(
    @PrimaryKey val id: String,
    val concertId: String,
    val qrHash: String?,
    val externalGuestKey: String?,
    val fullName: String,
    val email: String? = null,
    val phone: String? = null,
    val sponsorSource: String = "SPONSOR_CSV",
    val sponsorCompany: String? = null,
    val invitedBy: String? = null,
    val guestType: String? = null,
    val allowedGate: String? = null,
    val status: String,
    val checkedInAtIso: String?,
    val notes: String? = null,
)

@Entity(
    tableName = "local_scan_logs",
    indices = [
        Index(value = ["sourceDeviceId", "localScanId"], unique = true),
        Index("concertId"),
        Index("qrHash"),
        Index("displayCode"),
        Index("syncStatus"),
        Index("scannedAtEpochMillis"),
    ],
)
data class LocalScanLogEntity(
    @PrimaryKey val localScanId: String,
    val sourceDeviceId: String,
    val concertId: String,
    val qrHash: String,
    val displayCode: String? = null,
    val attendeeName: String? = null,
    val ticketTypeName: String? = null,
    val zoneOrSeat: String? = null,
    val gateName: String? = null,
    val previousCheckInAtIso: String? = null,
    val previousGateName: String? = null,
    val previousStaffName: String? = null,
    val entityType: String,
    val localResult: String,
    val syncStatus: String,
    val retryCount: Int,
    val nextRetryAtEpochMillis: Long?,
    val backendResultCode: String?,
    val backendStatus: String?,
    val backendCheckInId: String?,
    val scannedAtEpochMillis: Long,
    val syncedAtIso: String?,
    val serverCheckInAtIso: String? = null,
    val message: String?,
)
