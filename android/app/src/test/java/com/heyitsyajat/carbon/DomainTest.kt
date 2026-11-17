package com.heyitsyajat.carbon

import com.heyitsyajat.carbon.domain.Graph
import com.heyitsyajat.carbon.domain.Markdown
import com.heyitsyajat.carbon.domain.Search
import com.heyitsyajat.carbon.domain.Templates
import com.heyitsyajat.carbon.model.Note
import com.heyitsyajat.carbon.model.NoteMeta
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

class DomainTest {

    private fun note(path: String, content: String): Note = Note(
        NoteMeta(path, Markdown.titleFromPath(path), Markdown.folderOf(path), 0, content.length.toLong()),
        content,
    )

    @Test
    fun `tags come from front matter and inline text but not code`() {
        val content = """
            ---
            tags: [daily, work]
            ---
            # Heading

            Some #inline text and `#notatag` inside code.
            ```
            #codeblock
            ```
        """.trimIndent()
        assertEquals(setOf("daily", "work", "inline"), Markdown.extractTags(content))
    }

    @Test
    fun `wiki links keep target and label`() {
        val links = Markdown.extractWikiLinks("See [[Weekly review]] and [[Carbon|the app]] and [[Ideas#Later]].")
        assertEquals(listOf("Weekly review", "Carbon", "Ideas"), links.map { it.target })
        assertEquals("the app", links[1].label)
    }

    @Test
    fun `outline ignores headings inside fences`() {
        val outline = Markdown.extractOutline("# One\n\n```\n# Not a heading\n```\n\n## Two")
        assertEquals(listOf("One", "Two"), outline.map { it.text })
        assertEquals(0, outline.first().line)
    }

    @Test
    fun `daily note path uses the configured pattern`() {
        val path = Templates.dailyPath("Daily", "yyyy-MM-dd", LocalDate.of(2026, 11, 17))
        assertEquals("Daily/2026-11-17.md", path)
    }

    @Test
    fun `template variables resolve title date and weekday tokens`() {
        val resolved = Templates.resolve(
            "# {{title}} — {{date:EEEE, d MMMM yyyy}} at {{time}}",
            "Weekly sync",
            LocalDateTime.of(2026, 11, 17, 9, 5),
        )
        assertEquals("# Weekly sync — Tuesday, 17 November 2026 at 09:05", resolved)
    }

    @Test
    fun `desktop weekday tokens are supported`() {
        val resolved = Templates.resolve("{{date:ddd D MMM}}", "x", LocalDateTime.of(2026, 11, 17, 9, 0))
        assertEquals("Tue 17 Nov", resolved)
    }

    @Test
    fun `search finds text and ranks title matches first`() {
        val notes = listOf(
            note("Pricing.md", "We decided to raise prices in March."),
            note("Meeting notes.md", "Discussed pricing and packaging."),
            note("Random.md", "Nothing here."),
        )
        val hits = Search.vault(notes, "pricing")
        assertEquals(2, hits.size)
        assertEquals("Pricing", hits.first().title)
    }

    @Test
    fun `search respects tag filter`() {
        val notes = listOf(
            note("A.md", "#work\nAlpha"),
            note("B.md", "#personal\nAlpha"),
        )
        val hits = Search.vault(notes, "alpha", tag = "personal")
        assertEquals(listOf("B.md"), hits.map { it.path })
    }

    @Test
    fun `fuzzy matching rejects missing letters and rewards prefixes`() {
        assertNull(Search.fuzzyScore("zzz", "Weekly review"))
        val prefix = Search.fuzzyScore("week", "Weekly review")!!
        val middle = Search.fuzzyScore("week", "My weekly review")!!
        assertTrue(prefix > middle)
    }

    @Test
    fun `graph links notes by title and reports unresolved targets`() {
        val notes = listOf(
            note("Welcome.md", "See [[Weekly review]] and [[Missing note]]."),
            note("Weekly review.md", "Back to [[Welcome]]."),
        )
        val index = Graph.index(notes)
        assertEquals(listOf("Weekly review.md"), index.outgoing["Welcome.md"])
        assertEquals(listOf("Welcome.md"), index.backlinks["Weekly review.md"])
        assertEquals(listOf("Missing note"), index.unresolved)

        val graph = Graph.build(notes, index)
        assertEquals(2, graph.nodes.size)
        assertTrue(graph.edges.any { it.from == "Welcome.md" })
        graph.nodes.forEach {
            assertTrue(it.x in 0f..300f)
            assertTrue(it.y in 0f..300f)
        }
    }

    @Test
    fun `mentions find unlinked titles`() {
        val notes = listOf(
            note("Carbon roadmap.md", "Plan."),
            note("Notes.md", "The Carbon roadmap says hello."),
        )
        val index = Graph.index(notes)
        assertEquals(listOf("Notes.md"), index.mentions["Carbon roadmap.md"])
    }
}
