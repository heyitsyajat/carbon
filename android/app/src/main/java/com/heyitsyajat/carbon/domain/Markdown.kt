package com.heyitsyajat.carbon.domain

import com.heyitsyajat.carbon.model.OutlineEntry
import com.heyitsyajat.carbon.model.WikiLink

/** Markdown parsing shared by the editor, search, graph and preview. Pure Kotlin. */
object Markdown {

    private val WIKI = Regex("""\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?]]""")
    private val INLINE_TAG = Regex("""(?<![\w#])#([A-Za-z0-9_][A-Za-z0-9_/-]*)""")
    private val HEADING = Regex("""^(#{1,6})\s+(.*)$""")
    private val FENCE = Regex("""^\s*(```|~~~)""")

    fun titleFromPath(path: String): String =
        path.substringAfterLast('/').removeSuffix(".md").ifBlank { "Untitled" }

    fun folderOf(path: String): String = path.substringBeforeLast('/', "")

    fun displayName(path: String): String = path.substringAfterLast('/')

    /** Front matter `tags:` entries plus inline #tags, excluding fenced code. */
    fun extractTags(content: String): Set<String> {
        val tags = linkedSetOf<String>()
        val lines = content.lines()
        var inFrontMatter = lines.firstOrNull()?.trim() == "---"
        var inFence = false

        lines.forEachIndexed { index, raw ->
            val line = raw.trim()
            if (inFrontMatter) {
                if (index > 0 && line == "---") {
                    inFrontMatter = false
                    return@forEachIndexed
                }
                if (line.startsWith("tags:", ignoreCase = true)) {
                    line.substringAfter(':')
                        .trim()
                        .removePrefix("[")
                        .removeSuffix("]")
                        .split(',')
                        .map { it.trim().removePrefix("#") }
                        .filter { it.isNotEmpty() }
                        .forEach { tags += it }
                }
                return@forEachIndexed
            }
            if (FENCE.containsMatchIn(raw)) {
                inFence = !inFence
                return@forEachIndexed
            }
            if (inFence) return@forEachIndexed
            if (HEADING.matches(line)) return@forEachIndexed
            val withoutCode = raw.replace(Regex("`[^`]*`"), "")
            INLINE_TAG.findAll(withoutCode).forEach { tags += it.groupValues[1] }
        }
        return tags
    }

    fun extractWikiLinks(content: String): List<WikiLink> =
        WIKI.findAll(content).map { match ->
            val target = match.groupValues[1].trim()
            val label = match.groupValues[2].trim().ifBlank { target }
            WikiLink(target = target, label = label)
        }.toList()

    fun extractOutline(content: String): List<OutlineEntry> {
        val entries = mutableListOf<OutlineEntry>()
        var inFence = false
        content.lines().forEachIndexed { index, line ->
            if (FENCE.containsMatchIn(line)) {
                inFence = !inFence
                return@forEachIndexed
            }
            if (inFence) return@forEachIndexed
            val match = HEADING.matchEntire(line.trim()) ?: return@forEachIndexed
            val text = stripInline(match.groupValues[2])
            if (text.isNotBlank()) entries += OutlineEntry(match.groupValues[1].length, text, index)
        }
        return entries
    }

    fun firstHeadingOrTitle(content: String, fallback: String): String =
        extractOutline(content).firstOrNull()?.text ?: fallback

    /** Removes Markdown syntax so text can be shown in lists and previews. */
    fun stripInline(text: String): String = text
        .replace(WIKI, "$1")
        .replace(Regex("""!\[([^\]]*)]\([^)]*\)"""), "$1")
        .replace(Regex("""\[([^\]]*)]\([^)]*\)"""), "$1")
        .replace(Regex("""`([^`]*)`"""), "$1")
        .replace(Regex("""\*\*([^*]*)\*\*"""), "$1")
        .replace(Regex("""__([^_]*)__"""), "$1")
        .replace(Regex("""\*([^*]*)\*"""), "$1")
        .replace(Regex("""_([^_]*)_"""), "$1")
        .replace(Regex("""~~([^~]*)~~"""), "$1")
        .trim()

    /** A short, readable excerpt around the first match of [query]. */
    fun snippet(content: String, query: String, radius: Int = 70): Pair<String, Int> {
        val plainLines = content.lines()
        val index = if (query.isBlank()) 0 else plainLines.indexOfFirst { it.contains(query, ignoreCase = true) }.coerceAtLeast(0)
        val raw = plainLines.getOrElse(index) { "" }
        val clean = stripInline(raw)
        if (query.isBlank() || clean.length <= radius * 2) return clean to (index + 1)
        val at = clean.indexOf(query, ignoreCase = true).coerceAtLeast(0)
        val start = (at - radius).coerceAtLeast(0)
        val end = (start + radius * 2).coerceAtMost(clean.length)
        val prefix = if (start > 0) "…" else ""
        val suffix = if (end < clean.length) "…" else ""
        return (prefix + clean.substring(start, end) + suffix) to (index + 1)
    }

    /** Applies a simple inline emphasis transform for compact labels. */
    fun plain(text: String): String = stripInline(text)
}
