export default {
  id: 'deadZoneReport',
  init(context) {
    const section = document.createElement('section');
    section.id = 'dead-zone-report-controls';

    const label = document.createElement('label');
    label.textContent = 'Dead-zone threshold (%): ';
    const thresholdInput = document.createElement('input');
    thresholdInput.type = 'number';
    thresholdInput.value = '40';
    thresholdInput.style.width = '4em';
    label.appendChild(thresholdInput);
    section.appendChild(label);

    const button = document.createElement('button');
    button.textContent = 'Generate dead-zone report';
    section.appendChild(button);

    context.canvas.parentNode.insertBefore(section, context.canvas);

    const resultsEl = document.createElement('div');
    resultsEl.id = 'dead-zone-report-results';
    context.canvas.parentNode.insertBefore(resultsEl, context.canvas.nextSibling);

    function renderReport(report) {
      resultsEl.innerHTML = '';
      const summary = document.createElement('p');
      summary.textContent = `${report.weakSpotCount} of ${report.totalSamples} samples below ${report.threshold}% signal, grouped into ${report.zones.length} zone(s).`;
      resultsEl.appendChild(summary);
      if (report.zones.length === 0) return;

      const table = document.createElement('table');
      const header = document.createElement('tr');
      ['Zone', 'Samples', 'Avg signal', 'Location (x, y)', 'Recommendation'].forEach((text) => {
        const th = document.createElement('th');
        th.textContent = text;
        header.appendChild(th);
      });
      table.appendChild(header);

      for (const zone of report.zones) {
        const row = document.createElement('tr');
        [
          zone.zoneId,
          zone.sampleCount,
          `${zone.averageRssi}%`,
          `(${zone.centerX}, ${zone.centerY})`,
          zone.recommendation,
        ].forEach((text) => {
          const td = document.createElement('td');
          td.textContent = text;
          row.appendChild(td);
        });
        table.appendChild(row);
      }
      resultsEl.appendChild(table);
    }

    button.onclick = async () => {
      if (!context.state.currentFloorId) return alert('Create or select a floor first');
      const res = await fetch(
        `/api/floors/${context.state.currentFloorId}/report?threshold=${thresholdInput.value}`
      );
      renderReport(await res.json());
    };
  },
};
