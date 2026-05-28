/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseClienteRow, BaseSkuRow, MarginEvaluationResult, MarginStatus, SimulationResult } from './types';

// Normalizes a chronological reference string to make it sortable descending
// Handles 'YYYY-MM', 'MM/YYYY', 'YYYY/MM', or text like '2025/nov' or 'nov/2025' or pivot variables like '⊟ 2025/nov'
export function normalizeDateToSortKey(ref: string): number {
  if (!ref) return 0;
  
  // Clean pivot characters if present
  let cleaned = ref.replace(/[⊟⊞\-\+•▪▫]/g, '').trim().toLowerCase();
  
  const PT_MONTHS: Record<string, number> = {
    jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
    jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12
  };
  
  // Clean separators and split
  const parts = cleaned.split(/[-/\s\.]+/).filter(Boolean);
  
  if (parts.length === 2) {
    const part0 = parts[0];
    const part1 = parts[1];
    
    // Check if one of them is month abbreviation and the other is a 4-digit year
    const m0 = PT_MONTHS[part0.slice(0, 3)];
    const m1 = PT_MONTHS[part1.slice(0, 3)];
    
    const y0 = parseInt(part0);
    const y1 = parseInt(part1);
    
    if (m0 && !isNaN(y1) && y1 >= 1000) {
      // e.g. "nov/2025" or "nov-2025"
      return y1 * 100 + m0;
    }
    if (m1 && !isNaN(y0) && y0 >= 1000) {
      // e.g. "2025/nov" or "2025-nov"
      return y0 * 100 + m1;
    }
    
    // Numeric cases with 2 parts:
    // e.g. "2025/11" or "11/2025"
    if (!isNaN(y0) && !isNaN(y1)) {
      if (y0 >= 1000 && y1 <= 12) {
        return y0 * 100 + y1;
      }
      if (y1 >= 1000 && y0 <= 12) {
        return y1 * 100 + y0;
      }
    }
  }
  
  // Try YYYY-MM
  const matchYm = cleaned.match(/^(\d{4})[-/](\d{1,2})$/);
  if (matchYm) {
    const year = parseInt(matchYm[1]);
    const month = parseInt(matchYm[2]);
    return year * 100 + month;
  }
  
  // Try MM/YYYY or MM-YYYY
  const matchMy = cleaned.match(/^(\d{1,2})[-/](\d{4})$/);
  if (matchMy) {
    const month = parseInt(matchMy[1]);
    const year = parseInt(matchMy[2]);
    return year * 100 + month;
  }
  
  // Try extracting any 4-digit number as year and look for Portuguese month keyword
  const yearMatch = cleaned.match(/\b(\d{4})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    for (const [abbr, val] of Object.entries(PT_MONTHS)) {
      if (cleaned.includes(abbr)) {
        return year * 100 + val;
      }
    }
    return year * 100;
  }

  // Fallback to JS Date if possible
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() * 100 + (d.getMonth() + 1);
  }
  
  return 0;
}

// Help sort strings chronologically descending (newest first)
export function sortRefsDescending<T extends { rotuloLinha: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const keyA = normalizeDateToSortKey(a.rotuloLinha);
    const keyB = normalizeDateToSortKey(b.rotuloLinha);
    if (keyA !== keyB) {
      return keyB - keyA; // Descending
    }
    return b.rotuloLinha.localeCompare(a.rotuloLinha);
  });
}

// Determines the margin status based on contribution margin percentage
export function getMarginStatus(mgcPercentage: number): MarginStatus {
  if (mgcPercentage < 0) {
    return 'NEGATIVA';
  } else if (mgcPercentage < 0.0599) { // bad is below 5.99%
    return 'RUIM';
  } else if (mgcPercentage < 0.12) { // regular is from 6% to 11.99%
    return 'REGULAR';
  } else { // 12% or above is target
    return 'TARGET';
  }
}

// Calculates details for a single scenario
export function calculateEvaluation(
  referenceName: string,
  source: 'CLIENTE' | 'SKU_ESTADO' | 'NENHUM',
  sourceDetails: string,
  kardex: number,
  dedutores: number,
  vpcVpxPercent: number,
  precoNF: number
): MarginEvaluationResult {
  const vpcVpxRatio = vpcVpxPercent / 100;
  const totalDeductionsRate = dedutores + vpcVpxRatio;
  
  // Formula: Preço_NF - kardex - {Preço_NF * (Dedutores + VPC/VPX)}
  const totalDeductionsAmount = precoNF * totalDeductionsRate;
  const mgcRs = precoNF - kardex - totalDeductionsAmount;
  
  // Calculate MgC% = MgC R$ / Preço_NF (guard against division by zero)
  const mgcPercentage = precoNF > 0 ? mgcRs / precoNF : 0;
  const status = getMarginStatus(mgcPercentage);
  
  return {
    reference: referenceName,
    source,
    sourceDetails,
    kardex,
    dedutores,
    vpcVpx: vpcVpxRatio,
    totalDeductionsRate,
    precoNF,
    mgcRs,
    mgcPercentage,
    status
  };
}

// Formula derivation: Preço_NF = kardex / (1 - Dedutores - VPC - M)
export function calculateTargetPrice(
  kardex: number,
  dedutores: number,
  vpcVpxPercent: number,
  targetMargin: number
): number | null {
  const vpcVpxRatio = vpcVpxPercent / 100;
  const denominator = 1 - dedutores - vpcVpxRatio - targetMargin;
  
  if (denominator <= 0) {
    return null; // Mathematically impossible margin target at current cost rates
  }
  
  return kardex / denominator;
}

// Master engine calculation function
export function evaluateMargin(
  clienteRows: BaseClienteRow[],
  skuRows: BaseSkuRow[],
  selectedCliente: string,
  selectedSku: string,
  selectedEstado: string,
  precoNF: number,
  vpcVpxPercent: number
): SimulationResult {
  
  let source: 'CLIENTE' | 'SKU_ESTADO' | 'NENHUM' = 'NENHUM';
  let sourceDetails = '';
  let matchingRows: Array<{ rotuloLinha: string; kardexUnit: number; dedutores: number }> = [];
  
  // Step 1: Search in Base Margem Cliente
  let clientMatches = clienteRows.filter(
    (row) => 
      row.razaoSocial.toUpperCase() === selectedCliente.toUpperCase() && 
      row.codProduto.toUpperCase() === selectedSku.toUpperCase()
  );
  
  // Prioritize the selected state if it is available in the client matches
  if (clientMatches.length > 0 && selectedEstado) {
    const stateMatches = clientMatches.filter(
      (row) => row.codEstado.toUpperCase().trim() === selectedEstado.toUpperCase().trim()
    );
    if (stateMatches.length > 0) {
      clientMatches = stateMatches;
    }
  }
  
  if (clientMatches.length > 0) {
    source = 'CLIENTE';
    sourceDetails = selectedCliente;
    matchingRows = clientMatches.map(row => ({
      rotuloLinha: row.rotuloLinha,
      kardexUnit: row.kardexUnit,
      dedutores: row.dedutores
    }));
  } else if (selectedEstado && selectedSku) {
    // Step 2: Fallback to Base Margem SKU
    const skuMatches = skuRows.filter(
      (row) => 
        row.codEstado.toUpperCase() === selectedEstado.toUpperCase() && 
        row.codProduto.toUpperCase() === selectedSku.toUpperCase()
    );
    
    if (skuMatches.length > 0) {
      source = 'SKU_ESTADO';
      sourceDetails = `Estado: ${selectedEstado}`;
      matchingRows = skuMatches.map(row => ({
        rotuloLinha: row.rotuloLinha,
        kardexUnit: row.kardexUnit,
        dedutores: row.dedutores
      }));
    }
  }
  
  if (matchingRows.length === 0) {
    return {
      ultimoMes: null,
      tresMeses: null,
      targetPrice12: null,
      targetPrice6: null
    };
  }
  
  // Sort chronological reference months descending (newest first)
  const sortedMatches = sortRefsDescending(matchingRows);
  
  // 1. Último Mês
  const latestMatch = sortedMatches[0];
  const latestRefName = `Último Mês (${latestMatch.rotuloLinha})`;
  const ultimoMesResult = calculateEvaluation(
    latestRefName,
    source,
    sourceDetails,
    latestMatch.kardexUnit,
    latestMatch.dedutores,
    vpcVpxPercent,
    precoNF
  );
  
  // 2. Últimos 3 Meses
  const last3Matches = sortedMatches.slice(0, 3);
  // Mesmo para o cálculo médio dos últimos 3 meses, considerar o kardex do ultimo mês disponível
  const ultimoKardex = latestMatch.kardexUnit;
  const avgDedutores = last3Matches.reduce((sum, item) => sum + item.dedutores, 0) / last3Matches.length;
  const listMonths = last3Matches.map(item => item.rotuloLinha).join(', ');
  const m3RefName = `Média 3 Meses (${listMonths})`;
  
  const tresMesesResult = calculateEvaluation(
    m3RefName,
    source,
    sourceDetails,
    ultimoKardex,
    avgDedutores,
    vpcVpxPercent,
    precoNF
  );
  
  // 3. Preço Alvo para Margem Target (12%) e Regular (6%) usando o kardex do último mês disponível
  const referenceKardex = ultimoKardex;
  const referenceDedutores = avgDedutores;
  
  const targetPrice12 = calculateTargetPrice(referenceKardex, referenceDedutores, vpcVpxPercent, 0.12);
  const targetPrice6 = calculateTargetPrice(referenceKardex, referenceDedutores, vpcVpxPercent, 0.06);
  
  return {
    ultimoMes: ultimoMesResult,
    tresMeses: tresMesesResult,
    targetPrice12,
    targetPrice6
  };
}
