import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCmvReport, calculateWeightedAverageCost } from './cmvCalculations.ts';

test('calcula custo medio ponderado preservando o valor do estoque anterior', () => {
  const result = calculateWeightedAverageCost({
    currentStock: 10,
    currentUnitCost: 2,
    purchasedUnits: 10,
    purchaseTotal: 40,
  });
  assert.equal(result, 3);
});

test('calcula CMV, margem e curva ABC usando vendas reais', () => {
  const report = buildCmvReport(
    [
      { id: 'a', name: 'Produto A', price: 20 },
      { id: 'b', name: 'Produto B', price: 10 },
    ],
    [
      { product_id: 'a', quantity: 2, waste_percentage: 10, ingredient: { cost_price: 1 } },
      { product_id: 'b', quantity: 1, ingredient: { cost_price: 2 } },
    ],
    [{
      id: 'order-1',
      total: 50,
      delivery_fee: 0,
      items: [
        { product_id: 'a', product_name: 'Produto A', quantity: 2, subtotal: 40 },
        { product_id: 'b', product_name: 'Produto B', quantity: 1, subtotal: 10 },
      ],
    }],
  );

  assert.equal(report.netRevenue, 50);
  assert.equal(Number(report.realizedCmv.toFixed(2)), 6.4);
  assert.equal(report.products[0].abcClass, 'A');
  assert.equal(report.products[1].abcClass, 'B');
});

test('prefere fotografia histórica do custo quando ela existe', () => {
  const report = buildCmvReport(
    [{ id: 'a', name: 'Produto A', price: 20 }],
    [{ product_id: 'a', quantity: 1, ingredient: { cost_price: 99 } }],
    [{
      id: 'order-1',
      total: 20,
      items: [],
      cmv_snapshot: {
        version: 1,
        items: [{ product_id: 'a', product_name: 'Produto A', quantity: 1, net_revenue: 20, total_cost: 4, has_recipe: true }],
      },
    }],
  );
  assert.equal(report.realizedCmv, 4);
  assert.equal(report.ordersWithSnapshot, 1);
});

test('reconhece custo direto e unidade em kg para produto vendido por peso', () => {
  const report = buildCmvReport(
    [{
      id: 'acai',
      name: 'Açaí peso',
      price: 44.9,
      weight_based: true,
      costing_mode: 'manual',
      manual_unit_cost: 15.9,
    }],
    [],
    [{
      id: 'order-weight',
      total: 22.45,
      items: [{ product_id: 'acai', product_name: 'Açaí peso', quantity: 0.5, subtotal: 22.45 }],
    }],
  );

  assert.equal(report.products[0].saleUnit, 'kg');
  assert.equal(report.products[0].costSource, 'manual');
  assert.equal(report.products[0].realizedCost, 7.95);
});
