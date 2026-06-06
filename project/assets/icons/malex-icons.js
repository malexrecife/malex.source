/* Malex icon set — derived from the lllX. 24px grid, round join/cap.
   Weights: regular (stroke 2) and bold (stroke 2.75).
   Usage: el.innerHTML = malexIconSVG('locker', {size:24, stroke:2, color:'var(--navy-900)'}); */
window.MALEX_ICONS = {
  "locker": "<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2.5\"/><line x1=\"4\" y1=\"12\" x2=\"20\" y2=\"12\"/><line x1=\"9\" y1=\"7\" x2=\"9\" y2=\"8.6\"/><line x1=\"9\" y1=\"15.4\" x2=\"9\" y2=\"17\"/>",
  "qr-code": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.2\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.2\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.2\"/><path d=\"M14 14h3v3h-3z\"/><path d=\"M20.6 14v.01\"/><path d=\"M14 20.6v.01\"/><path d=\"M20.6 17.5v3.1\"/><path d=\"M17.5 20.6h3.1\"/>",
  "location": "<path d=\"M12 21c4.5-4 7-7.3 7-10.5a7 7 0 1 0-14 0C5 13.7 7.5 17 12 21Z\"/><circle cx=\"12\" cy=\"10.3\" r=\"2.6\"/>",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3.4 2\"/>",
  "shield": "<path d=\"M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3Z\"/><path d=\"M9 12l2 2 4-4\"/>",
  "card": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2.6\"/><line x1=\"3\" y1=\"9.6\" x2=\"21\" y2=\"9.6\"/><line x1=\"6.5\" y1=\"14.6\" x2=\"10.5\" y2=\"14.6\"/>",
  "pix": "<path d=\"M12 3.2 20.8 12 12 20.8 3.2 12 12 3.2Z\"/><path d=\"M8.3 12 12 15.7 15.7 12 12 8.3 8.3 12Z\"/>",
  "suitcase": "<rect x=\"4\" y=\"7\" width=\"16\" height=\"13\" rx=\"2.6\"/><path d=\"M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2\"/><line x1=\"12\" y1=\"11\" x2=\"12\" y2=\"16\"/>",
  "plane": "<path d=\"M12 2.3c.7 0 1.2.8 1.2 1.8v4.9l6.8 4v1.7l-6.8-1.9v3.6l2 1.5v1.4L12 18.9l-3.2 1.4v-1.4l2-1.5v-3.6l-6.8 1.9v-1.7l6.8-4V4.1c0-1 .5-1.8 1.2-1.8Z\"/>",
  "train": "<rect x=\"5\" y=\"3\" width=\"14\" height=\"14\" rx=\"3\"/><line x1=\"5\" y1=\"10.5\" x2=\"19\" y2=\"10.5\"/><line x1=\"8.6\" y1=\"13.7\" x2=\"8.6\" y2=\"13.7\"/><line x1=\"15.4\" y1=\"13.7\" x2=\"15.4\" y2=\"13.7\"/><path d=\"M8.5 17l-2.5 4\"/><path d=\"M15.5 17l2.5 4\"/>",
  "parking": "<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"3\"/><path d=\"M9.5 17V8h3.7a2.6 2.6 0 0 1 0 5.2H9.5\"/>",
  "support": "<path d=\"M5 13.5v-1.5a7 7 0 0 1 14 0v1.5\"/><rect x=\"3.2\" y=\"13\" width=\"3.6\" height=\"6\" rx=\"1.6\"/><rect x=\"17.2\" y=\"13\" width=\"3.6\" height=\"6\" rx=\"1.6\"/><path d=\"M19 19a3.2 3.2 0 0 1-3 2.4h-2\"/>",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"7\"/><line x1=\"16.2\" y1=\"16.2\" x2=\"21\" y2=\"21\"/>",
  "arrow-right": "<line x1=\"4\" y1=\"12\" x2=\"19.5\" y2=\"12\"/><path d=\"M13.5 6l6 6-6 6\"/>",
  "arrow-left": "<line x1=\"20\" y1=\"12\" x2=\"4.5\" y2=\"12\"/><path d=\"M10.5 6l-6 6 6 6\"/>",
  "check": "<path d=\"M4 12.5l5 5L20 6.5\"/>",
  "menu": "<line x1=\"4\" y1=\"7\" x2=\"20\" y2=\"7\"/><line x1=\"4\" y1=\"12\" x2=\"20\" y2=\"12\"/><line x1=\"4\" y1=\"17\" x2=\"20\" y2=\"17\"/>",
  "user": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4.5 20.5a7.5 7.5 0 0 1 15 0\"/>",
  "ticket": "<path d=\"M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V7Z\"/><line x1=\"14\" y1=\"6.5\" x2=\"14\" y2=\"9\"/><line x1=\"14\" y1=\"15\" x2=\"14\" y2=\"17.5\"/>",
  "wallet": "<rect x=\"3\" y=\"6\" width=\"18\" height=\"13\" rx=\"2.6\"/><path d=\"M3 9.5h12.5a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H3\"/><line x1=\"14.5\" y1=\"12.5\" x2=\"14.5\" y2=\"12.5\"/>",
  "map": "<path d=\"M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3Z\"/><line x1=\"9\" y1=\"3\" x2=\"9\" y2=\"18\"/><line x1=\"15\" y1=\"6\" x2=\"15\" y2=\"21\"/>",
  "navigation": "<path d=\"M3.5 11 21 4l-7 17-2.6-7.9L3.5 11Z\"/>",
  "unlock": "<rect x=\"4\" y=\"10\" width=\"16\" height=\"11\" rx=\"2.6\"/><path d=\"M8 10V7a4 4 0 0 1 7.7-1.5\"/><line x1=\"12\" y1=\"14.2\" x2=\"12\" y2=\"17\"/>",
  "lock": "<rect x=\"4\" y=\"10\" width=\"16\" height=\"11\" rx=\"2.6\"/><path d=\"M8 10V7a4 4 0 0 1 8 0v3\"/><line x1=\"12\" y1=\"14.2\" x2=\"12\" y2=\"17\"/>",
  "package": "<path d=\"M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z\"/><path d=\"M4.2 7.6 12 12l7.8-4.4\"/><line x1=\"12\" y1=\"12\" x2=\"12\" y2=\"21\"/>",
  "calendar-check": "<rect x=\"4\" y=\"5\" width=\"16\" height=\"16\" rx=\"2.6\"/><line x1=\"4\" y1=\"9.6\" x2=\"20\" y2=\"9.6\"/><line x1=\"8\" y1=\"3\" x2=\"8\" y2=\"6.2\"/><line x1=\"16\" y1=\"3\" x2=\"16\" y2=\"6.2\"/><path d=\"M9 14.8l2 2 4-4\"/>",
  "star": "<path d=\"M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 17l-5.3 2.7 1.1-6L3.4 9.5l6-.8L12 3.2Z\"/>",
  "phone": "<path d=\"M5.5 4h3.2l1.6 4-2 1.4a11 11 0 0 0 5 5l1.4-2 4 1.6V20a1.5 1.5 0 0 1-1.5 1.5A16.5 16.5 0 0 1 4 5.5 1.5 1.5 0 0 1 5.5 4Z\"/>",
  "chevron-right": "<path d=\"M9 5l7 7-7 7\"/>",
  "close": "<line x1=\"5.5\" y1=\"5.5\" x2=\"18.5\" y2=\"18.5\"/><line x1=\"18.5\" y1=\"5.5\" x2=\"5.5\" y2=\"18.5\"/>",
  "plus": "<line x1=\"12\" y1=\"4.5\" x2=\"12\" y2=\"19.5\"/><line x1=\"4.5\" y1=\"12\" x2=\"19.5\" y2=\"12\"/>",
  "bell": "<path d=\"M6 9.5a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4s2-1.5 2-6.5Z\"/><path d=\"M10 20a2 2 0 0 0 4 0\"/>",
};

// Aliases so common Lucide names resolve to the Malex set (drop-in for kits).
(function(){
  var A = { "map-pin":"location", "shield-check":"shield", "credit-card":"card", "x":"close", "log-in":"arrow-right", "chevron":"chevron-right" };
  for (var k in A) { if (window.MALEX_ICONS[A[k]]) window.MALEX_ICONS[k] = window.MALEX_ICONS[A[k]]; }
})();

window.malexIconSVG = function(name, opts){
  opts = opts || {};
  var inner = window.MALEX_ICONS[name];
  if(!inner){ return null; }
  var size = opts.size || 24;
  var sw = opts.stroke || (opts.bold ? 2.75 : 2);
  var color = opts.color || 'currentColor';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round">'+inner+'</svg>';
};
window.MALEX_ICON_NAMES = Object.keys(window.MALEX_ICONS);
