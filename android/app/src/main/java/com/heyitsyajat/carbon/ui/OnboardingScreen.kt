package com.heyitsyajat.carbon.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun OnboardingScreen(onFinish: (Boolean) -> Unit) {
    var step by remember { mutableStateOf(0) }
    val colors = MaterialTheme.colorScheme

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 40.dp),
    ) {
        CarbonMark(size = 46)
        Spacer(Modifier.height(22.dp))

        if (step == 0) {
            Text("Your notes, as files.", style = MaterialTheme.typography.displayLarge, color = colors.onBackground)
            Spacer(Modifier.height(12.dp))
            Text(
                "Carbon is a local-first Markdown app. Every note lives in a folder on this device that you can copy, back up or open anywhere.",
                style = MaterialTheme.typography.bodyLarge,
                color = colors.onSurfaceVariant,
            )
            Spacer(Modifier.height(28.dp))
            Feature(Icons.Outlined.Description, "Plain Markdown", "Notes are .md files, never locked in a database.")
            Feature(Icons.Outlined.Search, "Search everything", "Full-text search, quick switching and tag filters.")
            Feature(Icons.Outlined.Hub, "Connect ideas", "Wiki links, backlinks, mentions and a graph view.")
            Spacer(Modifier.height(20.dp))
            Surface(color = colors.surfaceContainer, shape = MaterialTheme.shapes.medium) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Lock, contentDescription = null, tint = colors.primary)
                    Spacer(Modifier.height(0.dp))
                    Text(
                        "No account. No analytics. No background network traffic.",
                        modifier = Modifier.padding(start = 12.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.height(32.dp))
            Button(onClick = { step = 1 }, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                Text("Continue", fontWeight = FontWeight.Medium)
            }
        } else {
            Text("AI is optional.", style = MaterialTheme.typography.headlineLarge, color = colors.onBackground)
            Spacer(Modifier.height(10.dp))
            Text(
                "Notes, search, links, graph, templates and export work without AI. Add a provider only if you want writing help — you can change this any time in Settings.",
                style = MaterialTheme.typography.bodyLarge,
                color = colors.onSurfaceVariant,
            )
            Spacer(Modifier.height(24.dp))
            Surface(color = colors.surfaceContainer, shape = MaterialTheme.shapes.medium) {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = colors.primary)
                        Text(
                            "The assistant can",
                            modifier = Modifier.padding(start = 10.dp),
                            style = MaterialTheme.typography.titleSmall,
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    listOf(
                        "Continue a note in your voice",
                        "Rewrite a selected paragraph",
                        "Summarise and pull out action items",
                        "Answer questions about the open note",
                        "Turn a meeting transcript into notes",
                    ).forEach { line ->
                        Row(Modifier.padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Check, contentDescription = null, tint = colors.primary, modifier = Modifier.height(14.dp))
                            Text(
                                line,
                                modifier = Modifier.padding(start = 8.dp),
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.height(18.dp))
            Text(
                "Providers: local Ollama, any OpenAI-compatible endpoint, OpenAI or Anthropic. API keys are encrypted with the Android Keystore.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.onSurfaceVariant,
            )
            Spacer(Modifier.height(28.dp))
            Button(onClick = { onFinish(true) }, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                Text("Set up AI provider", fontWeight = FontWeight.Medium)
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { onFinish(false) }, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                Text("Continue without AI")
            }
            Spacer(Modifier.height(6.dp))
            TextButton(onClick = { step = 0 }, modifier = Modifier.fillMaxWidth()) {
                Text("Back")
            }
        }
    }
}

@Composable
private fun Feature(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, body: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 9.dp), verticalAlignment = Alignment.Top) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 2.dp))
        Column(Modifier.padding(start = 14.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onBackground)
            Text(body, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
