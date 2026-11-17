package com.heyitsyajat.carbon.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.heyitsyajat.carbon.ai.AiAction
import com.heyitsyajat.carbon.ai.AiClient
import com.heyitsyajat.carbon.ai.AiPrompts
import com.heyitsyajat.carbon.ai.AiRequest
import com.heyitsyajat.carbon.ai.PromptContext
import com.heyitsyajat.carbon.data.AppSettings
import com.heyitsyajat.carbon.data.Provider
import com.heyitsyajat.carbon.data.SettingsStore
import com.heyitsyajat.carbon.data.VaultRepository
import com.heyitsyajat.carbon.domain.Graph
import com.heyitsyajat.carbon.domain.Markdown
import com.heyitsyajat.carbon.domain.Templates
import com.heyitsyajat.carbon.model.LinkIndex
import com.heyitsyajat.carbon.model.Note
import com.heyitsyajat.carbon.model.NoteGraph
import com.heyitsyajat.carbon.model.NoteMeta
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDateTime

enum class EditorMode { EDIT, PREVIEW }

data class AiUiState(
    val running: Boolean = false,
    val result: String = "",
    val error: String? = null,
    val action: AiAction = AiAction.CONTINUE,
    val label: String? = null,
    val selection: String = "",
    val includeLinked: Boolean = true,
    val transcript: String = "",
)

data class UiState(
    val loading: Boolean = true,
    val onboarding: Boolean = false,
    val notes: List<NoteMeta> = emptyList(),
    val allNotes: List<Note> = emptyList(),
    val folders: List<String> = emptyList(),
    val tags: Map<String, Int> = emptyMap(),
    val links: LinkIndex = LinkIndex(),
    val current: Note? = null,
    val draft: String = "",
    val dirty: Boolean = false,
    val editorMode: EditorMode = EditorMode.EDIT,
    val settings: AppSettings = AppSettings(),
    val ai: AiUiState = AiUiState(),
    val drawerOpen: Boolean = false,
    val quickOpen: Boolean = false,
    val searchOpen: Boolean = false,
    val aiOpen: Boolean = false,
    val settingsOpen: Boolean = false,
    val graphOpen: Boolean = false,
    val helpOpen: Boolean = false,
    val searchTag: String? = null,
    val message: String? = null,
)

sealed interface EditorCommand {
    data class Insert(val text: String) : EditorCommand
    data class Wrap(val before: String, val after: String, val placeholder: String) : EditorCommand
    data class ReplaceSelection(val text: String) : EditorCommand
    data class Append(val text: String) : EditorCommand
    data class ScrollToLine(val line: Int) : EditorCommand
}

class CarbonViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = VaultRepository(application)
    private val settingsStore = SettingsStore(application)
    private val aiClient = AiClient()

    private val _state = MutableStateFlow(UiState())
    val state = _state.asStateFlow()
    val editorEvents = MutableSharedFlow<EditorCommand>(extraBufferCapacity = 8)

    private var saveJob: Job? = null
    private var aiJob: Job? = null
    private val saveDelayMs = 650L

    init {
        viewModelScope.launch { bootstrap() }
    }

    private suspend fun bootstrap() {
        val settings = withContext(Dispatchers.IO) { settingsStore.load() }
        val notes = withContext(Dispatchers.IO) {
            repository.ensureVault()
            repository.list()
        }
        _state.update {
            it.copy(
                loading = false,
                settings = settings,
                notes = notes,
                onboarding = !settings.onboardingComplete,
            )
        }
        if (settings.onboardingComplete) {
            val last = settings.lastNotePath?.takeIf { path -> notes.any { it.path == path } }
                ?: notes.firstOrNull()?.path
            if (last != null) openNote(last)
            refreshVault()
        }
    }

    private suspend fun refreshVault() {
        val notes = withContext(Dispatchers.IO) { repository.list() }
        val all = withContext(Dispatchers.IO) { repository.loadAll() }
        val tags = buildMap {
            all.forEach { note ->
                Markdown.extractTags(note.content).forEach { tag -> put(tag, (get(tag) ?: 0) + 1) }
            }
        }.toList().sortedBy { it.first.lowercase() }.toMap()
        val links = withContext(Dispatchers.Default) { Graph.index(all) }
        val folders = withContext(Dispatchers.IO) { repository.folderTree() }
        _state.update {
            it.copy(
                notes = notes,
                allNotes = all,
                tags = tags,
                links = links,
                folders = folders,
                current = it.current?.let { current -> all.firstOrNull { note -> note.meta.path == current.meta.path } ?: current },
            )
        }
    }

    fun dismissMessage() = _state.update { it.copy(message = null) }

    /* ------------------------------- notes ------------------------------- */

    fun openNote(path: String, line: Int? = null) {
        viewModelScope.launch {
            flushSave()
            val meta = _state.value.notes.firstOrNull { it.path == path }
            val content = withContext(Dispatchers.IO) { runCatching { repository.read(path) }.getOrNull() }
            if (meta == null || content == null) {
                _state.update { it.copy(message = "That note could not be opened.") }
                return@launch
            }
            _state.update {
                it.copy(
                    current = Note(meta, content),
                    draft = content,
                    dirty = false,
                    drawerOpen = false,
                    editorMode = EditorMode.EDIT,
                )
            }
            val settings = _state.value.settings.copy(lastNotePath = path)
            _state.update { it.copy(settings = settings) }
            withContext(Dispatchers.IO) { settingsStore.save(settings) }
            if (line != null) editorEvents.emit(EditorCommand.ScrollToLine(line))
        }
    }

    fun onDraftChange(text: String) {
        _state.update { it.copy(draft = text, dirty = true) }
        saveJob?.cancel()
        saveJob = viewModelScope.launch {
            delay(saveDelayMs)
            flushSave()
        }
    }

    fun saveNow() {
        viewModelScope.launch { flushSave(force = true) }
    }

    private suspend fun flushSave(force: Boolean = false) {
        val current = _state.value.current ?: return
        val draft = _state.value.draft
        if (!_state.value.dirty && !force) return
        if (draft == current.content) {
            _state.update { it.copy(dirty = false) }
            return
        }
        val ok = withContext(Dispatchers.IO) {
            runCatching { repository.write(current.meta.path, draft) }.isSuccess
        }
        if (!ok) {
            _state.update { it.copy(message = "The note could not be saved.") }
            return
        }
        val meta = current.meta.copy(modified = System.currentTimeMillis(), size = draft.toByteArray().size.toLong())
        _state.update {
            it.copy(
                current = Note(meta, draft),
                dirty = false,
                notes = it.notes.map { entry -> if (entry.path == meta.path) meta else entry },
            )
        }
        refreshIndexesOnly()
    }

    private suspend fun refreshIndexesOnly() {
        val all = withContext(Dispatchers.IO) { repository.loadAll() }
        val tags = buildMap {
            all.forEach { note ->
                Markdown.extractTags(note.content).forEach { tag -> put(tag, (get(tag) ?: 0) + 1) }
            }
        }.toList().sortedBy { it.first.lowercase() }.toMap()
        val links = withContext(Dispatchers.Default) { Graph.index(all) }
        _state.update { it.copy(allNotes = all, tags = tags, links = links) }
    }

    fun createNote(title: String, folder: String = "") {
        val clean = title.trim().removeSuffix(".md").ifBlank { "Untitled" }
            .replace(Regex("""[<>:"/\\|?*]"""), "-")
        val path = if (folder.isBlank()) "$clean.md" else "${folder.trim('/')}/$clean.md"
        viewModelScope.launch {
            val ok = withContext(Dispatchers.IO) {
                runCatching { repository.create(path, "# $clean\n\n") }.isSuccess
            }
            if (!ok) {
                _state.update { it.copy(message = "A note called “$clean” already exists.") }
                return@launch
            }
            refreshVault()
            openNote(path)
        }
    }

    fun createFolder(name: String) {
        val clean = name.trim().replace(Regex("""[<>:"/\\|?*]"""), "-")
        if (clean.isBlank()) return
        viewModelScope.launch {
            withContext(Dispatchers.IO) { repository.createFolder(clean) }
            refreshVault()
            _state.update { it.copy(message = "Folder created") }
        }
    }

    fun renameCurrent(newTitle: String) {
        val current = _state.value.current ?: return
        val clean = newTitle.trim().removeSuffix(".md").ifBlank { return }
            .replace(Regex("""[<>:"/\\|?*]"""), "-")
        val folder = current.meta.folder
        val newPath = if (folder.isBlank()) "$clean.md" else "$folder/$clean.md"
        if (newPath == current.meta.path) return
        viewModelScope.launch {
            flushSave(force = true)
            val ok = withContext(Dispatchers.IO) {
                runCatching { repository.rename(current.meta.path, newPath) }.isSuccess
            }
            if (!ok) {
                _state.update { it.copy(message = "That note could not be renamed.") }
                return@launch
            }
            refreshVault()
            openNote(newPath)
        }
    }

    fun deleteCurrent() {
        val current = _state.value.current ?: return
        viewModelScope.launch {
            val ok = withContext(Dispatchers.IO) { runCatching { repository.delete(current.meta.path) }.isSuccess }
            if (!ok) {
                _state.update { it.copy(message = "That note could not be deleted.") }
                return@launch
            }
            _state.update { it.copy(current = null, draft = "", dirty = false) }
            refreshVault()
            _state.value.notes.firstOrNull()?.let { openNote(it.path) }
            _state.update { it.copy(message = "Note deleted") }
        }
    }

    fun openDailyNote() {
        val settings = _state.value.settings
        val path = Templates.dailyPath(settings.dailyFolder, settings.dailyFormat, java.time.LocalDate.now())
        viewModelScope.launch {
            val exists = _state.value.notes.any { it.path == path }
            if (!exists) {
                val title = Markdown.titleFromPath(path)
                val body = Templates.resolve(Templates.DEFAULT_DAILY, title, LocalDateTime.now())
                withContext(Dispatchers.IO) {
                    runCatching {
                        if (settings.dailyFolder.isNotBlank()) repository.createFolder(settings.dailyFolder)
                        repository.create(path, body)
                    }
                }
                refreshVault()
            }
            openNote(path)
        }
    }

    fun createMeeting(title: String) {
        val path = Templates.meetingPath(LocalDateTime.now(), title)
        viewModelScope.launch {
            val body = Templates.resolve(Templates.DEFAULT_MEETING, title.trim().ifBlank { "Meeting" }, LocalDateTime.now())
            val ok = withContext(Dispatchers.IO) { runCatching { repository.create(path, body) }.isSuccess }
            if (!ok) {
                _state.update { it.copy(message = "That meeting note already exists.") }
                return@launch
            }
            refreshVault()
            openNote(path)
            _state.update { it.copy(message = "Meeting note created") }
        }
    }

    fun insertTemplate(path: String) {
        viewModelScope.launch {
            val content = withContext(Dispatchers.IO) { runCatching { repository.read(path) }.getOrNull() } ?: return@launch
            val title = _state.value.current?.meta?.title ?: "Note"
            val resolved = Templates.resolve(content, title, LocalDateTime.now())
            editorEvents.emit(EditorCommand.Insert("\n${resolved.trim()}\n"))
        }
    }

    fun insertCommand(command: EditorCommand) {
        viewModelScope.launch { editorEvents.emit(command) }
    }

    fun importFolder(uri: Uri) {
        viewModelScope.launch {
            val count = withContext(Dispatchers.IO) { runCatching { repository.importTree(uri) }.getOrDefault(0) }
            refreshVault()
            _state.update {
                it.copy(message = if (count > 0) "Imported $count note${if (count == 1) "" else "s"}" else "No Markdown files found")
            }
        }
    }

    fun templateNotes(): List<NoteMeta> = _state.value.notes.filter {
        val folder = _state.value.settings.templatesFolder.trim('/')
        folder.isNotEmpty() && it.path.startsWith("$folder/")
    }

    /* -------------------------------- AI -------------------------------- */

    fun runAi(action: AiAction, selection: String? = null, instruction: String? = null, transcript: String? = null) {
        val snapshot = _state.value
        val note = snapshot.current
        if (!snapshot.settings.aiEnabled) {
            _state.update { it.copy(aiOpen = true, ai = it.ai.copy(action = action)) }
            return
        }
        if (note == null) {
            _state.update { it.copy(message = "Open a note first.") }
            return
        }
        aiJob?.cancel()
        val settings = snapshot.settings
        val extra = if (snapshot.ai.includeLinked) linkedContext(note) else emptyList()
        val context = PromptContext(
            action = action,
            noteTitle = note.meta.title,
            noteContent = snapshot.draft,
            selection = selection,
            extraNotes = extra,
            instruction = instruction,
            maxChars = 12_000,
        )
        val request = AiRequest(
            provider = settings.provider,
            baseUrl = settings.baseUrl,
            model = settings.model,
            apiKey = settingsStore.apiKey(settings.provider),
            messages = AiPrompts.build(context, settings.systemPrompt),
            temperature = settings.temperature,
            maxTokens = settings.maxTokens,
        )
        _state.update {
            it.copy(
                aiOpen = true,
                ai = it.ai.copy(
                    running = true,
                    result = "",
                    error = null,
                    action = action,
                    label = AiPrompts.describe(context),
                    selection = selection.orEmpty(),
                ),
            )
        }
        aiJob = viewModelScope.launch {
            try {
                aiClient.stream(request).collect { delta ->
                    _state.update { current -> current.copy(ai = current.ai.copy(result = current.ai.result + delta)) }
                }
                _state.update { it.copy(ai = it.ai.copy(running = false)) }
                if (_state.value.ai.result.isBlank()) {
                    _state.update { it.copy(ai = it.ai.copy(error = "The provider returned an empty response.")) }
                }
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                val message = error.message ?: "The AI request failed."
                _state.update { it.copy(ai = it.ai.copy(running = false, error = message)) }
            }
        }
    }

    fun testAi(onResult: (String) -> Unit) {
        val settings = _state.value.settings
        viewModelScope.launch {
            val request = AiRequest(
                provider = settings.provider,
                baseUrl = settings.baseUrl,
                model = settings.model,
                apiKey = settingsStore.apiKey(settings.provider),
                messages = AiPrompts.build(PromptContext(AiAction.CHAT, instruction = "Say ready")),
            )
            val text = runCatching {
                val builder = StringBuilder()
                aiClient.test(request).collect { builder.append(it) }
                builder.toString().trim()
            }
            onResult(text.getOrElse { it.message ?: "Connection failed" }.ifBlank { "Connected, but the reply was empty" })
        }
    }

    fun cancelAi() {
        aiJob?.cancel()
        _state.update { it.copy(ai = it.ai.copy(running = false)) }
    }

    fun clearAi() = _state.update { it.copy(ai = it.ai.copy(result = "", error = null, label = null)) }

    fun setAiTranscript(text: String) = _state.update { it.copy(ai = it.ai.copy(transcript = text)) }

    fun toggleAiLinked() = _state.update { it.copy(ai = it.ai.copy(includeLinked = !it.ai.includeLinked)) }

    fun applyAi(mode: AiApply) {
        val result = _state.value.ai.result.trim()
        if (result.isEmpty()) return
        val command = when (mode) {
            AiApply.INSERT -> EditorCommand.Insert("\n$result\n")
            AiApply.APPEND -> EditorCommand.Append("\n$result\n")
            AiApply.REPLACE -> EditorCommand.ReplaceSelection(result)
        }
        viewModelScope.launch { editorEvents.emit(command) }
        _state.update { it.copy(aiOpen = false, message = "Inserted assistant text") }
    }

    private fun linkedContext(note: Note): List<Pair<String, String>> {
        val paths = (repository.let {
            val links = _state.value.links
            (links.outgoing[note.meta.path].orEmpty() + links.backlinks[note.meta.path].orEmpty()).distinct()
        }).take(5)
        return paths.mapNotNull { path ->
            _state.value.allNotes.firstOrNull { it.meta.path == path }?.let { it.meta.title to it.content }
        }
    }

    /* ------------------------------ settings ----------------------------- */

    fun updateSettings(transform: (AppSettings) -> AppSettings) {
        val updated = transform(_state.value.settings)
        _state.update { it.copy(settings = updated) }
        viewModelScope.launch { withContext(Dispatchers.IO) { settingsStore.save(updated) } }
    }

    fun saveApiKey(provider: Provider, key: String?) {
        settingsStore.setApiKey(provider, key)
    }

    fun finishOnboarding(configureAi: Boolean) {
        val updated = _state.value.settings.copy(onboardingComplete = true, aiEnabled = configureAi)
        updateSettings { updated }
        _state.update { it.copy(onboarding = false) }
        viewModelScope.launch {
            refreshVault()
            _state.value.notes.firstOrNull()?.let { openNote(it.path) }
        }
    }

    /* ------------------------------- panels ------------------------------ */

    fun toggleDrawer(open: Boolean) = _state.update { it.copy(drawerOpen = open) }
    fun showQuickOpen(open: Boolean) = _state.update { it.copy(quickOpen = open) }
    fun showSearch(open: Boolean) = _state.update { it.copy(searchOpen = open) }
    fun showAi(open: Boolean) = _state.update { it.copy(aiOpen = open) }
    fun showSettings(open: Boolean) = _state.update { it.copy(settingsOpen = open) }
    fun showGraph(open: Boolean) = _state.update { it.copy(graphOpen = open) }
    fun showHelp(open: Boolean) = _state.update { it.copy(helpOpen = open) }
    fun setEditorMode(mode: EditorMode) = _state.update { it.copy(editorMode = mode) }
    fun notify(message: String) = _state.update { it.copy(message = message) }

    fun updateSelectedTag(tag: String) = _state.update {
        it.copy(searchOpen = true, searchTag = tag, drawerOpen = false)
    }

    fun clearSearchTag() = _state.update { it.copy(searchTag = null) }

    fun openWikiLink(target: String) {
        viewModelScope.launch {
            val clean = target.trim()
            val match = _state.value.allNotes.firstOrNull { note ->
                note.meta.title.equals(clean, ignoreCase = true) ||
                    note.meta.path.equals(clean, ignoreCase = true) ||
                    note.meta.path.equals("$clean.md", ignoreCase = true)
            }
            if (match != null) {
                openNote(match.meta.path)
            } else {
                createNote(clean)
            }
        }
    }

    fun searchNotes(query: String, tag: String? = null, folder: String? = null) =
        com.heyitsyajat.carbon.domain.Search.vault(_state.value.allNotes, query, tag, folder)

    fun quickSwitch(query: String) =
        com.heyitsyajat.carbon.domain.Search.quickSwitch(_state.value.allNotes, query)

    fun graph(): NoteGraph = Graph.build(_state.value.allNotes, _state.value.links)
}

enum class AiApply { INSERT, REPLACE, APPEND }

