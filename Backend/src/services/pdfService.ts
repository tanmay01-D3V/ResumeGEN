import PDFDocument from 'pdfkit';
import type { ResumeDocument } from '../../../shared/schemas';
import { ensureHttpUrl, isSafeHttpUrl, sanitizeFilename, sanitizeSingleLine, sanitizeText } from '../utils/sanitize';

interface Layout {
  fontRegular: string;
  fontBold: string;
  fontItalic: string;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  bodySize: number;
  bodyLineGap: number;
  sectionGap: number;
  itemGap: number;
  nameSize: number;
  centeredHeader: boolean;
}

function layoutFor(document: ResumeDocument): Layout {
  const onePage = document.layout === 'one_page';
  const base: Layout = {
    fontRegular: 'Helvetica',
    fontBold: 'Helvetica-Bold',
    fontItalic: 'Helvetica-Oblique',
    marginX: onePage ? 42 : 52,
    marginTop: onePage ? 36 : 48,
    marginBottom: 58,
    bodySize: onePage ? 9.6 : 10.2,
    bodyLineGap: onePage ? 1.2 : 1.8,
    sectionGap: onePage ? 8 : 11,
    itemGap: onePage ? 5 : 7,
    nameSize: onePage ? 20 : 23,
    centeredHeader: false,
  };
  if (document.template === 'classic') {
    return {
      ...base,
      fontRegular: 'Times-Roman',
      fontBold: 'Times-Bold',
      fontItalic: 'Times-Italic',
      centeredHeader: true,
      bodySize: onePage ? 9.8 : 10.4,
    };
  }
  if (document.template === 'compact') {
    return {
      ...base,
      bodySize: 9.6,
      bodyLineGap: 1,
      sectionGap: 7,
      itemGap: 4,
      nameSize: 20,
    };
  }
  return base;
}

export function resumeFilename(document: ResumeDocument, jobTitle = ''): string {
  const name = sanitizeFilename(document.name || 'Candidate');
  const role = sanitizeFilename(sanitizeSingleLine(jobTitle || document.headline || 'Resume', 80));
  return `${name}_${role || 'Resume'}_Resume.pdf`.replace(/_+/g, '_');
}

/**
 * Server-side, ATS-friendly PDF renderer. The PDF is rendered from the exact
 * saved document snapshot (or the server-generated preview document), so the
 * download cannot contain content that was not approved in the preview.
 */
export function renderResumePdf(document: ResumeDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const layout = layoutFor(document);
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: layout.marginTop,
          bottom: layout.marginBottom,
          left: layout.marginX,
          right: layout.marginX,
        },
        bufferPages: true,
        info: {
          Title: `${sanitizeSingleLine(document.name, 120)} — Resume`,
          Author: sanitizeSingleLine(document.name, 120),
          Subject: sanitizeSingleLine(document.headline || 'Resume', 200),
          Creator: 'ResumeGEN',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const contentWidth = doc.page.width - layout.marginX * 2;
      const bottom = doc.page.height - layout.marginBottom;
      let y = layout.marginTop;

      const ensureSpace = (needed: number) => {
        if (y + needed <= bottom) return;
        doc.addPage();
        y = layout.marginTop;
      };

      const paragraph = (
        text: string,
        options: {
          font?: string;
          size?: number;
          color?: string;
          indent?: number;
          gapAfter?: number;
          lineGap?: number;
          align?: 'left' | 'center';
        } = {},
      ) => {
        const font = options.font ?? layout.fontRegular;
        const size = options.size ?? layout.bodySize;
        const indent = options.indent ?? 0;
        const width = contentWidth - indent;
        doc.font(font).fontSize(size).fillColor(options.color ?? '#111827');
        const height = doc.heightOfString(text, {
          width,
          lineGap: options.lineGap ?? layout.bodyLineGap,
        });
        ensureSpace(height + 2);
        doc.text(text, layout.marginX + indent, y, {
          width,
          lineGap: options.lineGap ?? layout.bodyLineGap,
          align: options.align ?? 'left',
        });
        y += height + (options.gapAfter ?? 0);
      };

      // Header -----------------------------------------------------------
      doc.font(layout.fontBold).fontSize(layout.nameSize).fillColor('#0f172a');
      const name = sanitizeSingleLine(document.name || 'Candidate', 120);
      const nameHeight = doc.heightOfString(name, { width: contentWidth });
      ensureSpace(nameHeight + 8);
      doc.text(name, layout.marginX, y, {
        width: contentWidth,
        align: layout.centeredHeader ? 'center' : 'left',
      });
      y += nameHeight + 3;

      if (document.headline) {
        paragraph(sanitizeSingleLine(document.headline, 200), {
          size: layout.bodySize + 1,
          color: '#334155',
          align: layout.centeredHeader ? 'center' : 'left',
          gapAfter: 2,
        });
      }

      const contactParts = [
        sanitizeSingleLine(document.contact.location, 120),
        sanitizeSingleLine(document.contact.phone, 40),
        sanitizeSingleLine(document.contact.email, 160),
      ].filter(Boolean);
      if (contactParts.length > 0) {
        paragraph(contactParts.join('  •  '), {
          size: layout.bodySize - 0.5,
          color: '#334155',
          align: layout.centeredHeader ? 'center' : 'left',
          gapAfter: 1,
        });
      }

      const validLinks = document.contact.links.filter(
        (link) => link.url && isSafeHttpUrl(link.url) && link.label,
      );
      if (validLinks.length > 0) {
        ensureSpace(16);
        doc.font(layout.fontRegular).fontSize(layout.bodySize - 1).fillColor('#1d4ed8');
        let linkX = layout.centeredHeader ? 0 : layout.marginX;
        if (layout.centeredHeader) {
          const labels = validLinks.map((link) => sanitizeSingleLine(link.label, 40));
          const combined = labels.join('  •  ');
          const width = doc.widthOfString(combined);
          linkX = (doc.page.width - width) / 2;
          doc.text(combined, linkX, y, { lineBreak: false });
          // Draw transparent clickable rectangles over each label.
          let offset = 0;
          for (let index = 0; index < validLinks.length; index += 1) {
            const link = validLinks[index]!;
            const label = labels[index]!;
            const labelWidth = doc.widthOfString(label);
            doc.link(linkX + offset, y, labelWidth, layout.bodySize + 2, ensureHttpUrl(link.url));
            offset += labelWidth + doc.widthOfString('  •  ');
          }
        } else {
          let offset = 0;
          for (let index = 0; index < validLinks.length; index += 1) {
            const link = validLinks[index]!;
            const label = sanitizeSingleLine(link.label, 40);
            const text = index === 0 ? label : `  •  ${label}`;
            const width = doc.widthOfString(text);
            doc.text(text, linkX + offset, y, { lineBreak: false, underline: true });
            const labelOffset = index === 0 ? 0 : doc.widthOfString('  •  ');
            doc.link(linkX + offset + labelOffset, y, doc.widthOfString(label), layout.bodySize + 2, ensureHttpUrl(link.url));
            offset += width;
          }
        }
        y += layout.bodySize + 4;
      }

      // Divider
      ensureSpace(10);
      doc
        .moveTo(layout.marginX, y + 2)
        .lineTo(doc.page.width - layout.marginX, y + 2)
        .strokeColor('#cbd5e1')
        .lineWidth(0.8)
        .stroke();
      y += 9;

      // Summary ----------------------------------------------------------
      if (document.summary) {
        renderSectionHeading('Professional Summary');
        paragraph(sanitizeText(document.summary, 2000), { gapAfter: layout.sectionGap });
      }

      // Sections ---------------------------------------------------------
      for (const section of document.sections) {
        if (section.key === 'summary') continue;
        const items = section.items.filter(
          (item) => item.heading || item.subheading || item.bullets.length > 0 || item.links.length > 0,
        );
        if (items.length === 0) continue;

        ensureSpace(38);
        renderSectionHeading(sanitizeSingleLine(section.title, 100));
        for (const item of items) {
          const heading = sanitizeSingleLine(item.heading, 300);
          const subheading = sanitizeSingleLine(item.subheading, 300);
          const meta = sanitizeSingleLine(item.meta, 300);
          const detail = [subheading, meta].filter(Boolean).join('  |  ');

          if (heading) {
            doc.font(layout.fontBold).fontSize(layout.bodySize + 0.6).fillColor('#111827');
            const height = doc.heightOfString(heading, { width: contentWidth });
            ensureSpace(height + 4);
            doc.text(heading, layout.marginX, y, { width: contentWidth });
            y += height + 1;
          }
          if (detail) {
            doc.font(layout.fontItalic).fontSize(layout.bodySize - 0.5).fillColor('#475569');
            const height = doc.heightOfString(detail, {
              width: contentWidth,
              lineGap: layout.bodyLineGap,
            });
            ensureSpace(height + 3);
            doc.text(detail, layout.marginX, y, {
              width: contentWidth,
              lineGap: layout.bodyLineGap,
            });
            y += height + 2;
          }

          for (const rawBullet of item.bullets) {
            const bullet = sanitizeText(rawBullet, 800);
            if (!bullet) continue;
            doc.font(layout.fontRegular).fontSize(layout.bodySize).fillColor('#111827');
            const bulletHeight = doc.heightOfString(bullet, {
              width: contentWidth - 12,
              lineGap: layout.bodyLineGap,
            });
            ensureSpace(bulletHeight + 2);
            doc.text('•', layout.marginX, y, { width: 10 });
            doc.text(bullet, layout.marginX + 12, y, {
              width: contentWidth - 12,
              lineGap: layout.bodyLineGap,
            });
            y += bulletHeight + 1.4;
          }

          const links = item.links.filter(
            (link) => link.url && isSafeHttpUrl(link.url) && link.label,
          );
          if (links.length > 0) {
            doc.font(layout.fontRegular).fontSize(layout.bodySize - 1).fillColor('#1d4ed8');
            for (const link of links) {
              const label = sanitizeSingleLine(link.label, 40);
              const url = ensureHttpUrl(link.url);
              const text = `${label}: ${url}`;
              const height = doc.heightOfString(text, { width: contentWidth });
              ensureSpace(height + 2);
              doc.text(text, layout.marginX, y, { width: contentWidth, link: url, underline: true });
              y += height + 1;
            }
          }

          y += layout.itemGap;
        }
        y += layout.sectionGap - layout.itemGap;
      }

      // Footer + page numbers ------------------------------------------
      const range = doc.bufferedPageRange();
      for (let index = 0; index < range.count; index += 1) {
        doc.switchToPage(range.start + index);
        const pageBottom = doc.page.height - 30;
        doc
          .moveTo(layout.marginX, pageBottom - 8)
          .lineTo(doc.page.width - layout.marginX, pageBottom - 8)
          .strokeColor('#e2e8f0')
          .lineWidth(0.6)
          .stroke();
        // The footer is intentionally inside the bottom margin. Temporarily
        // allow drawing there so PDFKit does not append an empty page.
        const previousBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .font(layout.fontRegular)
          .fontSize(7.5)
          .fillColor('#64748b')
          .text(
            `${sanitizeSingleLine(document.name || 'Resume', 80)}  •  Page ${index + 1} of ${range.count}`,
            layout.marginX,
            pageBottom,
            { width: contentWidth, align: 'center', lineBreak: false },
          );
        doc.page.margins.bottom = previousBottomMargin;
      }

      doc.end();

      function renderSectionHeading(title: string) {
        const normalized = title.toUpperCase();
        doc.font(layout.fontBold).fontSize(layout.bodySize).fillColor('#0f172a');
        const height = doc.heightOfString(normalized, {
          width: contentWidth,
          characterSpacing: 0.5,
        });
        ensureSpace(height + 10);
        doc.text(normalized, layout.marginX, y, {
          width: contentWidth,
          characterSpacing: 0.5,
        });
        y += height + 3;
        doc
          .moveTo(layout.marginX, y)
          .lineTo(doc.page.width - layout.marginX, y)
          .strokeColor('#94a3b8')
          .lineWidth(0.7)
          .stroke();
        y += 5;
      }
    } catch (error) {
      reject(error);
    }
  });
}
