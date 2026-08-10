import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import * as XLSX from "npm:xlsx@0.18.5";
import { classify, parseCsv, parseSource } from "./index.ts";

Deno.test("interpreta CSV brasileiro com campos entre aspas", () => {
  const rows = parseCsv(
    'numero_venda;produto;quantidade;valor_unitario;total\n100;"Pizza, grande";2;25,00;50,00\n',
  );
  assertEquals(rows.length, 1);
  assertEquals(rows[0].produto, "Pizza, grande");
  assertEquals(rows[0].valor_unitario, "25,00");
  assertEquals(classify("vendas", rows), "sales");
});

Deno.test("identifica listas de produtos, clientes e vendas em JSON", () => {
  const source = new TextEncoder().encode(JSON.stringify({
    produtos: [{ id: 1, nome: "Açaí", preco: 15, categoria: "Açaí" }],
    clientes: [{ id: 2, nome: "Maria", telefone: "85999999999" }],
    vendas: [{ id: 3, data: "01/08/2026", total: 15 }],
  }));
  const datasets = parseSource(source, "backup.json", "application/json");
  assertEquals(datasets.map((dataset) => dataset.detectedType), [
    "products",
    "customers",
    "orders",
  ]);
});

Deno.test("lê múltiplas planilhas de um Excel", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([{
      codigo: 1,
      nome: "Hambúrguer",
      preco: 20,
      categoria: "Lanches",
    }]),
    "Produtos",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([{
      pedido_id: 10,
      produto: "Hambúrguer",
      quantidade: 1,
      valor_unitario: 20,
    }]),
    "Itens Venda",
  );
  const bytes = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as Uint8Array;
  const datasets = parseSource(bytes, "sistema.xlsx");
  assertEquals(datasets.length, 2);
  assertEquals(datasets[0].detectedType, "products");
  assertEquals(datasets[1].detectedType, "order_items");
});
