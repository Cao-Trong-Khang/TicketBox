package com.ticketbox.checkin.data.session

import android.content.Context
import java.util.UUID

interface StaffSession {
    fun accessToken(): String?
    fun staffEmail(): String?
    fun staffId(): String?
    fun isLoggedIn(): Boolean
    fun setAccessToken(token: String)
    fun setAuthenticatedStaff(token: String, staffId: String, staffEmail: String)
    fun sourceDeviceId(): String
    fun setSourceDeviceId(sourceDeviceId: String)
    fun clearSessionCredentials()
}

class StaffSessionStore(context: Context) : StaffSession {
    private val preferences = context.applicationContext.getSharedPreferences(
        "ticketbox-checkin-session",
        Context.MODE_PRIVATE,
    )

    override fun accessToken(): String? = preferences.getString(KEY_ACCESS_TOKEN, null)

    override fun staffEmail(): String? = preferences.getString(KEY_STAFF_EMAIL, null)

    override fun staffId(): String? = preferences.getString(KEY_STAFF_ID, null)

    override fun isLoggedIn(): Boolean = !accessToken().isNullOrBlank()

    override fun setAccessToken(token: String) {
        preferences.edit().putString(KEY_ACCESS_TOKEN, token.trim()).apply()
    }

    override fun setAuthenticatedStaff(token: String, staffId: String, staffEmail: String) {
        preferences.edit()
            .putString(KEY_ACCESS_TOKEN, token.trim())
            .putString(KEY_STAFF_ID, staffId.trim())
            .putString(KEY_STAFF_EMAIL, staffEmail.trim())
            .apply()
    }

    override fun sourceDeviceId(): String {
        val existing = preferences.getString(KEY_SOURCE_DEVICE_ID, null)
        if (!existing.isNullOrBlank()) {
            return existing
        }

        val generated = "android-${UUID.randomUUID()}"
        preferences.edit().putString(KEY_SOURCE_DEVICE_ID, generated).apply()
        return generated
    }

    override fun setSourceDeviceId(sourceDeviceId: String) {
        preferences.edit().putString(KEY_SOURCE_DEVICE_ID, sourceDeviceId.trim()).apply()
    }

    override fun clearSessionCredentials() {
        preferences.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_STAFF_ID)
            .remove(KEY_STAFF_EMAIL)
            .apply()
    }

    private companion object {
        const val KEY_ACCESS_TOKEN = "access_token"
        const val KEY_SOURCE_DEVICE_ID = "source_device_id"
        const val KEY_STAFF_ID = "staff_id"
        const val KEY_STAFF_EMAIL = "staff_email"
    }
}
