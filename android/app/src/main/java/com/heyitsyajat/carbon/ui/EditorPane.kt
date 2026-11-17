package com.heyitsyajat.carbon.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckBox
import androidx.compose.material.icons.outlined.Code
import androidx.compose.material.icons.outlined.FormatBold
import androidx.compose.material.icons.outlined.FormatItalic
import androidx.compose.material.icons.outlined.FormatListBulleted
import androidx.compose.material.icons.outlined.FormatSize
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Title
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.runtime.CompositionLocalProvider
import kotlinx.coroutines.flow.Flow

@Composable
fun EditorPane(
    notePath: String,
    draft: String,
    textSize: Float,
    commands: Flow<EditorCommand>,
    onDraftChange: (String) -> Unit,
    onSelectionChange: (String) -> Unit,
    onWikiLink: (String) -> Unit,
    onTag: (String) -> Unit,
    onExternal: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MaterialTheme.colorScheme
    val commandFlow = commands
    var value by remember(notePath) { mutableStateOf(TextFieldValue(draft, TextRange(draft.length))) }
    val scroll = rememberScrollState()

    LaunchedEffect(draft) {
        if (draft != value.text) {
            value = value.copy(text = draft, selection = TextRange(draft.length.coerceAtMost(value.selection.end)))
        }
    }

    LaunchedEffect(notePath) {
        commandFlow.collect { command ->
            val text = value.text
            when (command) {
                is EditorCommand.Insert -> {
                    val position = value.selection.start.coerceIn(0, text.length)
                    val updated = text.substring(0, position) + command.text + text.substring(position)
                    value = TextFieldValue(updated, TextRange(position + command.text.length))
                    onDraftChange(updated)
                }

                is EditorCommand.Append -> {
                    val updated = if (text.endsWith("\n")) text + command.text else "$text\n${command.text}"
                    value = TextFieldValue(updated, TextRange(updated.length))
                    onDraftChange(updated)
                }

                is EditorCommand.ReplaceSelection -> {
                    val start = value.selection.min.coerceIn(0, text.length)
                    val end = value.selection.max.coerceIn(start, text.length)
                    val updated = text.substring(0, start) + command.text + text.substring(end)
                    value = TextFieldValue(updated, TextRange(start + command.text.length))
                    onDraftChange(updated)
                }

                is EditorCommand.Wrap -> {
                    val start = value.selection.min.coerceIn(0, text.length)
                    val end = value.selection.max.coerceIn(start, text.length)
                    val selected = text.substring(start, end).ifBlank { command.placeholder }
                    val updated = text.substring(0, start) + command.before + selected + command.after + text.substring(end)
                    val innerStart = start + command.before.length
                    value = TextFieldValue(updated, TextRange(innerStart, innerStart + selected.length))
                    onDraftChange(updated)
                }

                is EditorCommand.ScrollToLine -> {
                    val lines = text.lines().size.coerceAtLeast(1)
                    val fraction = (command.line.toFloat() / lines).coerceIn(0f, 1f)
                    scroll.animateScrollTo((scroll.maxValue * fraction).toInt())
                }
            }
        }
    }

    val selectionColors = TextSelectionColors(
        handleColor = colors.primary,
        backgroundColor = colors.primary.copy(alpha = 0.18f),
    )

    CompositionLocalProvider(LocalTextSelectionColors provides selectionColors) {
        BasicTextField(
            value = value,
            onValueChange = { updated ->
                value = updated
                onDraftChange(updated.text)
                val start = updated.selection.min.coerceIn(0, updated.text.length)
                val end = updated.selection.max.coerceIn(start, updated.text.length)
                onSelectionChange(updated.text.substring(start, end))
            },
            modifier = modifier
                .fillMaxSize()
                .verticalScroll(scroll)
                .padding(start = 22.dp, end = 22.dp, top = 18.dp, bottom = 140.dp),
            textStyle = TextStyle(
                color = colors.onBackground,
                fontSize = textSize.sp,
                lineHeight = (textSize * 1.6f).sp,
                fontFamily = FontFamily.Serif,
                lineHeightStyle = LineHeightStyle(
                    alignment = LineHeightStyle.Alignment.Center,
                    trim = LineHeightStyle.Trim.None,
                ),
            ),
            cursorBrush = SolidColor(colors.primary),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
        )
    }
}

@Composable
fun FormattingBar(
    onCommand: (EditorCommand) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MaterialTheme.colorScheme
    data class Tool(val icon: androidx.compose.ui.graphics.vector.ImageVector, val label: String, val action: () -> Unit)
    val tools = listOf(
        Tool(Icons.Outlined.Title, "Heading") { onCommand(EditorCommand.Wrap("\n## ", "\n", "Heading")) },
        Tool(Icons.Outlined.FormatBold, "Bold") { onCommand(EditorCommand.Wrap("**", "**", "bold text")) },
        Tool(Icons.Outlined.FormatItalic, "Italic") { onCommand(EditorCommand.Wrap("*", "*", "italic text")) },
        Tool(Icons.Outlined.FormatListBulleted, "List") { onCommand(EditorCommand.Wrap("\n- ", "", "List item")) },
        Tool(Icons.Outlined.CheckBox, "Task") { onCommand(EditorCommand.Wrap("\n- [ ] ", "", "Task")) },
        Tool(Icons.Outlined.Link, "Wiki link") { onCommand(EditorCommand.Wrap("[[", "]]", "Note name")) },
        Tool(Icons.Outlined.Code, "Code") { onCommand(EditorCommand.Wrap("`", "`", "code")) },
        Tool(Icons.Outlined.FormatSize, "Divider") { onCommand(EditorCommand.Insert("\n---\n")) },
    )
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(colors.surfaceContainerHigh)
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 6.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        tools.forEach { tool ->
            IconButton(onClick = tool.action, modifier = Modifier.width(38.dp).height(36.dp)) {
                Icon(tool.icon, contentDescription = tool.label, tint = colors.onSurfaceVariant, modifier = Modifier.width(19.dp))
            }
        }
    }
}

@Composable
fun EmptyEditor(onCreate: () -> Unit, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Nothing open", style = MaterialTheme.typography.headlineSmall, color = colors.onSurfaceVariant)
            Spacer(Modifier.height(6.dp))
            Text(
                "Pick a note from the vault, or start a new one.",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.onSurfaceVariant.copy(alpha = 0.8f),
            )
            Spacer(Modifier.height(16.dp))
            androidx.compose.material3.Button(onClick = onCreate) {
                Text("New note", fontWeight = FontWeight.Medium)
            }
        }
    }
}
