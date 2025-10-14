document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("candidatesBody");
  const downloadExcelBtn = document.getElementById("downloadExcelBtn");
  const downloadAllPdfBtn = document.getElementById("downloadAllPdfBtn");
  const downloadRecommendedBtn = document.getElementById("downloadRecommendedBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // ✅ Load candidates from localStorage
  function loadCandidates() {
    const candidates = JSON.parse(localStorage.getItem("candidateList") || "[]");
    tableBody.innerHTML = "";

    if (!candidates.length) {
      tableBody.innerHTML = `<tr><td colspan="10">⚠ No candidates found.</td></tr>`;
      return;
    }

    const domainOrder = [
      "EMBEDDED", "FPGA", "RTOS", "RF", "WIRELESS",
      "SYSTEM ENGG", "COMM AND DSP", "CORRELATION AND FUSION"
    ];
    const recommendationOrder = { "Recommended": 1, "Stand by": 2, "Not recommended": 3, "": 4 };

    candidates.sort((a, b) => {
      const domainDiff = domainOrder.indexOf(a.domain) - domainOrder.indexOf(b.domain);
      if (domainDiff !== 0) return domainDiff;
      const recA = recommendationOrder[a.recommended] || 99;
      const recB = recommendationOrder[b.recommended] || 99;
      if (recA !== recB) return recA - recB;
      const scoreA = Number(a.finalScore ?? a.testScore ?? 0);
      const scoreB = Number(b.finalScore ?? b.testScore ?? 0);
      return scoreB - scoreA;
    });

    candidates.forEach((c, idx) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td>${c.image ? `<img src="${c.image}" style="width:40px;height:40px;border-radius:50%;">` : "No Image"}</td>
        <td>${c.name || ""}</td>
        <td>${c.domain || ""}</td>
        <td>${c.email || ""}</td>
        <td>${c.contact || ""}</td>
        <td>${c.experience || ""}</td>
        <td>${c.cgpa || ""}</td>
        <td>${c.finalScore ?? ""}</td>
        <td>${c.recommended ?? ""}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  // ✅ Convert image URL to base64
  function getBase64Image(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(this, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null); // fallback if image fails
    });
  }

  // ✅ Build candidate PDF card
  async function addCandidateCard(doc, c, startY) {
    const boxWidth = 180;
    let y = startY;

    // Candidate personal info
    doc.setFontSize(12);
    doc.text(`Name: ${c.name || ""}`, 20, y);
    doc.text(`Domain: ${c.domain || ""}`, 20, y + 8);
    doc.text(`Education: ${(c.discipline || "")} ${(c.university || "")}`, 20, y + 16);
    doc.text(`Experience: ${c.experience || ""}`, 20, y + 24);
    doc.text(`Email: ${c.email || ""}`, 20, y + 32);
    doc.text(`Contact: ${c.contact || ""}`, 20, y + 40);

    // Candidate Image
    if (c.image) {
      const base64Img = await getBase64Image(c.image);
      if (base64Img) {
        doc.addImage(base64Img, "PNG", 150, y - 5, 30, 30);
      }
    }

    y += 50;

    // Previous Score box
    doc.rect(15, y, boxWidth, 15);
    doc.text(`Previous Score: ${c.finalScore ?? ""}`, 20, y + 10);
    y += 25;

    // Interview Scores box
    doc.rect(15, y, boxWidth, 35);
    doc.text("Interview Scores:", 20, y + 10);
    doc.text("1. Intellect (10):", 30, y + 18);
    doc.text("2. Prof Knowledge (10):", 30, y + 26);
    doc.text("3. Comm Skills (10):", 30, y + 34);
    doc.text("4. Total (30):", 30, y + 42);
    y += 45;

    // Remarks box
    doc.rect(15, y, boxWidth, 20);
    doc.text("Remarks: ______________________", 20, y + 12);

    return y + 30;
  }


  function downloadSelectedDomainExcel(domain) {
  const candidates = JSON.parse(localStorage.getItem("candidateList") || "[]")
    .filter(c => String(c.domain || "").trim() === String(domain || "").trim());

  if (!candidates.length) { 
    alert("No candidates for " + domain); 
    return; 
  }

  const today = new Date().toLocaleDateString();

  // ✅ Sort by Final Score descending (fallback to testScore if finalScore missing)
  candidates.sort((a, b) => {
    const scoreA = (a.finalScore !== undefined ? Number(a.finalScore) : Number(a.testScore) || 0);
    const scoreB = (b.finalScore !== undefined ? Number(b.finalScore) : Number(b.testScore) || 0);
    return scoreB - scoreA; // descending
  });

  // ✅ Prepare rows
  const rows = candidates.map((c, idx) => ({
    "S No": idx + 1,
    "Name": c.name || "",
    "Education": c.discipline || c.university || "",
    "Experience": c.experience || "",
    "Contact Number": c.contactNumber || c.contact || "",
    "Email": c.email || "",
    "Suitability for Lab": c.suitability || "",
    "Avg Test Score": c.testScore ?? "",
    "Avg Interview Score (raw)": c.avgInterviewRaw ?? "",
    "Final Score": c.finalScore ?? "",
    "Remarks": c.recommended ?? ""
  }));

  // ✅ Header rows
  const headerRows = [
    ["ACAST Avionics Division"],
    [`Domain: ${domain}`, `Date: ${today}`],
    []
  ];

  // ✅ Create worksheet and add rows
  const ws = XLSX.utils.json_to_sheet(rows, { origin: "A4" });
  XLSX.utils.sheet_add_aoa(ws, headerRows, { origin: "A1" });

  // ✅ Merge A1 across all columns
  const colCount = Object.keys(rows[0]).length;
  ws["!merges"] = ws["!merges"] || [];
  ws["!merges"].push({ s:{r:0,c:0}, e:{r:0,c:colCount-1} });

  // ✅ Create workbook and save
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, domain.replace(/\s+/g,"_"));
  XLSX.writeFile(wb, `${domain}_Candidates_${(new Date()).toISOString().slice(0,10)}.xlsx`);
}
  // ✅ Download All Candidates PDF

 function downloadAllCandidatesPDF() {
  let all = JSON.parse(localStorage.getItem("candidateList") || "[]");
  if (!all.length) { alert("No candidates to export"); return; }
  if (!window.jspdf || !window.jspdf.jsPDF) { alert("jsPDF not loaded"); return; }

  // ✅ Sort candidates in descending order by finalScore
  all.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  all.forEach((c, idx) => {
    // ... keep everything exactly the same as your original code ...
    // ✅ watermark
    if (window.companyLogoBase64) {
      try {
        doc.setGState(new doc.GState({ opacity: 0.1 }));
        const imgType = companyLogoBase64.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(companyLogoBase64, imgType, pageW/2 - 150, pageH/2 - 150, 300, 300);
        doc.setGState(new doc.GState({ opacity: 1 }));
      } catch (e) {
        console.warn("Watermark addImage failed", e);
      }
    }

    // ✅ header
    doc.setFillColor(22, 43, 77);
    doc.rect(0, 0, pageW, 70, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("ACAST Avionics Division", pageW / 2, 44, { align: "center" });
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);

    // ✅ candidate info box
    let y = 90;
    const infoW = pageW - margin * 2 - 160 - 12;
    doc.rect(margin, y, infoW, 160);
    doc.setFontSize(12);
    let tY = y + 20;
    doc.text(`Name: ${c.name || ""}`, margin + 8, tY); tY += 16;
    doc.text(`University: ${c.university || ""}`, margin + 8, tY); tY += 16;
    doc.text(`Education: ${c.discipline || ""}`, margin + 8, tY); tY += 16;
    doc.text(`CGPA: ${c.cgpa || ""}`, margin + 8, tY); tY += 16;
    doc.text(`Domain: ${c.domain || ""}`, margin + 8, tY); tY += 16;
    doc.text(`Experience: ${c.experience || ""}`, margin + 8, tY); tY += 16;
    doc.text(`Contact: ${c.contactNumber || c.contact || ""}`, margin + 8, tY); tY += 16;
    doc.text(`Email: ${c.email || ""}`, margin + 8, tY);

    // ✅ photo box
    const photoX = margin + infoW + 12;
    const photoY = y;
    const photoW = 160;
    const photoH = 160;
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

    // ✅ test scores box
    y += 180;
    const boxW = pageW - margin * 2;
    doc.rect(margin, y, boxW, 60);
    doc.setFontSize(12);
    const testAvgPct = c.testScore ? ((c.testScore / 50) * 100).toFixed(2) + "%" : "N/A";
    doc.text(`Test Score: ${c.testScore ?? ""} (${testAvgPct})`, margin + 8, y + 20);
    doc.text(`Weighted Test: ${c.weightedTest?.toFixed(2) ?? "0"}`, margin + 8, y + 38);

    // ✅ interview scores box
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

    (criteriaList || []).forEach((cr) => {
      doc.text(String(cr.name || ""), col1X, rowY);
      doc.text(String(cr.score ?? ""), col2X, rowY);
      rowY += rowHeight;
    });

    rowY += 6;
    const interviewAvgPct = c.avgInterviewRaw ? ((c.avgInterviewRaw / 10) * 100).toFixed(2) + "%" : "N/A";
    doc.text(
      `Average (raw): ${c.avgInterviewRaw !== undefined ? Number(c.avgInterviewRaw).toFixed(2) : "0"} (${interviewAvgPct})`,
      col1X,
      rowY
    );
    doc.text(
      `Weighted Interview: ${c.avgInterviewWeighted !== undefined ? Number(c.avgInterviewWeighted).toFixed(2) : "0"}`,
      col2X,
      rowY
    );

    // ✅ final score box
    y = y + interviewBoxH + 20;
    doc.rect(margin, y, boxW, 70);
    doc.setFontSize(13);
    doc.text(
      `Final Score: ${c.finalScore !== undefined ? Number(c.finalScore).toFixed(2) : "0"} (${c.recommended || ""})`,
      margin + 8,
      y + 24
    );
    doc.text(`Suitability for Lab: ${c.suitability || ""}`, margin + 8, y + 44);

    if (idx < all.length - 1) doc.addPage();
  });

  doc.save(`All_Candidates_${(new Date()).toISOString().slice(0,10)}.pdf`);
}


  // ✅ Download Recommended Candidates by Domain
 function downloadRecommendedCandidatesPDF(domain) {
  const all = JSON.parse(localStorage.getItem("candidateList") || "[]");

  // ✅ Filter only recommended candidates of this domain
  let recommended = all.filter(c =>
    c.domain?.toLowerCase().trim() === domain.toLowerCase().trim() &&
    c.recommended?.toLowerCase().trim() === "recommended"
  );

  if (!recommended.length) {
    alert("⚠ No recommended candidates for " + domain);
    return;
  }

  // ✅ Sort by score (descending)
  recommended.sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));

  // ✅ Create PDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  recommended.forEach((c, idx) => {
    // Header
    doc.setFillColor(22, 43, 77);
    doc.rect(0, 0, pageW, 70, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("ACAST Avionics Division", pageW / 2, 44, { align: "center" });

    // Domain text (below heading)
    doc.setFontSize(14);
    doc.text(`Domain: ${domain}`, pageW / 2, 65, { align: "center" });

    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);

    // Candidate info + photo box
    let y = 90;
    const infoW = pageW - margin * 2 - 160 - 12;
    doc.rect(margin, y, infoW, 160);
    doc.setFontSize(12);
    let tY = y + 20;
    doc.text(`Name: ${c.name || ""}`, margin + 8, tY); tY += 16;
    doc.text(`University: ${c.university || ""}`, margin + 8, tY); tY += 16;
    doc.text(`Education: ${c.discipline || ""}`, margin + 8, tY); tY += 16;
    doc.text(`CGPA: ${c.cgpa || ""}`, margin + 8, tY); tY += 16;
    doc.text(`Domain: ${c.domain || ""}`, margin + 8, tY); tY += 16;
    doc.text(`Experience: ${c.experience || ""}`, margin + 8, tY); tY += 16;
    doc.text(`Contact: ${c.contact || ""}`, margin + 8, tY); tY += 16;
    doc.text(`Email: ${c.email || ""}`, margin + 8, tY);

    const photoX = margin + infoW + 12;
    const photoY = y;
    const photoW = 160;
    const photoH = 160;
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

    // Previous Score box
    y += 180;
    const boxW = pageW - margin * 2;
    doc.rect(margin, y, boxW, 50);
    doc.setFontSize(12);
    doc.text(`Previous Score: ${(c.finalScore !== undefined) ? Number(c.finalScore).toFixed(2) : "0"}`, margin + 8, y + 20);

    // Interview Scores box (dynamic height)
    y += 70;
    const criteria = [
      { name: "Intellect (10)", score: "" },
      { name: "Prof Knowledge (10)", score: "" },
      { name: "Comm Skills (10)", score: "" },
      { name: "Total (30)", score: "" }
    ];

    const rowHeight = 18;
    const headerHeight = 30;
    const interviewBoxH = headerHeight + criteria.length * rowHeight + 20;

    doc.rect(margin, y, boxW, interviewBoxH);
    doc.setFontSize(12);
    doc.text("Interview Scores:", margin + 8, y + 20);

    const col1X = margin + 12;
    const col2X = margin + 350;
    let rowY = y + 40;

    doc.setFont("helvetica", "bold");
    doc.text("Criteria", col1X, rowY);
    doc.text("Score", col2X, rowY);
    doc.setFont("helvetica", "normal");

    rowY += 10;
    doc.line(margin + 8, rowY, margin + boxW - 8, rowY);
    rowY += 16;

    criteria.forEach(cr => {
      doc.text(cr.name, col1X, rowY);
      doc.text(cr.score, col2X, rowY);
      rowY += rowHeight;
    });

    // Remarks box
    y += interviewBoxH + 20;
    doc.rect(margin, y, boxW, 70);
    doc.setFontSize(13);
    doc.text(`Remarks: `, margin + 8, y + 30);

    if (idx < recommended.length - 1) doc.addPage();
  });

  doc.save(`${domain}_Recommended_Candidates_${(new Date()).toISOString().slice(0, 10)}.pdf`);
}


  // ✅ Event Bindings
  downloadExcelBtn.addEventListener("click", () => {
    const domain = document.getElementById("excelDomain").value;
    if (domain) downloadSelectedDomainExcel(domain);
    else alert("⚠ Please select a domain.");
  });

  // ✅ Fix: point to correct function name
downloadRecommendedBtn.addEventListener("click", () => {
  const domain = document.getElementById("recommendedDomain").value;
  if (domain) {
    downloadRecommendedCandidatesPDF(domain);
  } else {
    alert("⚠ Please select a domain.");
  }
});

  downloadAllPdfBtn.addEventListener("click", downloadAllCandidatesPDF);

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("loggedIn");
    window.location.href = "index.html";
  });

  loadCandidates();
});
