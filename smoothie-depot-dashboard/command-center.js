const searchInput = document.querySelector("#dossierSearch");
const sections = [...document.querySelectorAll(".intel-section")];
const exportStatus = document.querySelector("[data-export-status]");

function applySearch() {
  const query = searchInput?.value.trim().toLowerCase() || "";
  for (const section of sections) {
    const matches = !query || section.textContent.toLowerCase().includes(query);
    section.hidden = !matches;
    if (query && matches) section.open = true;
  }
}

searchInput?.addEventListener("input", applySearch);

function setExportStatus(message) {
  if (exportStatus) exportStatus.textContent = message;
}

function preparePrintPackage() {
  if (searchInput) {
    searchInput.value = "";
  }

  for (const section of sections) {
    section.hidden = false;
    if ("open" in section) section.open = true;
  }

  document.documentElement.dataset.printExport = "active";
}

function waitForPaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function exportPackageToPdf() {
  try {
    preparePrintPackage();
    setExportStatus("Preparing complete package for PDF export...");
    await waitForPaint();
    window.focus();
    window.print();
    setExportStatus("Print dialog requested. Choose Save as PDF to export the complete package.");
  } catch (error) {
    console.error("PDF export could not open the browser print dialog.", error);
    setExportStatus("PDF export could not open automatically. Use the browser print command to save as PDF.");
  }
}

window.addEventListener("afterprint", () => {
  delete document.documentElement.dataset.printExport;
  setExportStatus("PDF export flow completed or print dialog closed.");
});

for (const button of document.querySelectorAll("[data-command]")) {
  button.addEventListener("click", () => {
    if (button.dataset.command === "printPackage") {
      exportPackageToPdf();
      return;
    }

    const open = button.dataset.command === "expand";
    for (const section of sections) section.open = open;
  });
}

for (const toggle of document.querySelectorAll("[data-bookmark]")) {
  toggle.addEventListener("change", () => {
    document.getElementById(toggle.dataset.bookmark)?.classList.toggle("is-bookmarked", toggle.checked);
  });
}

for (const toggle of document.querySelectorAll("[data-highlight]")) {
  toggle.addEventListener("change", () => {
    document.getElementById(toggle.dataset.highlight)?.classList.toggle("is-highlighted", toggle.checked);
  });
}
