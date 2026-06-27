package com.ticketbox.checkin.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
abstract class CheckInDao {
    @Query("SELECT * FROM assignments ORDER BY startsAtIso ASC, gateName ASC")
    abstract fun observeAssignments(): Flow<List<AssignmentEntity>>

    @Query("SELECT * FROM assignments WHERE concertId = :concertId LIMIT 1")
    abstract suspend fun assignmentForConcert(concertId: String): AssignmentEntity?

    @Query("SELECT * FROM assignments WHERE concertId = :concertId ORDER BY gateName ASC")
    abstract suspend fun assignmentsForConcert(concertId: String): List<AssignmentEntity>

    @Upsert
    abstract suspend fun upsertAssignments(assignments: List<AssignmentEntity>)

    @Query("SELECT * FROM snapshots WHERE concertId = :concertId")
    abstract suspend fun snapshotForConcert(concertId: String): SnapshotEntity?

    @Upsert
    abstract suspend fun upsertSnapshot(snapshot: SnapshotEntity)

    @Query("DELETE FROM preloaded_tickets WHERE concertId = :concertId")
    abstract suspend fun deleteTicketsForConcert(concertId: String)

    @Query("DELETE FROM preloaded_vip_guests WHERE concertId = :concertId")
    abstract suspend fun deleteVipGuestsForConcert(concertId: String)

    @Upsert
    abstract suspend fun upsertTickets(tickets: List<PreloadedTicketEntity>)

    @Upsert
    abstract suspend fun upsertVipGuests(vipGuests: List<PreloadedVipGuestEntity>)

    @Transaction
    open suspend fun replaceSnapshot(
        snapshot: SnapshotEntity,
        tickets: List<PreloadedTicketEntity>,
        vipGuests: List<PreloadedVipGuestEntity>,
    ) {
        deleteTicketsForConcert(snapshot.concertId)
        deleteVipGuestsForConcert(snapshot.concertId)
        upsertSnapshot(snapshot)
        upsertTickets(tickets)
        upsertVipGuests(vipGuests)
    }

    @Query("SELECT * FROM preloaded_tickets WHERE concertId = :concertId AND qrHash = :qrHash")
    abstract suspend fun ticketByQrHash(concertId: String, qrHash: String): PreloadedTicketEntity?

    @Query(
        """
        SELECT * FROM preloaded_tickets
        WHERE concertId = :concertId AND (qrHash = :input OR ticketCode = :input)
        LIMIT 1
        """,
    )
    abstract suspend fun ticketByCodeOrQrHash(concertId: String, input: String): PreloadedTicketEntity?

    @Query(
        """
        SELECT * FROM preloaded_tickets
        WHERE qrHash = :input OR ticketCode = :input
        LIMIT 1
        """,
    )
    abstract suspend fun ticketByCodeOrQrHashAnyConcert(input: String): PreloadedTicketEntity?

    @Query("SELECT * FROM preloaded_tickets WHERE concertId = :concertId ORDER BY ticketCode ASC")
    abstract fun observeTicketsForConcert(concertId: String): Flow<List<PreloadedTicketEntity>>

    @Query("SELECT * FROM preloaded_tickets WHERE concertId = :concertId ORDER BY ticketCode ASC")
    abstract suspend fun ticketListForConcert(concertId: String): List<PreloadedTicketEntity>

    @Query(
        """
        SELECT * FROM preloaded_vip_guests
        WHERE concertId = :concertId AND qrHash = :qrHash
        """,
    )
    abstract suspend fun vipGuestByQrHash(concertId: String, qrHash: String): PreloadedVipGuestEntity?

    @Query(
        """
        SELECT * FROM preloaded_vip_guests
        WHERE concertId = :concertId
          AND (
            :gateName IS NULL
            OR allowedGate IS NULL
            OR LOWER(TRIM(allowedGate)) = LOWER(TRIM(:gateName))
          )
        ORDER BY fullName ASC
        """,
    )
    abstract fun observeVipGuestsForConcert(
        concertId: String,
        gateName: String?,
    ): Flow<List<PreloadedVipGuestEntity>>

    @Query(
        """
        SELECT * FROM preloaded_vip_guests
        WHERE concertId = :concertId
          AND (
            :gateName IS NULL
            OR allowedGate IS NULL
            OR LOWER(TRIM(allowedGate)) = LOWER(TRIM(:gateName))
          )
        ORDER BY fullName ASC
        """,
    )
    abstract suspend fun vipGuestListForConcert(
        concertId: String,
        gateName: String?,
    ): List<PreloadedVipGuestEntity>

    @Query(
        """
        SELECT COUNT(*) FROM local_scan_logs
        WHERE concertId = :concertId
          AND qrHash = :qrHash
          AND localResult IN ('accepted', 'stale_snapshot')
        """,
    )
    abstract suspend fun acceptedLocalScanCount(concertId: String, qrHash: String): Int

    @Query(
        """
        SELECT * FROM local_scan_logs
        WHERE concertId = :concertId
          AND qrHash = :qrHash
          AND localResult IN ('accepted', 'stale_snapshot')
        ORDER BY scannedAtEpochMillis DESC
        LIMIT 1
        """,
    )
    abstract suspend fun previousAcceptedLocalScan(
        concertId: String,
        qrHash: String,
    ): LocalScanLogEntity?

    @Query(
        """
        SELECT * FROM local_scan_logs
        WHERE concertId = :concertId
        ORDER BY scannedAtEpochMillis DESC
        """,
    )
    abstract fun observeScanLogsForConcert(concertId: String): Flow<List<LocalScanLogEntity>>

    @Query(
        """
        SELECT * FROM local_scan_logs
        WHERE concertId = :concertId AND syncStatus IN ('pending', 'synced', 'conflict', 'failed')
        ORDER BY scannedAtEpochMillis DESC
        """,
    )
    abstract fun observeSyncQueueForConcert(concertId: String): Flow<List<LocalScanLogEntity>>

    @Query("SELECT * FROM local_scan_logs WHERE localScanId = :localScanId LIMIT 1")
    abstract suspend fun scanLogById(localScanId: String): LocalScanLogEntity?

    @Query(
        """
        SELECT COUNT(*) FROM local_scan_logs
        WHERE concertId = :concertId AND syncStatus IN ('pending', 'failed')
        """,
    )
    abstract fun observePendingScanCount(concertId: String): Flow<Int>

    @Query(
        """
        SELECT COUNT(*) FROM local_scan_logs
        WHERE concertId = :concertId AND syncStatus IN ('pending', 'failed')
        """,
    )
    abstract suspend fun pendingScanCount(concertId: String): Int

    @Query(
        """
        SELECT COUNT(*) FROM local_scan_logs
        WHERE concertId = :concertId AND localResult IN ('accepted', 'stale_snapshot')
        """,
    )
    abstract suspend fun acceptedScanCountForConcert(concertId: String): Int

    @Insert(onConflict = OnConflictStrategy.ABORT)
    abstract suspend fun insertScanLog(scanLog: LocalScanLogEntity)

    @Query(
        """
        SELECT * FROM local_scan_logs
        WHERE concertId = :concertId AND syncStatus IN ('pending', 'failed')
          AND (:nowEpochMillis >= COALESCE(nextRetryAtEpochMillis, 0))
        ORDER BY scannedAtEpochMillis ASC
        LIMIT :limit
        """,
    )
    abstract suspend fun pendingScans(concertId: String, nowEpochMillis: Long, limit: Int): List<LocalScanLogEntity>

    @Query(
        """
        UPDATE local_scan_logs
        SET syncStatus = CASE
                WHEN :backendResultCode = 'conflict' THEN 'conflict'
                ELSE 'synced'
            END,
            backendResultCode = :backendResultCode,
            backendStatus = :backendStatus,
            backendCheckInId = :backendCheckInId,
            syncedAtIso = :syncedAtIso,
            serverCheckInAtIso = :serverCheckInAtIso,
            message = :message
        WHERE localScanId = :localScanId
        """,
    )
    abstract suspend fun markSynced(
        localScanId: String,
        backendResultCode: String,
        backendStatus: String,
        backendCheckInId: String,
        syncedAtIso: String?,
        serverCheckInAtIso: String?,
        message: String?,
    )

    @Query(
        """
        UPDATE local_scan_logs
        SET syncStatus = 'failed',
            retryCount = retryCount + 1,
            nextRetryAtEpochMillis = :nextRetryAtEpochMillis,
            message = :message
        WHERE localScanId = :localScanId
        """,
    )
    abstract suspend fun markRetry(
        localScanId: String,
        nextRetryAtEpochMillis: Long,
        message: String,
    )
}
