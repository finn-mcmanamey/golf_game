/* ===== home-screen icon: drawn at start-up, so the single HTML file needs no image files =====
   iOS reads the apple-touch-icon when you "Add to Home Screen"; Android reads the manifest. */

function drawAppIcon(size = 180) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), u = size / 18;
  const sky = g.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, '#1f3d72'); sky.addColorStop(0.55, '#3a6ea8'); sky.addColorStop(0.56, '#0d2a40'); sky.addColorStop(1, '#0a1f30');
  g.fillStyle = sky; g.fillRect(0, 0, size, size);
  // Water lines, then a single sculler in voxel blocks: hull, rower, two oars and yellow blades.
  g.fillStyle = 'rgba(255,255,255,.18)';
  for (let i = 0; i < 4; i++) g.fillRect(u * (1 + i * 4), u * (12 + (i % 2)), u * 2.5, u * 0.35);
  g.fillStyle = '#f4f1e8'; g.fillRect(u * 2, u * 10, u * 14, u);
  g.fillStyle = '#ffd23a'; g.fillRect(u * 8, u * 6.5, u * 1.6, u * 2.6);
  g.fillStyle = '#e0b590'; g.fillRect(u * 8.1, u * 5, u * 1.4, u * 1.4);
  g.strokeStyle = '#e8e8e8'; g.lineWidth = u * 0.45;
  g.beginPath(); g.moveTo(u * 8, u * 8.5); g.lineTo(u * 3.5, u * 12.5); g.moveTo(u * 9.6, u * 8.5); g.lineTo(u * 14.5, u * 12.5); g.stroke();
  g.fillStyle = '#ffd23a'; g.fillRect(u * 2.6, u * 12.2, u * 1.6, u * 0.8); g.fillRect(u * 14, u * 12.2, u * 1.6, u * 0.8);
  return c.toDataURL('image/png');
}

function installAppIcon() {
  try {
    const icon = drawAppIcon(180), link = document.createElement('link');
    link.rel = 'apple-touch-icon'; link.href = icon;
    document.head.appendChild(link);
    const fav = document.createElement('link');
    fav.rel = 'icon'; fav.href = drawAppIcon(64);
    document.head.appendChild(fav);
    const manifest = { name: 'Voxel Regatta', short_name: 'Regatta', display: 'standalone', background_color: '#0d1b2e', theme_color: '#0d1b2e',
      icons: [{ src: drawAppIcon(512), sizes: '512x512', type: 'image/png' }] };
    const m = document.createElement('link');
    m.rel = 'manifest'; m.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));
    document.head.appendChild(m);
  } catch (e) { /* an icon is a nicety; never let it stop the game */ }
}
installAppIcon();
