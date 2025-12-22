/**
 * Utilitários para exportação de dados em Excel e PDF
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Exporta dados para Excel (.xlsx)
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  sheetName: string = 'Dados',
  columnHeaders?: Record<keyof T, string>
): void {
  // Mapear headers se fornecidos
  const mappedData = columnHeaders
    ? data.map(row => {
        const mappedRow: Record<string, unknown> = {};
        for (const key of Object.keys(row) as (keyof T)[]) {
          const header = columnHeaders[key] || String(key);
          mappedRow[header] = row[key];
        }
        return mappedRow;
      })
    : data;

  const worksheet = XLSX.utils.json_to_sheet(mappedData);
  const workbook = XLSX.utils.book_new();
  
  // Ajustar largura das colunas automaticamente
  const maxWidths: number[] = [];
  mappedData.forEach((row) => {
    Object.values(row).forEach((value, colIndex) => {
      const cellLength = String(value || '').length;
      maxWidths[colIndex] = Math.max(maxWidths[colIndex] || 10, cellLength + 2);
    });
  });
  
  worksheet['!cols'] = maxWidths.map(width => ({ wch: Math.min(width, 50) }));
  
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm', { locale: ptBR });
  XLSX.writeFile(workbook, `${filename}_${timestamp}.xlsx`);
}

/**
 * Exporta dados para PDF
 */
export function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; header: string; width?: number }[],
  filename: string,
  title?: string
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Adicionar título
  if (title) {
    doc.setFontSize(16);
    doc.text(title, 14, 15);
  }

  // Adicionar timestamp
  doc.setFontSize(10);
  doc.setTextColor(128);
  doc.text(
    `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    14,
    title ? 23 : 15
  );
  doc.setTextColor(0);

  // Preparar dados para a tabela
  const headers = columns.map(col => col.header);
  const body = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (value instanceof Date) {
        return format(value, 'dd/MM/yyyy HH:mm', { locale: ptBR });
      }
      if (typeof value === 'number') {
        return value.toLocaleString('pt-BR');
      }
      return String(value ?? '');
    })
  );

  // Gerar tabela
  autoTable(doc, {
    head: [headers],
    body,
    startY: title ? 28 : 20,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: columns.reduce((acc, col, index) => {
      if (col.width) {
        acc[index] = { cellWidth: col.width };
      }
      return acc;
    }, {} as Record<number, { cellWidth: number }>),
  });

  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm', { locale: ptBR });
  doc.save(`${filename}_${timestamp}.pdf`);
}

/**
 * Tipos de exportação suportados
 */
export type ExportFormat = 'excel' | 'pdf';

/**
 * Função utilitária para exportar logs
 */
export function exportLogs(
  logs: Array<{
    timestamp: string;
    level: string;
    source: string;
    message: string;
    function_name?: string;
  }>,
  format: ExportFormat
): void {
  const formattedData = logs.map(log => ({
    timestamp: log.timestamp,
    level: log.level.toUpperCase(),
    source: log.function_name || log.source,
    message: log.message.substring(0, 200),
  }));

  if (format === 'excel') {
    exportToExcel(formattedData, 'logs', 'Logs', {
      timestamp: 'Data/Hora',
      level: 'Nível',
      source: 'Fonte',
      message: 'Mensagem',
    });
  } else {
    exportToPDF(
      formattedData,
      [
        { key: 'timestamp', header: 'Data/Hora', width: 35 },
        { key: 'level', header: 'Nível', width: 20 },
        { key: 'source', header: 'Fonte', width: 30 },
        { key: 'message', header: 'Mensagem' },
      ],
      'logs',
      'Relatório de Logs do Sistema'
    );
  }
}

/**
 * Função utilitária para exportar alertas
 */
export function exportAlerts(
  alerts: Array<{
    message: string;
    severity: string;
    created_at: string;
    resolved: boolean;
    resolved_at?: string;
  }>,
  format: ExportFormat
): void {
  const formattedData = alerts.map(alert => ({
    created_at: alert.created_at,
    severity: alert.severity.toUpperCase(),
    message: alert.message,
    status: alert.resolved ? 'Resolvido' : 'Ativo',
    resolved_at: alert.resolved_at || '-',
  }));

  if (format === 'excel') {
    exportToExcel(formattedData, 'alertas', 'Alertas', {
      created_at: 'Criado em',
      severity: 'Severidade',
      message: 'Mensagem',
      status: 'Status',
      resolved_at: 'Resolvido em',
    });
  } else {
    exportToPDF(
      formattedData,
      [
        { key: 'created_at', header: 'Criado em', width: 35 },
        { key: 'severity', header: 'Severidade', width: 25 },
        { key: 'message', header: 'Mensagem' },
        { key: 'status', header: 'Status', width: 25 },
      ],
      'alertas',
      'Relatório de Alertas'
    );
  }
}
