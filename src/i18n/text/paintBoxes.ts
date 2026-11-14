import type { Dict } from '.'

/** Paint selection, boxes and quick pot counts. Order: it, es, de, fr, zh. */
export const paintBoxes: Dict = {
  'Slots (optional)': ['Slot (facoltativo)', 'Huecos (opcional)', 'Plätze (optional)', 'Cases (facultatif)', '格位（可选）'],
  '☑ Select': ['☑ Seleziona', '☑ Seleccionar', '☑ Auswählen', '☑ Sélectionner', '☑ 选择'],
  'Done selecting': ['Fine selezione', 'Terminar selección', 'Auswahl beenden', 'Terminer la sélection', '完成选择'],
  Selection: ['Selezione', 'Selección', 'Auswahl', 'Sélection', '已选'],
  '{{n}} selected': ['{{n}} selezionati', '{{n}} seleccionados', '{{n}} ausgewählt', '{{n}} sélectionnés', '已选 {{n}} 个'],
  'Select all ({{n}})': ['Seleziona tutti ({{n}})', 'Seleccionar todo ({{n}})', 'Alle auswählen ({{n}})', 'Tout sélectionner ({{n}})', '全选（{{n}}）'],
  Clear: ['Deseleziona', 'Quitar', 'Leeren', 'Effacer', '清除'],
  '📦 Put in a box…': ['📦 Metti in una scatola…', '📦 Poner en una caja…', '📦 In eine Box legen…', '📦 Mettre dans une boîte…', '📦 放入盒子…'],
  'One pot less: {{name}}': ['Un barattolo in meno: {{name}}', 'Un bote menos: {{name}}', 'Ein Töpfchen weniger: {{name}}', 'Un pot de moins : {{name}}', '少一瓶：{{name}}'],
  'One pot more: {{name}}': ['Un barattolo in più: {{name}}', 'Un bote más: {{name}}', 'Ein Töpfchen mehr: {{name}}', 'Un pot de plus : {{name}}', '多一瓶：{{name}}'],
  'Put {{n}} paints in a box': ['Metti {{n}} colori in una scatola', 'Poner {{n}} pinturas en una caja', '{{n}} Farben in eine Box legen', 'Mettre {{n}} peintures dans une boîte', '把 {{n}} 种颜料放入盒子'],
  'Box or place': ['Scatola o posizione', 'Caja o lugar', 'Box oder Platz', 'Boîte ou emplacement', '盒子或位置'],
  '{{n}} not in your inventory yet will be skipped.': ['{{n}} non ancora nel tuo inventario verranno saltati.', '{{n}} que aún no están en tu inventario se omitirán.', '{{n}} noch nicht im Bestand werden übersprungen.', "{{n}} pas encore dans votre inventaire seront ignorés.", '尚未在库存中的 {{n}} 个将被跳过。'],
  'Move {{n}}': ['Sposta {{n}}', 'Mover {{n}}', '{{n}} verschieben', 'Déplacer {{n}}', '移动 {{n}} 个'],
  'Take out of any box': ['Togli da ogni scatola', 'Sacar de cualquier caja', 'Aus jeder Box nehmen', 'Retirer de toute boîte', '移出所有盒子'],
  Box: ['Scatola', 'Caja', 'Box', 'Boîte', '盒子'],
  'Not in a box': ['Non in una scatola', 'No está en una caja', 'In keiner Box', 'Pas dans une boîte', '不在盒子里'],
  'Paints kept here ({{n}})': ['Colori conservati qui ({{n}})', 'Pinturas guardadas aquí ({{n}})', 'Hier aufbewahrte Farben ({{n}})', 'Peintures rangées ici ({{n}})', '存放于此的颜料（{{n}}）'],
  'Paints here': ['Colori qui', 'Pinturas aquí', 'Farben hier', 'Peintures ici', '此处的颜料'],
}
