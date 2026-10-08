(() => {
  "use strict";

  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const ACCEPTED_EXTENSIONS = new Set([
    "pdf", "doc", "docx", "txt", "rtf", "odt", "csv", "md", "ppt", "pptx", "xls", "xlsx"
  ]);
  const CATEGORIES = [
    { name: "Government Sources", icon: "bi-bank", description: "Public agencies and government publications" },
    { name: "Academic / Research", icon: "bi-mortarboard", description: "Research, journals, and academic papers" },
    { name: "Official Organizations", icon: "bi-building", description: "Organizations and institutional documents" },
    { name: "News Sources", icon: "bi-newspaper", description: "News and media publications" },
    { name: "Educational Sources", icon: "bi-book", description: "Educational resources and learning material" },
    { name: "Commercial Sources", icon: "bi-briefcase", description: "Business and commercial publications" },
    { name: "User-Provided Documents", icon: "bi-person-lines-fill", description: "Documents supplied directly by you" },
    { name: "Unknown / Unverified", icon: "bi-question-circle", description: "Origin not identified; review recommended" }
  ];
  const documents = [];
  const fileInput = document.querySelector("#fileInput");
  const dropzone = document.querySelector("#uploadDropzone");
  const views = [...document.querySelectorAll(".view-panel")];
  const categoryChart = document.querySelector("#categoryChart");
  const recentDocuments = document.querySelector("#recentDocuments");
  const documentRows = document.querySelector("#documentRows");
  const toastContainer = document.querySelector("#toastContainer");

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getExtension(name) {
    const dot = name.lastIndexOf(".");
    return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
  }

  function getFileType(extension) {
    if (extension === "pdf") return "PDF";
    if (extension === "doc" || extension === "docx") return "DOCX";
    if (extension === "txt") return "TXT";
    return "Other";
  }

  function getCategory(name) {
    const lower = name.toLowerCase();
    if (/gov|government|agency|public|policy/.test(lower)) return CATEGORIES[0].name;
    if (/research|journal|academic|study|university|doi|paper/.test(lower)) return CATEGORIES[1].name;
    if (/organization|organisation|institution|official|foundation/.test(lower)) return CATEGORIES[2].name;
    if (/news|media|press|times|report/.test(lower)) return CATEGORIES[3].name;
    if (/education|school|course|lesson|textbook/.test(lower)) return CATEGORIES[4].name;
    if (/company|commercial|product|market|business/.test(lower)) return CATEGORIES[5].name;
    return CATEGORIES[6].name;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function showToast(message, kind = "info") {
    const toast = document.createElement("div");
    toast.className = "toast align-items-center show";
    toast.setAttribute("role", "status");
    const icon = kind === "error" ? "bi-exclamation-circle text-danger" : "bi-check-circle text-success";
    toast.innerHTML = `<div class="d-flex"><div class="toast-body"><i class="bi ${icon} me-2"></i>${escapeHtml(message)}</div><button type="button" class="btn-close me-2 m-auto" aria-label="Close"></button></div>`;
    toast.querySelector(".btn-close").addEventListener("click", () => toast.remove());
    toastContainer.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
  }

  function notifyNavigation() {
    document.querySelectorAll("[data-view]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const name = link.dataset.view;
        const title = name.charAt(0).toUpperCase() + name.slice(1);
        views.forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
        document.querySelectorAll(".side-nav .nav-link").forEach((navLink) => {
          navLink.classList.toggle("active", navLink.dataset.view === name);
        });
        document.querySelector("#breadcrumbCurrent").textContent = name === "about" ? "Privacy" : title;
        document.querySelector("#sidebar").classList.remove("open");
        history.replaceState(null, "", `#${name}`);
        if (name === "sources") renderCategories();
      });
    });
  }

  function renderOverview() {
    const identified = documents.filter((document) => document.identified).length;
    document.querySelector("#statDocuments").textContent = documents.length;
    document.querySelector("#statIdentified").textContent = identified;
    document.querySelector("#statReview").textContent = documents.length - identified;
    document.querySelector("#statConflicts").textContent = "—";
    document.querySelector("#navDocumentCount").textContent = documents.length;

    if (documents.length === 0) {
      categoryChart.innerHTML = `<div class="chart-empty"><span class="empty-chart-icon"><i class="bi bi-bar-chart-line"></i></span><strong>Your source landscape starts here</strong><span>Add documents to see how your sources are categorized.</span></div>`;
      recentDocuments.innerHTML = `<div class="recent-empty"><i class="bi bi-file-earmark-plus"></i><span>No documents yet</span><small>Your uploaded files will appear here.</small></div>`;
      return;
    }

    const counts = new Map();
    documents.forEach((document) => counts.set(document.category, (counts.get(document.category) || 0) + 1));
    const max = Math.max(...counts.values());
    categoryChart.innerHTML = [...counts.entries()].map(([name, count]) => `
      <div class="category-row"><span class="category-name">${escapeHtml(name)}</span>
      <div class="category-track"><div class="category-fill" style="width:${Math.round(count / max * 100)}%"></div></div>
      <span class="category-total">${count}</span></div>`).join("");

    recentDocuments.innerHTML = documents.slice(-4).reverse().map((document) => `
      <div class="recent-item"><span class="file-icon ${document.type}"><i class="bi ${document.type === "PDF" ? "bi-file-earmark-pdf" : "bi-file-earmark-text"}"></i></span>
      <span class="recent-meta"><strong title="${escapeHtml(document.name)}">${escapeHtml(document.name)}</strong><small>${document.type} · ${document.size}</small></span>
      <span class="status-pill ${document.identified ? "identified" : "review"}">${document.identified ? "Demo identified" : "Review"}</span></div>`).join("");
  }

  function renderCategories() {
    const grid = document.querySelector("#sourceCategoryGrid");
    if (!grid) return;
    const counts = new Map();
    documents.forEach((document) => counts.set(document.category, (counts.get(document.category) || 0) + 1));
    grid.innerHTML = CATEGORIES.map((category) => `
      <article class="source-category-card"><div class="source-category-top"><span class="source-category-icon"><i class="bi ${category.icon}"></i></span><span class="source-category-count">${counts.get(category.name) || 0}</span></div><h3>${category.name}</h3><p>${category.description}</p></article>`).join("");
  }

  function renderDocuments() {
    const search = document.querySelector("#documentSearch").value.trim().toLowerCase();
    const type = document.querySelector("#typeFilter").value;
    const status = document.querySelector("#statusFilter").value;
    const filtered = documents.filter((document) => {
      const matchesSearch = document.name.toLowerCase().includes(search);
      const matchesType = !type || document.type === type;
      const matchesStatus = !status || (status === "identified" ? document.identified : !document.identified);
      return matchesSearch && matchesType && matchesStatus;
    });
    if (!filtered.length) {
      const hasDocuments = documents.length > 0;
      documentRows.innerHTML = `<tr><td colspan="6"><div class="table-empty"><i class="bi ${hasDocuments ? "bi-search" : "bi-inbox"}"></i><strong>${hasDocuments ? "No matching documents" : "No documents in your library"}</strong><span>${hasDocuments ? "Try adjusting your search or filters." : "Upload a file to begin organizing your sources."}</span>${hasDocuments ? "" : '<button class="button-secondary" type="button" data-upload-trigger>Add your first document</button>'}</div></td></tr>`;
      return;
    }
    documentRows.innerHTML = filtered.map((document) => `
      <tr><td><div class="document-name-cell"><span class="file-icon ${document.type}"><i class="bi ${document.type === "PDF" ? "bi-file-earmark-pdf" : "bi-file-earmark-text"}"></i></span><span><strong title="${escapeHtml(document.name)}">${escapeHtml(document.name)}</strong><small>${escapeHtml(document.category)}</small></span></div></td>
      <td>${document.type}</td><td>${document.size}</td><td>${document.added}</td>
      <td><span class="status-pill ${document.identified ? "identified" : "review"}"><i class="bi ${document.identified ? "bi-stars" : "bi-exclamation-circle"}"></i>${document.identified ? "Demo identified" : "Needs review"}</span></td>
      <td><button class="row-action" type="button" data-delete="${document.id}" aria-label="Delete ${escapeHtml(document.name)}" title="Delete document"><i class="bi bi-trash3"></i></button></td></tr>`).join("");
  }

  function renderAll() {
    renderOverview();
    renderDocuments();
    renderCategories();
  }

  function addFiles(fileList) {
    const accepted = [];
    const rejected = [];
    [...fileList].forEach((file) => {
      const extension = getExtension(file.name);
      if (!ACCEPTED_EXTENSIONS.has(extension)) {
        rejected.push(`${file.name}: unsupported file type`);
      } else if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}: exceeds the 20 MB limit`);
      } else if (documents.some((document) => document.name === file.name && document.sizeBytes === file.size)) {
        rejected.push(`${file.name}: already added`);
      } else {
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          type: getFileType(extension),
          size: formatSize(file.size),
          sizeBytes: file.size,
          added: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date()),
          category: getCategory(file.name),
          identified: false
        });
      }
    });
    documents.push(...accepted);
    renderAll();
    if (accepted.length) showToast(`${accepted.length} document${accepted.length === 1 ? "" : "s"} added to this browser session.`);
    if (rejected.length) showToast(rejected.join("; "), "error");
  }

  function generateReport() {
    const categoryCounts = new Map();
    documents.forEach((document) => categoryCounts.set(document.category, (categoryCounts.get(document.category) || 0) + 1));
    const inventory = documents.length
      ? documents.map((document, index) => `${index + 1}. ${document.name} (${document.type}, ${document.size})\n   Demo category: ${document.category} | Assessment: ${document.identified ? "Demo identified" : "Needs review"}`).join("\n")
      : "No documents have been added.";
    const categories = categoryCounts.size
      ? [...categoryCounts.entries()].map(([category, count]) => `- ${category}: ${count}`).join("\n")
      : "- No sources classified.";
    const content = [
      "SOURCEVERIFY AI — SOURCE REVIEW SUMMARY",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "EXECUTIVE SUMMARY",
      `This workspace contains ${documents.length} document${documents.length === 1 ? "" : "s"}. No document text has been extracted or verified in this demo.`,
      "",
      "UPLOADED DOCUMENTS",
      inventory,
      "",
      "SOURCE CLASSIFICATION (ILLUSTRATIVE)",
      categories,
      "",
      "SOURCE COMPARISON",
      "Not performed. A document analysis backend is not connected.",
      "",
      "CONFLICTING INFORMATION",
      "Not analyzed. A document analysis backend is not connected.",
      "",
      "IMPORTANT FINDINGS",
      "No content-level findings have been generated.",
      "",
      "REFERENCES",
      "No external references have been independently verified.",
      "",
      "AI ANALYSIS DISCLAIMER",
      "Source categories in this report are filename-based demo labels, not independently verified source identities or credibility scores. No document contents were read, scanned, uploaded, or analyzed. Verify all sources and findings against original material. This report is not a claim of source verification."
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sourceverify-report-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("Your demo source review report was downloaded.");
  }

  document.querySelectorAll("[data-upload-trigger]").forEach((button) => button.addEventListener("click", () => fileInput.click()));
  document.querySelectorAll("[data-generate-report]").forEach((button) => button.addEventListener("click", generateReport));
  document.querySelector("#generateReport").addEventListener("click", generateReport);
  fileInput.addEventListener("change", () => {
    addFiles(fileInput.files);
    fileInput.value = "";
  });
  document.querySelector("#documentSearch").addEventListener("input", renderDocuments);
  document.querySelector("#typeFilter").addEventListener("change", renderDocuments);
  document.querySelector("#statusFilter").addEventListener("change", renderDocuments);
  documentRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    const index = documents.findIndex((document) => document.id === button.dataset.delete);
    if (index >= 0) {
      const [removed] = documents.splice(index, 1);
      renderAll();
      showToast(`${removed.name} removed from this workspace.`);
    }
  });
  ["dragenter", "dragover"].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("drag-over");
  }));
  ["dragleave", "drop"].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("drag-over");
  }));
  dropzone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
  document.querySelector(".theme-toggle").addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-theme");
    document.querySelector(".theme-toggle i").className = isDark ? "bi bi-sun" : "bi bi-moon-stars";
    document.querySelector(".theme-toggle").setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  });
  document.querySelector(".mobile-menu").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
  document.querySelector(".notice-dismiss").addEventListener("click", () => document.querySelector(".demo-notice").remove());
  document.querySelector("#reportDate").textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date());

  notifyNavigation();
  const initialView = location.hash.slice(1);
  const initialLink = document.querySelector(`.side-nav [data-view="${initialView}"]`);
  if (initialLink) initialLink.click();
  else renderAll();
})();
