package com.ticketbox.checkin.data.local

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented migration tests for [CheckInDatabase].
 *
 * The historically verified scenario in this repository is `v3 → v4`.
 * Git history confirms that the app shipped with database version 3 and that
 * version 4 replaced [fallbackToDestructiveMigration] with explicit Room
 * migrations, so this class focuses on proving that pending offline records in
 * `local_scan_logs` survive that real upgrade path.
 *
 * Note: the optional `v1 → v4` chain check below is only a synthetic
 * compatibility smoke test for the current exported schemas in `app/schemas`.
 * It is not evidence of the true historical production schemas for v1/v2,
 * because those schema snapshots are not available in git history.
 */
@RunWith(AndroidJUnit4::class)
class CheckInMigrationTest {

    private val testDbName = "migration-test-db"

    @get:Rule
    val migrationTestHelper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        CheckInDatabase::class.java,
    )

    /**
     * Insert pending/failed scan logs into a historically verified v3 schema,
     * migrate to v4, then verify the records are still intact.
     */
    @Test
    fun migrate3To4_pendingScanLogsSurvive() {
        // --- 1. Create the database at version 3 and insert a pending scan log ---
        val dbV3 = migrationTestHelper.createDatabase(testDbName, 3)

        val pendingScan = ContentValues().apply {
            put("localScanId", "offline-scan-001")
            put("sourceDeviceId", "device-1")
            put("concertId", "concert-1")
            put("qrHash", "QR-TICKET-001")
            put("displayCode", "TICKET-001")
            put("attendeeName", "Nguyen Van A")
            put("ticketTypeName", "General Admission")
            put("zoneOrSeat", "Zone A")
            put("gateName", "Gate A")
            put("entityType", "ticket")
            put("localResult", "accepted")
            put("syncStatus", "pending")
            put("retryCount", 0)
            put("scannedAtEpochMillis", 1_718_000_000_000L)
            put("message", "Offline check-in while no network")
        }
        dbV3.insert("local_scan_logs", SQLiteDatabase.CONFLICT_ABORT, pendingScan)

        val failedScan = ContentValues().apply {
            put("localScanId", "offline-scan-002")
            put("sourceDeviceId", "device-1")
            put("concertId", "concert-1")
            put("qrHash", "QR-TICKET-002")
            put("displayCode", "TICKET-002")
            put("attendeeName", "Tran Thi B")
            put("ticketTypeName", "VIP")
            put("zoneOrSeat", "Zone VIP")
            put("gateName", "Gate B")
            put("entityType", "ticket")
            put("localResult", "accepted")
            put("syncStatus", "failed")
            put("retryCount", 2)
            put("nextRetryAtEpochMillis", 1_718_000_060_000L)
            put("scannedAtEpochMillis", 1_718_000_030_000L)
            put("message", "HTTP 503 during sync")
        }
        dbV3.insert("local_scan_logs", SQLiteDatabase.CONFLICT_ABORT, failedScan)

        dbV3.close()

        // --- 2. Run migration from v3 to v4 ---
        migrationTestHelper.runMigrationsAndValidate(
            testDbName,
            4,
            true,
            Migrations.MIGRATION_3_4,
        )

        // --- 3. Reopen with Room and verify data survived ---
        val migratedDb = Room.databaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            CheckInDatabase::class.java,
            testDbName,
        )
            .addMigrations(*Migrations.ALL)
            .allowMainThreadQueries()
            .build()

        val dao = migratedDb.checkInDao()

        runBlocking {
            // Verify the pending scan log is intact
            val pending = dao.scanLogById("offline-scan-001")
            assertNotNull("Pending scan log must survive migration", pending)
            assertEquals("offline-scan-001", pending!!.localScanId)
            assertEquals("device-1", pending.sourceDeviceId)
            assertEquals("concert-1", pending.concertId)
            assertEquals("QR-TICKET-001", pending.qrHash)
            assertEquals("TICKET-001", pending.displayCode)
            assertEquals("Nguyen Van A", pending.attendeeName)
            assertEquals("pending", pending.syncStatus)
            assertEquals("accepted", pending.localResult)
            assertEquals(0, pending.retryCount)
            assertEquals(1_718_000_000_000L, pending.scannedAtEpochMillis)

            // Verify the failed scan log is intact
            val failed = dao.scanLogById("offline-scan-002")
            assertNotNull("Failed scan log must survive migration", failed)
            assertEquals("offline-scan-002", failed!!.localScanId)
            assertEquals("failed", failed.syncStatus)
            assertEquals(2, failed.retryCount)
            assertEquals(1_718_000_060_000L, failed.nextRetryAtEpochMillis)
            assertEquals("HTTP 503 during sync", failed.message)

            // Verify pending count query still works
            val pendingCount = dao.pendingScanCount("concert-1")
            assertEquals(
                "Both pending and failed records should be counted",
                2,
                pendingCount,
            )
        }

        migratedDb.close()
    }

    /**
     * Synthetic compatibility smoke test for the exported schema chain.
     *
     * This only verifies that Room can walk the current `1 → 2 → 3 → 4`
     * schema files bundled in the repo. It should not be read as proof that
     * v1/v2 exactly match historical production releases, because those
     * original schema snapshots are not available in git history.
     */
    @Test
    fun syntheticSchemaChain_v1ToV4_validatesCurrentExports() {
        // Create at v1
        val dbV1 = migrationTestHelper.createDatabase(testDbName, 1)
        dbV1.close()

        // Run all migrations through to v4
        migrationTestHelper.runMigrationsAndValidate(
            testDbName,
            4,
            true,
            *Migrations.ALL,
        )
    }
}
