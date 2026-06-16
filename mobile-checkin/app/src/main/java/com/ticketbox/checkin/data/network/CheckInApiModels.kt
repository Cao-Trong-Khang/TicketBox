package com.ticketbox.checkin.data.network

data class ApiLoginRequest(
    val email: String,
    val password: String,
)

data class ApiLoginResponse(
    val accessToken: String,
)

data class ApiStaffUser(
    val id: String,
    val email: String,
)

data class ApiAssignment(
    val assignmentId: String,
    val concertId: String,
    val title: String,
    val venueName: String,
    val status: String?,
    val gateName: String?,
    val sourceDeviceId: String?,
    val startsAt: String,
    val endsAt: String?,
)

data class ApiPreloadResponse(
    val concert: ApiPreloadConcert,
    val assignments: List<ApiPreloadAssignment>,
    val snapshot: ApiSnapshot,
    val tickets: List<ApiPreloadedTicket>,
    val vipGuests: List<ApiPreloadedVipGuest>,
)

data class ApiPreloadConcert(
    val id: String,
    val title: String,
    val venueName: String,
    val venueAddress: String?,
    val status: String?,
    val startsAt: String,
    val endsAt: String?,
)

data class ApiPreloadAssignment(
    val assignmentId: String,
    val gateName: String?,
    val sourceDeviceId: String?,
)

data class ApiSnapshot(
    val generatedAt: String,
    val version: String,
)

data class ApiPreloadedTicket(
    val id: String,
    val ticketCode: String,
    val qrHash: String,
    val status: String,
    val issuedAt: String,
    val checkedInAt: String?,
    val attendeeName: String?,
    val attendeeEmail: String?,
    val zoneOrSeat: String?,
    val previousCheckIn: ApiPreviousCheckIn?,
    val ticketType: ApiTicketType,
)

data class ApiPreviousCheckIn(
    val scannedAt: String?,
    val gate: String?,
    val staffName: String?,
)

data class ApiTicketType(
    val code: String,
    val name: String,
)

data class ApiPreloadedVipGuest(
    val id: String,
    val qrHash: String?,
    val externalGuestKey: String?,
    val fullName: String,
    val email: String?,
    val phone: String?,
    val sponsorSource: String,
    val sponsorCompany: String?,
    val invitedBy: String?,
    val guestType: String?,
    val allowedGate: String?,
    val status: String,
    val checkedInAt: String?,
    val notes: String?,
)

data class ApiSyncRequest(
    val sourceDeviceId: String,
    val scans: List<ApiSyncScan>,
)

data class ApiSyncScan(
    val localScanId: String,
    val qrHash: String,
    val entityType: String,
    val scannedAt: String,
    val mode: String,
    val localResult: String,
)

data class ApiSyncResponse(
    val sourceDeviceId: String,
    val concertId: String,
    val syncedAt: String,
    val outcomes: List<ApiSyncOutcome>,
)

data class ApiSyncOutcome(
    val localScanId: String?,
    val checkInId: String,
    val resultCode: String,
    val status: String,
    val message: String,
    val syncedAt: String?,
    val serverCheckInAt: String?,
    val idempotent: Boolean,
)
