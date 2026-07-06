export default {
  id: 'tagging',
  init(context) {
    const { api, state } = context;
    const statusEl = document.getElementById('status');
    const takeReadingBtn = document.getElementById('take-reading-btn');

    context.canvas.addEventListener('click', (e) => {
      if (context.suppressNextClick) {
        context.suppressNextClick = false;
        return;
      }
      state.lastClick = context.getCanvasPos(e);
      statusEl.textContent = `Point selected: (${Math.round(state.lastClick.x)}, ${Math.round(state.lastClick.y)})`;
    });

    takeReadingBtn.onclick = async () => {
      if (!state.currentFloorId) return alert('Create or select a floor first');
      if (!state.lastClick) return alert('Click a point on the floor plan first');
      const sample = await api.takeSample(state.currentFloorId, state.lastClick.x, state.lastClick.y);
      state.samples.push(sample);
      statusEl.textContent = `Recorded: ${sample.rssi} at (${Math.round(sample.x)}, ${Math.round(sample.y)})`;
      if (context.loadHeatmap) context.loadHeatmap();
    };
  },
};
