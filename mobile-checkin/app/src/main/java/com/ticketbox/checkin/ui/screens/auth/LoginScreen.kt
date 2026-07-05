package com.ticketbox.checkin.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.ticketbox.checkin.ui.components.StatusBanner
import com.ticketbox.checkin.ui.components.TicketBoxPrimaryButton
import com.ticketbox.checkin.ui.components.TicketBoxTextField
import com.ticketbox.checkin.ui.theme.TicketBoxColors
import com.ticketbox.checkin.ui.theme.TicketBoxSpacing

@Composable
fun LoginScreen(
    onLogin: (String, String) -> Unit,
    statusMessage: String,
) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(TicketBoxColors.AppBackground)
            .imePadding(),
        contentPadding = PaddingValues(
            start = TicketBoxSpacing.ScreenHorizontal,
            top = 56.dp,
            end = TicketBoxSpacing.ScreenHorizontal,
            bottom = TicketBoxSpacing.XLarge,
        ),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Large),
    ) {
        item {
            Text(
                "Staff Check-in",
                color = TicketBoxColors.TextPrimary,
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "TicketBox Event Operations",
                modifier = Modifier.padding(top = 4.dp),
                color = TicketBoxColors.TextMuted,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        item {
            TicketBoxTextField(
                value = identifier,
                onValueChange = { identifier = it },
                label = "Email or phone",
            )
        }
        item {
            TicketBoxTextField(
                value = password,
                onValueChange = { password = it },
                label = "Password",
                visualTransformation = PasswordVisualTransformation(),
            )
        }
        item {
            TicketBoxPrimaryButton(
                label = "Log In",
                enabled = identifier.isNotBlank() && password.isNotBlank(),
                onClick = { onLogin(identifier, password) },
            )
        }
        item {
            StatusBanner(statusMessage)
        }
    }
}
