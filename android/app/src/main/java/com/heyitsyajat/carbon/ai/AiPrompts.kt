package com.heyitsyajat.carbon.ai

enum class AiAction(val id: String, val label: String) {
    CONTINUE("continue", "Continue"),
    REWRITE("rewrite", "Rewrite"),
    SUMMARIZE("summarize", "Summarize"),
    BULLETS("bullets", "Bullets"),
    TABLE("table", "Table"),
    ACTIONS("action-items", "Actions"),
    CHAT("chat", "Ask about this note"),
    CUSTOM("custom", "Custom instruction"),
    MEETING("meeting", "Meeting transcript");

    companion object {
        fun from(id: String): AiAction = entries.firstOrNull { it.id == id } ?: CONTINUE
    }
}

data class ChatMessage(val role: String, val content: String)

data class PromptContext(
    val action: AiAction,
    val noteTitle: String = "Untitled note",
    val noteContent: String = "",
    val selection: String? = null,
    val extraNotes: List<Pair<String, String>> = emptyList(),
    val instruction: String? = null,
    val maxChars: Int = 12_000,
)

object AiPrompts {

    private const val SYSTEM = "You are the writing assistant inside Carbon, a local-first Markdown notes app. " +
        "Return only the requested content as GitHub-flavoured Markdown. Do not wrap the whole answer in a code fence. " +
        "Do not add a preamble, an apology, or a closing offer of further help. " +
        "Preserve the author's voice, terminology and formatting unless asked to change them. " +
        "Never invent facts, names, dates or links."

    private val INSTRUCTIONS = mapOf(
        AiAction.CONTINUE to "Continue the note from exactly where the author stopped. Write 2-4 sentences or a short paragraph that follows naturally. Do not repeat the last sentence, do not summarise, and do not add headings.",
        AiAction.REWRITE to "Rewrite the supplied text so it is clearer and tighter while keeping the same meaning and point of view. Keep Markdown formatting. Return only the rewritten text.",
        AiAction.SUMMARIZE to "Summarise the supplied note in 3-6 bullet points (or a short paragraph if it is very short). Start with the single most important point.",
        AiAction.BULLETS to "Convert the supplied text into a tight Markdown bullet list. Keep concrete details, group related points, and use at most two levels of nesting. Return only the list.",
        AiAction.TABLE to "Convert the supplied text into a single Markdown table. Choose at most four meaningful columns, add a header row, and do not invent data that is not present.",
        AiAction.ACTIONS to "Extract the action items from the supplied text as a Markdown checklist (\"- [ ] ...\"). Add an owner or due date in bold when the text states one. If there are none, write \"No action items found.\".",
    )

    private val USER_PROMPTS = mapOf(
        AiAction.CONTINUE to "Continue this note:",
        AiAction.REWRITE to "Rewrite this text:",
        AiAction.SUMMARIZE to "Summarise this note:",
        AiAction.BULLETS to "Turn this into bullets:",
        AiAction.TABLE to "Turn this into a table:",
        AiAction.ACTIONS to "Extract the action items from this note:",
    )

    fun build(context: PromptContext, systemPrompt: String = ""): List<ChatMessage> {
        val extra = systemPrompt.trim()
        val system = if (extra.isEmpty()) SYSTEM else "$SYSTEM\n\nAdditional standing instructions from the author:\n$extra"
        val messages = mutableListOf(ChatMessage("system", system))
        val max = context.maxChars
        val noteSections = buildList {
            if (context.noteContent.isNotBlank()) {
                add("<note title=\"${context.noteTitle.replace("\"", "&quot;")}\">\n${context.noteContent.take(max)}\n</note>")
            }
            context.extraNotes.take(5).forEach { (title, content) ->
                add("<note title=\"${title.replace("\"", "&quot;")}\">\n${content.take(minOf(max, 6_000))}\n</note>")
            }
        }

        when (context.action) {
            AiAction.CHAT -> {
                val parts = mutableListOf(context.instruction?.trim().orEmpty().ifBlank { "What are the key ideas in this note?" })
                if (noteSections.isNotEmpty()) {
                    parts += ""
                    parts += "Notes:"
                    parts += noteSections
                }
                messages += ChatMessage("user", parts.joinToString("\n"))
            }

            AiAction.MEETING -> {
                val transcript = context.selection?.trim().orEmpty().ifBlank { context.noteContent }
                messages += ChatMessage(
                    "user",
                    listOf(
                        "Turn this meeting transcript into durable notes. Return exactly two Markdown sections:",
                        "",
                        "## Summary",
                        "4-6 bullets covering only what was actually said.",
                        "",
                        "## Action items",
                        "A checklist (`- [ ]`) with an owner in bold where one is named. If nothing was agreed, write \"No action items found.\"",
                        "",
                        "Do not invent attendees, decisions or dates.",
                        "",
                        "Transcript:",
                        transcript.take(max),
                    ).joinToString("\n"),
                )
            }

            AiAction.CUSTOM -> {
                val parts = mutableListOf(
                    context.instruction?.trim()?.let { "Task: $it" } ?: "Improve this note.",
                    "Work on the text supplied below and return only the result.",
                )
                val target = context.selection?.trim().orEmpty().ifBlank { context.noteContent }
                if (target.isNotBlank()) {
                    parts += ""
                    parts += "Text:"
                    parts += target.take(max)
                }
                if (!context.selection.isNullOrBlank() && noteSections.isNotEmpty()) {
                    parts += ""
                    parts += "Full note for context:"
                    parts += noteSections
                }
                messages += ChatMessage("user", parts.joinToString("\n"))
            }

            else -> {
                val instruction = INSTRUCTIONS.getValue(context.action)
                val parts = mutableListOf(instruction, "")
                val selection = context.selection?.trim()
                if (context.action == AiAction.CONTINUE) {
                    parts += USER_PROMPTS.getValue(context.action)
                    parts += ""
                    parts += (selection?.ifBlank { null } ?: context.noteContent).take(max)
                } else if (!selection.isNullOrBlank()) {
                    parts += USER_PROMPTS.getValue(context.action)
                    parts += ""
                    parts += selection.take(max)
                    if (context.extraNotes.isNotEmpty()) {
                        parts += ""
                        parts += "Related notes for context:"
                        parts += noteSections
                    }
                } else {
                    parts += USER_PROMPTS.getValue(context.action)
                    parts += ""
                    parts += noteSections.joinToString("\n\n").ifBlank { "(empty note)" }
                }
                messages += ChatMessage("user", parts.joinToString("\n"))
            }
        }
        return messages
    }

    fun describe(context: PromptContext): String {
        val scope = when {
            !context.selection.isNullOrBlank() -> "selection"
            context.extraNotes.isNotEmpty() -> "${1 + context.extraNotes.size} notes"
            else -> "current note"
        }
        val instruction = context.instruction?.trim()
        return if (context.action == AiAction.CUSTOM && !instruction.isNullOrBlank()) {
            "${instruction.take(80)} · $scope"
        } else {
            "${context.action.label} · $scope"
        }
    }
}
