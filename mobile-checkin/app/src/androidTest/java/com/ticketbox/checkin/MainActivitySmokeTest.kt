package com.ticketbox.checkin

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test

class MainActivitySmokeTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun rendersStaffLoginEntryPoint() {
        composeRule.onNodeWithText("Staff Check-in").assertIsDisplayed()
        composeRule.onNodeWithText("Email or phone").assertIsDisplayed()
        composeRule.onNodeWithText("Password").assertIsDisplayed()
    }
}
