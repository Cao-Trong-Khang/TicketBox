package com.ticketbox.checkin.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

object TicketBoxColors {
    val AppBackground = Color(0xFF0C0C12)
    val AppChrome = Color(0xFF0F0F16)
    val Surface = Color(0xFF17171F)
    val SurfaceRaised = Color(0xFF1E1E28)
    val InputBackground = Color(0xFF23232E)
    val Border = Color(0x14FFFFFF)
    val Primary = Color(0xFFFF6B35)
    val OnPrimary = Color.White
    val TextPrimary = Color(0xFFF0F0F5)
    val TextSecondary = Color(0xFFC8C8D8)
    val TextMuted = Color(0xFF7878A0)
    val Success = Color(0xFF4ADE80)
    val Error = Color(0xFFF87171)
    val Warning = Color(0xFFFB923C)
    val Info = Color(0xFF60A5FA)
    val Neutral = Color(0xFFA1A1AA)
}

@Immutable
data class TicketBoxStatusColors(
    val foreground: Color,
    val background: Color,
    val border: Color,
)

enum class TicketBoxStatusVariant {
    Success,
    Error,
    Warning,
    Info,
    Neutral,
}

object TicketBoxSpacing {
    val XSmall = 4.dp
    val Small = 8.dp
    val Medium = 12.dp
    val Large = 16.dp
    val XLarge = 20.dp
    val ScreenHorizontal = 16.dp
}

object TicketBoxShapes {
    val Small = RoundedCornerShape(8.dp)
    val Medium = RoundedCornerShape(12.dp)
    val Large = RoundedCornerShape(16.dp)
}

private val TicketBoxColorScheme: ColorScheme = darkColorScheme(
    primary = TicketBoxColors.Primary,
    onPrimary = TicketBoxColors.OnPrimary,
    background = TicketBoxColors.AppBackground,
    onBackground = TicketBoxColors.TextPrimary,
    surface = TicketBoxColors.Surface,
    onSurface = TicketBoxColors.TextPrimary,
    surfaceVariant = TicketBoxColors.SurfaceRaised,
    onSurfaceVariant = TicketBoxColors.TextSecondary,
    error = TicketBoxColors.Error,
    onError = Color.White,
)

@Composable
fun TicketBoxTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = TicketBoxColorScheme,
        typography = MaterialTheme.typography,
        content = content,
    )
}

fun statusVariantFor(label: String): TicketBoxStatusVariant {
    val normalized = label.lowercase()
    return when {
        listOf("success", "active", "synced", "checked", "valid", "online").any(normalized::contains) ->
            TicketBoxStatusVariant.Success
        listOf("invalid", "failed", "error", "cancel", "not found", "refunded").any(normalized::contains) ->
            TicketBoxStatusVariant.Error
        listOf("duplicate", "conflict", "already").any(normalized::contains) ->
            TicketBoxStatusVariant.Warning
        listOf("offline", "pending", "recorded", "stale").any(normalized::contains) ->
            TicketBoxStatusVariant.Info
        else -> TicketBoxStatusVariant.Neutral
    }
}

fun statusColors(variant: TicketBoxStatusVariant): TicketBoxStatusColors =
    when (variant) {
        TicketBoxStatusVariant.Success -> TicketBoxStatusColors(
            foreground = TicketBoxColors.Success,
            background = TicketBoxColors.Success.copy(alpha = 0.10f),
            border = TicketBoxColors.Success.copy(alpha = 0.30f),
        )
        TicketBoxStatusVariant.Error -> TicketBoxStatusColors(
            foreground = TicketBoxColors.Error,
            background = TicketBoxColors.Error.copy(alpha = 0.10f),
            border = TicketBoxColors.Error.copy(alpha = 0.30f),
        )
        TicketBoxStatusVariant.Warning -> TicketBoxStatusColors(
            foreground = TicketBoxColors.Warning,
            background = TicketBoxColors.Warning.copy(alpha = 0.10f),
            border = TicketBoxColors.Warning.copy(alpha = 0.30f),
        )
        TicketBoxStatusVariant.Info -> TicketBoxStatusColors(
            foreground = TicketBoxColors.Info,
            background = TicketBoxColors.Info.copy(alpha = 0.10f),
            border = TicketBoxColors.Info.copy(alpha = 0.30f),
        )
        TicketBoxStatusVariant.Neutral -> TicketBoxStatusColors(
            foreground = TicketBoxColors.TextSecondary,
            background = TicketBoxColors.SurfaceRaised,
            border = TicketBoxColors.Border,
        )
    }

@Composable
fun primaryButtonColors() = ButtonDefaults.buttonColors(
    containerColor = TicketBoxColors.Primary,
    contentColor = TicketBoxColors.OnPrimary,
    disabledContainerColor = TicketBoxColors.Primary.copy(alpha = 0.38f),
    disabledContentColor = TicketBoxColors.OnPrimary.copy(alpha = 0.50f),
)

@Composable
fun secondaryButtonColors() = ButtonDefaults.outlinedButtonColors(
    contentColor = TicketBoxColors.TextSecondary,
    disabledContentColor = TicketBoxColors.TextMuted,
)
