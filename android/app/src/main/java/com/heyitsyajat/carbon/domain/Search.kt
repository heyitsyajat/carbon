package com.heyitsyajat.carbon.domain

import com.heyitsyajat.carbon.model.Note
import com.heyitsyajat.carbon.model.SearchHit

/** Search and fuzzy matching over plain Kotlin models. */
object Search {

    fun vault(
        notes: List<Note>,
        query: String,
        tag: String? = null,
        folder: String? = null,
    ): List<SearchHit> {
        val trimmed = query.trim()
        if (trimmed.isEmpty() && tag == null && folder == null) return emptyList()
        val tokens = trimmed.lowercase().split(Regex("""\s+""")).filter { it.isNotEmpty() }

        return notes.mapNotNull { note ->
            if (tag != null && !Markdown.extractTags(note.content).any { it.equals(tag, ignoreCase = true) }) {
                return@mapNotNull null
            }
            if (folder != null && !note.meta.folder.startsWith(folder)) return@mapNotNull null

            val title = note.meta.title
            val body = note.content
            var score = 0
            if (tokens.isEmpty()) score = 1
            for (token in tokens) {
                val inTitle = title.contains(token, ignoreCase = true)
                val inBody = body.contains(token, ignoreCase = true)
                if (!inTitle && !inBody) return@mapNotNull null
                if (inTitle) score += 40
                if (body.contains(token)) score += 8
            }
            if (title.startsWith(trimmed, ignoreCase = true) && trimmed.isNotEmpty()) score += 30
            val (snippet, line) = Markdown.snippet(body, trimmed)
            SearchHit(note.meta.path, title, snippet, line, score)
        }.sortedWith(compareByDescending<SearchHit> { it.score }.thenBy { it.title.lowercase() })
    }

    /** Fuzzy score with bonuses for word starts, or null when not all characters match. */
    fun fuzzyScore(query: String, candidate: String): Int? {
        val needle = query.trim().lowercase()
        if (needle.isEmpty()) return 0
        val hay = candidate.lowercase()
        var score = 0
        var index = 0
        var lastMatch = -2
        for (char in needle) {
            if (char == ' ') continue
            val found = hay.indexOf(char, index)
            if (found < 0) return null
            score += if (found == lastMatch + 1) 12 else 4
            if (found == 0 || hay[found - 1] == ' ' || hay[found - 1] == '/' || hay[found - 1] == '-') score += 10
            lastMatch = found
            index = found + 1
        }
        score -= hay.length / 12
        if (hay.contains(needle)) score += 40
        if (hay.startsWith(needle)) score += 30
        return score
    }

    fun quickSwitch(notes: List<Note>, query: String, limit: Int = 40): List<Note> {
        if (query.isBlank()) return notes.sortedBy { it.meta.title.lowercase() }.take(limit)
        return notes.mapNotNull { note ->
            val titleScore = fuzzyScore(query, note.meta.title)
            val pathScore = fuzzyScore(query, note.meta.path)
            val best = listOfNotNull(titleScore?.plus(20), pathScore).maxOrNull() ?: return@mapNotNull null
            note to best
        }.sortedByDescending { it.second }.take(limit).map { it.first }
    }
}
