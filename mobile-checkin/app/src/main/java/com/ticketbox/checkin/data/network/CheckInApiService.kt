package com.ticketbox.checkin.data.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface CheckInApiService {
    @POST("auth/login")
    suspend fun login(@Body request: ApiLoginRequest): ApiLoginResponse

    @GET("auth/me")
    suspend fun me(): ApiStaffUser

    @GET("check-in/assignments")
    suspend fun assignments(): List<ApiAssignment>

    @GET("check-in/events/{concertId}/preload")
    suspend fun preload(
        @Path("concertId") concertId: String,
        @Query("assignmentId") assignmentId: String? = null,
    ): ApiPreloadResponse

    @POST("check-in/events/{concertId}/sync")
    suspend fun sync(
        @Path("concertId") concertId: String,
        @Body request: ApiSyncRequest,
    ): ApiSyncResponse
}
