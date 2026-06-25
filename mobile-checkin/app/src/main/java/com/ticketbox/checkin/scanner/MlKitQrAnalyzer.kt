package com.ticketbox.checkin.scanner

import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.io.Closeable
import java.util.concurrent.atomic.AtomicBoolean

class MlKitQrAnalyzer(
    private val onQrDetected: (String) -> Unit,
    private val onFailure: (Throwable) -> Unit = {},
) : ImageAnalysis.Analyzer, Closeable {

    private val scanner: BarcodeScanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build(),
    )

    private val enabled = AtomicBoolean(true)
    private val processingFrame = AtomicBoolean(false)

    fun setScanningEnabled(value: Boolean) {
        enabled.set(value)
    }

    @ExperimentalGetImage
    override fun analyze(imageProxy: ImageProxy) {
        if (!enabled.get() || !processingFrame.compareAndSet(false, true)) {
            imageProxy.close()
            return
        }

        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            processingFrame.set(false)
            imageProxy.close()
            return
        }

        val inputImage = InputImage.fromMediaImage(
            mediaImage,
            imageProxy.imageInfo.rotationDegrees,
        )

        scanner.process(inputImage)
            .addOnSuccessListener { barcodes ->
                val value = barcodes
                    .asSequence()
                    .mapNotNull { barcode -> barcode.rawValue?.trim() }
                    .firstOrNull { rawValue -> rawValue.isNotEmpty() }

                if (value != null && enabled.compareAndSet(true, false)) {
                    onQrDetected(value)
                }
            }
            .addOnFailureListener(onFailure)
            .addOnCompleteListener {
                processingFrame.set(false)
                imageProxy.close()
            }
    }

    override fun close() {
        enabled.set(false)
        scanner.close()
    }
}
