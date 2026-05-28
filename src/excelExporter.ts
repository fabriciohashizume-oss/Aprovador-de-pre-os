/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { SAMPLE_CLIENTE_DATA, SAMPLE_SKU_DATA } from './sampleData';

export function downloadSampleExcel() {
  // Create worksheets
  // We need to place headers on Line 5. This means lines 1-4 can contain arbitrary text or be blank.
  const clientRows: any[] = [
    { title: 'RELATÓRIO MENSAL - BASE MARGEM CLIENTE' },
    { subtitle: 'Unidade de Negócios (BU) - Histórico de Custos e Dedutores' },
    { note: 'Atenção: Os cabeçalhos oficiais estão localizados estritamente na Linha 5.' },
    {}, // Line 4 blank
    // Line 5: Headers
    {
      'Rótulos de Linha': 'Mês/Ano',
      'Razao_Social': 'Razão Social do Cliente',
      'Cod_Estado': 'UF',
      'Cod Desc Grupo': 'Grupo/Família Produto',
      'cod_produto': 'Código SKU',
      'Soma de Kardex unit': 'Kardex Unitário (R$)',
      'Soma de Dedutores sem VPX/VPC/cust. fin. stk': 'Dedutores'
    }
  ];

  // Append sample data to clientRows
  SAMPLE_CLIENTE_DATA.forEach(row => {
    clientRows.push({
      'Rótulos de Linha': row.rotuloLinha,
      'Razao_Social': row.razaoSocial,
      'Cod_Estado': row.codEstado,
      'Cod Desc Grupo': row.codDescGrupo,
      'cod_produto': row.codProduto,
      'Soma de Kardex unit': row.kardexUnit,
      'Soma de Dedutores sem VPX/VPC/cust. fin. stk': row.dedutores
    });
  });

  const skuRows: any[] = [
    { title: 'RELATÓRIO MENSAL - BASE MARGEM SKU (ESTADO)' },
    { subtitle: 'Margens Consolidadas por Estado e SKU' },
    { note: 'Atenção: Os cabeçalhos oficiais estão localizados estritamente na Linha 5.' },
    {}, // Line 4 blank
    // Line 5: Headers
    {
      'Rótulos de Linha': 'Mês/Ano',
      'Cod_Estado': 'UF',
      'Cod Desc Grupo': 'Grupo/Família Produto',
      'cod_produto': 'Código SKU',
      'Soma de Kardex unit': 'Kardex Unitário (R$)',
      'Soma de Dedutores sem VPX/VPC/cust. fin. stk': 'Dedutores'
    }
  ];

  SAMPLE_SKU_DATA.forEach(row => {
    skuRows.push({
      'Rótulos de Linha': row.rotuloLinha,
      'Cod_Estado': row.codEstado,
      'Cod Desc Grupo': row.codDescGrupo,
      'cod_produto': row.codProduto,
      'Soma de Kardex unit': row.kardexUnit,
      'Soma de Dedutores sem VPX/VPC/cust. fin. stk': row.dedutores
    });
  });

  // Create workspace
  const wb = XLSX.utils.book_new();

  // Create sheet 1: Base Margem Cliente
  const wsCliente = XLSX.utils.json_to_sheet(clientRows, { skipHeader: true });
  XLSX.utils.book_append_sheet(wb, wsCliente, 'Base Margem Cliente');

  // Create sheet 2: Base Margem SKU
  const wsSku = XLSX.utils.json_to_sheet(skuRows, { skipHeader: true });
  XLSX.utils.book_append_sheet(wb, wsSku, 'Base Margem SKU');

  // Trigger download in browser
  XLSX.writeFile(wb, 'modelo_base_margem_descontos.xlsx');
}
