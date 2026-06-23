import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface ReportAnalysis {
  condition: string;
  confidence: number;
  probabilities: Record<string, number>;
  imageUrl: string;
  imagePath?: string;
  heatmapUrl?: string;
  region: string;
  season: string;
  skinType?: string;
  regionAnalysis?: Array<{ region: string; condition: string; confidence: number }>;
  recommendations?: {
    remedies?: any[];
    dietPlan?: any;
    lifestyleTips?: string[];
    avoidPractices?: string[];
    routine?: { morning: string[]; night: string[] };
    severityScore?: number;
  };
  createdAt: Date | string;
}

interface ReportUser {
  name: string;
  email: string;
  age?: number;
  gender?: string;
  skinType?: string;
  city?: string;
}

const BRAND_DARK   = '#0d2b1e';
const BRAND_GREEN  = '#166534';
const ACCENT_GREEN = '#16a34a';
const GREY_MID     = '#6b7280';
const TEXT_DARK    = '#111827';

const CONDITION_COLOUR: Record<string, string> = {
  acne: '#dc2626', pigmentation: '#9333ea', tanning: '#d97706', normal: '#16a34a',
};

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

// Draw footer on the CURRENT page — must be called before doc.end() or before addPage()
function drawFooter(doc: any, W: number, M: number, CW: number) {
  const fY = doc.page.height - 30;
  doc.rect(0, fY - 4, W, 34).fill('#f3f4f6');
  doc.fillColor(GREY_MID).font('Helvetica').fontSize(7)
     .text(
       'AyurSkin AI v3.0  |  Informational only — not medical advice.  |  Consult a qualified dermatologist for treatment decisions.',
       M, fY + 3, { align: 'center', width: CW }
     );
}

// Add a new page, draw its header strip, draw its footer, return starting y
function newPage(doc: any, W: number, M: number, CW: number, subtitle = 'AyurSkin AI — Analysis Continued'): number {
  doc.addPage({ margin: 0 });
  doc.rect(0, 0, W, 34).fill(BRAND_DARK);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(10).text(subtitle, M, 11);
  drawFooter(doc, W, M, CW);
  return 48;
}

// Check if content fits; if not, add a new page and return new y
function maybeBreak(doc: any, y: number, needed: number, W: number, M: number, CW: number): number {
  if (y + needed > doc.page.height - 44) return newPage(doc, W, M, CW);
  return y;
}

export async function generatePdfReport(
  analysis: ReportAnalysis,
  user: ReportUser,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: false,     // stream pages immediately — no switchToPage needed
      autoFirstPage: true,
      info: {
        Title:   'AyurSkin AI Dermatology Report',
        Author:  'AyurSkin AI Platform',
        Subject: `Skin analysis for ${user.name}`,
        Creator: 'AyurSkin v3.0',
      },
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);

    const W  = doc.page.width;
    const M  = 50;
    const CW = W - M * 2;

    // ── PAGE 1 ────────────────────────────────────────────────────────────────

    // Header
    doc.rect(0, 0, W, 76).fill(BRAND_DARK);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(20).text('AyurSkin AI', M, 18);
    doc.fillColor('#86efac').font('Helvetica').fontSize(9)
       .text('Dermatology Report  |  Deep Learning + Ayurvedic Intelligence', M, 44);
    doc.fillColor('#6ee7b7').fontSize(7.5)
       .text('CONFIDENTIAL  |  For personal use only  |  Not a substitute for professional medical advice', M, 59);

    let y = 92;

    // Patient details
    doc.rect(M, y, CW, 20).fill('#f0fdf4');
    doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(9).text('PATIENT DETAILS', M + 8, y + 6);
    y += 26;

    const fields: [string, string][] = [
      ['Name',     user.name],
      ['Email',    user.email],
      ['Age',      user.age ? `${user.age} years` : 'Not provided'],
      ['Gender',   user.gender || 'Not provided'],
      ['City',     user.city   || 'Not provided'],
      ['Date',     new Date(analysis.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })],
      ['Region',   analysis.region],
      ['Season',   analysis.season],
    ];
    const colW = CW / 2;
    fields.forEach(([lbl, val], i) => {
      const px = M + (i % 2) * colW;
      const py = y + Math.floor(i / 2) * 16;
      doc.fillColor(GREY_MID).font('Helvetica').fontSize(7.5).text(lbl + ':', px, py, { width: 60 });
      doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(7.5).text(val, px + 62, py, { width: colW - 68 });
    });
    y += Math.ceil(fields.length / 2) * 16 + 12;

    // Skin image
    y = maybeBreak(doc, y, 200, W, M, CW);
    doc.rect(M, y, CW, 20).fill('#f0fdf4');
    doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(9).text('CAPTURED SKIN IMAGE', M + 8, y + 6);
    y += 26;

    const imgPath = analysis.imagePath;
    if (imgPath && fs.existsSync(imgPath)) {
      const imgX = M + (CW - 150) / 2;
      try { doc.image(imgPath, imgX, y, { fit: [150, 150] }); } catch (_) {}
      y += 158;
    } else {
      doc.fillColor(GREY_MID).fontSize(8).text('[Image not available]', M, y, { align: 'center', width: CW });
      y += 16;
    }

    // Diagnosis
    y = maybeBreak(doc, y, 70, W, M, CW);
    doc.rect(M, y, CW, 20).fill('#f0fdf4');
    doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(9).text('PRIMARY DIAGNOSIS', M + 8, y + 6);
    y += 26;

    const cc = CONDITION_COLOUR[analysis.condition] || '#16a34a';
    const [cr, cg, cb] = hexToRgb(cc);
    doc.save();
    doc.rect(M, y, CW, 38).fill(`rgb(${cr},${cg},${cb})`);
    doc.opacity(0.1).rect(M, y, CW, 38).fill(`rgb(${cr},${cg},${cb})`);
    doc.restore();
    doc.rect(M, y, CW, 38).stroke(cc);
    doc.fillColor(cc).font('Helvetica-Bold').fontSize(14)
       .text(analysis.condition.toUpperCase(), M + 10, y + 6);
    doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(8.5)
       .text(
         `Confidence: ${analysis.confidence.toFixed(1)}%   |   Skin Type: ${analysis.skinType || 'Unknown'}   |   Severity: ${analysis.recommendations?.severityScore ?? 0}/100`,
         M + 10, y + 24
       );
    y += 46;

    // Probability bars
    const probs = Object.entries(analysis.probabilities || {});
    if (probs.length > 0) {
      y = maybeBreak(doc, y, probs.length * 15 + 16, W, M, CW);
      doc.fillColor(GREY_MID).font('Helvetica').fontSize(7)
         .text('CONFIDENCE DISTRIBUTION', M, y);
      y += 10;
      probs.forEach(([cls, pct]) => {
        const n    = Number(pct);
        const barW = Math.max(3, (n / 100) * (CW - 84));
        const bc   = CONDITION_COLOUR[cls] || '#94a3b8';
        doc.fillColor(TEXT_DARK).fontSize(7.5)
           .text(cls.charAt(0).toUpperCase() + cls.slice(1), M, y + 1, { width: 80 });
        doc.rect(M + 82, y, barW, 8).fill(bc);
        doc.fillColor(GREY_MID).fontSize(7).text(`${n.toFixed(1)}%`, M + 82 + barW + 3, y + 1);
        y += 14;
      });
      y += 4;
    }

    // Footer page 1
    drawFooter(doc, W, M, CW);

    // ── PAGE 2 ────────────────────────────────────────────────────────────────
    y = newPage(doc, W, M, CW, 'AyurSkin AI — Region Analysis & Recommendations');

    // Region analysis
    const regions = (analysis.regionAnalysis || []).slice(0, 5);
    if (regions.length > 0) {
      doc.rect(M, y, CW, 20).fill('#f0fdf4');
      doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(9)
         .text('REGION-WISE SKIN ANALYSIS', M + 8, y + 6);
      y += 26;

      const rW = Math.floor(CW / regions.length);
      regions.forEach((r, i) => {
        const rx = M + i * rW;
        const rc = CONDITION_COLOUR[r.condition] || '#94a3b8';
        const [rr, rg, rb] = hexToRgb(rc);
        doc.save().rect(rx + 2, y, rW - 4, 48).fill(`rgb(${rr},${rg},${rb})`).opacity(0.1).restore();
        doc.rect(rx + 2, y, rW - 4, 48).stroke(rc);
        doc.fillColor(rc).font('Helvetica-Bold').fontSize(7)
           .text(r.region.replace(/_/g, ' ').toUpperCase(), rx + 4, y + 5, { width: rW - 8, align: 'center' });
        doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(8)
           .text(r.condition.charAt(0).toUpperCase() + r.condition.slice(1), rx + 4, y + 18, { width: rW - 8, align: 'center' });
        doc.fillColor(GREY_MID).font('Helvetica').fontSize(7.5)
           .text(`${Number(r.confidence).toFixed(0)}%`, rx + 4, y + 32, { width: rW - 8, align: 'center' });
      });
      y += 56;
    }

    // Heatmap
    if (analysis.heatmapUrl) {
      const hmPath = path.join(__dirname, '../../', analysis.heatmapUrl.replace(/^\//, ''));
      if (fs.existsSync(hmPath)) {
        y = maybeBreak(doc, y, 210, W, M, CW);
        doc.rect(M, y, CW, 20).fill('#f0fdf4');
        doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(9)
           .text('ANNOTATED REGION HEATMAP', M + 8, y + 6);
        y += 26;
        const hmX = M + (CW - 170) / 2;
        try { doc.image(hmPath, hmX, y, { fit: [170, 170] }); } catch (_) {}
        y += 178;
      }
    }

    // Remedies
    const remedies = (analysis.recommendations?.remedies || []).slice(0, 3);
    if (remedies.length > 0) {
      y = maybeBreak(doc, y, 36, W, M, CW);
      doc.rect(M, y, CW, 20).fill('#f0fdf4');
      doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(9)
         .text('RECOMMENDED AYURVEDIC REMEDIES', M + 8, y + 6);
      y += 26;

      remedies.forEach((rem: any, i: number) => {
        y = maybeBreak(doc, y, 60, W, M, CW);
        doc.fillColor(ACCENT_GREEN).font('Helvetica-Bold').fontSize(9.5)
           .text(`${i + 1}.  ${rem.name || ''}`, M, y);
        y += 13;
        if (rem.ingredients?.length) {
          doc.fillColor(GREY_MID).font('Helvetica').fontSize(8)
             .text(`Ingredients: ${(rem.ingredients as string[]).join(', ')}`, M + 10, y, { width: CW - 10 });
          y += doc.currentLineHeight() + 3;
        }
        if (rem.application) {
          doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(8)
             .text(`Application: ${rem.application}`, M + 10, y, { width: CW - 10 });
          y += doc.currentLineHeight() + 3;
        }
        if (rem.frequency) {
          doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(8)
             .text(`Frequency: ${rem.frequency}`, M + 10, y, { width: CW - 10 });
          y += doc.currentLineHeight() + 3;
        }
        y += 7;
      });
    }

    // AM/PM Routine
    const routine = analysis.recommendations?.routine;
    if (routine) {
      y = maybeBreak(doc, y, 160, W, M, CW);
      doc.rect(M, y, CW, 20).fill('#f0fdf4');
      doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(9)
         .text('PERSONALIZED AM/PM SKINCARE ROUTINE', M + 8, y + 6);
      y += 26;

      const hW = Math.floor((CW - 12) / 2);
      // Headers
      doc.rect(M, y, hW, 15).fill('#fef9c3');
      doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(7.5)
         .text('MORNING ROUTINE', M + 4, y + 4, { width: hW - 8 });
      doc.rect(M + hW + 12, y, hW, 15).fill('#e0e7ff');
      doc.fillColor('#3730a3').font('Helvetica-Bold').fontSize(7.5)
         .text('NIGHT ROUTINE', M + hW + 16, y + 4, { width: hW - 8 });
      y += 19;

      let my = y;
      let ny = y;
      (routine.morning || []).forEach((step: string, i: number) => {
        doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(7.5)
           .text(`${i + 1}. ${step}`, M, my, { width: hW });
        my += doc.currentLineHeight() + 3;
      });
      (routine.night || []).forEach((step: string, i: number) => {
        doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(7.5)
           .text(`${i + 1}. ${step}`, M + hW + 12, ny, { width: hW });
        ny += doc.currentLineHeight() + 3;
      });
      y = Math.max(my, ny) + 10;
    }

    // Lifestyle Tips
    const tips = (analysis.recommendations?.lifestyleTips || []).slice(0, 5);
    if (tips.length > 0) {
      y = maybeBreak(doc, y, 36 + tips.length * 15, W, M, CW);
      doc.rect(M, y, CW, 20).fill('#f0fdf4');
      doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(9)
         .text('LIFESTYLE RECOMMENDATIONS', M + 8, y + 6);
      y += 26;
      tips.forEach((tip: string) => {
        doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(8)
           .text(`+  ${tip}`, M, y, { width: CW });
        y += doc.currentLineHeight() + 4;
      });
      y += 4;
    }

    // Avoid Practices
    const avoid = (analysis.recommendations?.avoidPractices || []).slice(0, 4);
    if (avoid.length > 0) {
      y = maybeBreak(doc, y, 36 + avoid.length * 15, W, M, CW);
      doc.rect(M, y, CW, 20).fill('#fef2f2');
      doc.fillColor('#dc2626').font('Helvetica-Bold').fontSize(9)
         .text('PRACTICES TO AVOID', M + 8, y + 6);
      y += 26;
      avoid.forEach((av: string) => {
        doc.fillColor('#b91c1c').font('Helvetica').fontSize(8)
           .text(`x  ${av}`, M, y, { width: CW });
        y += doc.currentLineHeight() + 4;
      });
    }

    // Footer is already drawn on page 2 by newPage(); doc.end() flushes it
    doc.end();
  });
}
