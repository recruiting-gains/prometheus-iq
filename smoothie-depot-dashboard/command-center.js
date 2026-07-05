const searchInput = document.querySelector("#dossierSearch");
const sections = [...document.querySelectorAll(".intel-section")];

function applySearch() {
  const query = searchInput?.value.trim().toLowerCase() || "";
  for (const section of sections) {
    const matches = !query || section.textContent.toLowerCase().includes(query);
    section.hidden = !matches;
    if (query && matches) section.open = true;
  }
}

searchInput?.addEventListener("input", applySearch);

for (const button of document.querySelectorAll("[data-command]")) {
  button.addEventListener("click", () => {
    if (button.dataset.command === "printPackage") {
      window.print();
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
