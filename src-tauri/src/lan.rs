//! LAN discovery (#168 Phase 2): finds other MiniTracker apps on the same network over mDNS
//! (`_minitracker._tcp`) and gives the web side a small WebSocket text pipe to each one. The pipe only
//! carries the WebRTC connection texts and the pairing confirmation; the data itself goes over the
//! encrypted WebRTC channel, as for every other sync.
//!
//! Shared by desktop and Android. Android also needs the CHANGE_WIFI_MULTICAST_STATE permission and a
//! WifiManager.MulticastLock held while discovery runs, or the phone drops mDNS packets.
//!
//! Events to the web side: `lan-peers` (the list of nearby apps), `lan-open` {conn, incoming},
//! `lan-msg` {conn, text}, `lan-close` {conn}.

use futures_util::{SinkExt, StreamExt};
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc::{UnboundedSender, unbounded_channel};
use tokio_tungstenite::tungstenite::Message;

const SERVICE: &str = "_minitracker._tcp.local.";

#[derive(Clone, Serialize)]
pub struct Peer {
    id: String,
    name: String,
    addrs: Vec<String>,
    port: u16,
}

#[derive(Clone, Serialize)]
struct Opened {
    conn: u32,
    incoming: bool,
}

#[derive(Clone, Serialize)]
struct Text {
    conn: u32,
    text: String,
}

#[derive(Clone, Serialize)]
struct Closed {
    conn: u32,
}

struct Running {
    daemon: ServiceDaemon,
    fullname: String,
    port: u16,
    server: tauri::async_runtime::JoinHandle<()>,
}

#[derive(Default)]
pub struct Lan {
    running: Mutex<Option<Running>>,
    peers: Arc<Mutex<HashMap<String, Peer>>>,
    conns: Arc<Mutex<HashMap<u32, UnboundedSender<String>>>>,
    next: AtomicU32,
}

fn emit_peers(app: &AppHandle, peers: &Mutex<HashMap<String, Peer>>) {
    let list: Vec<Peer> = peers.lock().unwrap().values().cloned().collect();
    let _ = app.emit("lan-peers", list);
}

/// Run one WebSocket connection: forward its texts to the web side, send what the web side queues.
fn serve<S>(
    app: AppHandle,
    conns: Arc<Mutex<HashMap<u32, UnboundedSender<String>>>>,
    conn: u32,
    incoming: bool,
    ws: tokio_tungstenite::WebSocketStream<S>,
) where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    let (tx, mut rx) = unbounded_channel::<String>();
    conns.lock().unwrap().insert(conn, tx);
    let _ = app.emit("lan-open", Opened { conn, incoming });
    tauri::async_runtime::spawn(async move {
        let (mut sink, mut stream) = ws.split();
        loop {
            tokio::select! {
                out = rx.recv() => match out {
                    Some(t) => if sink.send(Message::text(t)).await.is_err() { break },
                    None => { let _ = sink.close().await; break }
                },
                inc = stream.next() => match inc {
                    Some(Ok(Message::Text(t))) => { let _ = app.emit("lan-msg", Text { conn, text: t.to_string() }); }
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                    _ => {}
                },
            }
        }
        conns.lock().unwrap().remove(&conn);
        let _ = app.emit("lan-close", Closed { conn });
    });
}

/// Start advertising this device and looking for others. Returns the port it listens on.
#[tauri::command]
pub async fn lan_start(
    app: AppHandle,
    lan: State<'_, Lan>,
    id: String,
    name: String,
) -> Result<u16, String> {
    if let Some(r) = lan.running.lock().unwrap().as_ref() {
        emit_peers(&app, &lan.peers);
        return Ok(r.port);
    }
    crate::android::multicast_lock(true);
    let listener = TcpListener::bind("0.0.0.0:0")
        .await
        .map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let conns = lan.conns.clone();
    let next = Arc::new(AtomicU32::new(
        lan.next.fetch_add(1_000_000, Ordering::SeqCst) + 1_000_000,
    ));
    let app2 = app.clone();
    let server = tauri::async_runtime::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            let (app, conns, conn) = (
                app2.clone(),
                conns.clone(),
                next.fetch_add(1, Ordering::SeqCst),
            );
            tauri::async_runtime::spawn(async move {
                if let Ok(ws) = tokio_tungstenite::accept_async(stream).await {
                    serve(app, conns, conn, true, ws);
                }
            });
        }
    });

    let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let instance: String = id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(32)
        .collect();
    let host = format!("minitracker-{instance}.local.");
    let props = [("id", id.as_str()), ("name", name.as_str())];
    let info = ServiceInfo::new(SERVICE, &instance, &host, "", port, &props[..])
        .map_err(|e| e.to_string())?
        .enable_addr_auto();
    let fullname = info.get_fullname().to_string();
    daemon.register(info).map_err(|e| e.to_string())?;

    let events = daemon.browse(SERVICE).map_err(|e| e.to_string())?;
    let (peers, app3, me) = (lan.peers.clone(), app.clone(), id.clone());
    std::thread::spawn(move || {
        // fullname → device id, to drop a device when it leaves
        let mut names: HashMap<String, String> = HashMap::new();
        while let Ok(ev) = events.recv() {
            match ev {
                ServiceEvent::ServiceResolved(s) => {
                    let Some(pid) = s.get_property_val_str("id").map(str::to_string) else {
                        continue;
                    };
                    if pid == me {
                        continue;
                    }
                    let mut addrs: Vec<_> =
                        s.get_addresses().iter().map(|a| a.to_ip_addr()).collect();
                    addrs.sort_by_key(|a| !a.is_ipv4()); // IPv4 first: more often reachable
                    let peer = Peer {
                        id: pid.clone(),
                        name: s
                            .get_property_val_str("name")
                            .unwrap_or("MiniTracker")
                            .to_string(),
                        addrs: addrs.iter().map(|a| a.to_string()).collect(),
                        port: s.get_port(),
                    };
                    names.insert(s.get_fullname().to_string(), pid.clone());
                    peers.lock().unwrap().insert(pid, peer);
                    emit_peers(&app3, &peers);
                }
                ServiceEvent::ServiceRemoved(_, full) => {
                    if let Some(pid) = names.remove(&full) {
                        peers.lock().unwrap().remove(&pid);
                        emit_peers(&app3, &peers);
                    }
                }
                ServiceEvent::SearchStopped(_) => break,
                _ => {}
            }
        }
    });

    *lan.running.lock().unwrap() = Some(Running {
        daemon,
        fullname,
        port,
        server,
    });
    Ok(port)
}

/// Stop advertising and looking; open pipes stay until closed.
#[tauri::command]
pub fn lan_stop(app: AppHandle, lan: State<'_, Lan>) {
    if let Some(r) = lan.running.lock().unwrap().take() {
        let _ = r.daemon.unregister(&r.fullname);
        let _ = r.daemon.shutdown();
        r.server.abort();
    }
    crate::android::multicast_lock(false);
    lan.peers.lock().unwrap().clear();
    emit_peers(&app, &lan.peers);
}

/// Open a pipe to a nearby device; tries each of its addresses. Returns the pipe's number.
#[tauri::command]
pub async fn lan_connect(
    app: AppHandle,
    lan: State<'_, Lan>,
    addrs: Vec<String>,
    port: u16,
) -> Result<u32, String> {
    let mut last = String::from("No address");
    for a in addrs {
        let host = if a.contains(':') { format!("[{a}]") } else { a };
        let target = format!("{host}:{port}");
        let attempt = tokio::time::timeout(std::time::Duration::from_secs(4), async {
            let tcp = TcpStream::connect(&target)
                .await
                .map_err(|e| e.to_string())?;
            tokio_tungstenite::client_async(format!("ws://{target}/"), tcp)
                .await
                .map_err(|e| e.to_string())
        })
        .await;
        match attempt {
            Ok(Ok((ws, _))) => {
                let conn = lan.next.fetch_add(1, Ordering::SeqCst);
                serve(app, lan.conns.clone(), conn, false, ws);
                return Ok(conn);
            }
            Ok(Err(e)) => last = e,
            Err(_) => last = "Timed out".into(),
        }
    }
    Err(last)
}

#[tauri::command]
pub fn lan_send(lan: State<'_, Lan>, conn: u32, text: String) -> Result<(), String> {
    let conns = lan.conns.lock().unwrap();
    conns
        .get(&conn)
        .ok_or("Closed")?
        .send(text)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn lan_close(lan: State<'_, Lan>, conn: u32) {
    lan.conns.lock().unwrap().remove(&conn); // dropping the sender closes the socket
}
