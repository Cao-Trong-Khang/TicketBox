package com.ticketbox.checkin.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ticketbox.checkin.data.local.AssignmentEntity
import com.ticketbox.checkin.data.local.LocalScanLogEntity
import com.ticketbox.checkin.data.local.PreloadedVipGuestEntity
import com.ticketbox.checkin.ui.theme.TicketBoxColors
import com.ticketbox.checkin.ui.theme.TicketBoxShapes
import com.ticketbox.checkin.ui.theme.TicketBoxSpacing
import com.ticketbox.checkin.ui.theme.TicketBoxStatusVariant
import com.ticketbox.checkin.ui.theme.primaryButtonColors
import com.ticketbox.checkin.ui.theme.secondaryButtonColors
import com.ticketbox.checkin.ui.theme.statusColors
import com.ticketbox.checkin.ui.theme.statusVariantFor

@Composable
fun TicketBoxCard(
    modifier: Modifier = Modifier,
    containerColor: Color = TicketBoxColors.Surface,
    content: @Composable () -> Unit,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = TicketBoxShapes.Large,
        colors = CardDefaults.cardColors(containerColor = containerColor),
        border = BorderStroke(1.dp, TicketBoxColors.Border),
    ) {
        content()
    }
}

@Composable
fun TicketBoxPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentDescription: String? = null,
) {
    Button(
        modifier = modifier
            .fillMaxWidth()
            .height(56.dp)
            .then(
                if (contentDescription != null) {
                    Modifier.semantics { this.contentDescription = contentDescription }
                } else {
                    Modifier
                },
            ),
        shape = TicketBoxShapes.Large,
        colors = primaryButtonColors(),
        enabled = enabled,
        onClick = onClick,
    ) {
        Text(label, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun TicketBoxSecondaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentDescription: String? = null,
) {
    OutlinedButton(
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp)
            .then(
                if (contentDescription != null) {
                    Modifier.semantics { this.contentDescription = contentDescription }
                } else {
                    Modifier
                },
            ),
        shape = TicketBoxShapes.Large,
        colors = secondaryButtonColors(),
        border = BorderStroke(1.dp, TicketBoxColors.Border),
        enabled = enabled,
        onClick = onClick,
    ) {
        Text(label, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun TicketBoxTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true,
    isError: Boolean = false,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None),
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = modifier.fillMaxWidth(),
        singleLine = singleLine,
        isError = isError,
        visualTransformation = visualTransformation,
        keyboardOptions = keyboardOptions,
        shape = TicketBoxShapes.Medium,
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = TicketBoxColors.TextPrimary,
            unfocusedTextColor = TicketBoxColors.TextPrimary,
            focusedContainerColor = TicketBoxColors.InputBackground,
            unfocusedContainerColor = TicketBoxColors.InputBackground,
            focusedBorderColor = TicketBoxColors.Primary.copy(alpha = 0.70f),
            unfocusedBorderColor = TicketBoxColors.Border,
            focusedLabelColor = TicketBoxColors.TextSecondary,
            unfocusedLabelColor = TicketBoxColors.TextMuted,
            cursorColor = TicketBoxColors.Primary,
            errorBorderColor = TicketBoxColors.Error,
            errorLabelColor = TicketBoxColors.Error,
        ),
    )
}

@Composable
fun SearchField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
) {
    TicketBoxTextField(
        value = value,
        onValueChange = onValueChange,
        label = label,
        modifier = modifier,
    )
}

@Composable
fun FilterChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (selected) {
        Button(
            modifier = modifier.height(40.dp),
            shape = RoundedCornerShape(20.dp),
            colors = primaryButtonColors(),
            onClick = onClick,
        ) {
            Text(label)
        }
    } else {
        OutlinedButton(
            modifier = modifier.height(40.dp),
            shape = RoundedCornerShape(20.dp),
            colors = secondaryButtonColors(),
            border = BorderStroke(1.dp, TicketBoxColors.Border),
            onClick = onClick,
        ) {
            Text(label)
        }
    }
}

@Composable
fun StatusBadge(
    label: String,
    modifier: Modifier = Modifier,
    variant: TicketBoxStatusVariant = statusVariantFor(label),
) {
    val colors = statusColors(variant)
    Text(
        text = label,
        color = colors.foreground,
        modifier = modifier
            .background(colors.background, RoundedCornerShape(999.dp))
            .border(1.dp, colors.border, RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.Bold,
    )
}

@Composable
fun StatusBanner(
    message: String,
    modifier: Modifier = Modifier,
    variant: TicketBoxStatusVariant = statusVariantFor(message),
) {
    val colors = statusColors(variant)
    TicketBoxCard(
        modifier = modifier,
        containerColor = colors.background,
    ) {
        Text(
            text = message,
            color = colors.foreground,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun SyncStatusBanner(
    isOnline: Boolean,
    pendingCount: Int,
    modifier: Modifier = Modifier,
) {
    val message = "${if (isOnline) "Online" else "Offline"} / " +
        "${if (pendingCount > 0) "Pending Sync" else "Synced"} / Pending $pendingCount"
    StatusBanner(
        message = message,
        variant = if (!isOnline || pendingCount > 0) TicketBoxStatusVariant.Info else TicketBoxStatusVariant.Success,
        modifier = modifier,
    )
}

@Composable
fun EventCard(
    assignment: AssignmentEntity,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = TicketBoxShapes.Large,
        colors = CardDefaults.cardColors(containerColor = TicketBoxColors.Surface),
        border = BorderStroke(1.dp, TicketBoxColors.Border),
        onClick = onClick,
    ) {
        Column(
            modifier = Modifier.padding(TicketBoxSpacing.Large),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Text(
                    assignment.title,
                    modifier = Modifier.weight(1f),
                    color = TicketBoxColors.TextPrimary,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                StatusBadge(assignment.status)
            }
            Text(assignment.venueName, color = TicketBoxColors.TextSecondary)
            Text("Gate: ${assignment.gateName ?: "Any gate"}", color = TicketBoxColors.TextSecondary)
            Text("Date: ${assignment.startsAtIso}", color = TicketBoxColors.TextMuted)
        }
    }
}

@Composable
fun EventHeader(
    assignment: AssignmentEntity,
    modifier: Modifier = Modifier,
) {
    TicketBoxCard(
        modifier = modifier,
        containerColor = TicketBoxColors.SurfaceRaised,
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    assignment.title,
                    color = TicketBoxColors.TextPrimary,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "${assignment.venueName} / ${assignment.gateName ?: "Any gate"}",
                    color = TicketBoxColors.TextSecondary,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            StatusBadge(assignment.status)
        }
    }
}

@Composable
fun StatisticCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    TicketBoxCard(modifier = modifier) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.XSmall),
        ) {
            Text(
                label,
                color = TicketBoxColors.TextMuted,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                value,
                color = TicketBoxColors.TextPrimary,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
fun ResultCard(
    variant: TicketBoxStatusVariant,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val colors = statusColors(variant)
    TicketBoxCard(
        modifier = modifier,
        containerColor = colors.background,
    ) {
        Column(
            modifier = Modifier.padding(TicketBoxSpacing.Large),
            verticalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Small),
        ) {
            content()
        }
    }
}

@Composable
fun EmptyState(
    label: String,
    modifier: Modifier = Modifier,
) {
    TicketBoxCard(modifier = modifier) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                label,
                color = TicketBoxColors.TextMuted,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
fun LoadingState(
    label: String,
    modifier: Modifier = Modifier,
) {
    StatusBanner(label, modifier = modifier, variant = TicketBoxStatusVariant.Neutral)
}

@Composable
fun DetailRow(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            label,
            modifier = Modifier.weight(0.40f),
            color = TicketBoxColors.TextMuted,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            value,
            modifier = Modifier.weight(0.60f),
            color = TicketBoxColors.TextSecondary,
            style = MaterialTheme.typography.bodySmall,
            textAlign = TextAlign.End,
        )
    }
}

@Composable
fun VipGuestCard(
    guest: PreloadedVipGuestEntity,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    statusLabel: String = guest.status,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = TicketBoxShapes.Large,
        colors = CardDefaults.cardColors(containerColor = TicketBoxColors.Surface),
        border = BorderStroke(1.dp, TicketBoxColors.Border),
        onClick = onClick,
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(TicketBoxSpacing.Medium),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    guest.fullName,
                    color = TicketBoxColors.TextPrimary,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(guest.sponsorCompany ?: guest.sponsorSource, color = TicketBoxColors.TextSecondary)
                Text(
                    "${guest.guestType ?: "VIP"} / ${guest.externalGuestKey ?: guest.qrHash ?: "No invite code"}",
                    color = TicketBoxColors.TextMuted,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            StatusBadge(statusLabel)
        }
    }
}

@Composable
fun SyncQueueCard(
    scan: LocalScanLogEntity,
    statusLabel: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OperationalRecordCard(
        code = scan.displayCode ?: scan.qrHash,
        statusLabel = statusLabel,
        subtitle = "${scan.gateName ?: "Any gate"} / ${scan.scannedAtEpochMillis}",
        message = scan.message,
        onClick = onClick,
        modifier = modifier,
    )
}

@Composable
fun ScanHistoryCard(
    scan: LocalScanLogEntity,
    statusLabel: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OperationalRecordCard(
        code = scan.displayCode ?: scan.qrHash,
        statusLabel = statusLabel,
        subtitle = "${scan.gateName ?: "Any gate"} / ${scan.scannedAtEpochMillis} / ${scan.syncStatus}",
        message = scan.message,
        onClick = onClick,
        modifier = modifier,
    )
}

@Composable
private fun OperationalRecordCard(
    code: String,
    statusLabel: String,
    subtitle: String,
    message: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val variant = statusVariantFor(statusLabel)
    val colors = statusColors(variant)
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = TicketBoxShapes.Large,
        colors = CardDefaults.cardColors(containerColor = colors.background),
        border = BorderStroke(1.dp, colors.border),
        onClick = onClick,
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Text(
                    code,
                    modifier = Modifier.weight(1f),
                    color = TicketBoxColors.TextPrimary,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                StatusBadge(statusLabel, variant = variant)
            }
            Text(subtitle, color = TicketBoxColors.TextMuted, style = MaterialTheme.typography.bodySmall)
            message?.let {
                Text(it, color = TicketBoxColors.TextSecondary, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
