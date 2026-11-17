package com.heyitsyajat.carbon.domain

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/** Template tokens: {{title}}, {{date}}, {{time}}, {{date:dddd D MMMM}}. */
object Templates {

    val DEFAULT_DAILY = """
        ---
        tags: [daily]
        date: {{date:yyyy-MM-dd}}
        ---

        # {{date:EEEE, d MMMM yyyy}}

        ## Focus
        - 

        ## Notes


        ## Wins

    """.trimIndent()

    val DEFAULT_MEETING = """
        ---
        type: meeting
        tags: [meeting]
        date: {{date:yyyy-MM-dd}}
        ---

        # {{title}} — {{date:EEE d MMM}}

        **Attendees:** 
        **Context:** 

        ## Notes
        - {{time}} 

        ## Decisions

        ## Action items
        - [ ] 

        ## Follow-up

    """.trimIndent()

    val DEFAULT_WELCOME = """
        ---
        tags: [welcome]
        ---

        # Welcome to Carbon

        Carbon keeps your notes as plain Markdown files in a folder you can open anywhere. This vault lives on this phone, and you can export or copy it whenever you like.

        ## Start here

        - Create a note with the **+** button.
        - Link notes with `[[Note name]]` — backlinks and unlinked mentions show up in the panel.
        - Press the graph icon to see how the vault connects.
        - Open today's note from the calendar icon; it uses the daily template.
        - Search everything with the magnifier, or jump between notes with the quick switcher.

        ## AI is optional

        Everything above works without AI. When you want writing help, open **Settings → AI** and add a local Ollama model, any OpenAI-compatible endpoint, or your own API key. Then open the assistant and try:

        - **Continue** to write the next few sentences in your voice.
        - **Rewrite** on a selected paragraph.
        - **Actions** to pull checkboxes and owners out of meeting notes.

        #carbon #welcome
    """.trimIndent()

    private val VARIABLE = Regex("""\{\{\s*([a-z]+)(?::([^}]+))?\s*}}""", RegexOption.IGNORE_CASE)

    fun resolve(template: String, title: String, date: LocalDateTime): String =
        VARIABLE.replace(template) { match ->
            when (match.groupValues[1].lowercase()) {
                "title" -> title
                "date" -> format(match.groupValues[2].ifBlank { "yyyy-MM-dd" }, date.toLocalDate())
                "time" -> formatTime(match.groupValues[2].ifBlank { "HH:mm" }, date)
                else -> match.value
            }
        }

    /** Accepts the desktop token set (dddd, ddd, D, YYYY) and Java patterns. */
    private fun javaPattern(pattern: String): String = pattern
        .replace("dddd", "EEEE")
        .replace("ddd", "EEE")
        .replace("YYYY", "yyyy")
        .replace("YY", "yy")
        .replace("D", "d")

    fun format(pattern: String, date: LocalDate): String = runCatching {
        DateTimeFormatter.ofPattern(javaPattern(pattern)).format(date)
    }.getOrElse { date.toString() }

    fun formatTime(pattern: String, dateTime: LocalDateTime): String = runCatching {
        DateTimeFormatter.ofPattern(javaPattern(pattern)).format(dateTime)
    }.getOrElse { dateTime.toLocalTime().toString() }

    fun dailyPath(folder: String, pattern: String, date: LocalDate): String {
        val name = format(pattern.ifBlank { "yyyy-MM-dd" }, date)
            .replace(Regex("""[<>:"/\\|?*]"""), "-")
        val clean = folder.trim('/').trim()
        return if (clean.isEmpty()) "$name.md" else "$clean/$name.md"
    }

    fun meetingPath(date: LocalDateTime, title: String): String {
        val stamp = format("yyyy-MM-dd HHmm", date.toLocalDate())
        val clean = title.trim().replace(Regex("""[<>:"/\\|?*]"""), "").take(80).ifBlank { "Meeting" }
        return "Meetings/$stamp — $clean.md"
    }
}
