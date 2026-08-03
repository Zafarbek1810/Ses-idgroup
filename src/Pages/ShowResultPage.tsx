import * as React from "react";
import { useEffect, useState } from "react";
import { AlertCircle, FileText, Loader2 } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  getOnlineStorageByIdTwo,
  resolveOnlineStorageAnalysisId,
} from "@/api/onlineStorage";
import {
  getOrderByIdTwo,
  resolveOrderItemAnalysisId,
  type Order,
  type OrderItem,
  type OrderPatient,
} from "@/api/order";
import {
  decodeGridFillFromItems,
  getResultByIdTwo,
  getResultItems,
  type ResultRecord,
} from "@/api/result";
import { ResultPdfCanvas } from "@/components/ResultPdfCanvas";
import {
  A4_PREVIEW_HEIGHT,
  A4_PREVIEW_WIDTH,
  bodyCellKey,
  headerCellKey,
  isDynamicCell,
  normalizeTableData,
  onlineStorageRecordToPdfTemplate,
  type PdfDynamicContext,
  type PdfTemplate,
} from "@/lib/pdfTemplate";
import type { ShowResultParams } from "@/lib/showResultLink";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      template: PdfTemplate;
      fillValues: Record<string, string>;
      dynamicCtx: PdfDynamicContext;
      analysisName: string;
    };

function patientName(patient: OrderPatient | null | undefined, fallback?: string | null) {
  if (!patient) return fallback?.trim() || "—";
  return `${patient.last_name ?? ""} ${patient.first_name ?? ""}`.trim() || "—";
}

function buildAddress(order: Order, patient: OrderPatient | null | undefined) {
  const parts = [
    patient?.village || order.village,
    patient?.street || order.street,
    order.district?.name,
  ].filter(Boolean);
  return parts.join(", ") || "—";
}

function seedFillFromTemplate(
  tpl: PdfTemplate | null,
  saved: Record<string, string> = {},
): Record<string, string> {
  const table = tpl?.elements.find(el => el.type === "table");
  const grid = normalizeTableData(table?.tableData);
  const next: Record<string, string> = {};

  for (let r = 0; r < grid.headerRows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.headerCells[r][c];
      if (cell.covered || !isDynamicCell(cell)) continue;
      const key = headerCellKey(r, c);
      next[key] = Object.prototype.hasOwnProperty.call(saved, key)
        ? String(saved[key] ?? "")
        : "";
    }
  }

  for (let r = 0; r < grid.bodyRows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.bodyCells[r][c];
      if (cell.covered || !isDynamicCell(cell)) continue;
      const key = bodyCellKey(r, c);
      next[key] = Object.prototype.hasOwnProperty.call(saved, key)
        ? String(saved[key] ?? "")
        : "";
    }
  }
  return next;
}

function labDoctorFromResult(result: ResultRecord | null): string | null {
  const d = result?.lab_director;
  if (!d) return null;
  const initial = (d.username || "").charAt(0).toUpperCase();
  const surname = d.surname || "";
  const name = `${initial}.${surname}`.replace(/^\./, "").replace(/\.$/, "");
  return name || null;
}

export function ShowResultPage({ params }: { params: ShowResultParams }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });
      try {
        const [order, storage, result] = await Promise.all([
          getOrderByIdTwo(params.orderId),
          getOnlineStorageByIdTwo(params.storageId),
          getResultByIdTwo(params.orderId).catch(() => null),
        ]);

        const tpl = onlineStorageRecordToPdfTemplate(storage);
        if (!tpl) {
          throw new Error("PDF shablon formati noto'g'ri");
        }

        const storageAnalysisId = resolveOnlineStorageAnalysisId(storage);
        const analysisId = params.analysisId;

        if (
          storageAnalysisId != null &&
          storageAnalysisId > 0 &&
          storageAnalysisId !== analysisId
        ) {
          throw new Error(
            `Shablon boshqa analizga bog'langan (analiz #${storageAnalysisId})`,
          );
        }

        const items = (order.items ?? []) as OrderItem[];
        const orderItem =
          items.find(it => resolveOrderItemAnalysisId(it) === analysisId) ?? null;

        const analysisName =
          orderItem?.analysis?.name ||
          storage.analysis?.name ||
          tpl.analysisName ||
          `Analiz #${analysisId}`;

        const laboratoryName = orderItem?.laboratory?.name ?? null;

        const bound: PdfTemplate = {
          ...structuredClone(tpl),
          analysisId,
          analysisName,
        };
        const table = bound.elements.find(el => el.type === "table");
        if (table) {
          table.analysisId = analysisId;
          table.analysisName = analysisName;
        }

        const savedItems = getResultItems(result);
        const saved = decodeGridFillFromItems(savedItems, analysisId);
        const fillValues = seedFillFromTemplate(bound, saved);

        const dynamicCtx: PdfDynamicContext = {
          orderId: order.id,
          orderCreatedAt: orderItem?.createdAt || order.createdAt || null,
          resultDate: result?.updatedAt || result?.createdAt || new Date().toISOString(),
          patientFullName: patientName(order.patient, order.name),
          patientAddress: buildAddress(order, order.patient),
          patientBirthDay: order.patient?.birth_day ?? null,
          patientPhone: order.patient?.phone ?? null,
          labDoctor: labDoctorFromResult(result),
          analysisName,
          laboratoryName,
        };

        if (!cancelled) {
          setState({
            status: "ready",
            template: bound,
            fillValues,
            dynamicCtx,
            analysisName,
          });
        }
      } catch (err) {
        if (cancelled) return;
        let message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Natijani yuklab bo'lmadi";
        if (err instanceof ApiError && err.status === 404) {
          message =
            "Public API topilmadi (getbytwo). Backendda /order|result|onlinestorage/getbytwo/:id routelarini yoqing.";
        }
        setState({ status: "error", message });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.orderId, params.analysisId, params.storageId]);

  const grid =
    state.status === "ready"
      ? normalizeTableData(
          state.template.elements.find(el => el.type === "table")?.tableData,
        )
      : null;
  const previewPageHeight = grid
    ? Math.max(
        A4_PREVIEW_HEIGHT,
        A4_PREVIEW_HEIGHT + Math.max(0, grid.bodyRows - 8) * 18 + grid.headerRows * 8,
      )
    : A4_PREVIEW_HEIGHT;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">SES — tahlil natijasi</p>
            <p className="text-xs text-slate-500">
              Buyurtma #{params.orderId}
              {state.status === "ready" ? ` · ${state.analysisName}` : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {state.status === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            <p className="text-sm">PDF natija yuklanmoqda...</p>
          </div>
        )}

        {state.status === "error" && (
          <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
            <p className="text-sm font-medium text-slate-900">Natijani ochib bo&apos;lmadi</p>
            <p className="mt-2 text-sm text-slate-600">{state.message}</p>
          </div>
        )}

        {state.status === "ready" && (
          <div className="flex justify-center overflow-auto pb-8">
            <div
              className="shadow-lg ring-1 ring-slate-200"
              style={{ width: A4_PREVIEW_WIDTH, minHeight: previewPageHeight }}
            >
              <ResultPdfCanvas
                template={state.template}
                fillValues={state.fillValues}
                dynamicCtx={state.dynamicCtx}
                readOnly
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
