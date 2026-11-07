package io.github.giacomoantonioli.minitracker

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private var multicastLock: WifiManager.MulticastLock? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
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
    releaseMulticastLock()
    super.onDestroy()
  }
}
