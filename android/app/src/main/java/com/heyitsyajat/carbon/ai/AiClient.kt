package com.heyitsyajat.carbon.ai

import com.heyitsyajat.carbon.data.Provider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

data class AiRequest(
    val provider: Provider,
    val baseUrl: String,
    val model: String,
    val apiKey: String?,
    val messages: List<ChatMessage>,
    val temperature: Float = 0.6f,
    val maxTokens: Int = 1200,
)

class AiException(message: String) : Exception(message)

/**
 * Streams chat completions over plain HTTP so the app needs no vendor SDK.
 * OpenAI, Ollama and any compatible server share the SSE format; Anthropic
 * uses its own event names.
 */
class AiClient {

    fun stream(request: AiRequest): Flow<String> = flow {
        val base = request.baseUrl.trim().trimEnd('/')
        if (base.isEmpty()) throw AiException("Set a base URL in Settings → AI.")
        val model = request.model.trim()
        if (model.isEmpty()) throw AiException("Set a model name in Settings → AI.")
        if ((request.provider == Provider.OPENAI || request.provider == Provider.ANTHROPIC) && request.apiKey.isNullOrBlank()) {
            throw AiException("Add an API key in Settings → AI.")
        }

        val anthropic = request.provider == Provider.ANTHROPIC
        val url = if (anthropic) "$base/messages" else "$base${if (base.endsWith("/v1")) "" else "/v1"}/chat/completions"
        val body = if (anthropic) anthropicBody(request) else openAiBody(request)

        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 20_000
            readTimeout = 120_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "text/event-stream")
            if (anthropic) {
                setRequestProperty("x-api-key", request.apiKey.orEmpty())
                setRequestProperty("anthropic-version", "2023-06-01")
            } else if (!request.apiKey.isNullOrBlank()) {
                setRequestProperty("Authorization", "Bearer ${request.apiKey}")
            }
        }

        try {
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            if (status !in 200..299) {
                val text = (connection.errorStream ?: connection.inputStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
                throw AiException(errorMessage(status, text))
            }
            val contentType = connection.contentType.orEmpty()
            if (!contentType.contains("event-stream")) {
                // Some gateways ignore stream=true and return one JSON document.
                val text = connection.inputStream.bufferedReader().use { it.readText() }
                val value = extractFull(text, anthropic)
                if (value.isBlank()) throw AiException("The provider returned an empty response.")
                emit(value)
                return@flow
            }
            BufferedReader(InputStreamReader(connection.inputStream, Charsets.UTF_8)).use { reader ->
                var line: String?
                while (true) {
                    line = reader.readLine() ?: break
                    if (line.isBlank() || line.startsWith(":")) continue
                    if (!line.startsWith("data:")) continue
                    val data = line.removePrefix("data:").trim()
                    if (data == "[DONE]") break
                    val delta = runCatching { extractDelta(data, anthropic) }.getOrNull()
                    if (!delta.isNullOrEmpty()) emit(delta)
                }
            }
        } finally {
            connection.disconnect()
        }
    }.flowOn(Dispatchers.IO)

    fun test(request: AiRequest): Flow<String> = stream(
        request.copy(messages = listOf(ChatMessage("user", "Reply with the single word: ready"))),
    )

    private fun openAiBody(request: AiRequest): String {
        val messages = JSONArray()
        request.messages.forEach { message ->
            messages.put(JSONObject().put("role", message.role).put("content", message.content))
        }
        return JSONObject()
            .put("model", request.model)
            .put("messages", messages)
            .put("temperature", request.temperature)
            .put("max_tokens", request.maxTokens)
            .put("stream", true)
            .toString()
    }

    private fun anthropicBody(request: AiRequest): String {
        val system = request.messages.firstOrNull { it.role == "system" }?.content.orEmpty()
        val messages = JSONArray()
        request.messages.filter { it.role != "system" }.forEach { message ->
            messages.put(JSONObject().put("role", "user").put("content", message.content))
        }
        return JSONObject()
            .put("model", request.model)
            .put("max_tokens", request.maxTokens)
            .put("temperature", request.temperature)
            .put("stream", true)
            .put("system", system)
            .put("messages", messages)
            .toString()
    }

    private fun extractDelta(data: String, anthropic: Boolean): String? {
        val json = JSONObject(data)
        return if (anthropic) {
            when (json.optString("type")) {
                "content_block_delta" -> json.optJSONObject("delta")?.optString("text")
                "message_delta", "message_stop", "ping" -> null
                else -> null
            }
        } else {
            json.optJSONArray("choices")
                ?.optJSONObject(0)
                ?.optJSONObject("delta")
                ?.optString("content")
                ?.takeIf { it.isNotEmpty() }
        }
    }

    private fun extractFull(text: String, anthropic: Boolean): String {
        val json = JSONObject(text)
        return if (anthropic) {
            json.optJSONArray("content")?.optJSONObject(0)?.optString("text").orEmpty()
        } else {
            json.optJSONArray("choices")?.optJSONObject(0)
                ?.optJSONObject("message")?.optString("content").orEmpty()
        }
    }

    private fun errorMessage(status: Int, text: String): String {
        val detail = runCatching {
            val json = JSONObject(text)
            json.optJSONObject("error")?.optString("message")?.takeIf { it.isNotBlank() }
                ?: json.optString("message").takeIf { it.isNotBlank() }
        }.getOrNull() ?: text.take(240).ifBlank { "No details were returned." }
        return "The AI service returned HTTP $status. $detail"
    }
}
