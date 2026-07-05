package com.ticketbox.checkin

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import org.junit.Rule
import org.junit.Test

class MainActivitySmokeTest {
    @get:Rule
    val composeRule = createEmptyComposeRule()

    @Test
    fun rendersStaffLoginEntryPoint() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("ticketbox-checkin-session", Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit()

        ActivityScenario.launch(MainActivity::class.java).use {
            composeRule.onNodeWithText("Staff Check-in").assertIsDisplayed()
            composeRule.onNodeWithText("Email or phone").assertIsDisplayed()
            composeRule.onNodeWithText("Password").assertIsDisplayed()
        }
    }
}
