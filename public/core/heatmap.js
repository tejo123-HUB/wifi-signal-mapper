// RSSI here is a 0-100 quality percentage (see server/core/wifiScanner.js) —
// keep this mapping in that same scale, don't switch to dBm ranges.
function rssiToColor(rssi) {
  const clamped = Math.max(0, Math.min(100, rssi));
  const hue = (clamped / 100) * 120; // 0 = red (weak), 120 = green (strong)
  return `hsla(${hue}, 80%, 50%, 0.45)`;
}

export default {
  id: 'heatmap',
  init(context) {
    const smoothingSlider = document.getElementById('smoothing');
    let grid = [];

    context.heatmap = {
      draw() {
        const { ctx } = context;
        const cellSize = 20;
        for (const point of grid) {
          ctx.fillStyle = rssiToColor(point.rssi);
          ctx.fillRect(point.x - cellSize / 2, point.y - cellSize / 2, cellSize, cellSize);
        }
      },
    };

    let requestToken = 0;
    context.loadHeatmap = async () => {
      if (!context.state.currentFloorId) return;
      const floorId = context.state.currentFloorId;
      const power = smoothingSlider.value;
      const token = ++requestToken;
      try {
        const result = await context.api.getHeatmap(
          floorId,
          power,
          context.canvas.width,
          context.canvas.height
        );
        // Ignore this response if a newer request (floor switch, slider
        // move) has already been kicked off while we were waiting.
        if (token !== requestToken) return;
        grid = result;
        context.redraw();
      } catch (e) {
        console.error('Failed to load heatmap:', e);
      }
    };

    smoothingSlider.oninput = () => context.loadHeatmap();
  },
};
