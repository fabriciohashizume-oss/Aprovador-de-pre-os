/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  TrendingUp, 
  Sparkles, 
  Calculator, 
  FileSpreadsheet, 
  History, 
  User, 
  MapPin, 
  Barcode, 
  DollarSign, 
  Percent, 
  ChevronRight, 
  Trash2, 
  Download, 
  RefreshCw, 
  FileDown, 
  Coins, 
  Scale, 
  MessageSquare, 
  Plus,
  HelpCircle,
  Search,
  Check,
  ChevronDown,
  Info,
  Layers,
  ThumbsUp,
  ThumbsDown,
  ClipboardList,
  LineChart as LineIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BaseClienteRow, BaseSkuRow, DecisionRecord, MarginEvaluationResult, MarginStatus } from './types.ts';
import { SAMPLE_CLIENTE_DATA, SAMPLE_SKU_DATA } from './sampleData.ts';
import { evaluateMargin, getMarginStatus, calculateEvaluation, sortRefsDescending } from './marginEngine.ts';
import { parseExcelFile } from './excelParser.ts';
import { downloadSampleExcel } from './excelExporter.ts';
import { parsePastedOrder, ParsedOrderItem } from './orderParser.ts';

// Charts components using Recharts
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

export default function App() {
  // Database States
  const [clienteRows, setClienteRows] = useState<BaseClienteRow[]>(() => {
    const saved = localStorage.getItem('user_cliente_rows');
    return saved ? JSON.parse(saved) : SAMPLE_CLIENTE_DATA;
  });
  
  const [skuRows, setSkuRows] = useState<BaseSkuRow[]>(() => {
    const saved = localStorage.getItem('user_sku_rows');
    return saved ? JSON.parse(saved) : SAMPLE_SKU_DATA;
  });
  
  const [fileName, setFileName] = useState<string | null>(() => {
    return localStorage.getItem('loaded_file_name') || null;
  });

  const [lastUploadedDate, setLastUploadedDate] = useState<string | null>(() => {
    return localStorage.getItem('loaded_file_date') || null;
  });

  // UI States
  const [activeTab, setActiveTab] = useState<'calculator' | 'database' | 'history' | 'order_analyser'>('calculator');
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Custom dropdown searchable selectors open states
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [skuDropdownOpen, setSkuDropdownOpen] = useState(false);
  
  // Search inputs inside our searchable selectors
  const [searchClient, setSearchClient] = useState('');
  const [searchSku, setSearchSku] = useState('');

  // Form Parameters
  const [selectedCliente, setSelectedCliente] = useState<string>('MAGAZINE LUIZA S/A');
  const [selectedSku, setSelectedSku] = useState<string>('SKU-3205');
  const [selectedEstado, setSelectedEstado] = useState<string>('SP');
  const [precoNF, setPrecoNF] = useState<string>('1600');
  const [vpcVpxPercent, setVpcVpxPercent] = useState<number>(5.0);

  // Approval action comment
  const [decisionComment, setDecisionComment] = useState('');

  // Persistent Decisions lists / log
  const [decisions, setDecisions] = useState<DecisionRecord[]>(() => {
    const saved = localStorage.getItem('approval_decisions_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Copied Order Analyser States
  const [pastedOrderText, setPastedOrderText] = useState<string>('');
  const [orderClient, setOrderClient] = useState<string>('');
  const [orderEstado, setOrderEstado] = useState<string>('SP');
  const [orderVpcGlobal, setOrderVpcGlobal] = useState<number>(0);
  const [orderItems, setOrderItems] = useState<ParsedOrderItem[]>([]);
  const [orderCalculationRef, setOrderCalculationRef] = useState<'ultimo' | 'tresMeses'>('ultimo');

  const handleParsePastedOrderText = (customText?: string) => {
    const textToParse = customText !== undefined ? customText : pastedOrderText;
    if (!textToParse.trim()) {
      triggerToast('Por favor, cole o texto do pedido para analisar.', 'error');
      return;
    }
    const parsed = parsePastedOrder(textToParse, uniqueSkus, uniqueClientes);
    
    if (parsed.items.length === 0) {
      triggerToast('Nenhum item com SKU mapeado foi encontrado no texto colado. Verifique se o SKU ou código do produto está presente.', 'error');
      return;
    }

    if (parsed.decodedClient) {
      setOrderClient(parsed.decodedClient);
    } else if (uniqueClientes.length > 0) {
      setOrderClient(uniqueClientes[0]);
    } else {
      setOrderClient('VENDA_AVULSA');
    }

    setOrderVpcGlobal(parsed.vpcGlobal);
    
    // Heuristic: identify client region (state) if available in database
    const matchingClientRow = parsed.decodedClient 
      ? clienteRows.find(r => r.razaoSocial.toUpperCase() === parsed.decodedClient.toUpperCase())
      : null;
    if (matchingClientRow) {
      setOrderEstado(matchingClientRow.codEstado);
    } else if (uniqueEstados.length > 0) {
      setOrderEstado(uniqueEstados[0]);
    } else {
      setOrderEstado('SP');
    }

    setOrderItems(parsed.items);
    triggerToast(`Sucesso! Separados ${parsed.items.length} itens do pedido para auditoria de margem.`, 'success');
  };

  // Unique lists computed from the current loaded database
  const uniqueClientes = React.useMemo(() => {
    const clientsSet = new Set(clienteRows.map(r => r.razaoSocial));
    return Array.from(clientsSet).filter(Boolean).sort();
  }, [clienteRows]);

  const uniqueSkus = React.useMemo(() => {
    const skus = new Set<string>();
    clienteRows.forEach(r => skus.add(r.codProduto));
    skuRows.forEach(r => skus.add(r.codProduto));
    return Array.from(skus).filter(Boolean).sort();
  }, [clienteRows, skuRows]);

  const uniqueEstados = React.useMemo(() => {
    const states = new Set<string>();
    clienteRows.forEach(r => states.add(r.codEstado));
    skuRows.forEach(r => states.add(r.codEstado));
    return Array.from(states).filter(Boolean).map(s => s.toUpperCase()).sort();
  }, [clienteRows, skuRows]);

  // Handle outside click for dropdown closing
  const clientSelectorRef = useRef<HTMLDivElement>(null);
  const skuSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientSelectorRef.current && !clientSelectorRef.current.contains(event.target as Node)) {
        setClientDropdownOpen(false);
      }
      if (skuSelectorRef.current && !skuSelectorRef.current.contains(event.target as Node)) {
        setSkuDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show customized toasts
  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Synchronize dynamic parameters in case the user changes database or selects empty values
  useEffect(() => {
    if (uniqueClientes.length > 0 && !uniqueClientes.includes(selectedCliente)) {
      // Don't overwrite if it's "Venda Avulsa / Sem Cliente"
      if (selectedCliente !== 'VENDA_AVULSA') {
        setSelectedCliente(uniqueClientes[0]);
      }
    }
    if (uniqueSkus.length > 0 && !uniqueSkus.includes(selectedSku)) {
      setSelectedSku(uniqueSkus[0]);
    }
    if (uniqueEstados.length > 0 && !uniqueEstados.includes(selectedEstado)) {
      setSelectedEstado(uniqueEstados[0] || 'SP');
    }
  }, [clienteRows, skuRows, uniqueClientes, uniqueSkus, uniqueEstados]);

  // Excel Upload handle
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const result = parseExcelFile(buffer);

        if (result.error) {
          triggerToast(result.error, 'error');
          return;
        }

        const statsClients = result.clienteRows.length;
        const statsSkus = result.skuRows.length;

        if (statsClients === 0 && statsSkus === 0) {
          triggerToast('O arquivo foi lido, mas nenhuma linha foi identificada nas abas. Verifique se os cabeçalhos estão na linha 5.', 'error');
          return;
        }

        // Save to state
        setClienteRows(result.clienteRows);
        setSkuRows(result.skuRows);
        setFileName(file.name);
        const now = new Date().toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        setLastUploadedDate(now);

        // Save to local storage
        localStorage.setItem('user_cliente_rows', JSON.stringify(result.clienteRows));
        localStorage.setItem('user_sku_rows', JSON.stringify(result.skuRows));
        localStorage.setItem('loaded_file_name', file.name);
        localStorage.setItem('loaded_file_date', now);

        triggerToast(`Sucesso! Carregado: ${statsClients} registros de Clientes e ${statsSkus} registros de SKUs (Estado).`, 'success');
      } catch (err: any) {
        triggerToast(`Erro ao ler planilha: ${err.message || err}`, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Reset database back to default sample template
  const handleResetToSample = () => {
    setClienteRows(SAMPLE_CLIENTE_DATA);
    setSkuRows(SAMPLE_SKU_DATA);
    setFileName(null);
    setLastUploadedDate(null);
    localStorage.removeItem('user_cliente_rows');
    localStorage.removeItem('user_sku_rows');
    localStorage.removeItem('loaded_file_name');
    localStorage.removeItem('loaded_file_date');
    triggerToast('Base resetada para os dados padrão demonstrativos.', 'info');
  };

  // Math simulation numeric variables
  const parsedPrecoNF = parseFloat(precoNF.replace(',', '.')) || 0;
  
  // Calculate simulation
  const simulation = React.useMemo(() => {
    return evaluateMargin(
      clienteRows,
      skuRows,
      selectedCliente === 'VENDA_AVULSA' ? '' : selectedCliente,
      selectedSku,
      selectedEstado,
      parsedPrecoNF,
      vpcVpxPercent
    );
  }, [clienteRows, skuRows, selectedCliente, selectedSku, selectedEstado, parsedPrecoNF, vpcVpxPercent]);

  // Handle decisions logging
  const recordDecision = (type: 'APROVADO' | 'REJEITADO' | 'HELD_FOR_REVIEW') => {
    const isClientSource = selectedCliente !== 'VENDA_AVULSA';
    const activeRefResult = simulation.tresMeses || simulation.ultimoMes; // Prefer three months average for decisions

    if (!activeRefResult) {
      triggerToast('Impossível gravar decisão. Nenhum cálculo ativo correspondente encontrado na base para este SKU/Cliente.', 'error');
      return;
    }

    const newRecord: DecisionRecord = {
      id: 'DEC-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toLocaleString('pt-BR'),
      razaoSocial: isClientSource ? selectedCliente : 'Venda Avulsa / Não Cadastrada',
      codEstado: selectedEstado,
      codProduto: selectedSku,
      descGrupo: activeRefResult.source === 'CLIENTE' 
        ? (clienteRows.find(c => c.codProduto === selectedSku)?.codDescGrupo || 'GERAL')
        : (skuRows.find(s => s.codProduto === selectedSku)?.codDescGrupo || 'GERAL'),
      precoNF: parsedPrecoNF,
      vpcVpx: vpcVpxPercent,
      marginRefUsed: simulation.tresMeses ? 'tresMeses' : 'ultimo',
      kardex: activeRefResult.kardex,
      dedutores: activeRefResult.dedutores,
      mgcRs: activeRefResult.mgcRs,
      mgcPercentage: activeRefResult.mgcPercentage,
      status: activeRefResult.status,
      decision: type,
      comment: decisionComment.trim() || undefined
    };

    const updated = [newRecord, ...decisions];
    setDecisions(updated);
    localStorage.setItem('approval_decisions_history', JSON.stringify(updated));
    setDecisionComment('');
    
    const statusLabels = {
      APROVADO: 'Aprovado com sucesso! 🎉',
      REJEITADO: 'Proposta rejeitada. 🚫',
      HELD_FOR_REVIEW: 'Proposta enviada para o Comitê de Avaliação Especial. ⏳'
    };
    
    triggerToast(statusLabels[type], 'success');
  };

  const deleteDecision = (id: string) => {
    const updated = decisions.filter(d => d.id !== id);
    setDecisions(updated);
    localStorage.setItem('approval_decisions_history', JSON.stringify(updated));
    triggerToast('Registro de simulação removido do histórico.', 'info');
  };

  const clearAllDecisions = () => {
    if (window.confirm('Tem certeza que deseja apagar todo o histórico de decisões salvas localmente?')) {
      setDecisions([]);
      localStorage.removeItem('approval_decisions_history');
      triggerToast('Histórico de decisões completamente limpo.', 'info');
    }
  };

  // Create CSV export tool for simulations
  const exportHistoryToCSV = () => {
    if (decisions.length === 0) {
      triggerToast('Nenhuma simulação registrada no histórico para exportar.', 'error');
      return;
    }

    const headers = [
      'ID', 'Data/Hora', 'Cliente', 'Estado', 'SKU', 'Categoria', 
      'Preco NF (R$)', 'VPC/VPX (%)', 'Custo Kardex (R$)', 'Dedutores (%)',
      'Margem (R$)', 'Margem (%)', 'Status Margem', 'Decisão', 'Comentário'
    ];

    const rows = decisions.map(d => [
      d.id,
      d.timestamp,
      `"${d.razaoSocial.replace(/"/g, '""')}"`,
      d.codEstado,
      d.codProduto,
      `"${d.descGrupo ? d.descGrupo.replace(/"/g, '""') : 'N/A'}"`,
      d.precoNF.toFixed(2).replace('.', ','),
      d.vpcVpx.toFixed(2).replace('.', ','),
      d.kardex.toFixed(2).replace('.', ','),
      (d.dedutores * 100).toFixed(2).replace('.', ','),
      d.mgcRs.toFixed(2).replace('.', ','),
      (d.mgcPercentage * 100).toFixed(2).replace('.', ','),
      d.status,
      d.decision,
      `"${(d.comment || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'historico_aprovacao_margens.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Histórico exportado com sucesso em formato CSV (UTF-8 com BOM).', 'success');
  };

  // Helper lists for graph displaying
  const activeHistoryChartData = React.useMemo(() => {
    let matches: { rotuloLinha: string; kardexUnit: number; dedutores: number }[] = [];
    
    if (selectedCliente !== 'VENDA_AVULSA') {
      matches = clienteRows.filter(
        (r) => r.razaoSocial === selectedCliente && r.codProduto === selectedSku
      );
    }
    
    if (matches.length === 0 && selectedEstado) {
      matches = skuRows.filter(
        (r) => r.codEstado === selectedEstado && r.codProduto === selectedSku
      );
    }

    // Sort matches from oldest to newest for linear visualization
    return [...matches]
      .sort((a, b) => {
        const keyA = a.rotuloLinha.replace('-', '/');
        const keyB = b.rotuloLinha.replace('-', '/');
        return keyA.localeCompare(keyB);
      })
      .map(item => {
        const dPortion = item.dedutores;
        const vpcPortion = vpcVpxPercent / 100;
        const totDeductionsRate = dPortion + vpcPortion;
        const deductionsAmt = parsedPrecoNF * totDeductionsRate;
        const mgcRs = parsedPrecoNF - item.kardexUnit - deductionsAmt;
        const mgcPercentage = parsedPrecoNF > 0 ? (mgcRs / parsedPrecoNF) * 100 : 0;
        
        return {
          month: item.rotuloLinha,
          'Kardex (R$)': Number(item.kardexUnit.toFixed(2)),
          'Dedutores (%)': Number((item.dedutores * 100).toFixed(2)),
          'Margem Est. (%)': Number(mgcPercentage.toFixed(2)),
          'Preço Base (R$)': parsedPrecoNF
        };
      });
  }, [clienteRows, skuRows, selectedCliente, selectedSku, selectedEstado, parsedPrecoNF, vpcVpxPercent]);

  // Find category description matching SKU 
  const currentCategoryDesc = React.useMemo(() => {
    const matchC = clienteRows.find(r => r.codProduto === selectedSku);
    if (matchC) return matchC.codDescGrupo;
    const matchS = skuRows.find(r => r.codProduto === selectedSku);
    return matchS ? matchS.codDescGrupo : 'PRODUTOS QUÍMICOS / GERAL';
  }, [clienteRows, skuRows, selectedSku]);

  // Dynamically compute margem for each item in the parsed pasted list
  const evaluatedOrderItems = React.useMemo(() => {
    return orderItems.map((item) => {
      // 1. Get cost elements (Kardex and Dedutores) using direct client match or state fallback
      let source: 'CLIENTE' | 'SKU_ESTADO' | 'NENHUM' = 'NENHUM';
      let sourceDetails = '';
      let matchingRows: Array<{ rotuloLinha: string; kardexUnit: number; dedutores: number }> = [];

      // Look in Cliente Base
      let clientMatches = clienteRows.filter(
        (row) => 
          row.razaoSocial.toUpperCase() === orderClient.toUpperCase() && 
          row.codProduto.toUpperCase() === item.sku.toUpperCase()
      );

      // Filter by state if applicable
      if (clientMatches.length > 0 && orderEstado) {
        const stateMatches = clientMatches.filter(
          (row) => row.codEstado.toUpperCase().trim() === orderEstado.toUpperCase().trim()
        );
        if (stateMatches.length > 0) {
          clientMatches = stateMatches;
        }
      }

      if (clientMatches.length > 0) {
        source = 'CLIENTE';
        sourceDetails = orderClient;
        matchingRows = clientMatches.map(row => ({
          rotuloLinha: row.rotuloLinha,
          kardexUnit: row.kardexUnit,
          dedutores: row.dedutores
        }));
      } else if (orderEstado && item.sku) {
        // Fallback to SKU base
        const skuMatches = skuRows.filter(
          (row) => 
            row.codEstado.toUpperCase() === orderEstado.toUpperCase() && 
            row.codProduto.toUpperCase() === item.sku.toUpperCase()
        );
        
        if (skuMatches.length > 0) {
          source = 'SKU_ESTADO';
          sourceDetails = `Estado: ${orderEstado}`;
          matchingRows = skuMatches.map(row => ({
            rotuloLinha: row.rotuloLinha,
            kardexUnit: row.kardexUnit,
            dedutores: row.dedutores
          }));
        }
      }

      // If no cost mappings are found
      if (matchingRows.length === 0) {
        return {
          sku: item.sku,
          qtd: item.qtd,
          precoFinal: item.precoFinal,
          vpxItem: item.vpx,
          vlrTotal: item.vlrTotal,
          source: 'NENHUM' as const,
          sourceDetails: 'Sem histórico de custo cadastrado',
          evaluation: null,
          targetPrice12: null,
          targetPrice6: null,
        };
      }

      // Sort chronological descending
      const sortedMatches = sortRefsDescending(matchingRows);
      const latestMatch = sortedMatches[0];
      
      // Determine what elements to use based on user calculation choice (ultimo vs tresMeses)
      let referenceName = '';
      let kardexUnit = latestMatch.kardexUnit; // Always use latest monthly cost per rule
      let dedutoresRate = 0;

      if (orderCalculationRef === 'ultimo') {
        referenceName = `Último Mês (${latestMatch.rotuloLinha})`;
        dedutoresRate = latestMatch.dedutores;
      } else {
        const last3Matches = sortedMatches.slice(0, 3);
        const listMonths = last3Matches.map(item => item.rotuloLinha).join(', ');
        referenceName = `Média 3 Meses (${listMonths})`;
        dedutoresRate = last3Matches.reduce((sum, item) => sum + item.dedutores, 0) / last3Matches.length;
      }

      const totalVpcVpx = item.vpx + orderVpcGlobal;
      const evaluation = calculateEvaluation(
        referenceName,
        source,
        sourceDetails,
        kardexUnit,
        dedutoresRate,
        totalVpcVpx,
        item.precoFinal
      );

      // Preços Alvo para 12% e 6% de margem
      const targetPrice12 = (kardexUnit) / (1 - dedutoresRate - (totalVpcVpx / 100) - 0.12);
      const targetPrice6 = (kardexUnit) / (1 - dedutoresRate - (totalVpcVpx / 100) - 0.06);

      return {
        sku: item.sku,
        qtd: item.qtd,
        precoFinal: item.precoFinal,
        vpxItem: item.vpx,
        vlrTotal: item.vlrTotal,
        source,
        sourceDetails,
        evaluation,
        targetPrice12: targetPrice12 > 0 ? targetPrice12 : null,
        targetPrice6: targetPrice6 > 0 ? targetPrice6 : null,
      };
    });
  }, [orderItems, orderClient, orderEstado, orderVpcGlobal, orderCalculationRef, clienteRows, skuRows]);

  const handleRecordBatchDecisions = () => {
    if (evaluatedOrderItems.length === 0) {
      triggerToast('Nenhum item calculado para salvar no histórico.', 'error');
      return;
    }

    const newRecords: DecisionRecord[] = [];
    let countSaved = 0;

    evaluatedOrderItems.forEach((item) => {
      if (!item.evaluation) return; // ignore items with no cost mapping

      // Build corresponding Decision record
      const descGrupo = item.source === 'CLIENTE'
        ? (clienteRows.find(c => c.codProduto === item.sku)?.codDescGrupo || 'GERAL')
        : (skuRows.find(s => s.codProduto === item.sku)?.codDescGrupo || 'GERAL');

      const isAproved = item.evaluation.status === 'TARGET' || item.evaluation.status === 'REGULAR';
      
      newRecords.push({
        id: 'DEC-LOT-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
        timestamp: new Date().toLocaleString('pt-BR'),
        razaoSocial: orderClient,
        codEstado: orderEstado,
        codProduto: item.sku,
        descGrupo,
        precoNF: item.precoFinal,
        vpcVpx: item.vpxItem + orderVpcGlobal,
        marginRefUsed: orderCalculationRef,
        kardex: item.evaluation.kardex,
        dedutores: item.evaluation.dedutores,
        mgcRs: item.evaluation.mgcRs,
        mgcPercentage: item.evaluation.mgcPercentage,
        status: item.evaluation.status,
        decision: isAproved ? 'APROVADO' : 'HELD_FOR_REVIEW',
        comment: `Auditoria de lote de pedido completo. Qtd: ${item.qtd} unidades.`
      });
      countSaved++;
    });

    if (newRecords.length === 0) {
      triggerToast('Nenhum item válido com margem pôde ser registrado no lote.', 'error');
      return;
    }

    const updated = [...newRecords, ...decisions];
    setDecisions(updated);
    localStorage.setItem('approval_decisions_history', JSON.stringify(updated));
    triggerToast(`${countSaved} itens do pedido salvos no histórico de decisões auditadas!`, 'success');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-xl border text-sm max-w-lg ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
            {toast.type === 'error' && <XCircle className="h-5 w-5 text-rose-500 shrink-0" />}
            {toast.type === 'info' && <Info className="h-5 w-5 text-indigo-500 shrink-0" />}
            <span className="font-medium">{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Row with System Logo and Excel Loaders */}
      <header className="bg-slate-900 text-white shadow-md relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointers-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 z-10 relative">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2.5 rounded-xl text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Scale className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Engine v2.1
                </span>
                <span className="text-xs text-slate-400">UNIDADE DE NEGÓCIOS</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5">
                Aprovador de Descontos e Margem de Contribuição
              </h1>
            </div>
          </div>

          {/* Database Info & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/50 backdrop-blur">
            <div className="flex flex-col text-right pr-3 border-r border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Fonte de Dados Atual</span>
              <div className="flex items-center gap-1.5 justify-end">
                <div className={`w-2 h-2 rounded-full ${fileName ? 'bg-sky-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="text-sm font-medium text-slate-200">
                  {fileName ? 'Planilha Carregada' : 'Dados Demonstrativos'}
                </span>
              </div>
              <span className="text-xs text-slate-400 truncate max-w-[180px]">
                {fileName || 'modelo_exemplo_base.xlsx'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label 
                htmlFor="excel-upload-input" 
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-sm"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Carregar XLSX</span>
              </label>
              <input 
                id="excel-upload-input"
                type="file" 
                accept=".xlsx, .xls"
                className="hidden" 
                onChange={handleFileUpload}
              />

              <button
                onClick={downloadSampleExcel}
                title="Baixar Planilha Modelo de Exemplo"
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-all flex items-center justify-center"
              >
                <FileDown className="h-4 w-4" />
              </button>

              {fileName && (
                <button
                  onClick={handleResetToSample}
                  title="Restaurar Base Demonstrativa Original"
                  className="p-2 bg-rose-950/40 hover:bg-rose-900 border border-rose-800/60 rounded-lg text-rose-300 hover:text-white transition-all flex items-center justify-center"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Warning Alert Bar if data loaded is older/user upload context */}
        {fileName && lastUploadedDate && (
          <div className="bg-sky-950/80 border-t border-sky-800/40 px-4 py-1.5 text-center text-xs text-sky-200 flex items-center justify-center gap-2">
            <FileSpreadsheet className="h-3.5 w-3.5 text-sky-400" />
            <span>Planilha ativa: <b>{fileName}</b> carregada com sucesso em {lastUploadedDate}.</span>
          </div>
        )}
      </header>

      {/* Navigation tabs */}
      <nav className="bg-slate-100 border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 transition-all ${
                activeTab === 'calculator'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Calculator className="h-4 w-4" />
              Simulador & Aprovador
            </button>
            <button
              onClick={() => setActiveTab('order_analyser')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 transition-all ${
                activeTab === 'order_analyser'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Auditoria de Pedido Copiado
              <span className="bg-emerald-500/10 text-emerald-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Novo
              </span>
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 transition-all ${
                activeTab === 'database'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Layers className="h-4 w-4" />
              Visualizar Banco de Custos ({clienteRows.length + skuRows.length} registros)
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 transition-all relative ${
                activeTab === 'history'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <History className="h-4 w-4" />
              Histórico de Decisões
              {decisions.length > 0 && (
                <span className="absolute top-2 right-[-14px] bg-indigo-600 text-white font-bold text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce">
                  {decisions.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* TAB 1: CALCULATOR & APPROVAL */}
        {activeTab === 'calculator' && (
          <div className="space-y-6">
            
            {/* Split screen: Selectors Form vs Visual Results */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Box 1: Parameters selectors (Col span 5) */}
              <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md flex flex-col gap-5 sticky top-20">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800">
                    <Barcode className="h-5 w-5 text-emerald-600" />
                    <h2 className="font-bold text-base uppercase tracking-wide">
                      Parâmetros da Venda
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400">Preencha para calcular</span>
                </div>

                {/* Cliente selector Input */}
                <div className="flex flex-col gap-1.5" ref={clientSelectorRef}>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      Cliente (Razão Social)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedCliente === 'VENDA_AVULSA') {
                          setSelectedCliente(uniqueClientes[0] || '');
                        } else {
                          setSelectedCliente('VENDA_AVULSA');
                        }
                      }}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    >
                      {selectedCliente === 'VENDA_AVULSA' ? 'Selecionar da Base' : 'Ignorar (Venda s/ Cliente / Avulso)'}
                    </button>
                  </div>

                  {selectedCliente === 'VENDA_AVULSA' ? (
                    <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl px-4 py-3 text-center">
                      <span className="text-xs text-slate-500 block font-medium">🛒 Avaliação em Canal Avulso (Venda Geral)</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">O motor de busca usará os filtros de Estado e SKU salvos na aba Margem SKU</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <div 
                        className="relative w-full flex flex-col bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-1.5 text-left transition-all shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 cursor-text"
                        onClick={() => {
                          setClientDropdownOpen(true);
                        }}
                      >
                        <input
                          type="text"
                          className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none placeholder-slate-400"
                          placeholder="Selecione ou digite um cliente..."
                          value={clientDropdownOpen ? searchClient : (selectedCliente || '')}
                          onChange={(e) => {
                            setSearchClient(e.target.value);
                            setClientDropdownOpen(true);
                          }}
                          onFocus={() => {
                            setClientDropdownOpen(true);
                            setSearchClient('');
                          }}
                        />
                        <span className="text-[9.5px] text-slate-400 mt-0.5 select-none truncate">
                          {clientDropdownOpen ? 'Digite o nome do cliente para filtrar' : 'Cliente ativo para simulação'}
                        </span>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                      </div>

                      <AnimatePresence>
                        {clientDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="absolute z-40 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 flex flex-col"
                          >
                            <div className="overflow-y-auto flex-1 py-1">
                              {uniqueClientes
                                .filter(c => c.toLowerCase().includes(searchClient.toLowerCase()))
                                .map((clientName) => (
                                  <button
                                    key={clientName}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCliente(clientName);
                                      setClientDropdownOpen(false);
                                      setSearchClient('');
                                    }}
                                    className={`w-full text-left px-3.5 py-2 text-[11px] flex items-center justify-between transition-all ${
                                      selectedCliente === clientName
                                        ? 'bg-emerald-50 text-emerald-850 font-bold'
                                        : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    <span className="truncate">{clientName}</span>
                                    {selectedCliente === clientName && <Check className="h-3 w-3 text-emerald-600 shrink-0" />}
                                  </button>
                                ))}
                              {uniqueClientes.filter(c => c.toLowerCase().includes(searchClient.toLowerCase())).length === 0 && (
                                <div className="text-center py-4 text-slate-400 text-xs">Nenhum cliente correspondente.</div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* ROW 2: SKU (2/3) & Estado (1/3) */}
                <div className="grid grid-cols-12 gap-3">
                  {/* SKU Selector Input */}
                  <div className="col-span-8 flex flex-col gap-1.5" ref={skuSelectorRef}>
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <Barcode className="h-3.5 w-3.5 text-slate-400" />
                      SKU do Produto
                    </label>
                    <div className="relative">
                      <div 
                        className="relative w-full flex flex-col bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-1.5 text-left transition-all shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 cursor-text"
                        onClick={() => {
                          setSkuDropdownOpen(true);
                        }}
                      >
                        <input
                          type="text"
                          className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none placeholder-slate-400"
                          placeholder="Selecione ou digite um SKU..."
                          value={skuDropdownOpen ? searchSku : (selectedSku || '')}
                          onChange={(e) => {
                            setSearchSku(e.target.value);
                            setSkuDropdownOpen(true);
                          }}
                          onFocus={() => {
                            setSkuDropdownOpen(true);
                            setSearchSku('');
                          }}
                        />
                        <span className="text-[9.5px] text-slate-400 mt-0.5 select-none truncate">
                          {skuDropdownOpen ? 'Digite o SKU para filtrar' : currentCategoryDesc}
                        </span>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none font-bold">
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                      </div>

                      <AnimatePresence>
                        {skuDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="absolute z-40 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 flex flex-col"
                          >
                            <div className="overflow-y-auto flex-1 py-1">
                              {uniqueSkus
                                .filter(sku => sku.toLowerCase().includes(searchSku.toLowerCase()))
                                .map((sku) => {
                                  // Match group description
                                  const clientMatch = clienteRows.find(r => r.codProduto === sku);
                                  const skuMatch = skuRows.find(r => r.codProduto === sku);
                                  const group = clientMatch?.codDescGrupo || skuMatch?.codDescGrupo || 'Geral';
                                  
                                  return (
                                    <button
                                      key={sku}
                                      type="button"
                                      onClick={() => {
                                        setSelectedSku(sku);
                                        setSkuDropdownOpen(false);
                                        setSearchSku('');
                                      }}
                                      className={`w-full text-left px-3.5 py-1.5 flex flex-col transition-all ${
                                        selectedSku === sku
                                          ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-4 border-emerald-500'
                                          : 'text-slate-600 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className="text-[11px] font-bold text-slate-800">{sku}</span>
                                      <span className="text-[9px] text-slate-400 font-normal">{group}</span>
                                    </button>
                                  );
                                })}
                              {uniqueSkus.filter(sku => sku.toLowerCase().includes(searchSku.toLowerCase())).length === 0 && (
                                <div className="text-center py-4 text-slate-400 text-xs">Nenhum SKU correspondente.</div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Estado Selector */}
                  <div className="col-span-4 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      Estado (Ref)
                    </label>
                    <select
                      value={selectedEstado}
                      onChange={(e) => setSelectedEstado(e.target.value)}
                      className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-2.5 py-[11px] text-xs font-semibold text-slate-700 transition-all shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    >
                      {uniqueEstados.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ROW 3: VPC (1/3) & Preço (2/3) */}
                <div className="grid grid-cols-12 gap-3 items-end">
                  {/* VPC/VPX Manual Field */}
                  <div className="col-span-4 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5 text-slate-400" />
                      VPC / VPX (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={vpcVpxPercent}
                        onChange={(e) => {
                          const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                          setVpcVpxPercent(v);
                        }}
                        className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl pl-3 pr-7 py-2.5 text-xs font-bold text-slate-705 transition-all shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-slate-400 text-[10.5px] font-bold">%</div>
                    </div>
                  </div>

                  {/* Preço de Nota Fiscal Input */}
                  <div className="col-span-8 flex flex-col gap-1.5 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100/80">
                    <label className="text-[11px] font-bold text-emerald-800 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                        PREÇO PROP. NOTA FISCAL
                      </span>
                    </label>
                    <div className="relative mt-0.5">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500 font-bold text-xs">R$</div>
                      <input
                        type="text"
                        value={precoNF}
                        onChange={(e) => {
                          let val = e.target.value;
                          val = val.replace(/[^0-9.,]/g, '');
                          setPrecoNF(val);
                        }}
                        className="w-full bg-white border border-emerald-200 focus:border-emerald-500 rounded-lg pl-8 pr-3 py-1.5 text-sm font-bold text-emerald-950 transition-all shadow-sm focus:ring-2 focus:ring-emerald-500/10 focus:outline-none"
                        placeholder="Valor..."
                      />
                    </div>
                  </div>
                </div>

                {/* VPC Quick Slider (Pure Craftsmanship) */}
                <div className="px-1 -mt-1 flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span className="font-medium">Canal de Verba (Ajuste Rápido):</span>
                    <span className="font-bold text-indigo-650 bg-indigo-50 px-1.5 py-0.5 rounded">{vpcVpxPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={vpcVpxPercent}
                    onChange={(e) => setVpcVpxPercent(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Fallback Info Disclaimer Box */}
                {selectedCliente !== 'VENDA_AVULSA' && !clienteRows.some(row => row.razaoSocial === selectedCliente && row.codProduto === selectedSku) && (
                  <div className="bg-sky-50 border border-sky-100 p-2.5 rounded-lg flex items-start gap-1.5">
                    <Info className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
                    <div className="text-[10.5px] text-sky-800 leading-snug">
                      <b>Sem histórico com cliente:</b> O SKU <b>{selectedSku}</b> não vendeu para <b>{selectedCliente}</b>. Ativado <b>Estado ({selectedEstado})</b>.
                    </div>
                  </div>
                )}
              </div>

              {/* Box 2: Results Display (Col span 7) */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                
                {/* Visual Indicators Header */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="h-4.5 w-4.5 text-indigo-500" />
                        DRE Projetada da Proposta
                      </h3>
                      <p className="text-xs text-slate-400">Verificação automática baseada na política de Alçada de Descontos</p>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded">Meta: {'>'}=12%</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded">Reg: 6% a 12%</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded">Ruim: {'<'}6%</span>
                    </div>
                  </div>

                  {/* Calculations breakdown block */}
                  {!simulation.ultimoMes && !simulation.tresMeses ? (
                    <div className="py-12 text-center flex flex-col items-center justify-center">
                      <AlertTriangle className="h-12 w-12 text-slate-300 mb-2 animate-bounce" />
                      <h3 className="text-sm font-bold text-slate-700">Dados não encontrados para este produto</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        O produto ou cliente selecionado não possui custos mapeados. Certifique-se de que a aba carregada contempla o SKU <b>{selectedSku}</b> ou mude o Estado selecionado para fallback.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* CARD REFERENCE: LATEST MONTH */}
                      {simulation.ultimoMes && (
                        <CardMarginRef 
                          evaluation={simulation.ultimoMes} 
                          title="Análise do Último Mês" 
                        />
                      )}

                      {/* CARD REFERENCE: LAST 3 MONTHS */}
                      {simulation.tresMeses && (
                        <CardMarginRef 
                          evaluation={simulation.tresMeses} 
                          title="Média dos Últimos 3 Meses" 
                        />
                      )}

                    </div>
                  )}
                </div>

                {/* Target Price Optimizer section (The direct helpful guidance tool) */}
                {(simulation.ultimoMes || simulation.tresMeses) && (
                  <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl border border-slate-800 relative z-10 overflow-hidden">
                    {/* Visual glowing banner decorator */}
                    <div className="absolute right-0 bottom-0 top-0 w-32 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
                    <div className="absolute left-[-20px] top-[-20px] w-12 h-12 rounded-full bg-indigo-500/20 blur-xl pointer-events-none" />

                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-5 w-5 text-emerald-400 animate-spin-slow" />
                      <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-100">
                        Otimizador Inteligente de Preço
                      </h3>
                    </div>
                    
                    <p className="text-xs text-slate-300 leading-snug mb-4">
                      Se as margens acima forem insuficientes, utilize os preços de nota fiscal calculados abaixo como contraproposta técnica para o cliente atingir o equilíbrio de rentabilidade:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* Price regular (6%) */}
                      <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60 flex flex-col gap-1 relative group">
                        <span className="text-[10px] text-amber-400 font-bold tracking-wider uppercase">Fator 1: Margem Regular (6%)</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xs text-slate-400 font-mono">Preço R$</span>
                          <span className="text-lg font-black text-white font-mono">
                            {simulation.targetPrice6 
                              ? simulation.targetPrice6.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                              : 'Impossível Calcular'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">Atende a margem de {((simulation.tresMeses?.dedutores || 0) * 100 + vpcVpxPercent).toFixed(1)}% de deduções.</p>
                        
                        {simulation.targetPrice6 && (
                          <button
                            type="button"
                            onClick={() => setPrecoNF(simulation.targetPrice6!.toFixed(2).replace('.', ','))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-slate-700 hover:bg-slate-650 px-2 py-1.5 rounded font-bold hover:text-emerald-400 transition-colors flex items-center gap-0.5"
                          >
                            <span>Aplicar</span>
                          </button>
                        )}
                      </div>

                      {/* Price target (12%) */}
                      <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60 flex flex-col gap-1 relative group">
                        <span className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase">Fator 2: Margem Alvo (12%)</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xs text-slate-400 font-mono">Preço R$</span>
                          <span className="text-lg font-black text-emerald-300 font-mono">
                            {simulation.targetPrice12 
                              ? simulation.targetPrice12.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                              : 'Impossível Calcular'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">Ponto de melhor rentabilidade ideal da BU.</p>
                        
                        {simulation.targetPrice12 && (
                          <button
                            type="button"
                            onClick={() => setPrecoNF(simulation.targetPrice12!.toFixed(2).replace('.', ','))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-emerald-600 hover:bg-emerald-500 px-2 py-1.5 rounded font-bold hover:scale-105 active:scale-95 transition-all text-white flex items-center gap-0.5 shadow-md shadow-emerald-950/40"
                          >
                            <span>Aplicar</span>
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                )}



                {/* DECISION LOGGER INTERFACE */}
                {(simulation.ultimoMes || simulation.tresMeses) && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <MessageSquare className="h-5 w-5 text-indigo-500" />
                      <div>
                        <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">Consolidação e Alçada de Decisão</h3>
                        <p className="text-[10.5px] text-slate-400">Registrar esta simulação e salvar parecer técnico do aprovador</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-slate-600">Comentários / Observações do Parecer (Opcional):</label>
                      <textarea
                        value={decisionComment}
                        onChange={(e) => setDecisionComment(e.target.value)}
                        placeholder="Ex: 'Preço aprovado excepcionalmente pois o cliente concordou em compensar o frete no próximo lote' ou 'Rejeitado por margem abaixo do limite regular da BU...'"
                        rows={2}
                        className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all placeholder:text-slate-400 font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => recordDecision('APROVADO')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 group hover:scale-[1.02] active:scale-95"
                      >
                        <ThumbsUp className="h-4 w-4 shrink-0 transition-transform group-hover:rotate-12" />
                        <span>APROVAR DESCONTO</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => recordDecision('REJEITADO')}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 group hover:scale-[1.02] active:scale-95"
                      >
                        <ThumbsDown className="h-4 w-4 shrink-0 transition-transform group-hover:-rotate-12" />
                        <span>REJEITAR ACORDO</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => recordDecision('HELD_FOR_REVIEW')}
                        className="bg-slate-700 hover:bg-slate-650 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 group hover:scale-[1.02] active:scale-95"
                      >
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                        <span>RETER PARA COMITÊ</span>
                      </button>
                    </div>

                    <span className="text-[10.5px] text-slate-400 text-center block">
                      Ao clicar em qualquer ação, o parecer técnico e a tabela com os parâmetros serão arquivados na aba <b>Histórico de Decisões</b>.
                    </span>
                  </div>
                )}

              </div>

            </div>

          </div>
        )}

        {/* TAB 2: DATABASE INSPECTOR */}
        {activeTab === 'database' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileSpreadsheet className="h-5.5 w-5.5 text-indigo-600" />
                  Custos e Dedutores do Banco de Dados Ativo
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Este painel exibe todos os produtos, clientes e respectivas margens carregados na memória do navegador.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleResetToSample}
                  className="bg-slate-100 hover:bg-slate-200 hover:text-slate-800 text-slate-600 text-xs font-bold py-2.5 px-4 rounded-xl transition-all"
                >
                  Restaurar Banco Demonstrativo
                </button>
              </div>
            </div>

            {/* Quick Summary Widgets */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><User className="h-5.5 w-5.5" /></div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">Clientes Cadastrados</span>
                  <span className="text-base font-bold text-slate-800">{uniqueClientes.length}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><Barcode className="h-5.5 w-5.5" /></div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">SKUs Mapeados</span>
                  <span className="text-base font-bold text-slate-800">{uniqueSkus.length}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><MapPin className="h-5.5 w-5.5" /></div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">Estados Cobertos</span>
                  <span className="text-base font-bold text-slate-800">{uniqueEstados.length}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><FileSpreadsheet className="h-5.5 w-5.5" /></div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">Total de Linhas</span>
                  <span className="text-base font-bold text-slate-800">{clienteRows.length + skuRows.length}</span>
                </div>
              </div>
            </div>

            {/* Main Tabs inside Database Inspector */}
            <div className="space-y-6">
              
              {/* Clients Base Tables structure */}
              <div>
                <div className="bg-slate-800 text-white rounded-t-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Aba: Base Margem Cliente ({clienteRows.length} linhas carregadas)
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded">Cabeçalho Linha 5</span>
                </div>
                <div className="overflow-x-auto border border-slate-200 border-t-0 rounded-b-xl max-h-96">
                  <table className="w-full text-left text-xs text-slate-600 border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-widest sticky top-0 md:text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Rótulos de Linha</th>
                        <th className="px-4 py-3">Razao_Social</th>
                        <th className="px-4 py-3">Cod_Estado</th>
                        <th className="px-4 py-3">Grupo Categoria</th>
                        <th className="px-4 py-3">cod_produto</th>
                        <th className="px-4 py-3 text-right">Kardex Unit. (R$)</th>
                        <th className="px-4 py-3 text-right">Dedutores (sem VPC)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {clienteRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-mono text-[10px] text-slate-400">{row.rotuloLinha}</td>
                          <td className="px-4 py-2.5 text-slate-800 truncate max-w-sm" title={row.razaoSocial}>{row.razaoSocial}</td>
                          <td className="px-4 py-2.5"><span className="bg-slate-200/60 font-bold px-1.5 py-0.5 rounded text-[10px]">{row.codEstado}</span></td>
                          <td className="px-4 py-2.5 text-slate-400 truncate max-w-[120px]">{row.codDescGrupo}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-700">{row.codProduto}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-emerald-700">R$ {row.kardexUnit.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-indigo-700">{(row.dedutores * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* State Fallback Tables structure */}
              <div>
                <div className="bg-slate-800 text-white rounded-t-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Aba: Base Margem SKU ({skuRows.length} linhas carregadas)
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded">Cabeçalho Linha 5 (Fallback)</span>
                </div>
                <div className="overflow-x-auto border border-slate-200 border-t-0 rounded-b-xl max-h-96">
                  <table className="w-full text-left text-xs text-slate-600 border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-widest sticky top-0 md:text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Rótulos de Linha</th>
                        <th className="px-4 py-3">Cod_Estado</th>
                        <th className="px-4 py-3">Grupo Categoria</th>
                        <th className="px-4 py-3">cod_produto</th>
                        <th className="px-4 py-3 text-right">Kardex Unit. (R$)</th>
                        <th className="px-4 py-3 text-right">Dedutores (sem VPC)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {skuRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-mono text-[10px] text-slate-400">{row.rotuloLinha}</td>
                          <td className="px-4 py-2.5"><span className="bg-slate-200/60 font-bold px-1.5 py-0.5 rounded text-[10px]">{row.codEstado}</span></td>
                          <td className="px-4 py-2.5 text-slate-400 truncate max-w-[120px]">{row.codDescGrupo}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-700">{row.codProduto}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-emerald-700">R$ {row.kardexUnit.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-indigo-700">{(row.dedutores * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: APPROVED/DECISIONS HISTORIC */}
        {activeTab === 'history' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <History className="h-5.5 w-5.5 text-indigo-600" />
                  Histórico de Pareceres e Logs de Acordos
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Simulações efetivadas, rejeitadas ou retidas de acordos de preço de nota fiscal com clientes da BU.
                </p>
              </div>

              {decisions.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportHistoryToCSV}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Exportar CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearAllDecisions}
                    className="p-2 text-rose-500 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-all"
                    title="Limpar Histórico"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {decisions.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <History className="h-12 w-12 text-slate-350 mb-3" />
                <h3 className="text-sm font-bold text-slate-700">Nenhum veredito no histórico</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm leading-normal">
                  Realize as simulações na aba <b>Simulador & Aprovador</b>, insira um parecer técnico e clique em "Aprovar" ou "Rejeitar" para popular este painel.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {decisions.map((dec) => {
                  const decisionMetaLabel = {
                    APROVADO: { text: 'CONCEDIDO', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                    REJEITADO: { text: 'NEGADO', bg: 'bg-rose-50 text-rose-800 border-rose-200' },
                    HELD_FOR_REVIEW: { text: 'REVISÃO COMITÊ', bg: 'bg-slate-100 text-slate-800 border-slate-300' }
                  }[dec.decision];

                  const marginLevelColor = {
                    TARGET: 'bg-emerald-500/20 text-emerald-700',
                    REGULAR: 'bg-amber-500/20 text-amber-700',
                    RUIM: 'bg-orange-500/20 text-orange-700',
                    NEGATIVA: 'bg-rose-500/20 text-rose-700'
                  }[dec.status];

                  return (
                    <div key={dec.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      {/* Header row */}
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${decisionMetaLabel.bg}`}>
                            {decisionMetaLabel.text}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 font-bold">{dec.id}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">• {dec.timestamp}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteDecision(dec.id)}
                          className="text-xs text-slate-400 hover:text-rose-600 transition-colors self-end sm:self-auto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Content block */}
                      <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-5 flex flex-col gap-1.5 border-r border-slate-100 pr-4">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cliente de Negociação</span>
                          <p className="text-sm font-extrabold text-slate-800 truncate" title={dec.razaoSocial}>{dec.razaoSocial}</p>
                          <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-500 mt-0.5">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded font-bold">UF: {dec.codEstado}</span>
                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold">SKU: {dec.codProduto}</span>
                            <span className="text-slate-400 italic truncate max-w-[140px]">{dec.descGrupo}</span>
                          </div>
                        </div>

                        <div className="md:col-span-4 grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1 pr-2 border-r border-slate-100/50">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Calculadora</span>
                            <span className="text-sm font-bold text-slate-800">R$ {dec.precoNF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">VPC: {dec.vpcVpx}%</span>
                          </div>

                          <div className="flex flex-col gap-1 pl-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Resultado Obtido</span>
                            <span className="text-sm font-bold text-slate-800">R$ {dec.mgcRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs font-black font-mono text-slate-800">{(dec.mgcPercentage * 100).toFixed(2)}%</span>
                              <span className={`text-[9px] font-extrabold px-1.5 rounded uppercase font-mono ${marginLevelColor}`}>
                                {dec.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-3 bg-indigo-50/25 p-3 rounded-xl border border-indigo-100/30 flex flex-col gap-1 self-start">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-indigo-500" />
                            Parecer do Aprovador
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed italic pr-2">
                            {dec.comment ? `"${dec.comment}"` : 'Sem observações registradas.'}
                          </p>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* TAB 4: ORDER ANALYSER */}
        {activeTab === 'order_analyser' && (
          <div className="space-y-6">
            
            {/* Intro Header Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-700 shrink-0 mt-1">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-slate-800 font-sans">Cópia & Auditoria Rápida de Pedidos</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Cole a tela inteira do portal do pedido (incluindo o cabeçalho e a tabela de produtos). O motor identificará o cliente, o VPC de contrato global e calculará a margem de contribuição (MCE) individual de cada item automaticamente.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    Pressione Ctrl+A no portal, copie e cole ao lado
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Paste Input & Global parameters override (Col span 4) */}
              <div className="xl:col-span-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md flex flex-col gap-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide flex items-center gap-2">
                    <Upload className="h-4 w-4 text-emerald-600" />
                    Área de Transferência
                  </h3>
                  <button 
                    type="button"
                    onClick={() => {
                      setPastedOrderText('');
                      setOrderItems([]);
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold transition-all cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>

                {/* Paste Area */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500">Cole a tela do pedido aqui (Ctrl+V):</label>
                  <textarea
                    rows={8}
                    value={pastedOrderText}
                    onChange={(e) => setPastedOrderText(e.target.value)}
                    placeholder="Nome Fantasia: 007140318 - ...&#10;VPC Contratual: 4.5%&#10;&#10;Família  Código  Tarja  Desc.  Qtd.  Vlr. Total  Preço Final&#10;HC  HC028  •  -0.15%  12  R$ 237,36  R$ 19,78..."
                    className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed resize-y"
                  />
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleParsePastedOrderText()}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md shadow-emerald-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    Processar & Mapear Itens
                  </button>
                </div>

                {/* Overrides and custom tweaks parameters */}
                <div className="border-t border-slate-100 pt-4 mt-2 flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2">
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded uppercase font-mono">Parametrização</span>
                    <h4 className="text-xs font-bold text-slate-705 font-sans">Ajustes Finos Globais</h4>
                  </div>

                  {/* Override Client */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      Cliente Associado:
                    </label>
                    <select
                      value={orderClient}
                      onChange={(e) => setOrderClient(e.target.value)}
                      className="text-xs py-1.5 px-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-750"
                    >
                      <option value="VENDA_AVULSA">Venda Avulsa (Sem Histórico Cliente)</option>
                      {uniqueClientes.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Override Estado */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      Estado (Região Fiscal):
                    </label>
                    <select
                      value={orderEstado}
                      onChange={(e) => setOrderEstado(e.target.value)}
                      className="text-xs py-1.5 px-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-750"
                    >
                      {uniqueEstados.map(uf => (
                        <option key={uf} value={uf}>{uf.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  {/* Override VPC Contratual */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5 text-slate-400" />
                      Soma VPC Contratual do Pedido (%):
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="100"
                      value={orderVpcGlobal}
                      onChange={(e) => setOrderVpcGlobal(parseFloat(e.target.value) || 0)}
                      className="text-xs p-1.5 bg-white rounded-lg border border-slate-205 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-400 leading-normal">
                      Esta verba soma-se com a coluna <b>VPX de cada item</b> para compor a verba comercial inteira.
                    </span>
                  </div>

                  {/* Pricing Reference Type Selection */}
                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-[11px] font-semibold text-slate-500">Mapeamento de Demonstrador / DRE:</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200/50">
                      <button
                        type="button"
                        onClick={() => setOrderCalculationRef('ultimo')}
                        className={`text-[10px] font-bold py-1.5 rounded-md text-center transition-all ${
                          orderCalculationRef === 'ultimo'
                            ? 'bg-white text-emerald-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Último Mês
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderCalculationRef('tresMeses')}
                        className={`text-[10px] font-bold py-1.5 rounded-md text-center transition-all ${
                          orderCalculationRef === 'tresMeses'
                            ? 'bg-white text-emerald-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Média 3 Meses
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Calculations results Dashboard & Table (Col span 8) */}
              <div className="xl:col-span-8 flex flex-col gap-6">
                
                {orderItems.length === 0 ? (
                  /* Empty state display */
                  <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-md text-center flex flex-col items-center justify-center min-h-[400px]">
                    <div className="bg-indigo-50 p-4 rounded-full text-indigo-500 mb-4 animate-pulse">
                      <ClipboardList className="h-10 w-10" />
                    </div>
                    <h3 className="text-base font-bold text-slate-700">Aguardando Pedido</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                      Selecione tudo no portal com <b>Ctrl+A</b>, copie (<b>Ctrl+C</b>) e cole no painel ao lado para auditar instantaneamente todas as margens e preços ideais.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2 justify-center text-[10px] font-semibold text-slate-400">
                      <span className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">✓ Varre Nome do Cliente</span>
                      <span className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">✓ Extrai Verba Contratual</span>
                      <span className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">✓ Cruzamento com DRE de Venda</span>
                    </div>
                  </div>
                ) : (
                  /* Valid results displays */
                  <div className="space-y-6">
                    
                    {/* General Statistics Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Total Revenue */}
                      <div className="bg-white p-4 rounded-xl border border-slate-205 shadow-sm flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Faturamento Total</span>
                        <span className="text-lg font-black text-slate-800 font-mono">
                          R$ {evaluatedOrderItems.reduce((acc, i) => acc + (i.precoFinal * i.qtd), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          {evaluatedOrderItems.reduce((acc, i) => acc + i.qtd, 0)} unidades do pedido
                        </span>
                      </div>

                      {/* Total MCE Margin */}
                      {(() => {
                        const totalSales = evaluatedOrderItems.reduce((acc, i) => acc + (i.precoFinal * i.qtd), 0);
                        const totalMce = evaluatedOrderItems.reduce((acc, i) => {
                          if (i.evaluation) {
                            return acc + (i.evaluation.mgcRs * i.qtd);
                          }
                          return acc;
                        }, 0);
                        const mcePercentGlobal = totalSales > 0 ? (totalMce / totalSales) * 100 : 0;
                        const globalStatus = mcePercentGlobal >= 12 ? 'bg-emerald-500 text-white shadow-inner shadow-emerald-400/20' : mcePercentGlobal >= 6 ? 'bg-amber-500 text-slate-900' : 'bg-rose-600 text-white';

                        return (
                          <div className="bg-white p-4 rounded-xl border border-slate-205 shadow-sm flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Margem Global MCE</span>
                            <span className="text-lg font-black text-slate-800 font-mono">
                              R$ {totalMce.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs font-black font-mono">{mcePercentGlobal.toFixed(2)}%</span>
                              <span className={`text-[8.5px] font-extrabold px-1.5 py-0.2 rounded uppercase ${globalStatus}`}>
                                {mcePercentGlobal >= 12 ? 'TARGET (OTIMA)' : mcePercentGlobal >= 6 ? 'REGULAR' : 'ALTO RISCO'}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Total Costs Estimations */}
                      <div className="bg-white p-4 rounded-xl border border-slate-205 shadow-sm flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Verba Deduzida</span>
                        <span className="text-lg font-black text-rose-600 font-mono">
                          - R$ {evaluatedOrderItems.reduce((acc, i) => acc + (i.precoFinal * ((i.vpxItem + orderVpcGlobal) / 100) * i.qtd), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-405 font-semibold uppercase font-mono">
                          Média: {(((evaluatedOrderItems.reduce((acc, i) => acc + ((i.vpxItem + orderVpcGlobal) * i.qtd), 0)) / (evaluatedOrderItems.reduce((acc, i) => acc + i.qtd, 0)) || 0).toFixed(2))}% vpc + vpx
                        </span>
                      </div>

                      {/* Status classifications summary */}
                      <div className="bg-white p-4 rounded-xl border border-slate-205 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Classificação Margem</span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(() => {
                            const stats = { TARGET: 0, REGULAR: 0, RUIM: 0, NEGATIVA: 0, NONE: 0 };
                            evaluatedOrderItems.forEach(i => {
                              if (i.evaluation) {
                                stats[i.evaluation.status]++;
                              } else {
                                stats.NONE++;
                              }
                            });
                            return (
                              <>
                                {stats.TARGET > 0 && <span className="text-[9px] font-black px-1.5 bg-emerald-100 text-emerald-800 rounded">{stats.TARGET} Tgt</span>}
                                {stats.REGULAR > 0 && <span className="text-[9px] font-black px-1.5 bg-amber-100 text-amber-800 rounded">{stats.REGULAR} Reg</span>}
                                {stats.RUIM > 0 && <span className="text-[9px] font-black px-1.5 bg-orange-100 text-orange-850 rounded">{stats.RUIM} Rvs</span>}
                                {stats.NEGATIVA > 0 && <span className="text-[9px] font-black px-1.5 bg-rose-100 text-rose-800 rounded">{stats.NEGATIVA} Neg</span>}
                                {stats.NONE > 0 && <span className="text-[9px] font-black px-1.5 bg-slate-100 text-slate-600 rounded">{stats.NONE} Novo</span>}
                              </>
                            );
                          })()}
                        </div>
                        <span className="text-[9px] text-slate-350 font-semibold mt-1">Auditado sob {orderCalculationRef === 'ultimo' ? 'último mês' : 'média de 3 meses'}</span>
                      </div>
                    </div>

                    {/* Quick Warning if there are negative or bad margin items */}
                    {evaluatedOrderItems.some(i => i.evaluation && (i.evaluation.status === 'NEGATIVA' || i.evaluation.status === 'RUIM')) && (
                      <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-start gap-2.5">
                        <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5 animate-bounce" />
                        <div>
                          <h4 className="text-xs font-bold text-orange-850 uppercase">Itens fora da meta identificados</h4>
                          <p className="text-[11px] text-orange-700 mt-0.5 leading-relaxed">
                            Há produtos que resultaram em margens ruins ou negativas na simulação sob a base de custos ativa. Avalie aumentar o preço de venda para os valores sugeridos de Preço Alvo na tabela ou reduza as verbas negociadas.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Batch Actions Toolbar */}
                    <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                      <div>
                        <h4 className="text-xs font-bold font-sans uppercase text-slate-205">Exportação de Simulações em Lote</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Com um clique, registre todos os itens calculados na base histórica.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRecordBatchDecisions}
                        className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 text-xs py-2 px-4 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Salvar Itens no Histórico de Decisões
                      </button>
                    </div>

                    {/* Active Order Items List and audit metrics */}
                    <div className="bg-white rounded-2xl border border-slate-205 shadow-md overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Itens do Pedido Carregados</h3>
                          <p className="text-[10px] text-slate-400">Varredura e comparação com o Cadastro de Custos de Clientes e fallback por Estado</p>
                        </div>
                        <span className="text-[10px] text-indigo-650 font-extrabold bg-indigo-50 px-2.5 py-0.5 rounded-full">
                          Cliente: {orderClient}
                        </span>
                      </div>

                      <div className="overflow-x-auto font-sans">
                        <table className="w-full min-w-[800px] text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-black text-[10px] tracking-wider">
                              <th className="py-3.5 px-4 text-center w-12">Status</th>
                              <th className="py-3.5 px-3">Código SKU</th>
                              <th className="py-3.5 px-2 text-center">Qtd</th>
                              <th className="py-3.5 px-3 text-right">Preço Final</th>
                              <th className="py-3.5 px-3 text-center">VPX + VPC</th>
                              <th className="py-3.5 px-3 text-center">Custo Base (Kardex)</th>
                              <th className="py-3.5 px-3 text-right">MCE Unitário</th>
                              <th className="py-3.5 px-3 text-right">MCE Total</th>
                              <th className="py-3.5 px-4 text-right">Preço Ideal (6% / 12%)</th>
                              <th className="py-3.5 px-3 text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                            {evaluatedOrderItems.map((item, index) => {
                              const hasEval = !!item.evaluation;
                              
                              const statusIndicator = hasEval 
                                ? {
                                    TARGET: { bar: 'bg-emerald-500', text: 'TARGET', class: 'bg-emerald-50 text-emerald-850' },
                                    REGULAR: { bar: 'bg-amber-500', text: 'REGULAR', class: 'bg-amber-50 text-amber-850 font-bold' },
                                    RUIM: { bar: 'bg-orange-550', text: 'REVISAR', class: 'bg-orange-50 text-orange-800 font-bold animate-pulse' },
                                    NEGATIVA: { bar: 'bg-rose-500', text: 'NEGATIVA', class: 'bg-rose-50 text-rose-800 border border-rose-200 font-bold' }
                                  }[item.evaluation!.status]
                                : { bar: 'bg-slate-300', text: 'S/ CUSTO', class: 'bg-slate-100 text-slate-600 font-bold' };

                              return (
                                <tr key={item.sku + '-' + index} className="hover:bg-slate-50/50 transition-colors">
                                  {/* Status indicator bar in margin */}
                                  <td className="py-3 px-4 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusIndicator.bar}`} />
                                      <span className={`text-[9px] font-black tracking-wide px-1.5 py-0.2 rounded uppercase font-mono ${statusIndicator.class}`}>
                                        {statusIndicator.text}
                                      </span>
                                    </div>
                                  </td>

                                  {/* SKU Product code and mapping source */}
                                  <td className="py-3 px-3">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-800 font-mono">{item.sku}</span>
                                      <span className="text-[9px] text-slate-400 font-black uppercase mt-0.5 truncate max-w-[120px]">
                                        {item.source === 'CLIENTE' ? 'Base Cliente' : item.source === 'SKU_ESTADO' ? `Fallback ${orderEstado}` : 'Manual/Sem Custo'}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Quantity */}
                                  <td className="py-3 px-2 text-center font-extrabold text-slate-705">
                                    {item.qtd}
                                  </td>

                                  {/* Price Final parsed */}
                                  <td className="py-3 px-3 text-right text-slate-800 font-mono font-black text-xs">
                                    R$ {item.precoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>

                                  {/* VPX + VPC breakdown */}
                                  <td className="py-3 px-3 text-center">
                                    <div className="flex flex-col items-center">
                                      <span className="font-mono text-[11px] font-extrabold text-slate-705">
                                        {(item.vpxItem + orderVpcGlobal).toFixed(2)}%
                                      </span>
                                      <span className="text-[9px] text-slate-400 leading-none mt-0.5">
                                        {item.vpxItem}% vpx + {orderVpcGlobal}% vpc
                                      </span>
                                    </div>
                                  </td>

                                  {/* Custo Base (Kardex) & Dedutores */}
                                  <td className="py-3 px-3 text-center">
                                    {hasEval ? (
                                      <div className="flex flex-col items-center">
                                        <span className="font-mono font-extrabold text-slate-800">
                                          R$ {item.evaluation!.kardex.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                        <span className="text-[9px] text-slate-400 mt-0.5">
                                          Ded: {(item.evaluation!.dedutores * 100).toFixed(2)}%
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-semibold italic">Não mapeado</span>
                                    )}
                                  </td>

                                  {/* Individual MCE Margin */}
                                  <td className="py-3 px-3 text-right font-mono">
                                    {hasEval ? (
                                      <div className="flex flex-col items-end">
                                        <span className={`font-black text-xs ${item.evaluation!.status === 'NEGATIVA' ? 'text-rose-600' : item.evaluation!.status === 'RUIM' ? 'text-orange-600' : item.evaluation!.status === 'REGULAR' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                          {(item.evaluation!.mgcPercentage * 100).toFixed(2)}%
                                        </span>
                                        <span className="text-[9px] text-slate-400 mt-0.5 leading-none">
                                          R$ {item.evaluation!.mgcRs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} unit.
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-semibold italic">-</span>
                                    )}
                                  </td>

                                  {/* Row Total Margin */}
                                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                                    {hasEval ? (
                                      <span>
                                        R$ {(item.evaluation!.mgcRs * item.qtd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-semibold italic">-</span>
                                    )}
                                  </td>

                                  {/* Suggested target prices */}
                                  <td className="py-3 px-4 text-right">
                                    {hasEval ? (
                                      <div className="flex flex-col items-end">
                                        <span className="text-[10.5px] font-mono text-emerald-600 font-black">
                                          R$ {item.targetPrice12 && item.targetPrice12 > 0 ? item.targetPrice12.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'N/A'} (12%)
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-400 font-extrabold mt-0.5">
                                          R$ {item.targetPrice6 && item.targetPrice6 > 0 ? item.targetPrice6.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'N/A'} (6%)
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-semibold italic">Configure custos</span>
                                    )}
                                  </td>

                                  {/* Delete row handler */}
                                  <td className="py-3 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = orderItems.filter((_, i) => i !== index);
                                        setOrderItems(updated);
                                        triggerToast('Produto removido da simulação em lote.', 'info');
                                      }}
                                      className="p-1 px-1.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded transition-all cursor-pointer"
                                      title="Remover Item"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 sm:px-6 lg:px-8">
          <p>© 2026 BU Controller - Motor de Alçada e Cálculo de Margem de Contribuição.</p>
          <p className="font-mono text-[10px]">Desenvolvido seguindo regras rígidas de Governança e Compliance.</p>
        </div>
      </footer>

    </div>
  );
}

// Inner helper comparative result card (Pure aesthetic quality)
interface CardMarginRefProps {
  evaluation: MarginEvaluationResult;
  title: string;
}

function CardMarginRef({ evaluation, title }: CardMarginRefProps) {
  const isNegative = evaluation.mgcPercentage < 0;
  
  // Decide badge visuals based on MarginStatus
  const statusConfig = {
    TARGET: { 
      borderColor: 'border-emerald-250', 
      bgColor: 'bg-emerald-50/70', 
      textColor: 'text-emerald-800', 
      tagText: 'Ótima (>=12%)', 
      tagClass: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />
    },
    REGULAR: { 
      borderColor: 'border-amber-200', 
      bgColor: 'bg-amber-50/50', 
      textColor: 'text-amber-800', 
      tagText: 'Regular (6% a 12%)', 
      tagClass: 'bg-amber-500 text-slate-950',
      icon: <Info className="h-5 w-5 text-amber-500" />
    },
    RUIM: { 
      borderColor: 'border-orange-200', 
      bgColor: 'bg-orange-50/40', 
      textColor: 'text-orange-850', 
      tagText: 'Ruim (<5,99%)', 
      tagClass: 'bg-orange-500 text-white',
      icon: <AlertTriangle className="h-5 w-5 text-orange-500" />
    },
    NEGATIVA: { 
      borderColor: 'border-rose-450', 
      bgColor: 'bg-rose-50/60 animate-glow-rose', 
      textColor: 'text-rose-900', 
      tagText: 'MARGEM NEGATIVA!', 
      tagClass: 'bg-rose-600 text-white animate-pulse',
      icon: <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
    },
  }[evaluation.status];

  return (
    <div className={`border rounded-xl p-4 transition-all shadow-sm flex flex-col gap-3.5 relative overflow-hidden ${statusConfig.borderColor} ${statusConfig.bgColor}`}>
      
      {/* Absolute background stamp for Negative */}
      {isNegative && (
        <div className="absolute right-[-10px] bottom-[-10px] rotate-12 opacity-[0.03] text-rose-500 select-none">
          <XCircle className="h-32 w-32" />
        </div>
      )}

      {/* Header element of Card */}
      <div className="flex items-start justify-between gap-1 border-b border-slate-200/40 pb-2">
        <div className="flex flex-col">
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{title}</span>
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate max-w-[150px] sm:max-w-none">{evaluation.reference}</span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-[9px] font-black tracking-wide px-2 py-0.5 rounded uppercase font-mono ${statusConfig.tagClass}`}>
            {statusConfig.tagText}
          </span>
          <span className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-0.5">
            {evaluation.source === 'CLIENTE' ? (
              <>
                <User className="h-3 w-3 text-indigo-500" />
                Base Cliente
              </>
            ) : (
              <>
                <MapPin className="h-3 w-3 text-sky-500" />
                Base Estado Fallback
              </>
            )}
          </span>
        </div>
      </div>

      {/* Margem De Contribuição Result Dashboard */}
      <div className="flex items-center justify-between bg-white px-3 py-3.5 rounded-xl border border-slate-200/50 shadow-inner">
        <div>
          <span className="block text-[9px] text-slate-400 font-bold uppercase">Meta Margem de Contribuição (MgC%)</span>
          <span className={`text-2xl font-black font-mono tracking-tight leading-none ${evaluation.status === 'NEGATIVA' ? 'text-rose-600 animate-pulse' : evaluation.status === 'RUIM' ? 'text-orange-600' : evaluation.status === 'REGULAR' ? 'text-amber-600' : 'text-emerald-600'}`}>
            {(evaluation.mgcPercentage * 100).toFixed(2)}%
          </span>
        </div>

        <div className="text-right">
          <span className="block text-[9px] text-slate-400 font-bold uppercase">Resultado em R$ (MgC R$)</span>
          <span className="text-md font-extrabold text-slate-800 font-mono">
            R$ {evaluation.mgcRs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* DRE Formula breakdown list */}
      <div className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600 mt-1 pl-1">
        
        {/* Preço de Nota Fiscal reference */}
        <div className="flex justify-between items-center text-[11px] border-b border-dashed border-slate-200/40 pb-1">
          <span className="text-slate-400">Preço de Nota Fiscal (NF):</span>
          <span className="font-mono text-slate-700">R$ {evaluation.precoNF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Custo do Produto Kardex (deduced) */}
        <div className="flex justify-between items-center text-[11px] border-b border-dashed border-slate-200/40 pb-1">
          <span className="text-slate-400 flex items-center gap-1 text-[11.5px]">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Custo Kardex Unitário (Abaixo):
          </span>
          <span className="font-mono text-rose-600 font-bold">- R$ {evaluation.kardex.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Outras Deduções da Tabela (Sem VPX) */}
        <div className="flex justify-between items-center text-[11px] border-b border-dashed border-slate-200/40 pb-1">
          <span className="text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Dedutores de Venda ({(evaluation.dedutores * 100).toFixed(2)}%):
          </span>
          <span className="font-mono text-slate-600">
            - R$ {(evaluation.precoNF * evaluation.dedutores).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* VPC / VPX Promocionais deduzidos */}
        <div className="flex justify-between items-center text-[11px] border-b border-dashed border-slate-200/40 pb-1">
          <span className="text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Acordo VPC / VPX ({(evaluation.vpcVpx * 100).toFixed(1)}%):
          </span>
          <span className="font-mono text-slate-600">
            - R$ {(evaluation.precoNF * evaluation.vpcVpx).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Total Cost compose details */}
        <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-500 pt-1">
          <span>Custos Totais Incidentes:</span>
          <span className="font-mono">
            R$ {(evaluation.kardex + (evaluation.precoNF * evaluation.totalDeductionsRate)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>

      </div>

      {/* Critical feedback messages */}
      {evaluation.status === 'NEGATIVA' && (
        <div className="mt-1 bg-rose-50 border border-rose-200 p-2 rounded-lg flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-rose-600 rounded-full animate-ping shrink-0" />
          <span className="text-[10px] text-rose-800 font-bold leading-normal">
            <b>ALERTA DE SEGURANÇA FISCAL:</b> Esta proposta consome todo o preço de NF e gerará prejuízo unitário direto para a companhia!
          </span>
        </div>
      )}
      
      {evaluation.status === 'RUIM' && (
        <div className="mt-1 bg-orange-50 border border-orange-100 p-2 rounded-lg flex items-center gap-2">
          <span className="text-[10px] text-orange-850 font-medium leading-normal">
            <b>Recomendação:</b> Margem abaixo do regulamento corporativo. Considere pedir recalculo ou adicionar menos VPC.
          </span>
        </div>
      )}

    </div>
  );
}
