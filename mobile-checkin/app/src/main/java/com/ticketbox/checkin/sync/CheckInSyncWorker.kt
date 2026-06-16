package com.ticketbox.checkin.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.Constraints
import com.ticketbox.checkin.data.CheckInRepository
import com.ticketbox.checkin.data.local.CheckInDatabase
import com.ticketbox.checkin.data.network.CheckInApiClient
import com.ticketbox.checkin.data.session.StaffSessionStore
import java.util.concurrent.TimeUnit

class CheckInSyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val concertId = inputData.getString(KEY_CONCERT_ID) ?: return Result.failure()
        val sessionStore = StaffSessionStore(applicationContext)
        val repository = CheckInRepository(
            dao = CheckInDatabase.get(applicationContext).checkInDao(),
            api = CheckInApiClient.create(sessionStore),
            sessionStore = sessionStore,
        )

        return try {
            repository.syncPending(concertId)
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val KEY_CONCERT_ID = "concert_id"

        fun enqueue(context: Context, concertId: String) {
            val request = OneTimeWorkRequestBuilder<CheckInSyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .setInputData(Data.Builder().putString(KEY_CONCERT_ID, concertId).build())
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                "check-in-sync-$concertId",
                ExistingWorkPolicy.KEEP,
                request,
            )
        }
    }
}
