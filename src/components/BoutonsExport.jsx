import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import "./BoutonsExport.css";

// Composant générique à déposer sur n'importe quel écran (réquisition, BL,
// rapport, fiche de stock...) pour donner à l'utilisateur le choix
// d'imprimer, ou d'enregistrer en image (PNG) ou en PDF le contenu visé par
// `cibleId`. L'élément portant cet id doit aussi porter la classe CSS
// "zone-imprimable" pour que l'impression n'inclue que lui.
export default function BoutonsExport({ cibleId, nomFichier = "document" }) {
  function imprimer() {
    window.print();
  }

  async function exporterImage() {
    const element = document.getElementById(cibleId);
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2 });
    const lien = document.createElement("a");
    lien.download = `${nomFichier}.png`;
    lien.href = canvas.toDataURL("image/png");
    lien.click();
  }

  async function exporterPdf() {
    const element = document.getElementById(cibleId);
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2 });
    const image = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const largeurPage = pdf.internal.pageSize.getWidth();
    const hauteurImage = (canvas.height * largeurPage) / canvas.width;
    pdf.addImage(image, "PNG", 0, 0, largeurPage, hauteurImage);
    pdf.save(`${nomFichier}.pdf`);
  }

  return (
    <div className="export-actions no-print">
      <button type="button" className="export-bouton" onClick={imprimer}>
        🖨 Imprimer
      </button>
      <button type="button" className="export-bouton" onClick={exporterImage}>
        🖼 Enregistrer en image
      </button>
      <button type="button" className="export-bouton" onClick={exporterPdf}>
        📄 Enregistrer en PDF
      </button>
    </div>
  );
}