//! Bluetooth LE sync (#168 Phase 4), PC side: the central. It scans for a phone advertising the MiniTracker
//! service, connects, subscribes to the TX characteristic and hands raw frames to the web side
//! (src/data/syncBle.ts cuts, pairs and encrypts them). Desktop only: the phone side is BleServer.kt.
//!
//! Commands: `ble_connect` (scan, connect, subscribe; returns the frame size), `ble_send`, `ble_close`.
//! Events: `ble-frame` {data: base64}, `ble-closed`.

#[cfg(desktop)]
mod central {
    use base64::{Engine, engine::general_purpose::STANDARD as B64};
    use btleplug::api::{
        Central, CharPropFlags, Manager as _, Peripheral as _, ScanFilter, WriteType,
    };
    use btleplug::platform::{Manager, Peripheral};
    use futures_util::StreamExt;
    use std::sync::Mutex;
    use std::time::Duration;
    use tauri::{AppHandle, Emitter, State};
    use uuid::{Uuid, uuid};

    const SERVICE: Uuid = uuid!("6d696e69-7472-6163-6b65-722d626c6531");
    const RX: Uuid = uuid!("6d696e69-7472-6163-6b65-722d626c6532");
    const TX: Uuid = uuid!("6d696e69-7472-6163-6b65-722d626c6533");
    /// ATT header; the frame is the negotiated MTU minus this. btleplug does not expose the MTU, so we use the
    /// 20-byte payload every BLE stack accepts (23 - 3) unless the write size reported is larger.
    const SAFE_FRAME: u32 = 20;

    #[derive(Default)]
    pub struct Ble {
        conn: Mutex<Option<Peripheral>>,
    }

    fn err<E: std::fmt::Display>(e: E) -> String {
        e.to_string()
    }

    #[tauri::command]
    pub async fn ble_connect(
        app: AppHandle,
        state: State<'_, Ble>,
        timeout_s: Option<u64>,
    ) -> Result<u32, String> {
        let adapter = Manager::new()
            .await
            .map_err(err)?
            .adapters()
            .await
            .map_err(err)?
            .into_iter()
            .next()
            .ok_or("No Bluetooth adapter found")?;
        adapter
            .start_scan(ScanFilter {
                services: vec![SERVICE],
            })
            .await
            .map_err(err)?;
        let deadline = tokio::time::Instant::now() + Duration::from_secs(timeout_s.unwrap_or(30));
        let phone = loop {
            let found = adapter.peripherals().await.map_err(err)?;
            let mut hit = None;
            for p in found {
                if let Ok(Some(props)) = p.properties().await {
                    if props.services.contains(&SERVICE) {
                        hit = Some(p);
                        break;
                    }
                }
            }
            if let Some(p) = hit {
                break p;
            }
            if tokio::time::Instant::now() > deadline {
                let _ = adapter.stop_scan().await;
                return Err("No phone found. Open Sync › Bluetooth on the phone first.".into());
            }
            tokio::time::sleep(Duration::from_millis(400)).await;
        };
        let _ = adapter.stop_scan().await;
        phone.connect().await.map_err(err)?;
        phone.discover_services().await.map_err(err)?;
        let chars = phone.characteristics();
        let tx = chars
            .iter()
            .find(|c| c.uuid == TX && c.properties.contains(CharPropFlags::NOTIFY))
            .ok_or("The phone does not offer the MiniTracker service")?
            .clone();
        if !chars.iter().any(|c| c.uuid == RX) {
            return Err("The phone does not offer the MiniTracker service".into());
        }
        let mut notes = phone.notifications().await.map_err(err)?;
        phone.subscribe(&tx).await.map_err(err)?;
        let watch = phone.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(n) = notes.next().await {
                if n.uuid == TX {
                    let _ = app.emit("ble-frame", B64.encode(&n.value));
                }
            }
            let _ = watch.disconnect().await;
            let _ = app.emit("ble-closed", ());
        });
        *state.conn.lock().unwrap() = Some(phone);
        Ok(SAFE_FRAME)
    }

    #[tauri::command]
    pub async fn ble_send(state: State<'_, Ble>, data: String) -> Result<(), String> {
        let phone = state.conn.lock().unwrap().clone().ok_or("Not connected")?;
        let rx = phone
            .characteristics()
            .into_iter()
            .find(|c| c.uuid == RX)
            .ok_or("Not connected")?;
        let bytes = B64.decode(data).map_err(err)?;
        phone
            .write(&rx, &bytes, WriteType::WithResponse)
            .await
            .map_err(err)
    }

    #[tauri::command]
    pub async fn ble_close(state: State<'_, Ble>) -> Result<(), String> {
        let phone = state.conn.lock().unwrap().take();
        if let Some(p) = phone {
            let _ = p.disconnect().await;
        }
        Ok(())
    }
}

#[cfg(desktop)]
pub use central::*;

/// The phone is the peripheral (BleServer.kt); it has no central role here.
#[cfg(mobile)]
#[derive(Default)]
pub struct Ble;
#[cfg(mobile)]
#[tauri::command]
pub async fn ble_connect(_timeout_s: Option<u64>) -> Result<u32, String> {
    Err("Bluetooth connect is for the PC app".into())
}
#[cfg(mobile)]
#[tauri::command]
pub async fn ble_send(_data: String) -> Result<(), String> {
    Err("Not connected".into())
}
#[cfg(mobile)]
#[tauri::command]
pub async fn ble_close() -> Result<(), String> {
    Ok(())
}
