package com.heyitsyajat.carbon.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddLink
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.heyitsyajat.carbon.domain.Markdown

@Composable
fun SidePanel(
    state: UiState,
    onOpenNote: (String) -> Unit,
    onWikiLink: (String) -> Unit,
    onLine: (Int) -> Unit,
    onTag: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MaterialTheme.colorScheme
    var tab by remember { mutableStateOf(0) }
    val path = state.current?.meta?.path
    val outline = remember(state.draft) { Markdown.extractOutline(state.draft) }
    val outgoing = path?.let { state.links.outgoing[it] }.orEmpty()
    val backlinks = path?.let { state.links.backlinks[it] }.orEmpty()
    val mentions = path?.let { state.links.mentions[it] }.orEmpty()
    val tags = remember(state.draft) { Markdown.extractTags(state.draft) }

    Column(modifier.background(colors.surfaceContainer)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
            PanelTab("Outline", tab == 0) { tab = 0 }
            PanelTab("Links", tab == 1) { tab = 1 }
        }
        HorizontalDivider(color = colors.outlineVariant)

        Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
            if (tab == 0) {
                SectionTitle("HEADINGS")
                if (outline.isEmpty()) {
                    EmptyHint("Headings in this note appear here.")
                } else {
                    outline.forEach { entry ->
                        Text(
                            text = entry.text,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onLine(entry.line) }
                                .padding(start = (12 + (entry.level - 1) * 12).dp, end = 12.dp, top = 5.dp, bottom = 5.dp),
                            style = MaterialTheme.typography.bodySmall,
                            color = if (entry.level == 1) colors.onBackground else colors.onSurfaceVariant,
                            fontWeight = if (entry.level == 1) FontWeight.Medium else FontWeight.Normal,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                if (tags.isNotEmpty()) {
                    HorizontalDivider(color = colors.outlineVariant, modifier = Modifier.padding(vertical = 8.dp))
                    SectionTitle("TAGS IN THIS NOTE")
                    tags.forEach { tag ->
                        Text(
                            "#$tag",
                            modifier = Modifier.fillMaxWidth().clickable { onTag(tag) }.padding(horizontal = 14.dp, vertical = 5.dp),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.primary,
                        )
                    }
                }
            } else {
                SectionTitle("BACKLINKS (${backlinks.size})")
                if (backlinks.isEmpty()) EmptyHint("Notes that link here will be listed.")
                else backlinks.forEach { LinkRow(it, onOpenNote) }

                Spacer(Modifier.height(6.dp))
                SectionTitle("OUTGOING (${outgoing.size})")
                if (outgoing.isEmpty()) EmptyHint("Write [[Note name]] to link another note.")
                else outgoing.forEach { LinkRow(it, onOpenNote) }

                Spacer(Modifier.height(6.dp))
                SectionTitle("MENTIONS (${mentions.size})")
                if (mentions.isEmpty()) EmptyHint("Notes that mention this title without linking.")
                else mentions.forEach { LinkRow(it, onOpenNote) }

                if (state.links.unresolved.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    SectionTitle("UNRESOLVED (${state.links.unresolved.size})")
                    state.links.unresolved.forEach { target ->
                        Row(
                            Modifier.fillMaxWidth().clickable { onWikiLink(target) }.padding(horizontal = 12.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Outlined.AddLink, contentDescription = null, modifier = Modifier.size(13.dp), tint = colors.onSurfaceVariant)
                            Spacer(Modifier.width(7.dp))
                            Text(
                                target,
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PanelTab(label: String, selected: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Text(
        text = label,
        modifier = Modifier
            .clickable(onClick = onClick)
            .background(if (selected) colors.primary.copy(alpha = 0.1f) else androidx.compose.ui.graphics.Color.Transparent, MaterialTheme.shapes.small)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        style = MaterialTheme.typography.labelSmall,
        color = if (selected) colors.primary else colors.onSurfaceVariant,
    )
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        modifier = Modifier.padding(start = 14.dp, end = 12.dp, top = 12.dp, bottom = 4.dp),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
    )
}

@Composable
private fun EmptyHint(text: String) {
    Text(
        text,
        modifier = Modifier.padding(horizontal = 14.dp, vertical = 4.dp),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.65f),
    )
}

@Composable
private fun LinkRow(path: String, onOpenNote: (String) -> Unit) {
    val colors = MaterialTheme.colorScheme
    Row(
        Modifier.fillMaxWidth().clickable { onOpenNote(path) }.padding(horizontal = 12.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.Link, contentDescription = null, modifier = Modifier.size(13.dp), tint = colors.primary.copy(alpha = 0.8f))
        Spacer(Modifier.width(7.dp))
        Text(
            Markdown.titleFromPath(path),
            style = MaterialTheme.typography.bodySmall,
            color = colors.onBackground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
