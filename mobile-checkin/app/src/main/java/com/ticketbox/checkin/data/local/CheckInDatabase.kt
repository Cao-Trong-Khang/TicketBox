package com.ticketbox.checkin.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        AssignmentEntity::class,
        SnapshotEntity::class,
        PreloadedTicketEntity::class,
        PreloadedVipGuestEntity::class,
        LocalScanLogEntity::class,
    ],
    version = 3,
)
abstract class CheckInDatabase : RoomDatabase() {
    abstract fun checkInDao(): CheckInDao

    companion object {
        @Volatile private var instance: CheckInDatabase? = null

        fun get(context: Context): CheckInDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    CheckInDatabase::class.java,
                    "ticketbox-checkin.db",
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { instance = it }
            }
    }
}
