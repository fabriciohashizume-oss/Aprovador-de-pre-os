/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BaseSkuRow {
  rotuloLinha: string; // Rótulos de Linha (reference month/date)
  codEstado: string; // Cod_Estado
  codDescGrupo: string; // Cod Desc Grupo
  codProduto: string; // cod_produto
  kardexUnit: number; // Soma de Kardex unit
  dedutores: number; // Soma de Dedutores sem VPX/VPC/cust. fin. stk (as ratio, e.g. 0.25 for 25%)
}

export interface BaseClienteRow {
  rotuloLinha: string; // Rótulos de Linha (reference month/date)
  razaoSocial: string; // Razao_Social
  codEstado: string; // Cod_Estado
  codDescGrupo: string; // Cod Desc Grupo
  codProduto: string; // cod_produto
  kardexUnit: number; // Soma de Kardex unit
  dedutores: number; // Soma de Dedutores sem VPX/VPC/cust. fin. stk (as ratio)
}

export type MarginStatus = 'TARGET' | 'REGULAR' | 'RUIM' | 'NEGATIVA';

export interface MarginEvaluationResult {
  reference: string; // E.g., "Último Mês (05/2026)" or "Média Últimos 3 Meses"
  source: 'CLIENTE' | 'SKU_ESTADO' | 'NENHUM';
  sourceDetails: string; // Client name or State name
  kardex: number;
  dedutores: number; // portion (e.g. 0.22)
  vpcVpx: number; // portion (e.g. 0.05)
  totalDeductionsRate: number; // dedutores + vpcVpx
  precoNF: number;
  mgcRs: number;
  mgcPercentage: number;
  status: MarginStatus;
}

export interface SimulationResult {
  ultimoMes: MarginEvaluationResult | null;
  tresMeses: MarginEvaluationResult | null;
  targetPrice12: number | null; // Preço para atingir 12%
  targetPrice6: number | null;  // Preço para atingir 6%
}

export interface DecisionRecord {
  id: string;
  timestamp: string;
  razaoSocial: string;
  codEstado: string;
  codProduto: string;
  descGrupo: string;
  precoNF: number;
  vpcVpx: number;
  marginRefUsed: 'ultimo' | 'tresMeses';
  kardex: number;
  dedutores: number;
  mgcRs: number;
  mgcPercentage: number;
  status: MarginStatus;
  decision: 'APROVADO' | 'REJEITADO' | 'HELD_FOR_REVIEW';
  comment?: string;
}
