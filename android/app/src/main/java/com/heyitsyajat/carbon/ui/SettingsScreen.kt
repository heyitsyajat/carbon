package com.heyitsyajat.carbon.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.heyitsyajat.carbon.data.Provider

@Composable
fun SettingsScreen(state: UiState, viewModel: CarbonViewModel) {
    val colors = MaterialTheme.colorScheme
    val context = LocalContext.current
    var providerMenu by remember { mutableStateOf(false) }
    var keyInput by remember { mutableStateOf("") }
    var testResult by remember { mutableStateOf<String?>(null) }
    var testing by remember { mutableStateOf(false) }
    val settings = state.settings
    val hasKey = remember(settings.provider, settings) {
        com.heyitsyajat.carbon.data.SettingsStore(context).hasKey(settings.provider)
    }

    Dialog(
        onDismissRequest = { viewModel.showSettings(false) },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(Modifier.fillMaxSize(), color = colors.background) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = { viewModel.showSettings(false) }) {
                        Icon(Icons.Outlined.ArrowBack, contentDescription = "Back")
                    }
                    Text("Settings", style = MaterialTheme.typography.headlineSmall)
                }
                HorizontalDivider(color = colors.outlineVariant)

                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp, vertical = 14.dp),
                ) {
                    SectionHeading("Appearance")
                    Text("Theme", style = MaterialTheme.typography.bodyMedium)
                    Row(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("system" to "System", "light" to "Light", "dark" to "Dark").forEach { (value, label) ->
                            TemplateChip(label, settings.theme == value) {
                                viewModel.updateSettings { it.copy(theme = value) }
                            }
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "Editor text size · ${settings.editorTextSize.toInt()}sp",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Slider(
                        value = settings.editorTextSize,
                        onValueChange = { size -> viewModel.updateSettings { it.copy(editorTextSize = size) } },
                        valueRange = 14f..26f,
                        steps = 11,
                    )

                    Spacer(Modifier.height(10.dp))
                    Text("Vault folders", style = MaterialTheme.typography.bodyMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
                        OutlinedTextField(
                            value = settings.dailyFolder,
                            onValueChange = { value -> viewModel.updateSettings { it.copy(dailyFolder = value) } },
                            label = { Text("Daily notes") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = settings.templatesFolder,
                            onValueChange = { value -> viewModel.updateSettings { it.copy(templatesFolder = value) } },
                            label = { Text("Templates") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }

                    SettingsDivider()

                    SectionHeading("AI")
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Enable the writing assistant", style = MaterialTheme.typography.bodyMedium)
                            Text(
                                "Off by default. Every note feature works without it.",
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.onSurfaceVariant,
                            )
                        }
                        Switch(
                            checked = settings.aiEnabled,
                            onCheckedChange = { enabled -> viewModel.updateSettings { it.copy(aiEnabled = enabled) } },
                        )
                    }

                    Spacer(Modifier.height(12.dp))
                    Text("Provider", style = MaterialTheme.typography.bodyMedium)
                    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        OutlinedButton(onClick = { providerMenu = true }, modifier = Modifier.weight(1f)) {
                            Text(settings.provider.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        DropdownMenu(expanded = providerMenu, onDismissRequest = { providerMenu = false }) {
                            Provider.entries.forEach { provider ->
                                DropdownMenuItem(
                                    text = { Text(provider.label) },
                                    onClick = {
                                        providerMenu = false
                                        viewModel.updateSettings {
                                            it.copy(
                                                provider = provider,
                                                baseUrl = provider.defaultBase,
                                                model = provider.defaultModel,
                                            )
                                        }
                                    },
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = settings.baseUrl,
                        onValueChange = { value -> viewModel.updateSettings { it.copy(baseUrl = value) } },
                        label = { Text("Base URL") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    )
                    OutlinedTextField(
                        value = settings.model,
                        onValueChange = { value -> viewModel.updateSettings { it.copy(model = value) } },
                        label = { Text("Model") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    )

                    if (settings.provider == Provider.OPENAI || settings.provider == Provider.ANTHROPIC) {
                        OutlinedTextField(
                            value = keyInput,
                            onValueChange = { keyInput = it },
                            label = { Text(if (hasKey) "Replace API key" else "API key") },
                            visualTransformation = PasswordVisualTransformation(),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                            trailingIcon = {
                                TextButton(
                                    onClick = {
                                        viewModel.saveApiKey(settings.provider, keyInput)
                                        keyInput = ""
                                        testResult = "Key saved"
                                    },
                                    enabled = keyInput.isNotBlank(),
                                ) { Text("Save") }
                            },
                        )
                        Text(
                            if (hasKey) "A key is stored in the Android Keystore." else "No key stored yet.",
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }

                    OutlinedTextField(
                        value = settings.systemPrompt,
                        onValueChange = { value -> viewModel.updateSettings { it.copy(systemPrompt = value) } },
                        label = { Text("Standing instructions (optional)") },
                        placeholder = { Text("Use British English. Keep a dry, direct tone.") },
                        minLines = 2,
                        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    )

                    Text(
                        "Temperature · ${String.format("%.1f", settings.temperature)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.onSurfaceVariant,
                        modifier = Modifier.padding(top = 10.dp),
                    )
                    Slider(
                        value = settings.temperature,
                        onValueChange = { value -> viewModel.updateSettings { it.copy(temperature = value) } },
                        valueRange = 0f..1.5f,
                    )

                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                        OutlinedButton(
                            onClick = {
                                testing = true
                                testResult = null
                                viewModel.testAi { result ->
                                    testing = false
                                    testResult = result
                                }
                            },
                            enabled = !testing,
                        ) { Text(if (testing) "Testing…" else "Test connection") }
                        Spacer(Modifier.width(10.dp))
                        Text(
                            testResult ?: if (settings.aiEnabled) "Ready to test" else "Enable AI first",
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.onSurfaceVariant,
                        )
                    }

                    SettingsDivider()

                    SectionHeading("Vault")
                    Text(
                        "Notes are Markdown files in app-specific storage. Copy the folder to back it up.",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.onSurfaceVariant,
                    )
                    Text(
                        "Android/data/com.heyitsyajat.carbon/files/vault",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.primary,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    Text(
                        "${state.notes.size} notes · ${state.tags.size} tags · ${state.links.unresolved.size} unresolved links",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp),
                    )

                    SettingsDivider()

                    SectionHeading("About")
                    Text("Carbon 1.0.0 for Android", style = MaterialTheme.typography.bodyMedium)
                    Text(
                        "MIT licensed. Desktop releases at github.com/heyitsyajat/carbon.",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.onSurfaceVariant,
                    )
                    TextButton(onClick = {
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/heyitsyajat/carbon")))
                        }
                    }) { Text("Open the project on GitHub") }
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

@Composable
private fun SectionHeading(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(bottom = 8.dp),
    )
}

@Composable
private fun SettingsDivider() {
    HorizontalDivider(
        color = MaterialTheme.colorScheme.outlineVariant,
        modifier = Modifier.padding(vertical = 16.dp),
    )
}
