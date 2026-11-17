package com.heyitsyajat.carbon.ui

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Article
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.DriveFileRenameOutline
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.HelpOutline
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ViewSidebar
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.DrawerValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.heyitsyajat.carbon.domain.Markdown
import com.heyitsyajat.carbon.ui.theme.CarbonTheme
import kotlinx.coroutines.launch

@Composable
fun CarbonRoot(viewModel: CarbonViewModel) {
    val state by viewModel.state.collectAsState()
    CarbonTheme(theme = state.settings.theme) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            when {
                state.loading -> LoadingScreen()
                state.onboarding -> OnboardingScreen(onFinish = viewModel::finishOnboarding)
                else -> WorkspaceScreen(state, viewModel)
            }
        }
    }
}

@Composable
private fun LoadingScreen() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CarbonMark(size = 46)
            Spacer(Modifier.height(14.dp))
            Text("CARBON", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WorkspaceScreen(state: UiState, viewModel: CarbonViewModel) {
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    var selectionText by remember { mutableStateOf("") }
    var showSidePanel by remember { mutableStateOf(true) }

    var newNoteOpen by remember { mutableStateOf(false) }
    var newFolderOpen by remember { mutableStateOf(false) }
    var renameOpen by remember { mutableStateOf(false) }
    var meetingOpen by remember { mutableStateOf(false) }
    var deleteOpen by remember { mutableStateOf(false) }
    var templatesOpen by remember { mutableStateOf(false) }
    var menuOpen by remember { mutableStateOf(false) }

    LaunchedEffect(state.message) {
        val message = state.message ?: return@LaunchedEffect
        snackbar.showSnackbar(message)
        viewModel.dismissMessage()
    }
    LaunchedEffect(state.drawerOpen) {
        if (state.drawerOpen) drawerState.open() else drawerState.close()
    }

    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) viewModel.importFolder(uri)
    }
    val context = androidx.compose.ui.platform.LocalContext.current

    val openExport = {
        val note = state.current
        if (note != null) {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/markdown"
                putExtra(Intent.EXTRA_SUBJECT, note.meta.title)
                putExtra(Intent.EXTRA_TEXT, state.draft)
            }
            context.startActivity(Intent.createChooser(intent, "Export note"))
        }
    }

    val pane: @Composable (Modifier) -> Unit = { modifier ->
        NotesPane(
            state = state,
            onOpenNote = { viewModel.openNote(it); viewModel.showSearch(false) },
            onNewNote = { newNoteOpen = true },
            onNewFolder = { newFolderOpen = true },
            onDaily = viewModel::openDailyNote,
            onMeeting = { meetingOpen = true },
            onImport = { importLauncher.launch(null) },
            onTag = { viewModel.updateSelectedTag(it) },
            onSearch = { viewModel.showSearch(true) },
            onQuickSwitch = { viewModel.showQuickOpen(true) },
            modifier = modifier,
        )
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        gesturesEnabled = true,
        drawerContent = {
            ModalDrawerSheet(Modifier.width(320.dp)) {
                pane(Modifier.fillMaxHeight())
            }
        },
    ) {
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            snackbarHost = { SnackbarHost(snackbar) },
            topBar = {
                Column {
                    TopAppBar(
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                        ),
                        navigationIcon = {
                            IconButton(onClick = { viewModel.toggleDrawer(true) }) {
                                Icon(Icons.Outlined.Menu, contentDescription = "Open vault")
                            }
                        },
                        title = {
                            Column {
                                Text(
                                    state.current?.meta?.title ?: "Carbon",
                                    style = MaterialTheme.typography.titleMedium,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    state.current?.meta?.folder?.ifBlank { "Vault" } ?: "Local-first Markdown",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        },
                        actions = {
                            IconButton(onClick = { viewModel.showSearch(true) }) {
                                Icon(Icons.Outlined.Search, contentDescription = "Search vault")
                            }
                            IconButton(onClick = { viewModel.showGraph(true) }) {
                                Icon(Icons.Outlined.Hub, contentDescription = "Graph view")
                            }
                            IconButton(onClick = { viewModel.showAi(true) }) {
                                Icon(Icons.Outlined.AutoAwesome, contentDescription = "Writing assistant")
                            }
                            Box {
                                IconButton(onClick = { menuOpen = true }) {
                                    Icon(Icons.Outlined.MoreVert, contentDescription = "More")
                                }
                                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                                    DropdownItem("Today's note", Icons.Outlined.CalendarToday) {
                                        menuOpen = false
                                        viewModel.openDailyNote()
                                    }
                                    DropdownItem("New meeting note", Icons.Outlined.Groups) {
                                        menuOpen = false
                                        meetingOpen = true
                                    }
                                    DropdownItem("Insert template", Icons.Outlined.Article) {
                                        menuOpen = false
                                        templatesOpen = true
                                    }
                                    DropdownItem("Import Markdown folder", Icons.Outlined.Description) {
                                        menuOpen = false
                                        importLauncher.launch(null)
                                    }
                                    DropdownItem("Export note", Icons.Outlined.IosShare) {
                                        menuOpen = false
                                        openExport()
                                    }
                                    HorizontalDivider()
                                    DropdownItem("Rename note", Icons.Outlined.DriveFileRenameOutline) {
                                        menuOpen = false
                                        renameOpen = true
                                    }
                                    DropdownItem("Delete note", Icons.Outlined.Delete, danger = true) {
                                        menuOpen = false
                                        deleteOpen = true
                                    }
                                    HorizontalDivider()
                                    DropdownItem("Side panel", Icons.Outlined.ViewSidebar) {
                                        menuOpen = false
                                        showSidePanel = !showSidePanel
                                    }
                                    DropdownItem("Settings", Icons.Outlined.Settings) {
                                        menuOpen = false
                                        viewModel.showSettings(true)
                                    }
                                    DropdownItem("Instructions", Icons.Outlined.HelpOutline) {
                                        menuOpen = false
                                        viewModel.showHelp(true)
                                    }
                                }
                            }
                        },
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                }
            },
        ) { padding ->
            BoxWithConstraints(Modifier.fillMaxSize().padding(padding)) {
                val wide = maxWidth >= 840.dp
                Row(Modifier.fillMaxSize()) {
                    if (wide) {
                        pane(Modifier.width(302.dp).fillMaxHeight())
                        VerticalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    }
                    Column(Modifier.weight(1f).fillMaxHeight()) {
                        EditorHeader(state, viewModel)
                        Box(Modifier.weight(1f)) {
                            if (state.current == null) {
                                EmptyEditor(onCreate = { newNoteOpen = true })
                            } else if (state.editorMode == EditorMode.EDIT) {
                                EditorPane(
                                    notePath = state.current!!.meta.path,
                                    draft = state.draft,
                                    textSize = state.settings.editorTextSize,
                                    commands = viewModel.editorEvents,
                                    onDraftChange = viewModel::onDraftChange,
                                    onSelectionChange = { selectionText = it },
                                    onWikiLink = { viewModel.openWikiLink(it) },
                                    onTag = { viewModel.updateSelectedTag(it) },
                                    onExternal = { url ->
                                        runCatching {
                                            context.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)))
                                        }
                                    },
                                )
                            } else {
                                MarkdownView(
                                    markdown = state.draft,
                                    onWikiLink = { viewModel.openWikiLink(it) },
                                    onTag = { viewModel.updateSelectedTag(it) },
                                    onExternal = { url ->
                                        runCatching {
                                            context.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)))
                                        }
                                    },
                                    textSize = state.settings.editorTextSize.sp,
                                )
                            }
                        }
                        if (state.editorMode == EditorMode.EDIT && state.current != null) {
                            FormattingBar(onCommand = viewModel::insertCommand)
                        }
                        StatusBar(state)
                    }
                    if (wide && showSidePanel) {
                        VerticalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        SidePanel(
                            state = state,
                            onOpenNote = viewModel::openNote,
                            onWikiLink = viewModel::openWikiLink,
                            onLine = { line -> viewModel.insertCommand(EditorCommand.ScrollToLine(line)) },
                            onTag = viewModel::updateSelectedTag,
                            modifier = Modifier.width(272.dp).fillMaxHeight(),
                        )
                    }
                }
            }
        }
    }

    // Overlays and dialogs
    if (state.quickOpen) QuickSwitchDialog(state, viewModel) { viewModel.showQuickOpen(false) }
    if (state.searchOpen) SearchOverlay(state, viewModel)
    if (state.graphOpen) GraphOverlay(state, viewModel)
    if (state.settingsOpen) SettingsScreen(state, viewModel)
    if (state.helpOpen) HelpDialog(onClose = { viewModel.showHelp(false) })
    if (state.aiOpen) AiSheet(state, viewModel, selectionText)

    if (newNoteOpen) {
        NameDialog(
            title = "New note",
            label = "Note title",
            initial = "",
            confirmLabel = "Create",
            onDismiss = { newNoteOpen = false },
            onConfirm = { name ->
                newNoteOpen = false
                viewModel.createNote(name, state.current?.meta?.folder.orEmpty())
            },
        )
    }
    if (newFolderOpen) {
        NameDialog(
            title = "New folder",
            label = "Folder name",
            initial = "",
            confirmLabel = "Create",
            onDismiss = { newFolderOpen = false },
            onConfirm = { name ->
                newFolderOpen = false
                viewModel.createFolder(name)
            },
        )
    }
    if (meetingOpen) {
        NameDialog(
            title = "New meeting note",
            label = "Meeting title",
            initial = "",
            confirmLabel = "Create",
            onDismiss = { meetingOpen = false },
            onConfirm = { name ->
                meetingOpen = false
                viewModel.createMeeting(name)
            },
        )
    }
    if (renameOpen) {
        NameDialog(
            title = "Rename note",
            label = "Note title",
            initial = state.current?.meta?.title.orEmpty(),
            confirmLabel = "Rename",
            onDismiss = { renameOpen = false },
            onConfirm = { name ->
                renameOpen = false
                viewModel.renameCurrent(name)
            },
        )
    }
    if (deleteOpen) {
        AlertDialog(
            onDismissRequest = { deleteOpen = false },
            title = { Text("Delete “${state.current?.meta?.title.orEmpty()}”?") },
            text = { Text("The Markdown file is removed from the vault. This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    deleteOpen = false
                    viewModel.deleteCurrent()
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { deleteOpen = false }) { Text("Cancel") } },
        )
    }
    if (templatesOpen) {
        val templates = viewModel.templateNotes()
        AlertDialog(
            onDismissRequest = { templatesOpen = false },
            title = { Text("Insert template") },
            text = {
                if (templates.isEmpty()) {
                    Text("Add notes to the “${state.settings.templatesFolder}” folder and they appear here.")
                } else {
                    Column(Modifier.verticalScroll(rememberScrollState())) {
                        templates.forEach { template ->
                            Row(
                                Modifier.fillMaxWidth().clickable {
                                    templatesOpen = false
                                    viewModel.insertTemplate(template.path)
                                }.padding(vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Outlined.Article, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(10.dp))
                                Text(template.title, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { templatesOpen = false }) { Text("Close") } },
        )
    }

}

@Composable
private fun EditorHeader(state: UiState, viewModel: CarbonViewModel) {
    val colors = MaterialTheme.colorScheme
    Row(
        Modifier
            .fillMaxWidth()
            .background(colors.surfaceContainer)
            .padding(horizontal = 14.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.Description, contentDescription = null, modifier = Modifier.size(13.dp), tint = colors.onSurfaceVariant)
        Spacer(Modifier.width(6.dp))
        Text(
            text = state.current?.meta?.path ?: "No note open",
            style = MaterialTheme.typography.labelSmall,
            color = colors.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = when {
                state.dirty -> "Saving…"
                state.current != null -> "Saved"
                else -> ""
            },
            style = MaterialTheme.typography.labelSmall,
            color = if (state.dirty) colors.secondary else colors.onSurfaceVariant,
        )
        Spacer(Modifier.width(10.dp))
        ModeTab("Edit", state.editorMode == EditorMode.EDIT) { viewModel.setEditorMode(EditorMode.EDIT) }
        ModeTab("Preview", state.editorMode == EditorMode.PREVIEW) { viewModel.setEditorMode(EditorMode.PREVIEW) }
    }
}

@Composable
private fun ModeTab(label: String, selected: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Text(
        text = label,
        modifier = Modifier
            .clickable(onClick = onClick)
            .background(if (selected) colors.primary.copy(alpha = 0.1f) else androidx.compose.ui.graphics.Color.Transparent, MaterialTheme.shapes.small)
            .padding(horizontal = 9.dp, vertical = 4.dp),
        style = MaterialTheme.typography.labelSmall,
        color = if (selected) colors.primary else colors.onSurfaceVariant,
        fontWeight = if (selected) FontWeight.Medium else FontWeight.Normal,
    )
}

@Composable
private fun StatusBar(state: UiState) {
    val colors = MaterialTheme.colorScheme
    val words = remember(state.draft) { state.draft.split(Regex("""\s+""")).count { it.isNotBlank() } }
    Row(
        Modifier
            .fillMaxWidth()
            .background(colors.surfaceContainerHigh)
            .padding(horizontal = 12.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("${state.notes.size} notes", style = MaterialTheme.typography.labelSmall, color = colors.onSurfaceVariant)
        Text("$words words", style = MaterialTheme.typography.labelSmall, color = colors.onSurfaceVariant)
        Spacer(Modifier.weight(1f))
        Text(
            if (state.settings.aiEnabled) "AI on · ${state.settings.provider.label}" else "AI off",
            style = MaterialTheme.typography.labelSmall,
            color = if (state.settings.aiEnabled) colors.primary else colors.onSurfaceVariant.copy(alpha = 0.7f),
        )
    }
}

@Composable
private fun DropdownItem(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    danger: Boolean = false,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        text = { Text(label, color = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface) },
        leadingIcon = { Icon(icon, contentDescription = null, modifier = Modifier.size(17.dp)) },
        onClick = onClick,
    )
}

@Composable
fun CarbonMark(size: Int = 32) {
    val colors = MaterialTheme.colorScheme
    Box(
        Modifier
            .size(size.dp)
            .background(colors.primary, MaterialTheme.shapes.small),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.Canvas(Modifier.size((size * 0.56f).dp)) {
            drawCircle(color = colors.onPrimary.copy(alpha = 0.95f), radius = this.size.minDimension / 2f, style = androidx.compose.ui.graphics.drawscope.Stroke(width = this.size.minDimension * 0.16f))
        }
    }
}
