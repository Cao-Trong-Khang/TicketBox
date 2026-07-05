package com.ticketbox.checkin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.ticketbox.checkin.data.CheckInRepository
import com.ticketbox.checkin.data.local.CheckInDatabase
import com.ticketbox.checkin.data.network.CheckInApiClient
import com.ticketbox.checkin.data.session.StaffSessionStore
import com.ticketbox.checkin.sync.CheckInSyncWorker
import com.ticketbox.checkin.ui.navigation.StaffCheckInApp
import com.ticketbox.checkin.ui.theme.TicketBoxTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sessionStore = StaffSessionStore(this)
        val repository = CheckInRepository(
            dao = CheckInDatabase.get(this).checkInDao(),
            api = CheckInApiClient.create(sessionStore),
            sessionStore = sessionStore,
        )

        setContent {
            TicketBoxTheme {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .safeDrawingPadding()
                        .imePadding(),
                ) {
                    StaffCheckInApp(
                        repository = repository,
                        sessionStore = sessionStore,
                        enqueueSync = { concertId -> CheckInSyncWorker.enqueue(this, concertId) },
                    )
                }
            }
        }
    }
}
