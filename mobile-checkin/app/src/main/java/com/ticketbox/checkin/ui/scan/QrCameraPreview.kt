package com.ticketbox.checkin.ui.scan

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.view.CameraController
import androidx.camera.view.LifecycleCameraController
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.ticketbox.checkin.scanner.MlKitQrAnalyzer
import java.util.concurrent.Executors

@Composable
fun QrCameraPreview(
    torchEnabled: Boolean,
    scanningEnabled: Boolean,
    onQrDetected: (String) -> Unit,
    onCameraError: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA,
            ) == PackageManager.PERMISSION_GRANTED,
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        hasCameraPermission = granted
        if (!granted) {
            onCameraError("Camera permission is required to scan QR codes")
        }
    }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    if (!hasCameraPermission) {
        CameraPermissionPlaceholder(
            modifier = modifier,
            onGrantPermission = {
                permissionLauncher.launch(Manifest.permission.CAMERA)
            },
        )
        return
    }

    CameraPreviewContent(
        torchEnabled = torchEnabled,
        scanningEnabled = scanningEnabled,
        onQrDetected = onQrDetected,
        onCameraError = onCameraError,
        modifier = modifier,
    )
}

@Composable
private fun CameraPreviewContent(
    torchEnabled: Boolean,
    scanningEnabled: Boolean,
    onQrDetected: (String) -> Unit,
    onCameraError: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val currentOnQrDetected = rememberUpdatedState(onQrDetected)
    val currentOnCameraError = rememberUpdatedState(onCameraError)
    val analyzerExecutor = remember { Executors.newSingleThreadExecutor() }

    val analyzer = remember {
        MlKitQrAnalyzer(
            onQrDetected = { value -> currentOnQrDetected.value(value) },
            onFailure = { error ->
                currentOnCameraError.value(error.message ?: "Could not read QR code")
            },
        )
    }

    val cameraController = remember {
        LifecycleCameraController(context).apply {
            cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
            setEnabledUseCases(CameraController.IMAGE_ANALYSIS)
            setImageAnalysisBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            setImageAnalysisAnalyzer(analyzerExecutor, analyzer)
            setTapToFocusEnabled(true)
            setPinchToZoomEnabled(true)
        }
    }

    DisposableEffect(lifecycleOwner, cameraController) {
        runCatching {
            cameraController.bindToLifecycle(lifecycleOwner)
        }.onFailure { error ->
            currentOnCameraError.value(error.message ?: "Could not start camera")
        }

        onDispose {
            cameraController.enableTorch(false)
            cameraController.clearImageAnalysisAnalyzer()
            analyzer.close()
            analyzerExecutor.shutdown()
        }
    }

    LaunchedEffect(scanningEnabled) {
        analyzer.setScanningEnabled(scanningEnabled)
    }

    LaunchedEffect(torchEnabled) {
        runCatching {
            cameraController.enableTorch(torchEnabled)
        }.onFailure { error ->
            currentOnCameraError.value(error.message ?: "Flash is unavailable")
        }
    }

    Box(
        modifier = modifier
            .background(Color.Black, RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center,
    ) {
        AndroidView(
            factory = { previewContext ->
                PreviewView(previewContext).apply {
                    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                    scaleType = PreviewView.ScaleType.FILL_CENTER
                    controller = cameraController
                }
            },
            modifier = Modifier.fillMaxSize(),
        )

        Box(
            modifier = Modifier
                .size(180.dp)
                .border(
                    width = 3.dp,
                    color = Color.White,
                    shape = RoundedCornerShape(12.dp),
                ),
        )

        Text(
            text = if (scanningEnabled) "Point the camera at a QR code" else "QR captured",
            color = Color.White,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(12.dp)
                .background(Color.Black.copy(alpha = 0.55f), RoundedCornerShape(8.dp))
                .padding(horizontal = 12.dp, vertical = 6.dp),
        )
    }
}

@Composable
private fun CameraPermissionPlaceholder(
    onGrantPermission: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .background(Color(0xFF111827), RoundedCornerShape(12.dp))
            .padding(20.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "Allow camera access to scan QR codes",
                color = Color.White,
            )
            Button(onClick = onGrantPermission) {
                Text("Allow camera")
            }
        }
    }
}
