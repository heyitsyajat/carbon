package com.heyitsyajat.carbon.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.CreateNewFolder
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FileDownload
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.heyitsyajat.carbon.domain.Markdown
import com.heyitsyajat.carbon.model.NoteMeta

@Composable
fun NotesPane(
    state: UiState,
    onOpenNote: (String) -> Unit,
    onNewNote: () -> Unit,
    onNewFolder: () -> Unit,
    onDaily: () -> Unit,
    onMeeting: () -> Unit,
    onImport: () -> Unit,
    onTag: (String) -> Unit,
    onSearch: () -> Unit,
    onQuickSwitch: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MaterialTheme.colorScheme
    var filter by remember { mutableStateOf("") }
    var expandedTags by remember { mutableStateOf(false) }

    val visible = remember(state.notes, filter) {
        if (filter.isBlank()) state.notes
        else state.notes.filter {
            it.title.contains(filter, ignoreCase = true) || it.path.contains(filter, ignoreCase = true)
        }
    }
    val grouped = remember(visible) {
        visible.groupBy { it.folder }.toSortedMap(compareBy { it.lowercase() })
    }

    Column(modifier.background(colors.surfaceContainer)) {
        Row(
            Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 14.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Carbon Vault", style = MaterialTheme.typography.titleMedium, color = colors.onBackground)
                Text(
                    "${state.notes.size} notes · plain Markdown",
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.onSurfaceVariant,
                )
            }
            IconButton(onClick = onNewNote) {
                Icon(Icons.Outlined.Add, contentDescription = "New note", tint = colors.primary)
            }
            IconButton(onClick = onNewFolder) {
                Icon(Icons.Outlined.CreateNewFolder, contentDescription = "New folder", tint = colors.onSurfaceVariant)
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            PaneAction(Icons.Outlined.CalendarToday, "Today", onDaily, Modifier.weight(1f))
            PaneAction(Icons.Outlined.Groups, "Meeting", onMeeting, Modifier.weight(1f))
            PaneAction(Icons.Outlined.Search, "Search", onSearch, Modifier.weight(1f))
            PaneAction(Icons.Outlined.FileDownload, "Import", onImport, Modifier.weight(1f))
        }

        OutlinedTextField(
            value = filter,
            onValueChange = { filter = it },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            placeholder = { Text("Filter notes", style = MaterialTheme.typography.bodySmall) },
            leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null, modifier = Modifier.size(17.dp)) },
            singleLine = true,
            textStyle = MaterialTheme.typography.bodySmall,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { if (filter.isNotBlank()) onQuickSwitch() }),
            shape = MaterialTheme.shapes.small,
        )

        if (state.tags.isNotEmpty()) {
            Column(Modifier.padding(horizontal = 12.dp)) {
                Row(
                    Modifier.fillMaxWidth().clickable { expandedTags = !expandedTags }.padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "TAGS",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        if (expandedTags) "Hide" else "${state.tags.size}",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.primary,
                    )
                }
                val tags = if (expandedTags) state.tags.entries.toList() else state.tags.entries.take(6)
                Row(
                    Modifier.fillMaxWidth().padding(bottom = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    tags.take(4).forEach { (tag, count) ->
                        Surface(
                            onClick = { onTag(tag) },
                            shape = CircleShape,
                            color = colors.primary.copy(alpha = 0.09f),
                        ) {
                            Text(
                                "#$tag $count",
                                modifier = Modifier.padding(horizontal = 9.dp, vertical = 3.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.primary,
                            )
                        }
                    }
                }
            }
        }

        HorizontalDivider(color = colors.outlineVariant)

        if (visible.isEmpty()) {
            Column(Modifier.padding(20.dp)) {
                Text("No notes match.", style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
                Spacer(Modifier.height(6.dp))
                Text(
                    "Clear the filter or create a note.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.onSurfaceVariant.copy(alpha = 0.75f),
                )
            }
        } else {
            LazyColumn(Modifier.weight(1f).padding(horizontal = 6.dp, vertical = 4.dp)) {
                grouped.forEach { (folder, notes) ->
                    item(key = "folder-$folder") {
                        Row(
                            Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = 10.dp, bottom = 3.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Outlined.Folder,
                                contentDescription = null,
                                modifier = Modifier.size(12.dp),
                                tint = colors.onSurfaceVariant.copy(alpha = 0.7f),
                            )
                            Spacer(Modifier.width(5.dp))
                            Text(
                                if (folder.isBlank()) "Vault" else folder,
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "${notes.size}",
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.onSurfaceVariant.copy(alpha = 0.6f),
                            )
                        }
                    }
                    items(notes, key = { it.path }) { note ->
                        NoteRow(note, active = note.path == state.current?.meta?.path, onClick = { onOpenNote(note.path) })
                    }
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }

        HorizontalDivider(color = colors.outlineVariant)
        Text(
            text = state.links.unresolved.size.let { if (it == 0) "All links resolve" else "$it unresolved link${if (it == 1) "" else "s"}" },
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            style = MaterialTheme.typography.labelSmall,
            color = colors.onSurfaceVariant.copy(alpha = 0.7f),
        )
    }
}

@Composable
private fun NoteRow(note: NoteMeta, active: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Surface(
        color = if (active) colors.primaryContainer else androidx.compose.ui.graphics.Color.Transparent,
        shape = MaterialTheme.shapes.small,
        modifier = Modifier.fillMaxWidth().padding(vertical = 1.dp).clickable(onClick = onClick),
    ) {
        Row(
            Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Outlined.Description,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = if (active) colors.primary else colors.onSurfaceVariant.copy(alpha = 0.7f),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = Markdown.titleFromPath(note.path),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (active) FontWeight.Medium else FontWeight.Normal,
                color = if (active) colors.primary else colors.onBackground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            if (note.modified > System.currentTimeMillis() - 86_400_000) {
                Box(Modifier.size(5.dp).background(colors.secondary, CircleShape))
            }
        }
    }
}

@Composable
private fun PaneAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MaterialTheme.colorScheme
    Column(
        modifier = modifier
            .clickable(onClick = onClick)
            .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, contentDescription = label, modifier = Modifier.size(17.dp), tint = colors.primary)
        Spacer(Modifier.height(3.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = colors.onSurfaceVariant)
    }
}
