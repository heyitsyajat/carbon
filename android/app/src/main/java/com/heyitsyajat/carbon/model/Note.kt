package com.heyitsyajat.carbon.model

/** A Markdown file inside the vault. [path] is vault-relative with forward slashes. */
data class NoteMeta(
    val path: String,
    val title: String,
    val folder: String,
    val modified: Long,
    val size: Long,
)

data class Note(
    val meta: NoteMeta,
    val content: String,
)

data class OutlineEntry(
    val level: Int,
    val text: String,
    val line: Int,
)

data class WikiLink(
    val target: String,
    val label: String,
)

data class SearchHit(
    val path: String,
    val title: String,
    val snippet: String,
    val line: Int,
    val score: Int,
)

data class LinkIndex(
    val outgoing: Map<String, List<String>> = emptyMap(),
    val backlinks: Map<String, List<String>> = emptyMap(),
    val mentions: Map<String, List<String>> = emptyMap(),
    val unresolved: List<String> = emptyList(),
)

data class GraphNode(
    val path: String,
    val title: String,
    var x: Float,
    var y: Float,
    val degree: Int,
)

data class GraphEdge(val from: String, val to: String)

data class NoteGraph(val nodes: List<GraphNode>, val edges: List<GraphEdge>)
