import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  assertFiscalCancellationWindow,
  FISCAL_CANCELLATION_LIMIT_HOURS,
} from "../_shared/fiscal-cancellation.ts";

const now = new Date("2026-08-28T12:00:00.000Z");

Deno.test("modelo 65 permite cancelamento até 30 minutos", () => {
  assertEquals(FISCAL_CANCELLATION_LIMIT_HOURS["65"], 0.5);
  assertFiscalCancellationWindow({
    model_code: "65",
    data_hora_autorizacao: "2026-08-28T11:30:00.000Z",
  }, now);
});

Deno.test("modelo 65 bloqueia cancelamento após 30 minutos", () => {
  assertThrows(
    () =>
      assertFiscalCancellationWindow({
        model_code: "65",
        data_hora_autorizacao: "2026-08-28T11:29:59.999Z",
      }, now),
    Error,
    "prazo de 30 minutos",
  );
});

Deno.test("modelo 55 permite cancelamento até 720 horas", () => {
  assertEquals(FISCAL_CANCELLATION_LIMIT_HOURS["55"], 720);
  assertFiscalCancellationWindow({
    model_code: "55",
    data_hora_autorizacao: "2026-07-29T12:00:00.000Z",
  }, now);
});

Deno.test("modelo 55 bloqueia cancelamento após 720 horas", () => {
  assertThrows(
    () =>
      assertFiscalCancellationWindow({
        model_code: "55",
        data_hora_autorizacao: "2026-07-29T11:59:59.999Z",
      }, now),
    Error,
    "prazo de 720 horas",
  );
});
