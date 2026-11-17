package com.heyitsyajat.carbon.domain

import com.heyitsyajat.carbon.model.GraphEdge
import com.heyitsyajat.carbon.model.GraphNode
import com.heyitsyajat.carbon.model.LinkIndex
import com.heyitsyajat.carbon.model.Note
import com.heyitsyajat.carbon.model.NoteGraph
import kotlin.math.sqrt
import kotlin.random.Random

object Graph {

    /** Builds backlinks, outgoing links, mentions and unresolved targets. */
    fun index(notes: List<Note>): LinkIndex {
        val byTitle = notes.associateBy { it.meta.title.lowercase() }
        val byPath = notes.associateBy { it.meta.path.lowercase() }
        val outgoing = mutableMapOf<String, MutableList<String>>()
        val backlinks = mutableMapOf<String, MutableList<String>>()
        val mentions = mutableMapOf<String, MutableList<String>>()
        val unresolved = linkedSetOf<String>()

        for (note in notes) {
            val resolved = linkedSetOf<String>()
            for (link in Markdown.extractWikiLinks(note.content)) {
                val target = byTitle[link.target.lowercase()]
                    ?: byPath[(link.target.removeSuffix(".md")).lowercase() + ".md"]
                    ?: byPath[link.target.lowercase()]
                if (target == null) {
                    unresolved += link.target
                    continue
                }
                if (target.meta.path == note.meta.path) continue
                resolved += target.meta.path
                backlinks.getOrPut(target.meta.path) { mutableListOf() }.add(note.meta.path)
            }
            if (resolved.isNotEmpty()) outgoing[note.meta.path] = resolved.toMutableList()
        }

        val noteTitles = notes.map { it.meta.title to it.meta.path }.filter { it.first.length >= 4 }
        for (note in notes) {
            val body = note.content.lowercase()
            for ((title, path) in noteTitles) {
                if (path == note.meta.path) continue
                if (outgoing[note.meta.path]?.contains(path) == true) continue
                if (body.contains(title.lowercase())) {
                    mentions.getOrPut(path) { mutableListOf() }.add(note.meta.path)
                }
            }
        }

        return LinkIndex(
            outgoing = outgoing,
            backlinks = backlinks,
            mentions = mentions,
            unresolved = unresolved.sorted(),
        )
    }

    fun build(notes: List<Note>, index: LinkIndex): NoteGraph {
        val degree = mutableMapOf<String, Int>()
        val edges = mutableListOf<GraphEdge>()
        for ((from, targets) in index.outgoing) {
            for (to in targets) {
                if (from == to) continue
                degree[from] = (degree[from] ?: 0) + 1
                degree[to] = (degree[to] ?: 0) + 1
                edges += GraphEdge(from, to)
            }
        }
        val nodes = notes.mapIndexed { i, note ->
            val angle = i * 2.399963
            GraphNode(
                path = note.meta.path,
                title = note.meta.title,
                x = (sqrt(i + 1f) * 26f) * kotlin.math.cos(angle.toFloat()),
                y = (sqrt(i + 1f) * 26f) * kotlin.math.sin(angle.toFloat()),
                degree = degree[note.meta.path] ?: 0,
            )
        }
        layout(nodes, edges)
        return NoteGraph(nodes, edges)
    }

    /** Deterministic force layout; runs on the caller's thread. */
    private fun layout(nodes: List<GraphNode>, edges: List<GraphEdge>, iterations: Int = 220, width: Float = 720f) {
        if (nodes.size <= 1) return
        val byPath = nodes.associateBy { it.path }
        val area = width * width
        val k = sqrt(area / nodes.size)
        val random = Random(7)

        repeat(iterations) { step ->
            val temperature = (width / 8f) * (1f - step / iterations.toFloat()) + 2f
            for (node in nodes) {
                var dx = 0f
                var dy = 0f
                for (other in nodes) {
                    if (other === node) continue
                    var deltaX = node.x - other.x
                    var deltaY = node.y - other.y
                    var distance = sqrt(deltaX * deltaX + deltaY * deltaY)
                    if (distance < 0.5f) {
                        deltaX = random.nextFloat() - 0.5f
                        deltaY = random.nextFloat() - 0.5f
                        distance = 0.5f
                    }
                    val force = (k * k) / distance
                    dx += deltaX / distance * force
                    dy += deltaY / distance * force
                }
                for (edge in edges) {
                    if (edge.from != node.path && edge.to != node.path) continue
                    val other = byPath[if (edge.from == node.path) edge.to else edge.from] ?: continue
                    val deltaX = node.x - other.x
                    val deltaY = node.y - other.y
                    val distance = (sqrt(deltaX * deltaX + deltaY * deltaY)).coerceAtLeast(0.5f)
                    val force = (distance * distance) / k
                    dx -= deltaX / distance * force
                    dy -= deltaY / distance * force
                }
                val magnitude = sqrt(dx * dx + dy * dy).coerceAtLeast(0.001f)
                node.x += dx / magnitude * minOf(magnitude, temperature)
                node.y += dy / magnitude * minOf(magnitude, temperature)
            }
        }

        val minX = nodes.minOf { it.x }
        val maxX = nodes.maxOf { it.x }
        val minY = nodes.minOf { it.y }
        val maxY = nodes.maxOf { it.y }
        val spanX = (maxX - minX).coerceAtLeast(1f)
        val spanY = (maxY - minY).coerceAtLeast(1f)
        for (node in nodes) {
            node.x = ((node.x - minX) / spanX) * 300f
            node.y = ((node.y - minY) / spanY) * 300f
        }
    }
}
