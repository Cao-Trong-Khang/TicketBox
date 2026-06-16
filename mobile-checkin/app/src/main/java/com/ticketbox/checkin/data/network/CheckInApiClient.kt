package com.ticketbox.checkin.data.network

import com.ticketbox.checkin.BuildConfig
import com.ticketbox.checkin.data.session.StaffSession
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object CheckInApiClient {
    fun create(sessionStore: StaffSession): CheckInApiService {
        val client = OkHttpClient.Builder()
            .addInterceptor { chain ->
                val token = sessionStore.accessToken()
                val requestBuilder = chain.request().newBuilder()

                if (!token.isNullOrBlank()) {
                    requestBuilder.header("Authorization", "Bearer $token")
                }

                chain.proceed(requestBuilder.build())
            }
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.BACKEND_API_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(CheckInApiService::class.java)
    }
}
