package com.ticketbox.checkin.domain

import com.ticketbox.checkin.data.local.LocalScanLogEntity
import java.util.UUID

class ScanLogFactory(
    private val idProvider: () -> String = { UUID.randomUUID().toString() },
    private val clock: () -> Long = { System.currentTimeMillis() },
) {
    fun pending(
        sourceDeviceId: String,
        concertId: String,
        qrHash: String,
        validationResult: LocalValidationResult,
        displayCode: String? = null,
        attendeeName: String? = null,
        ticketTypeName: String? = null,
        zoneOrSeat: String? = null,
        gateName: String? = null,
        previousCheckInAtIso: String? = null,
        previousGateName: String? = null,
        previousStaffName: String? = null,
    ): LocalScanLogEntity {
        return LocalScanLogEntity(
            localScanId = idProvider(),
            sourceDeviceId = sourceDeviceId,
            concertId = concertId,
            qrHash = qrHash,
            displayCode = displayCode,
            attendeeName = attendeeName,
            ticketTypeName = ticketTypeName,
            zoneOrSeat = zoneOrSeat,
            gateName = gateName,
            previousCheckInAtIso = previousCheckInAtIso,
            previousGateName = previousGateName,
            previousStaffName = previousStaffName,
            entityType = validationResult.entityType.wireValue,
            localResult = validationResult.result.wireValue,
            syncStatus = "pending",
            retryCount = 0,
            nextRetryAtEpochMillis = null,
            backendResultCode = null,
            backendStatus = null,
            backendCheckInId = null,
            scannedAtEpochMillis = clock(),
            syncedAtIso = null,
            message = validationResult.message,
        )
    }
}
