package com.heyitsyajat.carbon.data

import android.content.Context

enum class Provider(val id: String, val label: String, val defaultBase: String, val defaultModel: String) {
    OLLAMA("ollama", "Local model (Ollama)", "http://127.0.0.1:11434", "llama3.2"),
    OPENAI_COMPATIBLE("openai-compatible", "OpenAI-compatible endpoint", "http://127.0.0.1:1234/v1", "gpt-4o-mini"),
    OPENAI("openai", "OpenAI", "https://api.openai.com/v1", "gpt-4o-mini"),
    ANTHROPIC("anthropic", "Anthropic", "https://api.anthropic.com/v1", "claude-3-5-sonnet-latest");

    companion object {
        fun from(id: String?): Provider = entries.firstOrNull { it.id == id } ?: OLLAMA
    }
}

data class AppSettings(
    val theme: String = "system",
    val editorTextSize: Float = 18f,
    val aiEnabled: Boolean = false,
    val provider: Provider = Provider.OLLAMA,
    val model: String = Provider.OLLAMA.defaultModel,
    val baseUrl: String = Provider.OLLAMA.defaultBase,
    val systemPrompt: String = "",
    val temperature: Float = 0.6f,
    val maxTokens: Int = 1200,
    val lastNotePath: String? = null,
    val onboardingComplete: Boolean = false,
    val dailyFolder: String = "Daily",
    val dailyFormat: String = "yyyy-MM-dd",
    val templatesFolder: String = "Templates",
    val confirmDelete: Boolean = true,
)

class SettingsStore(context: Context) {

    private val prefs = context.applicationContext.getSharedPreferences("carbon.settings", Context.MODE_PRIVATE)

    fun load(): AppSettings {
        val defaults = AppSettings()
        val provider = Provider.from(prefs.getString("ai.provider", defaults.provider.id))
        return AppSettings(
            theme = prefs.getString("theme", defaults.theme) ?: defaults.theme,
            editorTextSize = prefs.getFloat("editor.textSize", defaults.editorTextSize),
            aiEnabled = prefs.getBoolean("ai.enabled", defaults.aiEnabled),
            provider = provider,
            model = prefs.getString("ai.model", provider.defaultModel) ?: provider.defaultModel,
            baseUrl = prefs.getString("ai.baseUrl", provider.defaultBase) ?: provider.defaultBase,
            systemPrompt = prefs.getString("ai.systemPrompt", defaults.systemPrompt) ?: defaults.systemPrompt,
            temperature = prefs.getFloat("ai.temperature", defaults.temperature),
            maxTokens = prefs.getInt("ai.maxTokens", defaults.maxTokens),
            lastNotePath = prefs.getString("lastNotePath", null),
            onboardingComplete = prefs.getBoolean("onboardingComplete", defaults.onboardingComplete),
            dailyFolder = prefs.getString("daily.folder", defaults.dailyFolder) ?: defaults.dailyFolder,
            dailyFormat = prefs.getString("daily.format", defaults.dailyFormat) ?: defaults.dailyFormat,
            templatesFolder = prefs.getString("templates.folder", defaults.templatesFolder) ?: defaults.templatesFolder,
            confirmDelete = prefs.getBoolean("ui.confirmDelete", defaults.confirmDelete),
        )
    }

    fun save(settings: AppSettings) {
        prefs.edit()
            .putString("theme", settings.theme)
            .putFloat("editor.textSize", settings.editorTextSize)
            .putBoolean("ai.enabled", settings.aiEnabled)
            .putString("ai.provider", settings.provider.id)
            .putString("ai.model", settings.model)
            .putString("ai.baseUrl", settings.baseUrl)
            .putString("ai.systemPrompt", settings.systemPrompt)
            .putFloat("ai.temperature", settings.temperature)
            .putInt("ai.maxTokens", settings.maxTokens)
            .putString("lastNotePath", settings.lastNotePath)
            .putBoolean("onboardingComplete", settings.onboardingComplete)
            .putString("daily.folder", settings.dailyFolder)
            .putString("daily.format", settings.dailyFormat)
            .putString("templates.folder", settings.templatesFolder)
            .putBoolean("ui.confirmDelete", settings.confirmDelete)
            .apply()
    }

    fun apiKey(provider: Provider): String? = Secrets.decrypt(prefs.getString("ai.key.${provider.id}", null))

    fun setApiKey(provider: Provider, key: String?) {
        if (key.isNullOrBlank()) prefs.edit().remove("ai.key.${provider.id}").apply()
        else prefs.edit().putString("ai.key.${provider.id}", Secrets.encrypt(key.trim())).apply()
    }

    fun hasKey(provider: Provider): Boolean = !apiKey(provider).isNullOrBlank()
}
