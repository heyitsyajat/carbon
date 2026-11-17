package com.heyitsyajat.carbon.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.heyitsyajat.carbon.ai.AiAction

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiSheet(state: UiState, viewModel: CarbonViewModel, selection: String) {
    val colors = MaterialTheme.colorScheme
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val context = LocalContext.current
    val keyboard = LocalSoftwareKeyboardController.current
    var instruction by remember { mutableStateOf("") }
    var question by remember { mutableStateOf("") }
    var showMeeting by remember { mutableStateOf(false) }

    fun run(action: AiAction, text: String? = null, custom: String? = null) {
        keyboard?.hide()
        val scoped = when (action) {
            AiAction.CONTINUE, AiAction.CHAT, AiAction.MEETING -> null
            else -> text?.takeIf { it.isNotBlank() } ?: selection.takeIf { it.isNotBlank() }
        }
        viewModel.runAi(action, scoped, custom)
    }

    ModalBottomSheet(
        onDismissRequest = { viewModel.showAi(false) },
        sheetState = sheetState,
        containerColor = colors.background,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .heightIn(max = 680.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp)
                .padding(bottom = 28.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = colors.primary)
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text("Writing assistant", style = MaterialTheme.typography.titleMedium)
                    Text(
                        if (state.settings.aiEnabled) {
                            "${state.settings.provider.label} · ${state.settings.model}"
                        } else {
                            "AI is off"
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                IconButton(onClick = {
                    viewModel.showAi(false)
                    viewModel.showSettings(true)
                }) {
                    Icon(Icons.Outlined.Settings, contentDescription = "AI settings")
                }
            }

            HorizontalDivider(color = colors.outlineVariant, modifier = Modifier.padding(vertical = 10.dp))

            if (!state.settings.aiEnabled) {
                Text(
                    "Everything except the assistant works without AI. Add a local model, an OpenAI-compatible endpoint, or your own API key to use it.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.onSurfaceVariant,
                )
                Spacer(Modifier.height(14.dp))
                Button(onClick = {
                    viewModel.showAi(false)
                    viewModel.showSettings(true)
                }) { Text("Open AI settings") }
                return@Column
            }

            val actions = listOf(
                AiAction.CONTINUE, AiAction.REWRITE, AiAction.SUMMARIZE,
                AiAction.BULLETS, AiAction.TABLE, AiAction.ACTIONS,
            )
            actions.chunked(3).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    row.forEach { action ->
                        OutlinedButton(
                            onClick = { run(action) },
                            modifier = Modifier.weight(1f),
                            enabled = !state.ai.running && state.current != null,
                            shape = MaterialTheme.shapes.small,
                        ) {
                            Text(action.label, style = MaterialTheme.typography.labelMedium, maxLines = 1)
                        }
                    }
                }
                Spacer(Modifier.height(6.dp))
            }

            Text(
                when {
                    selection.isNotBlank() -> "Using ${selection.length} selected characters."
                    state.ai.includeLinked -> "Using this note, plus linked notes as context."
                    else -> "Using this note."
                },
                style = MaterialTheme.typography.labelSmall,
                color = colors.onSurfaceVariant,
            )

            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                Switch(
                    checked = state.ai.includeLinked,
                    onCheckedChange = { viewModel.toggleAiLinked() },
                    modifier = Modifier.size(width = 36.dp, height = 24.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text("Include linked notes", style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
            }

            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = instruction,
                onValueChange = { instruction = it },
                label = { Text("Custom instruction") },
                placeholder = { Text("Tighten the intro") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                trailingIcon = {
                    TextButton(
                        onClick = {
                            if (instruction.isNotBlank()) {
                                run(AiAction.CUSTOM, custom = instruction.trim())
                            }
                        },
                        enabled = !state.ai.running && instruction.isNotBlank(),
                    ) { Text("Run") }
                },
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = question,
                onValueChange = { question = it },
                label = { Text("Ask about this note") },
                placeholder = { Text("What did we decide?") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                trailingIcon = {
                    TextButton(
                        onClick = {
                            if (question.isNotBlank()) run(AiAction.CHAT, custom = question.trim())
                        },
                        enabled = !state.ai.running && question.isNotBlank(),
                    ) { Text("Ask") }
                },
            )

            Spacer(Modifier.height(10.dp))
            TextButton(onClick = { showMeeting = !showMeeting }) {
                Text(if (showMeeting) "Hide transcript" else "Summarize a meeting transcript")
            }
            if (showMeeting) {
                OutlinedTextField(
                    value = state.ai.transcript,
                    onValueChange = viewModel::setAiTranscript,
                    label = { Text("Paste transcript") },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 110.dp),
                    minLines = 4,
                )
                Spacer(Modifier.height(6.dp))
                Button(
                    onClick = { run(AiAction.MEETING) },
                    enabled = !state.ai.running && state.ai.transcript.trim().length > 20,
                ) { Text("Summarize transcript") }
            }

            if (state.ai.running || state.ai.result.isNotBlank() || state.ai.error != null) {
                HorizontalDivider(color = colors.outlineVariant, modifier = Modifier.padding(vertical = 12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        state.ai.label ?: state.ai.action.label,
                        style = MaterialTheme.typography.labelMedium,
                        color = colors.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    if (state.ai.running) {
                        CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(6.dp))
                        TextButton(onClick = viewModel::cancelAi) {
                            Icon(Icons.Outlined.Stop, contentDescription = null, modifier = Modifier.size(12.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Stop")
                        }
                    } else {
                        TextButton(onClick = viewModel::clearAi) { Text("Clear") }
                    }
                }

                state.ai.error?.let { error ->
                    Surface(
                        color = colors.errorContainer,
                        shape = MaterialTheme.shapes.small,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Text("Assistant unavailable", style = MaterialTheme.typography.titleSmall, color = colors.error)
                            Spacer(Modifier.height(4.dp))
                            Text(error, style = MaterialTheme.typography.bodySmall, color = colors.onSurface)
                        }
                    }
                }

                if (state.ai.result.isNotBlank()) {
                    Surface(
                        color = colors.surface,
                        shape = MaterialTheme.shapes.small,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        SelectionContainer {
                            Text(
                                state.ai.result,
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.onBackground,
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                        Button(
                            onClick = { viewModel.applyAi(AiApply.INSERT) },
                            modifier = Modifier.weight(1f),
                            enabled = !state.ai.running && state.current != null,
                        ) { Text("Insert") }
                        if (state.ai.selection.isNotBlank()) {
                            OutlinedButton(
                                onClick = { viewModel.applyAi(AiApply.REPLACE) },
                                modifier = Modifier.weight(1f),
                                enabled = !state.ai.running,
                            ) { Text("Replace") }
                        }
                        OutlinedButton(
                            onClick = { viewModel.applyAi(AiApply.APPEND) },
                            modifier = Modifier.weight(1f),
                            enabled = !state.ai.running,
                        ) { Text("Append") }
                    }
                    TextButton(onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("Carbon assistant", state.ai.result))
                        viewModel.notify("Copied to clipboard")
                    }) {
                        Icon(Icons.Outlined.ContentCopy, contentDescription = null, modifier = Modifier.size(13.dp))
                        Spacer(Modifier.width(5.dp))
                        Text("Copy result")
                    }
                }
            }
        }
    }
}
