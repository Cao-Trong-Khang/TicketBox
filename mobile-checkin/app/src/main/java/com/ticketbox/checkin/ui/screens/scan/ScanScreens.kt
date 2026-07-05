package com.ticketbox.checkin.ui.screens.scan

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ticketbox.checkin.data.CheckInRepository
import com.ticketbox.checkin.data.LocalScanOutcome
import com.ticketbox.checkin.data.local.AssignmentEntity
import com.ticketbox.checkin.ui.components.EventHeader
import com.ticketbox.checkin.ui.components.StatusBanner
import com.ticketbox.checkin.ui.components.TicketBoxPrimaryButton
import com.ticketbox.checkin.ui.components.TicketBoxSecondaryButton
import com.ticketbox.checkin.ui.components.TicketBoxTextField
import com.ticketbox.checkin.ui.scan.QrCameraPreview
import com.ticketbox.checkin.ui.theme.TicketBoxColors
import com.ticketbox.checkin.ui.theme.TicketBoxShapes
import com.ticketbox.checkin.ui.theme.TicketBoxSpacing
import com.ticketbox.checkin.ui.theme.TicketBoxStatusVariant
import kotlinx.coroutines.launch

@Composable
fun ScanScreen(
    repository: CheckInRepository,
    assignment: AssignmentEntity,
    isOnline: Boolean,
    onOpenManualInput: () -> Unit,
    onShowResult: (LocalScanOutcome) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var payload by remember { mutableStateOf("") }
    var flashEnabled by remember { mutableStateOf(false) }
    var scanningEnabled by remember { mutableStateOf(true) }
    var isValidating by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(TicketBoxColors.AppBackground),
        contentPadding = PaddingValues(TicketBoxSpacing.ScreenHorizontal),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
    ) {
        item { EventHeader(assignment) }
        item { StatusBanner(if (isOnline) "Online" else "Offline") }
        item {
            Text(
                "QR Scan Area",
                color = TicketBoxColors.TextMuted,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            QrCameraPreview(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(260.dp)
                    .clip(TicketBoxShapes.Large)
                    .background(TicketBoxColors.AppChrome, TicketBoxShapes.Large)
                    .border(1.dp, TicketBoxColors.Border, TicketBoxShapes.Large),
                torchEnabled = flashEnabled,
                scanningEnabled = scanningEnabled && !isValidating,
                onQrDetected = { scannedValue ->
                    payload = scannedValue
                    scanningEnabled = false
                    error = null
                },
                onCameraError = { message ->
                    error = message
                },
            )
        }
        item {
            TicketBoxTextField(
                value = payload,
                onValueChange = { value ->
                    payload = value
                    scanningEnabled = value.isBlank()
                    error = null
                },
                label = "Scanned QR or ticket code",
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Small)) {
                TicketBoxSecondaryButton(
                    label = if (flashEnabled) "Flash On" else "Flash Off",
                    modifier = Modifier.weight(1f),
                    contentDescription = "Toggle flash",
                    onClick = { flashEnabled = !flashEnabled },
                )
                TicketBoxSecondaryButton(
                    label = "Manual",
                    modifier = Modifier.weight(1f),
                    onClick = onOpenManualInput,
                )
            }
        }
        item {
            TicketBoxPrimaryButton(
                label = if (isValidating) "Validating..." else "Validate",
                enabled = payload.isNotBlank() && !isValidating,
                onClick = {
                    val input = payload.trim()
                    if (input.isBlank()) {
                        error = "Enter or scan a code"
                        return@TicketBoxPrimaryButton
                    }

                    scope.launch {
                        isValidating = true
                        runCatching {
                            repository.recordScan(
                                concertId = assignment.concertId,
                                payload = input,
                                gateName = assignment.gateName,
                            )
                        }.onSuccess { outcome ->
                            payload = ""
                            scanningEnabled = true
                            onShowResult(outcome)
                        }.onFailure { throwable ->
                            error = throwable.message ?: "Could not validate QR code"
                            scanningEnabled = true
                        }
                        isValidating = false
                    }
                },
            )
        }
        error?.let { message ->
            item { StatusBanner(message, variant = TicketBoxStatusVariant.Error) }
        }
    }
}

@Composable
fun ManualInputScreen(
    assignment: AssignmentEntity,
    isOnline: Boolean,
    onBack: () -> Unit,
    onValidate: (String) -> Unit,
) {
    var code by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(TicketBoxColors.AppBackground),
        contentPadding = PaddingValues(TicketBoxSpacing.ScreenHorizontal),
        verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
    ) {
        item { EventHeader(assignment) }
        item { StatusBanner(if (isOnline) "Online" else "Offline") }
        item {
            Text(
                "Manual Ticket Input",
                color = TicketBoxColors.TextPrimary,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            TicketBoxTextField(
                value = code,
                onValueChange = {
                    code = it
                    error = null
                },
                label = "Ticket code",
            )
        }
        item {
            TicketBoxPrimaryButton(
                label = "Validate",
                onClick = {
                    if (code.isBlank()) {
                        error = "Ticket code is required"
                    } else {
                        onValidate(code)
                    }
                },
            )
        }
        item {
            TicketBoxSecondaryButton("Back to Scan", onBack)
        }
        error?.let {
            item { StatusBanner(it, variant = TicketBoxStatusVariant.Error) }
        }
    }
}
