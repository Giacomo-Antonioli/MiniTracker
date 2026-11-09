package io.github.giacomoantonioli.minitracker

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private var multicastLock: WifiManager.MulticastLock? = null
  private var ble: BleServer? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  /** Bluetooth sync (#168 phase 4): the page talks to the phone's GATT server through window.MiniTrackerBle. */
  override fun onWebViewCreate(webView: WebView) {
    ble = BleServer(this, webView).also { webView.addJavascriptInterface(it, "MiniTrackerBle") }
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    ble?.onPermissionResult(requestCode)
  }

  /** Nearby devices (#168): Android drops mDNS packets unless this is held. Called from Rust (android.rs) while discovery runs. */
  @Suppress("unused")
  fun acquireMulticastLock() {
    if (multicastLock?.isHeld == true) return
    val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    multicastLock = wifi.createMulticastLock("minitracker-lan").apply {
      setReferenceCounted(false)
      acquire()
    }
  }

  @Suppress("unused")
  fun releaseMulticastLock() {
    multicastLock?.let { if (it.isHeld) it.release() }
    multicastLock = null
  }

  override fun onDestroy() {
    ble?.stop()
    releaseMulticastLock()
    super.onDestroy()
  }
}
