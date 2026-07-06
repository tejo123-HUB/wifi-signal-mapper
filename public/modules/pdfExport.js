// jsPDF is vendored under public/vendor/ (copied from node_modules/jspdf's
// UMD build) rather than fetched from a CDN, so exporting works fully
// offline like the rest of this app. The UMD build is used specifically
// because jspdf's published "browser ESM" build (dist/jspdf.es.min.js) has
// unresolved bare imports (@babel/runtime/helpers/...) that only a bundler
// can resolve — it isn't actually loadable directly via <script type=module>.
// The UMD build is self-contained, so it's loaded as a classic script and
// exposes window.jspdf.jsPDF.
let loadPromise;
function loadJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/jspdf.umd.min.js';
      script.onload = () => resolve(window.jspdf.jsPDF);
      script.onerror = () => reject(new Error('Failed to load jsPDF'));
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}

export default {
  id: 'pdfExport',
  init(context) {
    const button = document.createElement('button');
    button.id = 'export-pdf-btn';
    button.textContent = 'Export as PDF';
    context.canvas.parentNode.insertBefore(button, context.canvas.nextSibling);

    button.onclick = async () => {
      try {
        const jsPDF = await loadJsPdf();
        const { canvas } = context;
        const imgData = canvas.toDataURL('image/png');
        const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
        const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save('wifi-heatmap.pdf');
      } catch (e) {
        console.error('PDF export failed:', e);
        alert('PDF export failed — see console for details.');
      }
    };
  },
};
