package com.heyitsyajat.carbon.data

import android.content.Context
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import com.heyitsyajat.carbon.domain.Markdown
import com.heyitsyajat.carbon.domain.Templates
import com.heyitsyajat.carbon.model.Note
import com.heyitsyajat.carbon.model.NoteMeta
import java.io.File

/**
 * A vault is a folder of Markdown files. Every path is validated to stay
 * inside the vault root before anything is read or written.
 */
class VaultRepository(context: Context) {

    private val appContext = context.applicationContext

    val root: File
        get() = File(appContext.getExternalFilesDir(null) ?: appContext.filesDir, "vault")

    fun ensureVault(): File {
        val dir = root
        if (!dir.exists()) dir.mkdirs()
        if (dir.listFiles().isNullOrEmpty()) {
            write("Welcome.md", Templates.DEFAULT_WELCOME)
            write(
                "Notes/How Carbon stores your notes.md",
                """
                # How Carbon stores your notes

                Every note in this vault is a `.md` file. Nothing is stored in a database, so you can copy this folder, open it in another editor, or back it up with any tool.

                - Vault folder: `vault`
                - Files: Markdown, UTF-8
                - Settings and AI keys stay outside the vault

                Link a note with `[[Welcome]]` and it appears under Backlinks.
                """.trimIndent(),
            )
            write(
                "Notes/Weekly review.md",
                """
                ---
                tags: [review]
                ---

                # Weekly review

                ## What moved
                - 

                ## What is blocked
                - 

                ## Next week
                - [ ] 

                #review
                """.trimIndent(),
            )
        }
        return dir
    }

    fun list(): List<NoteMeta> {
        ensureVault()
        val rootPath = root.canonicalFile
        return root.walkTopDown()
            .filter { it.isFile && it.extension.equals("md", ignoreCase = true) }
            .mapNotNull { file ->
                runCatching {
                    val relative = file.canonicalFile.relativeTo(rootPath).invariantSeparatorsPath
                    val name = Markdown.titleFromPath(relative)
                    NoteMeta(
                        path = relative,
                        title = name,
                        folder = Markdown.folderOf(relative),
                        modified = file.lastModified(),
                        size = file.length(),
                    )
                }.getOrNull()
            }
            .sortedWith(compareBy({ it.folder.lowercase() }, { it.title.lowercase() }))
            .toList()
    }

    fun loadAll(): List<Note> = list().mapNotNull { meta ->
        runCatching { Note(meta, read(meta.path)) }.getOrNull()
    }

    fun read(path: String): String = resolve(path).readText(Charsets.UTF_8)

    fun write(path: String, content: String) {
        val file = resolve(path)
        file.parentFile?.mkdirs()
        file.writeText(content, Charsets.UTF_8)
    }

    fun create(path: String, content: String): String {
        val file = resolve(path)
        if (file.exists()) throw IllegalStateException("A note called ${file.name} already exists.")
        file.parentFile?.mkdirs()
        file.writeText(content, Charsets.UTF_8)
        return path
    }

    fun createFolder(path: String) {
        resolve(path).mkdirs()
    }

    fun rename(oldPath: String, newPath: String) {
        val source = resolve(oldPath)
        val target = resolve(newPath)
        if (target.exists()) throw IllegalStateException("A note called ${target.name} already exists.")
        target.parentFile?.mkdirs()
        if (!source.renameTo(target)) throw IllegalStateException("The note could not be renamed.")
    }

    fun delete(path: String) {
        val file = resolve(path)
        if (!file.delete()) throw IllegalStateException("The note could not be deleted.")
    }

    fun folderTree(): List<String> {
        ensureVault()
        val rootPath = root.canonicalFile
        return root.walkTopDown()
            .filter { it.isDirectory && it != root }
            .map { it.canonicalFile.relativeTo(rootPath).invariantSeparatorsPath }
            .sorted()
            .toList()
    }

    fun importTree(uri: Uri): Int {
        val source = DocumentFile.fromTreeUri(appContext, uri) ?: return 0
        var imported = 0
        val baseName = source.name?.take(60)?.ifBlank { "Imported" } ?: "Imported"
        val targetFolder = uniqueFolder("Imported/$baseName")
        source.walk().forEach { doc ->
            if (doc.isFile && doc.name?.endsWith(".md", ignoreCase = true) == true) {
                val relative = doc.name ?: return@forEach
                val stream = appContext.contentResolver.openInputStream(doc.uri) ?: return@forEach
                val text = stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                write("$targetFolder/$relative", text)
                imported += 1
            }
        }
        return imported
    }

    private fun uniqueFolder(base: String): String {
        var candidate = base
        var index = 2
        while (resolve(candidate).exists()) {
            candidate = "$base $index"
            index += 1
        }
        resolve(candidate).mkdirs()
        return candidate
    }

    /** Resolves a vault-relative path, rejecting traversal outside the vault. */
    private fun resolve(path: String): File {
        ensureRootOnly()
        val clean = path.replace('\\', '/').trimStart('/')
        if (clean.isBlank()) throw IllegalArgumentException("That path is empty.")
        val file = File(root, clean).canonicalFile
        val rootPath = root.canonicalFile
        if (file != rootPath && !file.path.startsWith(rootPath.path + File.separator)) {
            throw IllegalArgumentException("That path is outside the vault.")
        }
        return file
    }

    private fun ensureRootOnly() {
        if (!root.exists()) root.mkdirs()
    }

    private fun DocumentFile.walk(): Sequence<DocumentFile> = sequence {
        yield(this@walk)
        if (isDirectory) {
            listFiles().forEach { child -> yieldAll(child.walk()) }
        }
    }
}
