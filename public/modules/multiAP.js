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
    let lastFetchedFloorId = null;
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
      // Keep selectedSsid in sync with what the dropdown actually shows —
      // if the previously-selected SSID doesn't exist on this floor, both
      // must fall back to "All access points" together.
      select.value = ssids.includes(current) ? current : '';
      selectedSsid = select.value;
    }

    // A new sample can introduce an SSID that wasn't seen before, so a
    // caller can force a refetch even if the floor hasn't changed; a plain
    // smoothing-slider drag (which also routes through context.loadHeatmap)
    // doesn't need to re-fetch the SSID list at all.
    async function refreshSsids(force = false) {
      const floorId = context.state.currentFloorId;
      if (!floorId) return;
      if (!force && floorId === lastFetchedFloorId) return;
      lastFetchedFloorId = floorId;
      const res = await fetch(`/api/floors/${floorId}/ssids`);
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

    // context.loadHeatmap fires on floor switch AND on every smoothing-slider
    // tick — only re-fetch SSIDs when the floor has actually changed
    // (refreshSsids' own floor-id cache handles that), not on every tick.
    const originalLoadHeatmap = context.loadHeatmap;
    context.loadHeatmap = async (...args) => {
      await originalLoadHeatmap?.(...args);
      await refreshSsids();
      if (selectedSsid) await loadFilteredHeatmap();
    };

    // A new sample can introduce an SSID that wasn't seen before on this
    // floor, so force a refetch here regardless of the floor-id cache.
    const originalTakeSample = context.api.takeSample;
    context.api.takeSample = async (...args) => {
      const sample = await originalTakeSample(...args);
      await refreshSsids(true);
      return sample;
    };

    refreshSsids();
  },
};
