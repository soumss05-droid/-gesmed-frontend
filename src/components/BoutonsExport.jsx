import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import "./BoutonsExport.css";

// Composant générique à déposer sur n'importe quel écran (réquisition, BL,
// commande, rapport, fiche de stock...) pour donner à l'utilisateur le choix
// d'imprimer, ou d'exporter le contenu visé par `cibleId` en Excel, PDF ou
// Word, via un seul bouton "Exporter" (menu déroulant), plus un bouton
// "Imprimer" séparé.
//
// Impression : on clone le contenu visé dans un conteneur temporaire ajouté
// directement sous <body>, puis on masque tout le reste de la page avec
// display:none (retiré du flux) plutôt que visibility:hidden (qui garde sa
// place dans la mise en page et provoquait des pages blanches en trop dès
// que la page contenait beaucoup de contenu caché — formulaires, onglets,
// historique...). Le conteneur temporaire est retiré juste après
// l'impression.
//
// PDF : capture visuelle (html2canvas) de la cible, insérée en image dans un
// PDF A4 — fidèle au rendu écran, adapté aussi bien aux tableaux qu'aux
// formulaires/documents (réquisition, BL...).
//
// Excel : cherche le ou les <table> présents dans la cible et les convertit
// directement en feuille de calcul (XLSX.utils.table_to_sheet). N'a de sens
// que sur les écrans qui affichent un tableau ; si aucun tableau n'est
// trouvé, un message prévient l'utilisateur plutôt que de produire un
// fichier vide.
//
// Word : récupère le HTML de la cible (hors éléments `.no-print`) et
// l'enregistre dans un fichier .doc, lisible par Word.
//
// Dans les trois cas, les éléments marqués `.no-print` (boutons d'export,
// actions de validation, etc.) sont exclus du rendu exporté — y compris les
// boutons de ce composant lui-même, qui s'affichent souvent dans la carte
// imprimable, et dont les icônes emoji sont de toute façon mal rendues sur
// un <canvas> (glyphes cassés).
const ignorerElementsNonImprimables = (element) =>
  element.classList?.contains("no-print");

// Clone la cible et retire les éléments .no-print, pour les exports qui
// lisent le HTML directement (Excel, Word) plutôt que de passer par
// html2canvas (qui a son propre mécanisme d'exclusion ci-dessus).
function cloneSansElementsNonImprimables(element) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll(".no-print").forEach((n) => n.remove());
  return clone;
}

export default function BoutonsExport({ cibleId, nomFichier = "document" }) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function fermerSiExterieur(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOuvert(false);
      }
    }
    document.addEventListener("mousedown", fermerSiExterieur);
    return () => document.removeEventListener("mousedown", fermerSiExterieur);
  }, []);

  function imprimer() {
    const element = document.getElementById(cibleId);
    if (!element) return;

    const conteneur = document.createElement("div");
    conteneur.id = "zone-impression-temporaire";
    conteneur.appendChild(element.cloneNode(true));
    document.body.appendChild(conteneur);

    function nettoyer() {
      conteneur.remove();
      window.removeEventListener("afterprint", nettoyer);
    }
    window.addEventListener("afterprint", nettoyer);

    window.print();
  }

  async function exporterPdf() {
    const element = document.getElementById(cibleId);
    if (!element) return;
    const canvas = await html2canvas(element, {
      scale: 2,
      ignoreElements: ignorerElementsNonImprimables,
    });
    const image = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const largeurPage = pdf.internal.pageSize.getWidth();
    const hauteurImage = (canvas.height * largeurPage) / canvas.width;
    pdf.addImage(image, "PNG", 0, 0, largeurPage, hauteurImage);
    pdf.save(`${nomFichier}.pdf`);
  }

  function exporterExcel() {
    const element = document.getElementById(cibleId);
    if (!element) return;
    const clone = cloneSansElementsNonImprimables(element);
    const tables = clone.querySelectorAll("table");
    if (tables.length === 0) {
      alert("Cette page ne contient pas de tableau exportable vers Excel.");
      return;
    }
    const classeur = XLSX.utils.book_new();
    tables.forEach((table, index) => {
      const feuille = XLSX.utils.table_to_sheet(table);
      XLSX.utils.book_append_sheet(classeur, feuille, `Tableau ${index + 1}`);
    });
    XLSX.writeFile(classeur, `${nomFichier}.xlsx`);
  }

  function exporterWord() {
    const element = document.getElementById(cibleId);
    if (!element) return;
    const clone = cloneSansElementsNonImprimables(element);

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${nomFichier}</title></head>
      <body>${clone.innerHTML}</body>
      </html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `${nomFichier}.doc`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  }

  function gererExport(format) {
    setMenuOuvert(false);
    if (format === "excel") exporterExcel();
    if (format === "pdf") exporterPdf();
    if (format === "word") exporterWord();
  }

  return (
    <div className="export-actions no-print" ref={menuRef}>
      <div className="export-menu-conteneur">
        <button type="button" className="export-bouton" onClick={() => setMenuOuvert((o) => !o)}>
          📤 Exporter ▾
        </button>
        {menuOuvert && (
          <div className="export-menu">
            <button type="button" onClick={() => gererExport("excel")}>Excel (.xlsx)</button>
            <button type="button" onClick={() => gererExport("pdf")}>PDF</button>
            <button type="button" onClick={() => gererExport("word")}>Word (.doc)</button>
          </div>
        )}
      </div>
      <button type="button" className="export-bouton" onClick={imprimer}>
        🖨 Imprimer
      </button>
    </div>
  );
}