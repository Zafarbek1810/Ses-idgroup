import * as React from "react";
import { CustomPdfTable } from "@/components/CustomPdfTable";
import {
  A4_HEIGHT,
  A4_PREVIEW_HEIGHT,
  A4_PREVIEW_SCALE,
  A4_PREVIEW_WIDTH,
  A4_WIDTH,
  formatDynamicDisplay,
  normalizeTableData,
  type PdfDynamicContext,
  type PdfElement,
  type PdfTemplate,
} from "@/lib/pdfTemplate";

export const ResultPdfCanvas = React.forwardRef<
  HTMLDivElement,
  {
    template: PdfTemplate;
    fillValues: Record<string, string>;
    dynamicCtx: PdfDynamicContext | null;
    onFillChange?: (key: string, value: string) => void;
    readOnly?: boolean;
  }
>(function ResultPdfCanvas(
  { template, fillValues, dynamicCtx, onFillChange, readOnly = false },
  ref,
) {
  const tableEl = template.elements.find(el => el.type === "table");
  const grid = normalizeTableData(tableEl?.tableData);
  const pageHeight = Math.max(
    A4_PREVIEW_HEIGHT,
    A4_PREVIEW_HEIGHT + Math.max(0, grid.bodyRows - 8) * 18 + grid.headerRows * 8,
  );
  const a4PreviewHeight = Math.round((A4_PREVIEW_WIDTH * A4_HEIGHT) / A4_WIDTH);
  const height =
    readOnly && pageHeight <= a4PreviewHeight * 1.05 ? a4PreviewHeight : pageHeight;

  return (
    <div
      ref={ref}
      className={`relative bg-white shrink-0 ${readOnly ? "" : "shadow-xl border border-slate-200"}`}
      style={{ width: A4_PREVIEW_WIDTH, height }}
    >
      {template.elements.map(el => (
        <FillableElement
          key={el.id}
          element={el}
          fillValues={fillValues}
          dynamicCtx={dynamicCtx}
          onFillChange={onFillChange}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
});

function FillableElement({
  element,
  fillValues,
  dynamicCtx,
  onFillChange,
  readOnly = false,
}: {
  element: PdfElement;
  fillValues: Record<string, string>;
  dynamicCtx: PdfDynamicContext | null;
  onFillChange?: (key: string, value: string) => void;
  readOnly?: boolean;
}) {
  const isTable = element.type === "table";

  const textStyle: React.CSSProperties = {
    fontWeight: element.style.bold ? 700 : 400,
    fontStyle: element.style.italic ? "italic" : "normal",
    textDecoration: element.style.underline ? "underline" : "none",
    fontSize: (element.style.fontSize ?? 12) * A4_PREVIEW_SCALE,
    textAlign: element.style.align || "left",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#0f172a",
    lineHeight: 1.35,
    pointerEvents: "none",
    userSelect: "none",
  };

  return (
    <div
      className="absolute"
      style={{
        left: element.x * A4_PREVIEW_SCALE,
        top: element.y * A4_PREVIEW_SCALE,
        width: element.width * A4_PREVIEW_SCALE,
        minHeight: element.height * A4_PREVIEW_SCALE,
        zIndex: isTable ? 20 : 1,
        pointerEvents: isTable && !readOnly ? "auto" : "none",
      }}
    >
      {element.type === "image" ? (
        element.imageSrc ? (
          <img
            src={element.imageSrc}
            alt=""
            className="w-full h-full object-contain pointer-events-none select-none"
            draggable={false}
            crossOrigin="anonymous"
          />
        ) : null
      ) : element.type === "table" ? (
        <div className="w-full bg-white" style={{ pointerEvents: readOnly ? "none" : "auto" }}>
          <CustomPdfTable
            data={normalizeTableData(element.tableData)}
            fillValues={fillValues}
            onFillChange={onFillChange}
            readOnly={readOnly}
            compact
          />
        </div>
      ) : element.type === "dynamic" ? (
        <div style={textStyle}>{formatDynamicDisplay(element, dynamicCtx, false).full}</div>
      ) : (
        <div style={textStyle}>{element.content || " "}</div>
      )}
    </div>
  );
}
