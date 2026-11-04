import path from 'node:path';
import { createRequire } from 'node:module';
import { config } from '../config.js';
const require = createRequire(import.meta.url);
let pdfjsPromise = null;
function loadPdfJs() {
    if (pdfjsPromise)
        return pdfjsPromise;
    pdfjsPromise = (async () => {
        const root = path.dirname(require.resolve('pdfjs-dist/package.json'));
        // legacy 构建在 Node 下使用 fake worker，无需浏览器 Worker
        const mod = (await import('pdfjs-dist/legacy/build/pdf.mjs'));
        return { mod, root };
    })();
    return pdfjsPromise;
}
export function looksLikePdf(buf) {
    return buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-';
}
/**
 * 提取 PDF 文本（最多 config.uploads.maxPdfPages 页）。
 * 扫描件/纯图片 PDF 会返回空文本，由调用方提示用户手填。
 */
export async function extractPdfText(buf) {
    const { mod, root } = await loadPdfJs();
    const loadingTask = mod.getDocument({
        data: new Uint8Array(buf),
        cMapUrl: path.join(root, 'cmaps') + path.sep,
        cMapPacked: true,
        standardFontDataUrl: path.join(root, 'standard_fonts') + path.sep,
        useSystemFonts: true,
        isEvalSupported: false,
        disableFontFace: true,
        verbosity: 0,
    });
    const doc = await loadingTask.promise;
    try {
        const pages = Math.min(doc.numPages, config.uploads.maxPdfPages);
        const chunks = [];
        for (let i = 1; i <= pages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            let pageText = '';
            for (const item of content.items) {
                const str = typeof item.str === 'string' ? item.str : '';
                if (!str)
                    continue;
                pageText += str;
                pageText += item.hasEOL === true ? '\n' : ' ';
            }
            chunks.push(pageText.trim());
            page.cleanup();
        }
        const text = chunks
            .join('\n\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        return { text: text.slice(0, 200_000), pages: doc.numPages };
    }
    finally {
        await loadingTask.destroy().catch(() => undefined);
    }
}
