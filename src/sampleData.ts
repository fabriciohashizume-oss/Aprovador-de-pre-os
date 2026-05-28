/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseSkuRow, BaseClienteRow } from './types';

export const SAMPLE_CLIENTE_DATA: BaseClienteRow[] = [
  // MAGAZINE LUIZA S/A - SKU-3205 (Smartphone)
  {
    rotuloLinha: '2026-05',
    razaoSocial: 'MAGAZINE LUIZA S/A',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1200.00,
    dedutores: 0.2250 // 22.5%
  },
  {
    rotuloLinha: '2026-04',
    razaoSocial: 'MAGAZINE LUIZA S/A',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1180.00,
    dedutores: 0.2100
  },
  {
    rotuloLinha: '2026-03',
    razaoSocial: 'MAGAZINE LUIZA S/A',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1250.00,
    dedutores: 0.2300
  },
  {
    rotuloLinha: '2026-02',
    razaoSocial: 'MAGAZINE LUIZA S/A',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1210.00,
    dedutores: 0.2200
  },

  // MAGAZINE LUIZA S/A - SKU-4819 (Notebook)
  {
    rotuloLinha: '2026-05',
    razaoSocial: 'MAGAZINE LUIZA S/A',
    codEstado: 'SP',
    codDescGrupo: 'NOTEBOOKS',
    codProduto: 'SKU-4819',
    kardexUnit: 2350.00,
    dedutores: 0.2400
  },
  {
    rotuloLinha: '2026-04',
    razaoSocial: 'MAGAZINE LUIZA S/A',
    codEstado: 'SP',
    codDescGrupo: 'NOTEBOOKS',
    codProduto: 'SKU-4819',
    kardexUnit: 2300.00,
    dedutores: 0.2350
  },
  {
    rotuloLinha: '2026-03',
    razaoSocial: 'MAGAZINE LUIZA S/A',
    codEstado: 'SP',
    codDescGrupo: 'NOTEBOOKS',
    codProduto: 'SKU-4819',
    kardexUnit: 2400.00,
    dedutores: 0.2500
  },

  // REDE CASAS BAHIA S.A. - SKU-3205 (Smartphone)
  {
    rotuloLinha: '2026-05',
    razaoSocial: 'REDE CASAS BAHIA S.A.',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1220.00,
    dedutores: 0.2300
  },
  {
    rotuloLinha: '2026-04',
    razaoSocial: 'REDE CASAS BAHIA S.A.',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1190.00,
    dedutores: 0.2200
  },
  {
    rotuloLinha: '2026-03',
    razaoSocial: 'REDE CASAS BAHIA S.A.',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1240.00,
    dedutores: 0.2450
  },

  // REDE CASAS BAHIA S.A. - SKU-7740 (Smart TV)
  {
    rotuloLinha: '2026-05',
    razaoSocial: 'REDE CASAS BAHIA S.A.',
    codEstado: 'RJ',
    codDescGrupo: 'SMART TVS',
    codProduto: 'SKU-7740',
    kardexUnit: 1650.00,
    dedutores: 0.2700
  },
  {
    rotuloLinha: '2026-04',
    razaoSocial: 'REDE CASAS BAHIA S.A.',
    codEstado: 'RJ',
    codDescGrupo: 'SMART TVS',
    codProduto: 'SKU-7740',
    kardexUnit: 1620.00,
    dedutores: 0.2600
  },
  {
    rotuloLinha: '2026-03',
    razaoSocial: 'REDE CASAS BAHIA S.A.',
    codEstado: 'RJ',
    codDescGrupo: 'SMART TVS',
    codProduto: 'SKU-7740',
    kardexUnit: 1680.00,
    dedutores: 0.2800
  },

  // MERCADOLIVRE S.A. - SKU-1544 (Fones e Audio)
  {
    rotuloLinha: '2026-05',
    razaoSocial: 'MERCADOLIVRE.COM ATIVIDADES DE INTERNET LTDA',
    codEstado: 'MG',
    codDescGrupo: 'FONES E AUDIO',
    codProduto: 'SKU-1544',
    kardexUnit: 180.00,
    dedutores: 0.1700
  },
  {
    rotuloLinha: '2026-04',
    razaoSocial: 'MERCADOLIVRE.COM ATIVIDADES DE INTERNET LTDA',
    codEstado: 'MG',
    codDescGrupo: 'FONES E AUDIO',
    codProduto: 'SKU-1544',
    kardexUnit: 175.00,
    dedutores: 0.1650
  },
  {
    rotuloLinha: '2026-03',
    razaoSocial: 'MERCADOLIVRE.COM ATIVIDADES DE INTERNET LTDA',
    codEstado: 'MG',
    codDescGrupo: 'FONES E AUDIO',
    codProduto: 'SKU-1544',
    kardexUnit: 185.00,
    dedutores: 0.1800
  },

  // AMAZON SERVICOS DE VAREJO LTDA - SKU-3205 (Smartphone)
  {
    rotuloLinha: '2026-05',
    razaoSocial: 'AMAZON SERVICOS DE VAREJO LTDA',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1205.00,
    dedutores: 0.2200
  },
  {
    rotuloLinha: '2026-04',
    razaoSocial: 'AMAZON SERVICOS DE VAREJO LTDA',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1195.00,
    dedutores: 0.2150
  },
  {
    rotuloLinha: '2026-03',
    razaoSocial: 'AMAZON SERVICOS DE VAREJO LTDA',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1220.00,
    dedutores: 0.2250
  }
];

export const SAMPLE_SKU_DATA: BaseSkuRow[] = [
  // SKU-3205 (Smartphone) por Estado (Fallback)
  {
    rotuloLinha: '2026-05',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1230.00,
    dedutores: 0.2400
  },
  {
    rotuloLinha: '2026-04',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1210.00,
    dedutores: 0.2300
  },
  {
    rotuloLinha: '2026-03',
    codEstado: 'SP',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1260.00,
    dedutores: 0.2500
  },
  {
    rotuloLinha: '2026-05',
    codEstado: 'RJ',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1280.00,
    dedutores: 0.2850
  },
  {
    rotuloLinha: '2026-04',
    codEstado: 'RJ',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1260.00,
    dedutores: 0.2750
  },
  {
    rotuloLinha: '2026-03',
    codEstado: 'RJ',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1300.00,
    dedutores: 0.2900
  },
  {
    rotuloLinha: '2026-05',
    codEstado: 'MG',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1250.00,
    dedutores: 0.2550
  },
  {
    rotuloLinha: '2026-04',
    codEstado: 'MG',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1230.00,
    dedutores: 0.2450
  },
  {
    rotuloLinha: '2026-03',
    codEstado: 'MG',
    codDescGrupo: 'SMARTPHONES',
    codProduto: 'SKU-3205',
    kardexUnit: 1270.00,
    dedutores: 0.2600
  },

  // SKU-4819 (Notebook) por Estado
  {
    rotuloLinha: '2026-05',
    codEstado: 'SP',
    codDescGrupo: 'NOTEBOOKS',
    codProduto: 'SKU-4819',
    kardexUnit: 2400.00,
    dedutores: 0.2600
  },
  {
    rotuloLinha: '2026-04',
    codEstado: 'SP',
    codDescGrupo: 'NOTEBOOKS',
    codProduto: 'SKU-4819',
    kardexUnit: 2360.00,
    dedutores: 0.2500
  },
  {
    rotuloLinha: '2026-03',
    codEstado: 'SP',
    codDescGrupo: 'NOTEBOOKS',
    codProduto: 'SKU-4819',
    kardexUnit: 2450.00,
    dedutores: 0.2700
  },
  {
    rotuloLinha: '2026-05',
    codEstado: 'SC',
    codDescGrupo: 'NOTEBOOKS',
    codProduto: 'SKU-4819',
    kardexUnit: 2320.00,
    dedutores: 0.2100
  },
  {
    rotuloLinha: '2026-04',
    codEstado: 'SC',
    codDescGrupo: 'NOTEBOOKS',
    codProduto: 'SKU-4819',
    kardexUnit: 2280.00,
    dedutores: 0.2050
  },
  {
    rotuloLinha: '2026-03',
    codEstado: 'SC',
    codDescGrupo: 'NOTEBOOKS',
    codProduto: 'SKU-4819',
    kardexUnit: 2360.00,
    dedutores: 0.2150
  },

  // SKU-7740 (Smart TV) por Estado (Fallback)
  {
    rotuloLinha: '2026-05',
    codEstado: 'SP',
    codDescGrupo: 'SMART TVS',
    codProduto: 'SKU-7740',
    kardexUnit: 1600.00,
    dedutores: 0.2400
  },
  {
    rotuloLinha: '2026-04',
    codEstado: 'SP',
    codDescGrupo: 'SMART TVS',
    codProduto: 'SKU-7740',
    kardexUnit: 1580.00,
    dedutores: 0.2350
  },
  {
    rotuloLinha: '2026-03',
    codEstado: 'SP',
    codDescGrupo: 'SMART TVS',
    codProduto: 'SKU-7740',
    kardexUnit: 1630.00,
    dedutores: 0.2500
  },
  {
    rotuloLinha: '2026-05',
    codEstado: 'PR',
    codDescGrupo: 'SMART TVS',
    codProduto: 'SKU-7740',
    kardexUnit: 1610.00,
    dedutores: 0.2200
  },
  {
    rotuloLinha: '2026-04',
    codEstado: 'PR',
    codDescGrupo: 'SMART TVS',
    codProduto: 'SKU-7740',
    kardexUnit: 1590.00,
    dedutores: 0.2150
  },
  {
    rotuloLinha: '2026-03',
    codEstado: 'PR',
    codDescGrupo: 'SMART TVS',
    codProduto: 'SKU-7740',
    kardexUnit: 1640.00,
    dedutores: 0.2300
  },

  // SKU-1544 (Fones e Audio) - Fallbacks
  {
    rotuloLinha: '2026-05',
    codEstado: 'MG',
    codDescGrupo: 'FONES E AUDIO',
    codProduto: 'SKU-1544',
    kardexUnit: 185.00,
    dedutores: 0.1800
  },
  {
    rotuloLinha: '2026-04',
    codEstado: 'MG',
    codDescGrupo: 'FONES E AUDIO',
    codProduto: 'SKU-1544',
    kardexUnit: 180.00,
    dedutores: 0.1700
  },
  {
    rotuloLinha: '2026-03',
    codEstado: 'MG',
    codDescGrupo: 'FONES E AUDIO',
    codProduto: 'SKU-1544',
    kardexUnit: 190.00,
    dedutores: 0.1900
  }
];
