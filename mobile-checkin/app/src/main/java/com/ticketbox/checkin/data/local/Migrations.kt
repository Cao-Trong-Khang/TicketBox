package com.ticketbox.checkin.data.local

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Explicit Room migrations.
 *
 * These replace [fallbackToDestructiveMigration] to ensure that critical data
 * — in particular pending offline check-in records in `local_scan_logs` — is
 * never silently dropped when the database version changes.
 *
 * **Rule for future developers**: every time the `@Database(version = N)` is
 * bumped, add a matching `MIGRATION_(N-1)_N` here with the required DDL and
 * include it in [ALL]. Never re-enable destructive migration.
 */
object Migrations {

    /**
     * v1 → v2  (identity — no schema change)
     *
     * Historical migration kept so Room can upgrade from the very first
     * version without falling back to a destructive rebuild.
     */
    val MIGRATION_1_2 = object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            // Identity migration – schema was unchanged between v1 and v2.
        }
    }

    /**
     * v2 → v3  (identity — no schema change)
     */
    val MIGRATION_2_3 = object : Migration(2, 3) {
        override fun migrate(db: SupportSQLiteDatabase) {
            // Identity migration – schema was unchanged between v2 and v3.
        }
    }

    /**
     * v3 → v4  (identity — validates the new migration mechanism)
     *
     * No schema change; this migration exists to prove that the migration
     * pipeline works correctly and that pending `local_scan_logs` survive
     * a version bump.
     */
    val MIGRATION_3_4 = object : Migration(3, 4) {
        override fun migrate(db: SupportSQLiteDatabase) {
            // Identity migration – schema is unchanged between v3 and v4.
        }
    }

    /** All migrations, in order. Pass to [RoomDatabase.Builder.addMigrations]. */
    val ALL: Array<Migration> = arrayOf(
        MIGRATION_1_2,
        MIGRATION_2_3,
        MIGRATION_3_4,
    )
}
