package io.github.giacomoantonioli.minitracker

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.*
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.util.ArrayDeque
import java.util.UUID

/**
 * Sync over Bluetooth LE (#168 Phase 4), phone side. The phone is the GATT peripheral: it advertises one
 * service and the PC connects. Two characteristics carry the raw frames that src/data/syncBle.ts cuts and
 * encrypts: RX (the PC writes) and TX (the phone notifies). The page reaches this through the
 * `MiniTrackerBle` JavaScript interface and gets events back as `minitracker-ble` window events, so no Rust
 * is involved on this side.
 */
@SuppressLint("MissingPermission")
class BleServer(private val activity: Activity, private val web: WebView) {
  companion object {
    val SERVICE: UUID = UUID.fromString("6d696e69-7472-6163-6b65-722d626c6531")
    val RX: UUID = UUID.fromString("6d696e69-7472-6163-6b65-722d626c6532")
    val TX: UUID = UUID.fromString("6d696e69-7472-6163-6b65-722d626c6533")
    val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    const val REQUEST = 4168
  }

  private val manager = activity.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
  private var server: BluetoothGattServer? = null
  private var tx: BluetoothGattCharacteristic? = null
  private var client: BluetoothDevice? = null
  private var mtu = 23
  private var advertising = false
  private val outbox = ArrayDeque<ByteArray>()
  private var sending = false
  private var pendingStart = false
  private val advertiseCallback = object : AdvertiseCallback() {
    override fun onStartFailure(errorCode: Int) { advertising = false; emit("error", "advertise:$errorCode") }
  }

  /** Tells the page something happened: window event `minitracker-ble` with {type, data}. */
  private fun emit(type: String, data: String = "") {
    val json = org.json.JSONObject().put("type", type).put("data", data).toString()
    activity.runOnUiThread {
      web.evaluateJavascript("window.dispatchEvent(new CustomEvent('minitracker-ble',{detail:$json}))", null)
    }
  }

  private fun permitted(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      listOf(Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT)
        .all { ContextCompat.checkSelfPermission(activity, it) == PackageManager.PERMISSION_GRANTED }

  @JavascriptInterface
  fun available(): Boolean =
    activity.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE) &&
      manager.adapter?.isEnabled == true && manager.adapter.bluetoothLeAdvertiser != null

  /** Starts advertising; asks for the Bluetooth permissions first if needed (then continues by itself). */
  @JavascriptInterface
  fun start() {
    if (!permitted()) {
      pendingStart = true
      activity.runOnUiThread {
        ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT), REQUEST)
      }
      return
    }
    if (!available()) return emit("error", "unavailable")
    stop()
    val srv = manager.openGattServer(activity, gatt) ?: return emit("error", "gatt")
    val service = BluetoothGattService(SERVICE, BluetoothGattService.SERVICE_TYPE_PRIMARY)
    service.addCharacteristic(BluetoothGattCharacteristic(RX, BluetoothGattCharacteristic.PROPERTY_WRITE, BluetoothGattCharacteristic.PERMISSION_WRITE))
    val notify = BluetoothGattCharacteristic(TX, BluetoothGattCharacteristic.PROPERTY_NOTIFY, BluetoothGattCharacteristic.PERMISSION_READ)
    notify.addDescriptor(BluetoothGattDescriptor(CCCD, BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE))
    service.addCharacteristic(notify)
    tx = notify
    server = srv
    srv.addService(service) // advertising starts in onServiceAdded
  }

  fun onPermissionResult(requestCode: Int) {
    if (requestCode != REQUEST || !pendingStart) return
    pendingStart = false
    if (permitted()) start() else emit("error", "permission")
  }

  private fun advertise() {
    val settings = AdvertiseSettings.Builder().setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY).setConnectable(true).setTimeout(0).build()
    val data = AdvertiseData.Builder().setIncludeDeviceName(false).addServiceUuid(ParcelUuid(SERVICE)).build()
    manager.adapter.bluetoothLeAdvertiser?.startAdvertising(settings, data, advertiseCallback)
    advertising = true
    emit("advertising")
  }

  @JavascriptInterface
  fun stop() {
    if (advertising && permitted()) manager.adapter?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
    advertising = false
    client?.let { server?.cancelConnection(it) }
    server?.close()
    server = null
    tx = null
    client = null
    outbox.clear()
    sending = false
  }

  /** Sends one frame (base64) to the PC as a notification, one at a time, in order. */
  @JavascriptInterface
  fun send(frameBase64: String) {
    synchronized(outbox) { outbox.add(Base64.decode(frameBase64, Base64.NO_WRAP)) }
    pump()
  }

  private fun pump() {
    val frame: ByteArray
    synchronized(outbox) {
      if (sending || outbox.isEmpty()) return
      frame = outbox.poll()!!
      sending = true
    }
    val device = client
    val c = tx
    if (device == null || c == null) { sending = false; return }
    @Suppress("DEPRECATION")
    run {
      c.value = frame
      server?.notifyCharacteristicChanged(device, c, false)
    }
  }

  private val gatt = object : BluetoothGattServerCallback() {
    override fun onServiceAdded(status: Int, service: BluetoothGattService) {
      if (status == BluetoothGatt.GATT_SUCCESS) advertise() else emit("error", "service:$status")
    }

    override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
      if (newState == BluetoothProfile.STATE_CONNECTED) {
        if (client != null && client != device) { server?.cancelConnection(device); return } // one PC at a time
        client = device
        mtu = 23
        manager.adapter.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
        advertising = false
        emit("connected")
      } else if (device == client) {
        client = null
        synchronized(outbox) { outbox.clear() }
        sending = false
        emit("closed")
      }
    }

    override fun onMtuChanged(device: BluetoothDevice, newMtu: Int) {
      mtu = newMtu
      emit("mtu", (newMtu - 3).toString())
    }

    override fun onDescriptorWriteRequest(device: BluetoothDevice, requestId: Int, d: BluetoothGattDescriptor, prepared: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray) {
      if (responseNeeded) server?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
      if (d.uuid == CCCD) emit("ready") // the PC subscribed: the link is usable
    }

    override fun onCharacteristicWriteRequest(device: BluetoothDevice, requestId: Int, c: BluetoothGattCharacteristic, prepared: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray) {
      if (responseNeeded) server?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
      if (c.uuid == RX) emit("frame", Base64.encodeToString(value, Base64.NO_WRAP))
    }

    override fun onNotificationSent(device: BluetoothDevice, status: Int) {
      sending = false
      pump()
    }
  }
}
