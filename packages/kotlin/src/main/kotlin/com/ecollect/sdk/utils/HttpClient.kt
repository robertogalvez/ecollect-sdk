package com.ecollect.sdk.utils

import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

val defaultJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = false
    isLenient = true
}

class HttpClient(
    private val client: OkHttpClient = OkHttpClient()
) {
    suspend inline fun <reified Req, reified Res> post(url: String, body: Req): Res {
        val json = defaultJson.encodeToString(body)
        val request = Request.Builder()
            .url(url)
            .post(json.toRequestBody(JSON_MEDIA_TYPE))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .build()
        val responseBody = executeCall(request)
        return defaultJson.decodeFromString(responseBody)
    }

    suspend fun executeCall(request: Request): String = suspendCancellableCoroutine { cont ->
        val call = client.newCall(request)
        cont.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                cont.resumeWithException(e)
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val body = it.body?.string() ?: ""
                    cont.resume(body)
                }
            }
        })
    }
}
