/* script.js - frontend connected to backend.py
   Provides: upload image, save candidate (local + backend), show list, delete, download excel, download pdf
*/

const BACKEND_URL = "http://localhost:8000";
const DOMAINS = [
  "EMBEDDED",
  "FPGA",
  "RTOS",
  "RF",
  "WIRELESS",
  "SYSTEM ENGG",
  "COMM AND DSP",
  "CORRELATION AND FUSION"
];

let uploadedImageBase64 = "";
let candidateList = []; // local cache
let companyLogoBase64 = "";

/* ---------- Init ---------- */
window.addEventListener("DOMContentLoaded", () => {
  candidateList = JSON.parse(localStorage.getItem("candidateList")) || [];

  const uploadBox = document.getElementById("uploadBox");
  const uploadInput = document.getElementById("imageUpload");

  if (uploadBox) {
    uploadBox.addEventListener("click", () => { if (uploadInput) uploadInput.click(); });
    uploadBox.addEventListener("dragover", (e) => { e.preventDefault(); uploadBox.classList.add("dragover"); });
    uploadBox.addEventListener("dragleave", () => { uploadBox.classList.remove("dragover"); });
    uploadBox.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadBox.classList.remove("dragover");
      const file = e.dataTransfer?.files?.[0] || null;
      if (file) processImage(file);
    });
  }

  if (uploadInput) {
    uploadInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) processImage(file);
    });
  }

  const summaryEl = document.getElementById("candidateSummary");
  if (summaryEl) populateCandidateSummary();

  const logoEl = document.getElementById("companyLogo");
  if (logoEl) {
    if (logoEl.complete && logoEl.naturalWidth) {
      logoToBase64(logoEl);
    } else {
      logoEl.onload = () => logoToBase64(logoEl);
    }
  }
});

/* ---------- Image handling ---------- */
function processImage(file) {
  if (!file || !file.type.match(/image\/(jpeg|jpg|png)/)) {
    alert("Only .jpg, .jpeg, .png files are allowed!");
    return;
  }
  const reader = new FileReader();
  reader.onload = function (ev) {
    uploadedImageBase64 = ev.target.result;
    const uploadBox = document.getElementById("uploadBox");
    if (uploadBox) uploadBox.innerHTML = `<img src="${uploadedImageBase64}" alt="Uploaded Image">`;
  };
  reader.readAsDataURL(file);
}

/* ---------- Index page functions ---------- */
function triggerFileInput() {
  const el = document.getElementById("imageUpload");
  if (el) el.click();
}

function saveCandidateInfo() {
  const name = (document.getElementById("candidateName") || {}).value || "";
  const university = (document.getElementById("university") || {}).value || "";
  const cgpa = (document.getElementById("cgpa") || {}).value || "";
  const domain = (document.getElementById("domain") || {}).value || "";
  const experience = (document.getElementById("experience") || {}).value || "";

  if (!name.trim() || !university.trim() || !cgpa || !domain || !experience) {
    alert("Please fill in all candidate details!");
    return;
  }

  const candidate = {
    name: name.trim(),
    university: university.trim(),
    cgpa: cgpa,
    domain,
    experience,
    image: uploadedImageBase64 || ""
  };

  localStorage.setItem("currentCandidate", JSON.stringify(candidate));
  window.location.href = "evaluation.html";
}

/* ---------- Evaluation functions ---------- */
function goBack() { window.location.href = "candidate.html"; }

function populateCandidateSummary() {
  const stored = JSON.parse(localStorage.getItem("currentCandidate") || "null");
  const el = document.getElementById("candidateSummary");
  if (!el) return;
  if (!stored) {
    el.innerHTML = `<div class="box">No candidate loaded. Please go back and fill candidate info.</div>`;
    return;
  }

  const imgHtml = stored.image ? `<div class="img-box-small"><img src="${stored.image}" alt="photo"></div>` : `<div class="img-box-small no-image">No Image</div>`;

  el.innerHTML = `
    <div class="grid-summary">
      <div class="box">
        <p><strong>Name:</strong> ${escapeHtml(stored.name)}</p>
        <p><strong>University:</strong> ${escapeHtml(stored.university)}</p>
        <p><strong>CGPA:</strong> ${escapeHtml(stored.cgpa)}</p>
        <p><strong>Domain:</strong> ${escapeHtml(stored.domain)}</p>
        <p><strong>Experience:</strong> ${escapeHtml(stored.experience)}</p>
      </div>
      <div class="box">${imgHtml}</div>
    </div>
  `;

  // If candidate already has criteria (e.g., editing), prefill them on evaluation form
  // (this assumes evaluation.html contains the criteria inputs with class .criteriaScore in same order)
  const existingCriteria = stored.criteria;
  if (existingCriteria && existingCriteria.length) {
    // try to map existing scores into inputs if present
    setTimeout(() => {
      const scoreInputs = Array.from(document.querySelectorAll(".criteriaScore"));
      const nameInputs = Array.from(document.querySelectorAll(".criteriaName"));
      existingCriteria.forEach((cr, idx) => {
        if (scoreInputs[idx]) scoreInputs[idx].value = cr.score;
        if (nameInputs[idx] && cr.name) nameInputs[idx].value = cr.name;
      });
      // also set testScore if present
      const testEl = document.getElementById("testScore");
      if (testEl && stored.testScore !== undefined) testEl.value = stored.testScore;
    }, 50);
  }
}

// Function to add optional evaluation criteria
function addOptionalCriteria() {
  const container = document.getElementById("criteriaContainer");
  if (!container) return;

  const div = document.createElement("div");
  div.classList.add("panelMember");

  const label = document.createElement("input");
  label.type = "text";
  label.placeholder = "Custom Criteria Name";
  label.classList.add("criteriaName");

  const input = document.createElement("input");
  input.type = "number";
  input.placeholder = "0-10";
  input.classList.add("criteriaScore");
  input.min = 0;
  input.max = 10;

  div.appendChild(label);
  div.appendChild(input);
  container.appendChild(div);
}

/* Optional: small input enforcement so user can't type wildly out of range (but we validate on Save) */
document.addEventListener("input", function (e) {
  if (e.target && e.target.classList && e.target.classList.contains("criteriaScore")) {
    // keep input numeric-ish but do not auto-correct; main validation happens on Save
    // optional: clamp while typing to avoid extreme values
    const v = e.target.value;
    if (v === "") return;
    const n = Number(v);
    if (!isFinite(n)) {
      e.target.value = "";
      return;
    }
    // don't auto force, but limit to a reasonable length
    if (n > 9999) e.target.value = n.toString().slice(0, 4);
  }
});




/* ---------- Relative Grading Helper ---------- */
function recalculateRelativeGrades(candidates) {
  // Group by domain
  const domainGroups = {};
  candidates.forEach(c => {
    if (!domainGroups[c.domain]) domainGroups[c.domain] = [];
    domainGroups[c.domain].push(c);
  });

  for (const domain in domainGroups) {
    const list = domainGroups[domain];
    list.sort((a, b) => b.finalScore - a.finalScore); // descending
    const total = list.length;
    const topN = Math.ceil(total / 3);
    const secondN = Math.ceil(total / 3);

    list.forEach((c, idx) => {
      if (idx < topN) c.recommended = "Recommended";
      else if (idx < topN + secondN) c.recommended = "Stand By";
      else c.recommended = "Not Recommended";
    });
  }
}


/* ---------- Save Candidate (updated + fixed) ---------- */
async function saveCandidate() {
  const stored = JSON.parse(localStorage.getItem("currentCandidate") || "null");
  if (!stored) {
    alert("No candidate loaded. Please fill candidate info first.");
    return;
  }

  const testScoreRaw = parseFloat((document.getElementById("testScore") || {}).value) || 0;
  if (testScoreRaw < 0 || testScoreRaw > 50) {
    alert("Test score must be between 0 and 50.");
    return;
  }

  const fixedLabels = [
    "Intellect",
    "Quest for Knowledge",
    "Professional Knowledge",
    "Experience",
    "Appearance & Bearing",
    "Communication Skills",
    "Suitability for Lab"
  ];

  const panelBoxes = Array.from(document.querySelectorAll("#criteriaContainer .panelMember"));
  if (panelBoxes.length === 0) {
    alert("Please enter interview scores.");
    return;
  }

  const criteria = [];
  for (let i = 0; i < panelBoxes.length; i++) {
    const box = panelBoxes[i];
    const scoreInput = box.querySelector(".criteriaScore");
    const nameInput = box.querySelector(".criteriaName");
    const sc = scoreInput ? parseFloat(scoreInput.value) : NaN;
    if (isNaN(sc) || sc < 0 || sc > 10) {
      alert("Enter correct scores (0–10) for all interview criteria.");
      return;
    }
    let name = (nameInput && nameInput.value && nameInput.value.trim()) ? nameInput.value.trim() : (fixedLabels[i] || `Criteria ${i + 1}`);
    criteria.push({ name, score: sc });
  }

  const totalInterviewRaw = criteria.reduce((acc, c) => acc + c.score, 0);
  const noOfSections = criteria.length;

  const avgInterviewRaw = totalInterviewRaw / noOfSections; // average raw per section
  const avgInterviewWeighted = (totalInterviewRaw / (noOfSections * 10)) * 70; // weighted interview out of 70

  const weightedTest = (testScoreRaw / 50) * 30; // weighted test out of 30
  const finalScore = weightedTest + avgInterviewWeighted; // total out of 100

  const candidate = {
    ...stored,
    testScore: testScoreRaw,
    weightedTest: +weightedTest.toFixed(2),
    criteria,
    avgInterviewRaw: +avgInterviewRaw.toFixed(2),
    avgInterviewWeighted: +avgInterviewWeighted.toFixed(2),
    finalScore: +finalScore.toFixed(2),
    image: stored.image || null,   // ✅ fix: preserve uploaded image
    recommended: ""                // will be updated by relative grading
  };

  // save to backend if exists
  try {
    const res = await fetch(`${BACKEND_URL}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candidate)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) candidate.id = data.id;
    }
  } catch (err) {
    console.warn("Could not reach backend to save candidate:", err);
  }

  if (!candidate.id) candidate.id = `local-${Date.now()}`;

  candidateList = JSON.parse(localStorage.getItem("candidateList")) || [];
  candidateList.push(candidate);

  // ✅ fix: apply relative grading per domain
  recalculateRelativeGrades(candidateList);

  localStorage.setItem("candidateList", JSON.stringify(candidateList));

  const resultEl = document.getElementById("result");
  if (resultEl)
    resultEl.innerHTML = `<b>Saved:</b> ${escapeHtml(candidate.name)} — Final Score: ${candidate.finalScore.toFixed(2)} (${candidate.recommended})`;

  try { renderCandidateList(candidateList); } catch (e) { console.warn("Render list error:", e); }
}


/* ---------- List / Delete ---------- */
function showList() {
  candidateList = JSON.parse(localStorage.getItem("candidateList")) || [];
  renderCandidateList(candidateList);

  const downloadButtons = document.getElementById("downloadButtons");
  if (downloadButtons) downloadButtons.style.display = candidateList.length ? "flex" : "none";
}

/* ---------- Render List (updated for relative grades) ---------- */
function renderCandidateList(candidates) {
  const container = document.getElementById("candidateTableContainer");
  if (!container) return;

  if (!candidates || candidates.length === 0) {
    container.innerHTML = "<p>No candidates saved yet.</p>";
    return;
  }

  let html = `
    <table class="cand-table">
      <thead>
        <tr>
          <th><input type="checkbox" id="selectAll"> Select All</th>
          <th>Photo</th>
          <th>Name</th>
          <th>University</th>
          <th>CGPA</th>
          <th>Domain</th>
          <th>Experience</th>
          <th>Test</th>
          <th>Weighted Test</th>
          <th>Interview Avg</th>
          <th>Weighted Avg</th>
          <th>Final Score</th>
          <th>Recommended</th>
        </tr>
      </thead>
      <tbody>
  `;

  candidates.forEach(c => {
    const imgHtml = c.image ? `<img src="${c.image}" alt="photo" class="tbl-photo">` : `<div class="no-photo">—</div>`;
    html += `
      <tr>
        <td><input type="checkbox" class="candidate-select" data-id="${escapeHtml(String(c.id))}"></td>
        <td>${imgHtml}</td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.university)}</td>
        <td>${escapeHtml(c.cgpa)}</td>
        <td>${escapeHtml(c.domain)}</td>
        <td>${escapeHtml(c.experience)}</td>
        <td>${c.testScore ?? ""}</td>
        <td>${(c.weightedTest !== undefined) ? Number(c.weightedTest).toFixed(2) : ""}</td>
        <td>${(c.avgInterviewRaw !== undefined) ? Number(c.avgInterviewRaw).toFixed(2) : ""}</td>
        <td>${(c.avgInterviewWeighted !== undefined) ? Number(c.avgInterviewWeighted).toFixed(2) : ""}</td>
        <td>${(c.finalScore !== undefined) ? Number(c.finalScore).toFixed(2) : ""}</td>
        <td>${escapeHtml(c.recommended)}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  const selectAllBox = document.getElementById("selectAll");
  if (selectAllBox) {
    selectAllBox.addEventListener("change", (e) => {
      document.querySelectorAll(".candidate-select").forEach(cb => { cb.checked = e.target.checked; });
    });
  }
}


async function deleteSelectedCandidates() {
  const selectedBoxes = Array.from(document.querySelectorAll(".candidate-select:checked"));
  if (!selectedBoxes.length) { alert("Please select at least one candidate to delete."); return; }
  if (!confirm(`Delete ${selectedBoxes.length} selected candidate(s)?`)) return;

  const selectedIds = selectedBoxes.map(cb => String(cb.dataset.id));
  const serverIds = selectedIds.filter(id => /^\d+$/.test(id)).map(id => Number(id));

  let current = JSON.parse(localStorage.getItem("candidateList")) || [];
  const selectedSet = new Set(selectedIds.map(String));
  current = current.filter(c => !selectedSet.has(String(c.id)));
  localStorage.setItem("candidateList", JSON.stringify(current));
  candidateList = current;
  renderCandidateList(candidateList);

  if (serverIds.length > 0) {
    try {
      await fetch(`${BACKEND_URL}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: serverIds })
      });
    } catch (err) {
      console.error("Backend delete failed:", err);
      alert("Deleted locally. Could not delete on backend: " + (err.message || err));
    }
  }
}

/* ---------- Excel Download (domain modal + download all) ---------- */
function openExcelModal() {
  const modal = document.getElementById("excelModal");
  if (modal) modal.style.display = "block";
}

function closeExcelModal() {
  const modal = document.getElementById("excelModal");
  if (modal) modal.style.display = "none";
}

/* ---------- Download Selected Domain Excel ---------- */
function downloadSelectedDomainExcel() {
  const domainEl = document.getElementById("domainSelect");
  const domain = domainEl ? domainEl.value : "";
  if (!domain) {
    alert("Please select a domain first!");
    return;
  }

  const candidateListLocal = JSON.parse(localStorage.getItem("candidateList")) || [];
  let domainCandidates = candidateListLocal.filter(c => c.domain === domain);

  if (!domainCandidates.length) {
    alert(`No candidates found for ${domain}`);
    return;
  }

  const today = new Date().toLocaleDateString();

  // --- Sort by Remarks order ---
  const order = { "Recommended": 1, "Stand By": 2, "Not Recommended": 3 };
  domainCandidates.sort((a, b) => (order[a.recommended] || 4) - (order[b.recommended] || 4));

  // --- Fixed headers ---
  const fixedCriteriaHeaders = [
    "Intellect",
    "Quest for Knowledge",
    "Professional Knowledge",
    "Experience",
    "Appearance & Bearing",
    "Communication Skills",
    "Suitability for Lab"
  ];

  // --- Candidate rows ---
  const candidateRows = domainCandidates.map((c, idx) => {
    const row = [
      idx + 1, // S No
      c.name,  // Name
    ];

    // Criteria scores
    fixedCriteriaHeaders.forEach(header => {
      const found = (c.criteria || []).find(x => x.name === header);
      row.push(found ? found.score : "");
    });

    row.push((c.criteria || []).reduce((sum, x) => sum + (x.score || 0), 0)); // Total
    row.push(c.avgInterviewWeighted?.toFixed(2) ?? ""); // Weighted Interview
    row.push(c.testScore ?? ""); // Test Score
    row.push(c.weightedTest?.toFixed(2) ?? ""); // Weighted Test
    row.push(c.finalScore?.toFixed(2) ?? ""); // Total Avg Score
    row.push(c.recommended ?? ""); // Remarks

    return row;
  });

  // --- Header rows ---
  const headerRows = [
    ["ACAST Avionics Division"], 
    [`Domain: ${domain}`, `Date: ${today}`],
    [
      "S No",
      "Name (As per CNIC)",
      ...fixedCriteriaHeaders,
      "Total",
      "Weighted Interview Score",
      "Test Score",
      "Weighted Test Score",
      "Total Avg Score",
      "Remarks"
    ]
  ];

  // --- Create worksheet ---
  const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...candidateRows]);

  // --- Merge cells ---
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }, // ACAST heading
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },  // Domain
    { s: { r: 1, c: 9 }, e: { r: 1, c: 15 } }, // Date
    { s: { r: 2, c: 14 }, e: { r: 2, c: 15 } } // Remarks spans 2 columns
  ];

  // --- Fix cell values ---
  ws["A1"] = { v: "ACAST Avionics Division", t: "s", s: {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { fgColor: { rgb: "D9E1F2" } }
  }};
  ws["A2"] = { v: "Domain: " + domain, t: "s", s: {
    font: { bold: true },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { fgColor: { rgb: "FCE4D6" } }
  }};
  ws["J2"] = { v: "Date: " + today, t: "s", s: {
    font: { bold: true },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { fgColor: { rgb: "FCE4D6" } }
  }};

  // --- Highlight heading row (row 3) ---
  const headerRange = XLSX.utils.decode_range("A3:P3");
  for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
    const cellRef = XLSX.utils.encode_cell({ r: 2, c: C });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "BDD7EE" } }
      };
    }
  }

  // --- Align serial numbers left ---
  candidateRows.forEach((row, rIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: rIdx + 3, c: 0 });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        alignment: { horizontal: "left", vertical: "center" }
      };
    }
  });

  // --- Workbook ---
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, domain.replace(/\s+/g, "_"));
  XLSX.writeFile(wb, `${sanitizeFilename(domain)}_Candidates.xlsx`);

  closeExcelModal();
}


/* ---------- Download All Excel ---------- */
function downloadAllExcel() {
  const candidateListLocal = JSON.parse(localStorage.getItem("candidateList")) || [];
  if (!candidateListLocal.length) {
    alert("No candidates to export");
    return;
  }

  const today = new Date().toLocaleDateString();

  const fixedCriteriaHeaders = [
    "Intellect",
    "Quest for Knowledge",
    "Professional Knowledge",
    "Experience",
    "Appearance & Bearing",
    "Communication Skills",
    "Suitability for Lab"
  ];

  const candidateRows = candidateListLocal.map((c, idx) => {
    return {
      "S No": idx + 1,
      "Name ": c.name,
      "Domain": c.domain,
      ...Object.fromEntries(
        fixedCriteriaHeaders.map(header => [
          header,
          (c.criteria || []).find(x => x.name === header)?.score || ""
        ])
      ),
      "Total": (c.criteria || []).reduce((sum, x) => sum + (x.score || 0), 0),
      "Weighted Interview Score": c.avgInterviewWeighted?.toFixed(2) ?? "",
      "Test Score": c.testScore ?? "",
      "Weighted Test Score": c.weightedTest?.toFixed(2) ?? "",
      "Total Avg Score": c.finalScore?.toFixed(2) ?? "",
      "Remarks": c.recommended ?? ""
    };
  });

  const headerRows = [
    ["ACAST Avionics Division"],
    [`Date: ${today}`],
    []
  ];

  const ws = XLSX.utils.json_to_sheet(candidateRows, { origin: "A4" });
  XLSX.utils.sheet_add_aoa(ws, headerRows, { origin: "A1" });

  // Merge ACAST across columns
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }
  ];

  // Style ACAST + Date rows
  ws["A1"].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" }, fill: { fgColor: { rgb: "D9E1F2" } } };
  ws["A2"].s = { font: { bold: true }, alignment: { horizontal: "center" }, fill: { fgColor: { rgb: "FCE4D6" } } };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "All_Candidates");
  XLSX.writeFile(wb, `All_Candidates_${today.replace(/\//g, "-")}.xlsx`);
}


/* ---------- Company logo -> base64 for watermark ---------- */
function logoToBase64(img) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.globalAlpha = 0.08;
    ctx.drawImage(img, 0, 0);
    companyLogoBase64 = canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("logoToBase64 failed:", err);
    companyLogoBase64 = "";
  }
}

/* ---------- PDF download (professional layout) ---------- */
function downloadAllPDF() {
  candidateList = JSON.parse(localStorage.getItem("candidateList")) || [];
  if (!candidateList.length) { alert("No candidates to export"); return; }
  if (!window.jspdf || !window.jspdf.jsPDF) { alert("jsPDF not loaded"); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

 if (companyLogoBase64) {
  try {
    doc.setGState(new doc.GState({ opacity: 0.1 })); // faded watermark
    const imgType = companyLogoBase64.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(companyLogoBase64, imgType, pageW/2 - 150, pageH/2 - 150, 300, 300);
    doc.setGState(new doc.GState({ opacity: 1 })); // reset back
  } catch (e) {
    console.warn("Watermark addImage failed", e);
  }
}


    // header
    doc.setFillColor(22, 43, 77);
    doc.rect(0, 0, pageW, 70, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("ACAST Avionics Division", pageW / 2, 44, { align: "center" });
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);

    // candidate info + photo box
    let y = 90;
    const infoW = pageW - margin * 2 - 160 - 12;
    doc.rect(margin, y, infoW, 140);
    doc.setFontSize(12);
    let tY = y + 20;
    doc.text(`Name: ${c.name}`, margin + 8, tY); tY += 18;
    doc.text(`University: ${c.university}`, margin + 8, tY); tY += 18;
    doc.text(`CGPA: ${c.cgpa}`, margin + 8, tY); tY += 18;
    doc.text(`Domain: ${c.domain}`, margin + 8, tY); tY += 18;
    doc.text(`Experience: ${c.experience}`, margin + 8, tY);

    const photoX = margin + infoW + 12;
    const photoY = y;
    const photoW = 160;
    const photoH = 140;
    doc.rect(photoX, photoY, photoW, photoH);
    if (c.image) {
      try {
        const imgType = c.image.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(c.image, imgType, photoX + 4, photoY + 4, photoW - 8, photoH - 8);
      } catch (e) {
        console.warn("Candidate photo addImage failed:", e);
      }
    } else {
      doc.setFontSize(10);
      doc.text("No Image", photoX + photoW / 2, photoY + photoH / 2, { align: "center" });
    }

    // Test scores box
    y += 160;
    const boxW = pageW - margin * 2;
    doc.rect(margin, y, boxW, 60);
    doc.setFontSize(12);
    const testAvgPct = ((c.testScore / 50) * 100).toFixed(2) + "%";
    doc.text(`Test Score: ${c.testScore} (${testAvgPct})`, margin + 8, y + 20);
    doc.text(`Weighted: ${c.weightedTest?.toFixed(2) ?? "0"}`, margin + 8, y + 38);

    // Evaluation Scores table
    y += 80;
    const criteriaList = c.criteria || [];
    const rowHeight = 16;
    const headerHeight = 40;
    const footerHeight = 30;
    const interviewBoxH = headerHeight + footerHeight + criteriaList.length * rowHeight;

    doc.rect(margin, y, boxW, interviewBoxH);
    doc.setFontSize(12);
    doc.text("Evaluation Scores:", margin + 8, y + 18);

    const col1X = margin + 12;
    const col2X = margin + 350;
    let rowY = y + 36;

    doc.setFont("helvetica", "bold");
    doc.text("Criteria", col1X, rowY);
    doc.text("Score", col2X, rowY);
    doc.setFont("helvetica", "normal");

    rowY += 10;
    doc.line(margin + 8, rowY, margin + boxW - 8, rowY);
    rowY += 10;

    // Print criteria rows
    (criteriaList || []).forEach((cr) => {
      doc.text(escapeHtml(cr.name), col1X, rowY);
      doc.text(String(cr.score), col2X, rowY);
      rowY += rowHeight;
    });

    // Averages row
    rowY += 6;
    const interviewAvgPct = ((c.avgInterviewRaw / 10) * 100).toFixed(2) + "%";
    doc.text(`Average (raw): ${(c.avgInterviewRaw !== undefined) ? Number(c.avgInterviewRaw).toFixed(2) : "0"} (${interviewAvgPct})`, col1X, rowY);
    doc.text(`Weighted: ${(c.avgInterviewWeighted !== undefined) ? Number(c.avgInterviewWeighted).toFixed(2) : "0"}`, col2X, rowY);

    // Move y below interview box
    y = y + interviewBoxH + 20;

    // Final score box
    doc.rect(margin, y, boxW, 60);
    doc.setFontSize(13);
    doc.text(`Final Score: ${(c.finalScore !== undefined) ? Number(c.finalScore).toFixed(2) : "0"} (${escapeHtml(c.recommended || "")})`, margin + 8, y + 34);

    if (idx < candidateList.length - 1) doc.addPage();
  };

  doc.save("All_Candidates_Evaluation.pdf");

/* ---------- Helpers ---------- */
function sanitizeFilename(s) {
  return String(s).replace(/[^\w\-_. ]+/g, "").replace(/\s+/g, "_");
}
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, function (s) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[s];
  });
}

/* ---------- Backwards compatibility & globals ---------- */
window.addPanelMember = addOptionalCriteria;
window.triggerFileInput = triggerFileInput;
window.saveCandidateInfo = saveCandidateInfo;
window.goBack = goBack;
window.addOptionalCriteria = addOptionalCriteria;
window.saveCandidate = saveCandidate;
window.showList = showList;
window.deleteSelectedCandidates = deleteSelectedCandidates;
window.openExcelModal = openExcelModal;
window.closeExcelModal = closeExcelModal;
window.downloadAllExcel = downloadAllExcel;
window.downloadAllPDF = downloadAllPDF;
window.downloadExcelForDomain = downloadSelectedDomainExcel;
