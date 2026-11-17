package com.heyitsyajat.carbon.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.ClickableText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.heyitsyajat.carbon.domain.Markdown

private sealed interface Block {
    data class Heading(val level: Int, val text: String) : Block
    data class Paragraph(val text: String) : Block
    data class Bullets(val items: List<String>, val ordered: Boolean) : Block
    data class Tasks(val items: List<Pair<Boolean, String>>) : Block
    data class Quote(val text: String) : Block
    data class Code(val language: String, val code: String) : Block
    data class Table(val rows: List<List<String>>) : Block
    data object Divider : Block
}

private enum class LinkKind { WIKI, EXTERNAL, TAG }

private data class LinkSpan(val start: Int, val end: Int, val target: String, val kind: LinkKind)

private val FENCE = Regex("""^\s*(```|~~~)\s*([\w+-]*)""")
private val HEADING = Regex("""^(#{1,6})\s+(.*)$""")
private val TASK = Regex("""^\s*[-*+]\s+\[([ xX])]\s+(.*)$""")
private val BULLET = Regex("""^\s*[-*+]\s+(.*)$""")
private val ORDERED = Regex("""^\s*\d+\.\s+(.*)$""")
private val RULE = Regex("""^\s*([-*_])(\s*\1){2,}\s*$""")
private val TABLE_DIVIDER = Regex("""^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$""")
private val INLINE = Regex(
    """(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|~~[^~\n]+~~|\[\[[^\]]+]]|\[[^\]]+]\([^)]*\)|https?://\S+|#[\w][\w/-]*)""",
)

/** Renders Markdown with the same warm typography as the desktop app. */
@Composable
fun MarkdownView(
    markdown: String,
    onWikiLink: (String) -> Unit,
    onTag: (String) -> Unit,
    onExternal: (String) -> Unit,
    modifier: Modifier = Modifier,
    textSize: TextUnit = 16.sp,
) {
    val blocks = remember(markdown) { parseBlocks(markdown) }
    val colors = MaterialTheme.colorScheme
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        blocks.forEach { block ->
            when (block) {
                is Block.Heading -> {
                    val size = when (block.level) {
                        1 -> 30.sp
                        2 -> 24.sp
                        3 -> 20.sp
                        else -> 17.sp
                    }
                    Text(
                        text = Markdown.plain(block.text),
                        fontFamily = FontFamily.Serif,
                        fontWeight = FontWeight.Medium,
                        fontSize = size,
                        lineHeight = size * 1.25f,
                        color = colors.onBackground,
                        modifier = Modifier.padding(top = if (block.level == 1) 6.dp else 10.dp),
                    )
                }

                is Block.Paragraph -> InlineText(
                    text = block.text,
                    textSize = textSize,
                    onWikiLink = onWikiLink,
                    onTag = onTag,
                    onExternal = onExternal,
                )

                is Block.Bullets -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    block.items.forEachIndexed { index, item ->
                        Row(verticalAlignment = Alignment.Top) {
                            Text(
                                text = if (block.ordered) "${index + 1}." else "•",
                                color = colors.primary,
                                fontSize = textSize,
                                lineHeight = textSize * 1.6f,
                                modifier = Modifier.width(if (block.ordered) 24.dp else 16.dp),
                            )
                            InlineText(
                                text = item,
                                textSize = textSize,
                                onWikiLink = onWikiLink,
                                onTag = onTag,
                                onExternal = onExternal,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }

                is Block.Tasks -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    block.items.forEach { (checked, item) ->
                        Row(verticalAlignment = Alignment.Top) {
                            Text(
                                text = if (checked) "☑" else "☐",
                                color = if (checked) colors.primary else colors.outline,
                                fontSize = textSize,
                                lineHeight = textSize * 1.6f,
                                modifier = Modifier.width(22.dp),
                            )
                            InlineText(
                                text = item,
                                textSize = textSize,
                                onWikiLink = onWikiLink,
                                onTag = onTag,
                                onExternal = onExternal,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }

                is Block.Quote -> Row(Modifier.fillMaxWidth()) {
                    Box(
                        Modifier
                            .width(3.dp)
                            .height(if (block.text.length > 90) 60.dp else 28.dp)
                            .background(colors.primary.copy(alpha = 0.5f)),
                    )
                    Spacer(Modifier.width(10.dp))
                    InlineText(
                        text = block.text,
                        textSize = textSize,
                        onWikiLink = onWikiLink,
                        onTag = onTag,
                        onExternal = onExternal,
                        muted = true,
                        modifier = Modifier.weight(1f),
                    )
                }

                is Block.Code -> Column(
                    Modifier
                        .fillMaxWidth()
                        .background(colors.surfaceContainerHighest, MaterialTheme.shapes.small)
                        .padding(12.dp)
                        .horizontalScroll(rememberScrollState()),
                ) {
                    if (block.language.isNotBlank()) {
                        Text(
                            block.language,
                            fontSize = 10.sp,
                            color = colors.onSurfaceVariant.copy(alpha = 0.7f),
                            fontWeight = FontWeight.Medium,
                        )
                        Spacer(Modifier.height(4.dp))
                    }
                    Text(
                        text = block.code,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.5.sp,
                        lineHeight = 19.sp,
                        color = colors.onBackground,
                    )
                }

                is Block.Table -> Column(
                    Modifier
                        .fillMaxWidth()
                        .background(colors.surface, MaterialTheme.shapes.small),
                ) {
                    block.rows.forEachIndexed { index, row ->
                        Row(Modifier.fillMaxWidth()) {
                            row.forEach { cell ->
                                Text(
                                    text = Markdown.plain(cell.trim()),
                                    modifier = Modifier
                                        .weight(1f)
                                        .padding(horizontal = 8.dp, vertical = 7.dp),
                                    fontSize = 13.sp,
                                    fontWeight = if (index == 0) FontWeight.SemiBold else FontWeight.Normal,
                                    color = if (index == 0) colors.onBackground else colors.onSurfaceVariant,
                                )
                            }
                        }
                        if (index < block.rows.lastIndex) HorizontalDivider(color = colors.outlineVariant)
                    }
                }

                Block.Divider -> HorizontalDivider(color = colors.outlineVariant, modifier = Modifier.padding(vertical = 6.dp))
            }
        }
        Spacer(Modifier.height(48.dp))
    }
}

@Composable
private fun InlineText(
    text: String,
    textSize: TextUnit,
    onWikiLink: (String) -> Unit,
    onTag: (String) -> Unit,
    onExternal: (String) -> Unit,
    modifier: Modifier = Modifier,
    muted: Boolean = false,
) {
    val colors = MaterialTheme.colorScheme
    val styled = remember(text, colors.primary, colors.onBackground, colors.surfaceContainerHighest) {
        buildInline(
            text = text,
            accent = colors.primary,
            body = colors.onBackground,
            codeBackground = colors.surfaceContainerHighest,
        )
    }
    ClickableText(
        text = styled.first,
        style = TextStyle(
            fontSize = textSize,
            lineHeight = textSize * 1.65f,
            color = if (muted) colors.onSurfaceVariant else colors.onBackground,
        ),
        modifier = modifier,
        onClick = { offset ->
            styled.second.firstOrNull { offset in it.start until it.end }?.let { span ->
                when (span.kind) {
                    LinkKind.WIKI -> onWikiLink(span.target)
                    LinkKind.TAG -> onTag(span.target)
                    LinkKind.EXTERNAL -> onExternal(span.target)
                }
            }
        },
    )
}

private fun buildInline(
    text: String,
    accent: Color,
    body: Color,
    codeBackground: Color,
): Pair<AnnotatedString, List<LinkSpan>> {
    val spans = mutableListOf<LinkSpan>()
    val builder = buildAnnotatedString {
        var cursor = 0
        for (match in INLINE.findAll(text)) {
            if (match.range.first > cursor) append(text.substring(cursor, match.range.first))
            val token = match.value
            val start = length
            when {
                token.startsWith("[[") -> {
                    val inner = token.removePrefix("[[").removeSuffix("]]")
                    val target = inner.substringBefore('|').substringBefore('#').trim()
                    val label = inner.substringAfter('|', target).trim()
                    pushStyle(SpanStyle(color = accent, textDecoration = TextDecoration.Underline))
                    append(label)
                    pop()
                    spans += LinkSpan(start, length, target, LinkKind.WIKI)
                }

                token.startsWith("[") && token.contains("](") -> {
                    val label = token.substringAfter('[').substringBefore("](")
                    val url = token.substringAfter("](").removeSuffix(")")
                    pushStyle(SpanStyle(color = accent, textDecoration = TextDecoration.Underline))
                    append(label)
                    pop()
                    spans += LinkSpan(start, length, url, LinkKind.EXTERNAL)
                }

                token.startsWith("http") -> {
                    pushStyle(SpanStyle(color = accent, textDecoration = TextDecoration.Underline))
                    append(token)
                    pop()
                    spans += LinkSpan(start, length, token, LinkKind.EXTERNAL)
                }

                token.startsWith("#") -> {
                    pushStyle(SpanStyle(color = accent, background = accent.copy(alpha = 0.08f)))
                    append(token)
                    pop()
                    spans += LinkSpan(start, length, token.removePrefix("#"), LinkKind.TAG)
                }

                token.startsWith("`") -> {
                    pushStyle(
                        SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp,
                            background = codeBackground,
                            color = body,
                        ),
                    )
                    append(token.removeSurrounding("`"))
                    pop()
                }

                token.startsWith("**") || token.startsWith("__") -> {
                    pushStyle(SpanStyle(fontWeight = FontWeight.SemiBold))
                    append(token.substring(2, token.length - 2))
                    pop()
                }

                token.startsWith("~~") -> {
                    pushStyle(SpanStyle(textDecoration = TextDecoration.LineThrough))
                    append(token.substring(2, token.length - 2))
                    pop()
                }

                else -> {
                    pushStyle(SpanStyle(fontStyle = FontStyle.Italic))
                    append(token.substring(1, token.length - 1))
                    pop()
                }
            }
            cursor = match.range.last + 1
        }
        if (cursor < text.length) append(text.substring(cursor))
    }
    return builder to spans
}

private fun isBlockStart(lines: List<String>, index: Int): Boolean {
    val line = lines[index]
    return line.isBlank() || FENCE.containsMatchIn(line) || HEADING.matches(line) ||
        RULE.matches(line) || TASK.matches(line) || BULLET.matches(line) || ORDERED.matches(line) ||
        line.trimStart().startsWith(">") || line.trimStart().startsWith("|")
}

private fun parseBlocks(markdown: String): List<Block> {
    val lines = markdown.lines()
    val blocks = mutableListOf<Block>()
    var index = 0
    while (index < lines.size) {
        val line = lines[index]
        val trimmed = line.trim()
        when {
            trimmed.isEmpty() -> index += 1

            FENCE.containsMatchIn(line) -> {
                val language = FENCE.matchEntire(trimmed)?.groupValues?.get(2).orEmpty()
                index += 1
                val code = mutableListOf<String>()
                while (index < lines.size && !FENCE.containsMatchIn(lines[index])) {
                    code += lines[index]
                    index += 1
                }
                if (index < lines.size) index += 1
                blocks += Block.Code(language, code.joinToString("\n"))
            }

            HEADING.matches(trimmed) -> {
                val match = HEADING.matchEntire(trimmed)!!
                blocks += Block.Heading(match.groupValues[1].length, match.groupValues[2])
                index += 1
            }

            RULE.matches(trimmed) -> {
                blocks += Block.Divider
                index += 1
            }

            TASK.matches(line) -> {
                val items = mutableListOf<Pair<Boolean, String>>()
                while (index < lines.size) {
                    val match = TASK.matchEntire(lines[index].trim()) ?: break
                    items += (match.groupValues[1].lowercase() == "x") to match.groupValues[2]
                    index += 1
                }
                blocks += Block.Tasks(items)
            }

            BULLET.matches(line) || ORDERED.matches(line) -> {
                val ordered = ORDERED.matches(line)
                val items = mutableListOf<String>()
                while (index < lines.size) {
                    val current = lines[index]
                    val match = if (ordered) ORDERED.matchEntire(current.trim()) else BULLET.matchEntire(current.trim())
                    if (match == null) break
                    items += match.groupValues[1]
                    index += 1
                }
                blocks += Block.Bullets(items, ordered)
            }

            trimmed.startsWith(">") -> {
                val quote = mutableListOf<String>()
                while (index < lines.size && lines[index].trimStart().startsWith(">")) {
                    quote += lines[index].trimStart().removePrefix(">").trimStart()
                    index += 1
                }
                blocks += Block.Quote(quote.joinToString(" "))
            }

            trimmed.startsWith("|") && index + 1 < lines.size && TABLE_DIVIDER.matches(lines[index + 1].trim()) -> {
                val rows = mutableListOf<List<String>>()
                rows += parseRow(lines[index])
                index += 2
                while (index < lines.size && lines[index].trimStart().startsWith("|")) {
                    rows += parseRow(lines[index])
                    index += 1
                }
                blocks += Block.Table(rows)
            }

            else -> {
                val paragraph = mutableListOf<String>()
                while (index < lines.size && !isBlockStart(lines, index)) {
                    paragraph += lines[index].trim()
                    index += 1
                }
                if (paragraph.isNotEmpty()) blocks += Block.Paragraph(paragraph.joinToString(" "))
            }
        }
    }
    return blocks
}

private fun parseRow(line: String): List<String> =
    line.trim().trim('|').split('|').map { it.trim() }
