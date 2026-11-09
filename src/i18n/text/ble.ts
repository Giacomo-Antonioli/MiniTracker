import type { Dict } from '.'

/** Bluetooth sync (#168 phase 4). Order: it, es, de, fr, zh. */
export const ble: Dict = {
  'Bluetooth': ['Bluetooth', 'Bluetooth', 'Bluetooth', 'Bluetooth', '蓝牙'],
  'No network needed. The phone waits, the PC finds it. The first time, check that both screens show the same number.': [
    'Nessuna rete necessaria. Il telefono attende, il PC lo trova. La prima volta controlla che entrambi gli schermi mostrino lo stesso numero.',
    'No hace falta red. El teléfono espera y el PC lo encuentra. La primera vez, comprueba que ambas pantallas muestran el mismo número.',
    'Kein Netzwerk nötig. Das Handy wartet, der PC findet es. Prüfe beim ersten Mal, dass beide Bildschirme dieselbe Zahl zeigen.',
    "Aucun réseau nécessaire. Le téléphone attend, le PC le trouve. La première fois, vérifiez que les deux écrans affichent le même nombre.",
    '无需网络。手机等待，电脑来查找。第一次请确认两台设备显示相同的数字。',
  ],
  'Wait for a PC': ['Attendi un PC', 'Esperar un PC', 'Auf einen PC warten', 'Attendre un PC', '等待电脑'],
  'Find a phone': ['Cerca un telefono', 'Buscar un teléfono', 'Handy suchen', 'Chercher un téléphone', '查找手机'],
  'Waiting for a PC… open Sync › Bluetooth on the PC and choose Find a phone.': [
    'In attesa di un PC… sul PC apri Sincronizza › Bluetooth e scegli Cerca un telefono.',
    'Esperando un PC… en el PC abre Sincronizar › Bluetooth y elige Buscar un teléfono.',
    'Warte auf einen PC… öffne am PC Sync › Bluetooth und wähle Handy suchen.',
    'En attente d’un PC… sur le PC, ouvrez Synchroniser › Bluetooth et choisissez Chercher un téléphone.',
    '正在等待电脑… 请在电脑上打开 同步 › 蓝牙，然后选择查找手机。',
  ],
  'Looking for a phone…': ['Ricerca di un telefono…', 'Buscando un teléfono…', 'Suche nach einem Handy…', 'Recherche d’un téléphone…', '正在查找手机…'],
  'Stop waiting': ['Smetti di attendere', 'Dejar de esperar', 'Nicht mehr warten', 'Arrêter d’attendre', '停止等待'],
  'Bluetooth is not available on this device.': ['Bluetooth non è disponibile su questo dispositivo.', 'Bluetooth no está disponible en este dispositivo.', 'Bluetooth ist auf diesem Gerät nicht verfügbar.', "Le Bluetooth n'est pas disponible sur cet appareil.", '此设备不支持蓝牙。'],
  'Pair these devices over Bluetooth?': ['Abbinare questi dispositivi via Bluetooth?', '¿Emparejar estos dispositivos por Bluetooth?', 'Diese Geräte per Bluetooth koppeln?', 'Appairer ces appareils par Bluetooth ?', '通过蓝牙配对这些设备？'],
  'Bluetooth permission was not given.': ['Il permesso Bluetooth non è stato concesso.', 'No se concedió el permiso de Bluetooth.', 'Die Bluetooth-Berechtigung wurde nicht erteilt.', "L'autorisation Bluetooth n'a pas été accordée.", '未授予蓝牙权限。'],
  'Bluetooth is off or not available on this phone.': ['Il Bluetooth è spento o non disponibile su questo telefono.', 'El Bluetooth está apagado o no está disponible en este teléfono.', 'Bluetooth ist aus oder auf diesem Handy nicht verfügbar.', "Le Bluetooth est désactivé ou indisponible sur ce téléphone.", '此手机的蓝牙已关闭或不可用。'],
  'No PC connected in time.': ['Nessun PC si è connesso in tempo.', 'Ningún PC se conectó a tiempo.', 'Kein PC hat sich rechtzeitig verbunden.', "Aucun PC ne s'est connecté à temps.", '电脑未在时限内连接。'],
  'The PC disconnected.': ['Il PC si è disconnesso.', 'El PC se desconectó.', 'Der PC hat die Verbindung getrennt.', 'Le PC s’est déconnecté.', '电脑已断开连接。'],
  'No phone found. Open Sync › Bluetooth on the phone first.': ['Nessun telefono trovato. Prima apri Sincronizza › Bluetooth sul telefono.', 'No se encontró ningún teléfono. Primero abre Sincronizar › Bluetooth en el teléfono.', 'Kein Handy gefunden. Öffne zuerst Sync › Bluetooth am Handy.', "Aucun téléphone trouvé. Ouvrez d'abord Synchroniser › Bluetooth sur le téléphone.", '没有找到手机。请先在手机上打开 同步 › 蓝牙。'],
}
