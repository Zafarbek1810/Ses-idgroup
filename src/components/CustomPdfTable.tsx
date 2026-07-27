import {
  bodyCellKey,
  isInSelection,
  normalizeTableData,
  type PdfTableCell,
  type PdfTableData,
  type PdfTableSelection,
} from "@/lib/pdfTemplate";

export type PatternRow = {
  id: number | string;
  name: string;
};

export type CustomPdfTableProps = {
  data: PdfTableData;
  /** Body rows — analysis patterns */
  patterns?: PatternRow[];
  /** Template editor: edit header only */
  editableHeader?: boolean;
  selection?: PdfTableSelection | null;
  onSelectHeaderCell?: (row: number, col: number, shiftKey: boolean) => void;
  onChangeHeaderCell?: (row: number, col: number, patch: Partial<PdfTableCell>) => void;
  /** Results: fill body input columns (col >= 1) */
  fillValues?: Record<string, string>;
  onFillChange?: (patternId: number | string, col: number, value: string) => void;
  compact?: boolean;
  className?: string;
};

/** @deprecated use bodyCellKey */
export function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

/** Header designed by user + body from analysis patterns */
export function CustomPdfTable({
  data,
  patterns = [],
  editableHeader = false,
  selection = null,
  onSelectHeaderCell,
  onChangeHeaderCell,
  fillValues,
  onFillChange,
  compact = false,
  className = "",
}: CustomPdfTableProps) {
  const grid = normalizeTableData(data);
  const fs = compact ? "text-[8px]" : "text-[11px]";
  const pad = compact ? "px-1 py-0.5" : "px-2 py-1.5";
  const inputCls = compact
    ? "w-full min-h-[14px] text-center bg-transparent border-0 outline-none text-[8px] text-black"
    : "w-full min-h-[22px] text-center bg-transparent border-0 outline-none text-[11px] text-black";

  const filling = fillValues != null;

  return (
    <table
      className={`w-full border-collapse border border-black bg-white text-black ${fs} ${className}`}
      style={{ tableLayout: "fixed" }}
    >
      <thead>
        {grid.headerCells.map((row, ri) => (
          <tr key={`h-${ri}`}>
            {row.map((cell, ci) => {
              if (cell.covered) return null;
              const cs = cell.colSpan ?? 1;
              const rs = cell.rowSpan ?? 1;

              if (editableHeader) {
                const highlighted = selection
                  ? (() => {
                      for (let r = ri; r < ri + rs; r++) {
                        for (let c = ci; c < ci + cs; c++) {
                          if (isInSelection(r, c, selection)) return true;
                        }
                      }
                      return false;
                    })()
                  : false;

                return (
                  <th
                    key={ci}
                    colSpan={cs}
                    rowSpan={rs}
                    className={`border border-black ${pad} align-middle p-0 font-semibold relative ${
                      highlighted
                        ? "outline outline-2 outline-offset-[-2px] outline-sky-500 bg-sky-100"
                        : "bg-slate-50"
                    }`}
                    onMouseDown={e => {
                      // Select on mousedown (before focus) so Shift+click works
                      e.stopPropagation();
                      onSelectHeaderCell?.(ri, ci, e.shiftKey);
                    }}
                    onPointerDown={e => e.stopPropagation()}
                  >
                    <input
                      value={cell.text}
                      onChange={e => onChangeHeaderCell?.(ri, ci, { text: e.target.value })}
                      onMouseDown={e => {
                        e.stopPropagation();
                        onSelectHeaderCell?.(ri, ci, e.shiftKey);
                      }}
                      onClick={e => e.stopPropagation()}
                      className={`${inputCls} font-semibold text-center px-1`}
                      placeholder="Sarlavha..."
                    />
                  </th>
                );
              }

              return (
                <th
                  key={ci}
                  colSpan={cs}
                  rowSpan={rs}
                  className={`border border-black ${pad} font-semibold text-center align-middle bg-slate-50`}
                >
                  {cell.text || "\u00a0"}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {patterns.length === 0 ? (
          <tr>
            <td
              colSpan={grid.cols}
              className={`border border-black ${pad} text-center text-slate-400`}
            >
              Analiz tanlang — patternlar shu yerda chiqadi
            </td>
          </tr>
        ) : (
          patterns.map(p => (
            <tr key={p.id}>
              {Array.from({ length: grid.cols }, (_, ci) => {
                if (ci === 0) {
                  return (
                    <td
                      key={ci}
                      className={`border border-black ${pad} text-left align-middle`}
                    >
                      {p.name}
                    </td>
                  );
                }

                if (filling) {
                  const key = bodyCellKey(p.id, ci);
                  return (
                    <td
                      key={ci}
                      className={`border border-black ${pad} text-center align-middle p-0`}
                    >
                      <input
                        value={fillValues?.[key] ?? ""}
                        onChange={e => onFillChange?.(p.id, ci, e.target.value)}
                        className={inputCls}
                        onClick={e => e.stopPropagation()}
                        onPointerDown={e => e.stopPropagation()}
                      />
                    </td>
                  );
                }

                return (
                  <td
                    key={ci}
                    className={`border border-black ${pad} text-center align-middle bg-amber-50/40`}
                  >
                    <span className="inline-block w-full min-h-[1em] text-slate-300 text-[9px]">
                      input
                    </span>
                  </td>
                );
              })}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
