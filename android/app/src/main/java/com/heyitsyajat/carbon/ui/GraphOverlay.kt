package com.heyitsyajat.carbon.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlin.math.roundToInt

@Composable
fun GraphOverlay(state: UiState, viewModel: CarbonViewModel) {
    val graph = remember(state.allNotes, state.links) { viewModel.graph() }
    val colors = MaterialTheme.colorScheme

    Dialog(
        onDismissRequest = { viewModel.showGraph(false) },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(Modifier.fillMaxSize(), color = colors.background) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    Modifier.fillMaxWidth().background(colors.surfaceContainerHigh).padding(horizontal = 6.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = { viewModel.showGraph(false) }) {
                        Icon(Icons.Outlined.Close, contentDescription = "Close graph")
                    }
                    Column(Modifier.weight(1f)) {
                        Text("Graph view", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "${graph.nodes.size} notes · ${graph.edges.size} links",
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.onSurfaceVariant,
                        )
                    }
                    Icon(Icons.Outlined.Hub, contentDescription = null, tint = colors.primary, modifier = Modifier.padding(end = 12.dp))
                }

                if (graph.nodes.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No notes yet.", style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
                    }
                    return@Column
                }

                BoxWithConstraints(Modifier.fillMaxSize().padding(12.dp)) {
                    val widthPx = constraints.maxWidth.toFloat()
                    val heightPx = constraints.maxHeight.toFloat()
                    val padding = 44f
                    val usableW = (widthPx - padding * 2).coerceAtLeast(1f)
                    val usableH = (heightPx - padding * 2).coerceAtLeast(1f)

                    fun position(path: String): Offset {
                        val node = graph.nodes.firstOrNull { it.path == path } ?: graph.nodes.first()
                        return Offset(
                            padding + (node.x / 300f) * usableW,
                            padding + (node.y / 300f) * usableH,
                        )
                    }

                    Canvas(Modifier.fillMaxSize()) {
                        graph.edges.forEach { edge ->
                            val start = position(edge.from)
                            val end = position(edge.to)
                            drawLine(
                                color = colors.outline.copy(alpha = 0.45f),
                                start = start,
                                end = end,
                                strokeWidth = 1.5f,
                            )
                        }
                    }

                    graph.nodes.forEach { node ->
                        val point = position(node.path)
                        val radius = 7 + (node.degree.coerceAtMost(6) * 2)
                        Box(
                            Modifier
                                .offset { IntOffset((point.x - radius * 3).roundToInt(), (point.y - radius).roundToInt()) }
                                .size(width = (radius * 6).dp, height = (radius * 4).dp)
                                .clickable {
                                    viewModel.showGraph(false)
                                    viewModel.openNote(node.path)
                                },
                            contentAlignment = Alignment.TopCenter,
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Box(
                                    Modifier
                                        .size((radius * 2).dp)
                                        .background(
                                            if (node.degree > 0) colors.primary else colors.outline,
                                            CircleShape,
                                        ),
                                )
                                Spacer(Modifier.size(4.dp))
                                Text(
                                    node.title,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = colors.onBackground,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.width((radius * 6).dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
