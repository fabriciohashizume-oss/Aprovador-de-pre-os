/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ParsedOrderItem {
  sku: string;
  qtd: number;
  precoFinal: number;
  vpx: number; // e.g., 3.0 for 3.00%
  vlrTotal: number;
  rawLine?: string;
}

export interface ParsedOrder {
  rawClient: string;
  decodedClient: string;
  vpcGlobal: number;
  items: ParsedOrderItem[];
}

// Helper to sanitize and parse Brazilian currency format (e.g., "R$ 102,32" or "1.240,50")
export function parseMoneyBr(val: string): number {
  if (!val) return 0;
  let clean = val.replace(/[^\d,.-]/g, '').trim();
  
  // Format like "1.234,56"
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(/,/g, '.');
  } else if (clean.includes(',')) {
    // Format like "102,32"
    clean = clean.replace(/,/g, '.');
  }
  
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper to sanitize and parse percentage values (e.g., "3.5%" or "3,00%")
export function parsePercentBr(val: string): number {
  if (!val) return 0;
  let clean = val.replace('%', '').replace(/[^\d,.-]/g, '').trim();
  if (clean.includes(',')) {
    clean = clean.replace(/,/g, '.');
  }
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

// Main parser function for order pastes
export function parsePastedOrder(text: string, uniqueSkus: string[], uniqueClientes: string[]): ParsedOrder {
  const result: ParsedOrder = {
    rawClient: '',
    decodedClient: '',
    vpcGlobal: 0,
    items: []
  };

  if (!text) return result;

  const lines = text.split(/\r?\n/);
  
  // Heuristic header indexes mapped if a header row is found
  let codeColIdx = -1;
  let qtdColIdx = -1;
  let priceColIdx = -1;
  let vpxColIdx = -1;
  let hasHeaders = false;

  // Track lines that contain data rows
  for (let i = 0; i < lines.length; i++) {
    const origLine = lines[i];
    const line = origLine.trim();
    if (!line) continue;

    // 1. Parse top meta parameters if found
    if (/Nome\s+Fantasia:/i.test(line)) {
      const clientMatch = line.match(/Nome\s+Fantasia:\s*([^\n\t\r|•⊟⊞]+)/i);
      if (clientMatch) {
        result.rawClient = clientMatch[1].trim();
        // Try matching best client in database
        const normalizedRaw = result.rawClient.toUpperCase();
        const found = uniqueClientes.find(c => 
          normalizedRaw.includes(c.toUpperCase()) || 
          c.toUpperCase().includes(normalizedRaw) ||
          // match code e.g. "007140318"
          (c.match(/\d+/) && normalizedRaw.includes(c.match(/\d+/)![0]))
        );
        if (found) {
          result.decodedClient = found;
        } else {
          result.decodedClient = result.rawClient;
        }
      }
    }

    if (/VPC\s+Contratual:/i.test(line)) {
      const vpcMatch = line.match(/VPC\s+Contratual:\s*([^\n\t\r|•⊟⊞]+)/i);
      if (vpcMatch) {
        const vpcRaw = vpcMatch[1].trim();
        if (vpcRaw && vpcRaw !== '—' && vpcRaw !== '-') {
          result.vpcGlobal = parsePercentBr(vpcRaw);
        }
      }
    }

    // 2. Detect headers row to bind dynamic columns if table is copied with headers
    // Looking for a row with multiple tab tokens, multiple spaces or single spaces describing typical table columns
    let cols = line.split(/\t+/);
    if (cols.length < 4) {
      cols = line.split(/\s{2,}/);
    }
    if (cols.length < 4 && line.includes(' ')) {
      const tempCols = line.split(/\s+/).filter(Boolean);
      if (tempCols.length >= 4) {
        cols = tempCols;
      }
    }

    if (cols.length >= 4) {
      const lowerCols = cols.map(c => c.toLowerCase());
      const hasCode = lowerCols.some(c => c.includes('código') || c.includes('codigo') || c.includes('sku'));
      const hasQtd = lowerCols.some(c => c.includes('qtd') || c.includes('quantidade') || c.includes('qnt'));
      const hasPrice = lowerCols.some(c => c.includes('preço final') || c.includes('preco final') || c.includes('preço liq') || c.includes('preco liq') || c.includes('unit'));
      
      if (hasCode && (hasQtd || hasPrice)) {
        // We found a header row! Record the column positions for higher precision
        codeColIdx = lowerCols.findIndex(c => c.includes('código') || c.includes('codigo') || c.includes('sku'));
        qtdColIdx = lowerCols.findIndex(c => c.includes('qtd') || c.includes('quantidade') || c.includes('qnt'));
        
        // Prioritize "preço final"
        const finalPriceIdx = lowerCols.findIndex(c => c.includes('preço final') || c.includes('preco final'));
        if (finalPriceIdx !== -1) {
          priceColIdx = finalPriceIdx;
        } else {
          priceColIdx = lowerCols.findIndex(c => c.includes('preço') || c.includes('preco') || c.includes('vlr. unit') || c.includes('vlr unit') || c.includes('unit'));
        }
        
        vpxColIdx = lowerCols.findIndex(c => 
          c.includes('vpx') || 
          c.includes('vpc') || 
          c.includes('verba') || 
          c.includes('comis') || 
          c.includes('comissão') ||
          c.includes('comissao')
        );
        hasHeaders = true;
        continue; // Skip header row from items representation
      }
    }

    // 3. Process data row containing an SKU item
    // Split columns by tabs or by sequential double spaces (very common in spreadsheet copy-pastes)
    let cells = line.split(/\t/);
    if (cells.length < 3) {
      cells = line.split(/\s{2,}/);
    }
    if (cells.length < 3 && line.includes(' ')) {
      // Third fallback: split by single spaces if no headers are used and SKU is detectable
      cells = line.split(/\s+/);
    }
    
    if (cells.length >= 3) {
      // Find SKU token in row cells using direct database codes first, or regex match second
      let sku = '';
      let skuCellIdx = -1;

      for (let cellIdx = 0; cellIdx < cells.length; cellIdx++) {
        const cellVal = cells[cellIdx].trim();
        // Match base codes exactly or case-insensitive
        const matchedDbSku = uniqueSkus.find(s => s.toUpperCase() === cellVal.toUpperCase());
        if (matchedDbSku) {
          sku = matchedDbSku;
          skuCellIdx = cellIdx;
          break;
        }
      }

      // Regex fallback if direct DB mapping misses
      if (!sku) {
        for (let cellIdx = 0; cellIdx < cells.length; cellIdx++) {
          const cellVal = cells[cellIdx].trim();
          // Heuristic matches: starts with letters, contains numbers e.g. "HC028", "SKU-3205"
          if (/^(?:HC\d+|SKU-\d+)\w*$/i.test(cellVal)) {
            sku = cellVal.toUpperCase();
            skuCellIdx = cellIdx;
            break;
          }
        }
      }

      // If we found a valid product item representation in this line:
      if (sku && skuCellIdx !== -1) {
        let qtd = 0;
        let precoFinal = 0;
        let vpx = 0;
        let vlrTotal = 0;

        // Lookahead for a subline (the next line in this layout that has details like "---")
        let sublineVpx = 0;
        let hasSubline = false;
        
        if (i + 1 < lines.length) {
          const nextOrigLine = lines[i + 1];
          const nextLine = nextOrigLine.trim();
          // Check if next line contains "---" and does not have a separate SKU
          const containsDashes = nextLine.startsWith('---') || nextLine.includes('---\t') || nextLine.includes('--- ') || nextLine.includes('---	');
          if (containsDashes || (nextLine.includes('---') && nextLine.includes('%'))) {
            hasSubline = true;
            let subCells = nextLine.split(/\t/);
            if (subCells.length < 3) {
              subCells = nextLine.split(/\s{2,}/);
            }
            if (subCells.length < 3 && nextLine.includes(' ')) {
              subCells = nextLine.split(/\s+/);
            }
            
            // In the target Portal table copy-pastes, the second row of an item holds VPX at index 3
            if (subCells.length >= 4) {
              const targetCell = subCells[3].trim();
              if (targetCell !== '---' && targetCell !== '-' && targetCell !== '—') {
                sublineVpx = parsePercentBr(targetCell);
              }
            } else {
              // Fallback: search for first % column in the subline
              const sublinePercentageCells: { val: string; value: number }[] = [];
              for (let idx = 0; idx < subCells.length; idx++) {
                const cellVal = subCells[idx].trim();
                if (cellVal.includes('%')) {
                  sublinePercentageCells.push({
                    val: cellVal,
                    value: parsePercentBr(cellVal)
                  });
                }
              }
              if (sublinePercentageCells.length > 0) {
                sublineVpx = sublinePercentageCells[0].value;
              }
            }
          }
        }

        // A. Identify VPX Percentage dynamically
        // Collect all percentages after the SKU cell
        const percentageCells: { val: string; idx: number; value: number }[] = [];
        for (let idx = skuCellIdx + 1; idx < cells.length; idx++) {
          const cellVal = cells[idx].trim();
          if (cellVal.includes('%')) {
            percentageCells.push({
              val: cellVal,
              idx,
              value: parsePercentBr(cellVal)
            });
          }
        }

        // Use the corresponding percentage column that is identified as VPX
        if (hasSubline) {
          vpx = sublineVpx;
        } else if (hasHeaders && vpxColIdx !== -1 && vpxColIdx < cells.length) {
          vpx = parsePercentBr(cells[vpxColIdx]);
        } else if (percentageCells.length >= 2) {
          // If 2 or more percentage cells exist in the row, the second is the VPX percentage
          // (The first one is the Discount percentage/column, e.g., 2,04%. The second is VPX, e.g., 3%).
          vpx = percentageCells[1].value;
        } else if (percentageCells.length === 1) {
          vpx = percentageCells[0].value;
        }

        // B. Identify Quantity and Prices
        let foundTriplet = false;

        // Filter other numeric columns in the row after SKU cell (excluding percentage and non-numeric symbols)
        const numericCandidates: { value: number; isInt: boolean; text: string; idx: number }[] = [];
        for (let idx = skuCellIdx + 1; idx < cells.length; idx++) {
          const cellVal = cells[idx].trim();
          if (!cellVal || cellVal.includes('%') || cellVal === '•' || cellVal === '⊟' || cellVal === '⊞' || cellVal === '-' || cellVal === '—') {
            continue;
          }
          const parsedNum = parseMoneyBr(cellVal);
          if (parsedNum > 0) {
            const isInt = /^\d+$/.test(cellVal.replace(/[^\d]/g, '')) && !cellVal.includes(',') && parsedNum < 100000;
            numericCandidates.push({
              value: parsedNum,
              isInt,
              text: cellVal,
              idx
            });
          }
        }

        // 1. Math Relationship Solver: try to find a combination where Q * P ≈ T
        if (numericCandidates.length >= 3) {
          let bestCombo: { q: number; p: number; t: number; diff: number } | null = null;

          for (let qIdx = 0; qIdx < numericCandidates.length; qIdx++) {
            for (let pIdx = 0; pIdx < numericCandidates.length; pIdx++) {
              if (qIdx === pIdx) continue;
              for (let tIdx = 0; tIdx < numericCandidates.length; tIdx++) {
                if (tIdx === qIdx || tIdx === pIdx) continue;

                const Q = numericCandidates[qIdx].value;
                const P = numericCandidates[pIdx].value;
                const T = numericCandidates[tIdx].value;

                const expectedT = Q * P;
                const diff = Math.abs(expectedT - T);
                const relError = expectedT > 0 ? diff / expectedT : 1;

                // Match with tolerance of 2.0 units or 6% error
                if (diff < 2.0 || relError < 0.06) {
                  if (!bestCombo || diff < bestCombo.diff) {
                    bestCombo = { q: Q, p: P, t: T, diff };
                  }
                }
              }
            }
          }

          if (bestCombo) {
            qtd = Math.round(bestCombo.q);
            precoFinal = bestCombo.p;
            vlrTotal = bestCombo.t;
            foundTriplet = true;
          }
        }

        // 2. Pair Relationship Solver: if exactly 2 numbers are found
        if (!foundTriplet && numericCandidates.length === 2) {
          const first = numericCandidates[0];
          const second = numericCandidates[1];
          if (first.isInt && !second.isInt) {
            qtd = Math.round(first.value);
            precoFinal = second.value;
          } else if (second.isInt && !first.isInt) {
            qtd = Math.round(second.value);
            precoFinal = first.value;
          } else {
            if (first.value < second.value) {
              qtd = Math.round(first.value);
              precoFinal = second.value;
            } else {
              qtd = Math.round(second.value);
              precoFinal = first.value;
            }
          }
          vlrTotal = qtd * precoFinal;
          foundTriplet = true;
        }

        // 3. Fallback: use positional indexes or standard heuristic
        if (!foundTriplet) {
          if (hasHeaders && codeColIdx !== -1) {
            const rawQtd = qtdColIdx !== -1 && qtdColIdx < cells.length ? cells[qtdColIdx] : '';
            const rawPrice = priceColIdx !== -1 && priceColIdx < cells.length ? cells[priceColIdx] : '';

            qtd = rawQtd ? parseInt(rawQtd.replace(/[^\d]/g, '')) || 0 : 0;
            precoFinal = rawPrice ? parseMoneyBr(rawPrice) : 0;
            vlrTotal = qtd * precoFinal;
          } else {
            // Positional fallback relative to SKU index
            const targetQtdCell = cells[skuCellIdx + 3];
            const targetTotalCell = cells[skuCellIdx + 4];
            const targetPriceCell = cells[skuCellIdx + 6];

            qtd = targetQtdCell ? parseInt(targetQtdCell.replace(/[^\d]/g, '')) || 0 : 0;
            precoFinal = targetPriceCell ? parseMoneyBr(targetPriceCell) : 0;
            vlrTotal = targetTotalCell ? parseMoneyBr(targetTotalCell) : (qtd * precoFinal);

            if (precoFinal === 0 && qtd > 0 && vlrTotal > 0) {
              precoFinal = vlrTotal / qtd;
            }
          }
        }

        // Just in case, let's validate that price or quantity is above zero to exclude false matches
        if (qtd > 0 || precoFinal > 0) {
          result.items.push({
            sku,
            qtd: qtd || 1, // default quantity of 1 if omitted
            precoFinal: precoFinal || 0,
            vpx: vpx || 0,
            vlrTotal: vlrTotal || (qtd * precoFinal),
            rawLine: origLine
          });
        }
        if (hasSubline) {
          i++; // Skip processing the already processed subline on the next iteration
        }
      }
    }
  }

  return result;
}
