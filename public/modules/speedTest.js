// Uses Cloudflare's public, no-auth speed-test endpoint to measure real
// download throughput over whatever network link is active at the tagged
// point — this is what makes it meaningful alongside RSSI (signal strength
// and actual usable speed aren't always the same thing). Requires internet
// access; if the request fails, the sample is still saved, just without a
// throughput value.
async function measureDownloadMbps() {
  const bytes = 5_000_000;
  const start = performance.now();
  const res = await fetch(`https://speed.cloudflare.com/__down?bytes=${bytes}`, {
    cache: 'no-store',
  });
  await res.arrayBuffer();
  const seconds = (performance.now() - start) / 1000;
  return Math.round(((bytes * 8) / seconds / 1_000_000) * 100) / 100;
}

export default {
  id: 'speedTest',
  init(context) {
    const label = document.createElement('label');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.id = 'speed-test-toggle';
    const statusSpan = document.createElement('span');
    label.append(toggle, ' Include speed test', statusSpan);

    const takeReadingBtn = document.getElementById('take-reading-btn');
    if (takeReadingBtn) {
      takeReadingBtn.parentNode.insertBefore(label, takeReadingBtn.nextSibling);
    }

    const originalTakeSample = context.api.takeSample;
    context.api.takeSample = async (floorId, x, y) => {
      const sample = await originalTakeSample(floorId, x, y);
      if (toggle.checked) {
        statusSpan.textContent = ' (measuring speed…)';
        try {
          const mbps = await measureDownloadMbps();
          await fetch(`/api/samples/${sample.id}/speed`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ download_mbps: mbps }),
          });
          sample.download_mbps = mbps;
        } catch (e) {
          console.error('Speed test failed:', e);
        } finally {
          statusSpan.textContent = '';
        }
      }
      return sample;
    };
  },
};
