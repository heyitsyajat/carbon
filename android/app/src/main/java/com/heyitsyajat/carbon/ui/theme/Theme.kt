package com.heyitsyajat.carbon.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

object CarbonPalette {
    val Canvas = Color(0xFFFDF7F3)
    val Raised = Color(0xFFFFFDFB)
    val Panel = Color(0xFFFBF0E9)
    val Chrome = Color(0xFFF8EBE2)
    val Sunken = Color(0xFFF6E7DD)
    val Hover = Color(0xFFF7E3D7)
    val Selected = Color(0xFFF5D9CA)

    val Ink = Color(0xFF2A151A)
    val InkSoft = Color(0xFF63424A)
    val InkMuted = Color(0xFF8A6A70)
    val InkFaint = Color(0xFFA98C8F)

    val Line = Color(0xFFECD9CD)
    val LineStrong = Color(0xFFE2C8BA)

    val Accent = Color(0xFF7A1F33)
    val AccentHover = Color(0xFF681829)
    val AccentSoft = Color(0xFFF6E0E2)
    val Peach = Color(0xFFF4A58A)
    val PeachSoft = Color(0xFFFDEEE5)

    val Success = Color(0xFF3F6F4F)
    val Danger = Color(0xFF9A2430)
    val Warning = Color(0xFF8A5A12)

    val DarkCanvas = Color(0xFF1B0F14)
    val DarkRaised = Color(0xFF241419)
    val DarkPanel = Color(0xFF1E1117)
    val DarkChrome = Color(0xFF180D12)
    val DarkSunken = Color(0xFF231318)
    val DarkHover = Color(0xFF2B1720)
    val DarkSelected = Color(0xFF3A1D28)

    val DarkInk = Color(0xFFF6EAE4)
    val DarkInkSoft = Color(0xFFD7BCBF)
    val DarkInkMuted = Color(0xFFAB8B90)
    val DarkInkFaint = Color(0xFF8A6B72)
    val DarkLine = Color(0xFF33202A)
    val DarkLineStrong = Color(0xFF432A35)
    val DarkAccent = Color(0xFFE9A08D)
    val DarkAccentSoft = Color(0xFF391D25)
}

private val LightScheme = lightColorScheme(
    primary = CarbonPalette.Accent,
    onPrimary = Color(0xFFFFF5F2),
    primaryContainer = CarbonPalette.AccentSoft,
    onPrimaryContainer = CarbonPalette.Accent,
    secondary = CarbonPalette.Peach,
    onSecondary = Color(0xFF3A1420),
    secondaryContainer = CarbonPalette.PeachSoft,
    onSecondaryContainer = Color(0xFF6A3426),
    background = CarbonPalette.Canvas,
    onBackground = CarbonPalette.Ink,
    surface = CarbonPalette.Raised,
    onSurface = CarbonPalette.Ink,
    surfaceVariant = CarbonPalette.Panel,
    onSurfaceVariant = CarbonPalette.InkSoft,
    outline = CarbonPalette.LineStrong,
    outlineVariant = CarbonPalette.Line,
    error = CarbonPalette.Danger,
    onError = Color.White,
    surfaceContainer = CarbonPalette.Panel,
    surfaceContainerHigh = CarbonPalette.Chrome,
    surfaceContainerLow = CarbonPalette.Raised,
    surfaceContainerLowest = CarbonPalette.Raised,
    surfaceContainerHighest = CarbonPalette.Sunken,
)

private val DarkScheme = darkColorScheme(
    primary = CarbonPalette.DarkAccent,
    onPrimary = Color(0xFF2A1016),
    primaryContainer = CarbonPalette.DarkAccentSoft,
    onPrimaryContainer = Color(0xFFF2B6A3),
    secondary = CarbonPalette.Peach,
    onSecondary = Color(0xFF2A1016),
    secondaryContainer = Color(0xFF33201D),
    onSecondaryContainer = Color(0xFFF7B79F),
    background = CarbonPalette.DarkCanvas,
    onBackground = CarbonPalette.DarkInk,
    surface = CarbonPalette.DarkRaised,
    onSurface = CarbonPalette.DarkInk,
    surfaceVariant = CarbonPalette.DarkPanel,
    onSurfaceVariant = CarbonPalette.DarkInkSoft,
    outline = CarbonPalette.DarkLineStrong,
    outlineVariant = CarbonPalette.DarkLine,
    error = Color(0xFFF08A8A),
    onError = Color(0xFF341A1D),
    surfaceContainer = CarbonPalette.DarkPanel,
    surfaceContainerHigh = CarbonPalette.DarkChrome,
    surfaceContainerLow = CarbonPalette.DarkRaised,
    surfaceContainerLowest = CarbonPalette.DarkRaised,
    surfaceContainerHighest = CarbonPalette.DarkSunken,
)

private val CarbonTypography = Typography(
    displayLarge = TextStyle(fontFamily = FontFamily.Serif, fontSize = 40.sp, lineHeight = 46.sp, fontWeight = FontWeight.Medium),
    headlineLarge = TextStyle(fontFamily = FontFamily.Serif, fontSize = 30.sp, lineHeight = 36.sp, fontWeight = FontWeight.Medium),
    headlineMedium = TextStyle(fontFamily = FontFamily.Serif, fontSize = 25.sp, lineHeight = 31.sp, fontWeight = FontWeight.Medium),
    headlineSmall = TextStyle(fontFamily = FontFamily.Serif, fontSize = 21.sp, lineHeight = 27.sp, fontWeight = FontWeight.Medium),
    titleLarge = TextStyle(fontFamily = FontFamily.Serif, fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.Medium),
    titleMedium = TextStyle(fontSize = 15.sp, lineHeight = 21.sp, fontWeight = FontWeight.SemiBold),
    titleSmall = TextStyle(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium),
    bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 23.sp),
    bodyMedium = TextStyle(fontSize = 13.5.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 17.sp),
    labelLarge = TextStyle(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium),
    labelMedium = TextStyle(fontSize = 11.5.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium),
    labelSmall = TextStyle(fontSize = 10.5.sp, lineHeight = 14.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.4.sp),
)

@Composable
fun CarbonTheme(
    theme: String = "system",
    content: @Composable () -> Unit,
) {
    val dark = when (theme) {
        "light" -> false
        "dark" -> true
        else -> isSystemInDarkTheme()
    }
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }
    }
    MaterialTheme(colorScheme = if (dark) DarkScheme else LightScheme, typography = CarbonTypography, content = content)
}
