import { drawGrid } from '../core/heatmap.js';

function toEpochMs(datetimeLocalValue) {
  return new Date(datetimeLocalValue).getTime();
}

function drawMini(canvas, rooms, grid, scale) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const room of rooms) {
    if (room.image && room.image.complete && !room.imageFailed) {
      ctx.drawImage(
        room.image,
        room.x * scale,
        room.y * scale,
        room.width * scale,
        room.height * scale
      );
    }
  }
  const scaledGrid = grid.map((p) => ({ x: p.x * scale, y: p.y * scale, rssi: p.rssi }));
  drawGrid(ctx, scaledGrid, 20 * scale);
}

export default {
  id: 'congestionTracking',
  init(context) {
    const section = document.createElement('section');
    section.id = 'congestion-controls';

    function rangeInputs(label) {
      const wrapper = document.createElement('span');
      const span = document.createElement('span');
      span.textContent = `${label}: `;
      const start = document.createElement('input');
      start.type = 'datetime-local';
      const end = document.createElement('input');
      end.type = 'datetime-local';
      wrapper.append(span, start, ' to ', end);
      section.appendChild(wrapper);
      return { start, end };
    }

    const range1 = rangeInputs('Range 1');
    const range2 = rangeInputs('Range 2');
    const compareBtn = document.createElement('button');
    compareBtn.textContent = 'Compare';
    section.appendChild(compareBtn);

    context.canvas.parentNode.insertBefore(section, context.canvas);

    const resultsEl = document.createElement('div');
    resultsEl.id = 'congestion-results';
    resultsEl.style.display = 'flex';
    resultsEl.style.gap = '1rem';
    context.canvas.parentNode.insertBefore(resultsEl, context.canvas.nextSibling);

    const note = document.createElement('p');
    context.canvas.parentNode.insertBefore(note, resultsEl.nextSibling);

    function makePanel(labelText) {
      const panel = document.createElement('div');
      const heading = document.createElement('p');
      heading.textContent = labelText;
      const canvas = document.createElement('canvas');
      const scale = 0.3;
      canvas.width = context.canvas.width * scale;
      canvas.height = context.canvas.height * scale;
      canvas.style.border = '1px solid #ccc';
      panel.append(heading, canvas);
      return { panel, heading, canvas, scale };
    }

    compareBtn.onclick = async () => {
      if (!context.state.currentFloorId) return alert('Create or select a floor first');
      if (!range1.start.value || !range1.end.value || !range2.start.value || !range2.end.value) {
        return alert('Fill in both time ranges first');
      }
      const params = new URLSearchParams({
        range1Start: toEpochMs(range1.start.value),
        range1End: toEpochMs(range1.end.value),
        range2Start: toEpochMs(range2.start.value),
        range2End: toEpochMs(range2.end.value),
        width: context.canvas.width,
        height: context.canvas.height,
      });
      const res = await fetch(`/api/floors/${context.state.currentFloorId}/congestion?${params}`);
      const body = await res.json();
      if (!res.ok) return alert(body.error || 'Comparison failed');
      const { range1: r1, range2: r2 } = body;

      resultsEl.innerHTML = '';
      const p1 = makePanel(`Range 1: ${r1.sampleCount} samples, avg ${r1.averageRssi ?? 'n/a'}%`);
      const p2 = makePanel(`Range 2: ${r2.sampleCount} samples, avg ${r2.averageRssi ?? 'n/a'}%`);
      resultsEl.append(p1.panel, p2.panel);
      drawMini(p1.canvas, context.state.rooms, r1.grid, p1.scale);
      drawMini(p2.canvas, context.state.rooms, r2.grid, p2.scale);

      if (r1.averageRssi != null && r2.averageRssi != null) {
        const drop = r1.averageRssi - r2.averageRssi;
        note.textContent =
          Math.abs(drop) >= 15
            ? `Signal is ${drop > 0 ? 'notably weaker in range 2' : 'notably weaker in range 1'} (${Math.abs(drop).toFixed(1)}pt gap at the same physical points) — likely congestion-based, not distance-based, since the AP-to-point distance didn't change between surveys.`
            : `Signal levels are similar between the two ranges (${Math.abs(drop).toFixed(1)}pt gap) — weak zones here are more likely distance-based than congestion-based.`;
      } else {
        note.textContent = 'Not enough samples in one or both ranges to compare.';
      }
    };
  },
};
