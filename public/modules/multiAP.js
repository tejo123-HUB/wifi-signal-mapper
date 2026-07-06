import { drawGrid } from '../core/heatmap.js';

export default {
  id: 'multiAP',
  init(context) {
    const section = document.createElement('section');
    section.id = 'multiap-controls';
    const label = document.createElement('label');
    label.textContent = 'Filter by AP (SSID): ';
    const select = document.createElement('select');
    select.id = 'ssid-filter';
    label.appendChild(select);
    section.appendChild(label);
    context.canvas.parentNode.insertBefore(section, context.canvas);

    let selectedSsid = '';
    let filteredGrid = [];
    const originalRedraw = context.redraw;

    function populateOptions(ssids) {
      const current = select.value;
      select.innerHTML = '';
      const allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = 'All access points';
      select.appendChild(allOpt);
      for (const ssid of ssids) {
        const opt = document.createElement('option');
        opt.value = ssid;
        opt.textContent = ssid;
        select.appendChild(opt);
      }
      select.value = ssids.includes(current) ? current : '';
    }

    async function refreshSsids() {
      if (!context.state.currentFloorId) return;
      const res = await fetch(`/api/floors/${context.state.currentFloorId}/ssids`);
      populateOptions(await res.json());
    }

    async function loadFilteredHeatmap() {
      if (!context.state.currentFloorId || !selectedSsid) return;
      const res = await fetch(
        `/api/floors/${context.state.currentFloorId}/heatmap-by-ssid?ssid=${encodeURIComponent(selectedSsid)}&width=${context.canvas.width}&height=${context.canvas.height}`
      );
      filteredGrid = await res.json();
      context.redraw();
    }

    // When a specific AP is selected, replace the default (all-AP) heatmap
    // with one filtered to just that AP; otherwise defer to core's redraw.
    context.redraw = () => {
      if (selectedSsid) {
        context.canvasEngine.drawRooms();
        drawGrid(context.ctx, filteredGrid);
      } else {
        originalRedraw();
      }
    };

    select.onchange = async () => {
      selectedSsid = select.value;
      if (selectedSsid) {
        await loadFilteredHeatmap();
      } else {
        context.redraw();
      }
    };

    // Refresh the SSID list whenever a new reading is taken or a floor is
    // selected, by wrapping the two hooks core already exposes for this.
    const originalLoadHeatmap = context.loadHeatmap;
    context.loadHeatmap = async (...args) => {
      await originalLoadHeatmap?.(...args);
      await refreshSsids();
      if (selectedSsid) await loadFilteredHeatmap();
    };

    refreshSsids();
  },
};
