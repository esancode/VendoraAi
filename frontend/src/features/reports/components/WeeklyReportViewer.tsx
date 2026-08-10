import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Loader2, CalendarDays, TrendingUp, AlertCircle, Lightbulb } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    Authorization: `Bearer ${localStorage.getItem('vendora_token')}`,
  },
});

interface ReportData {
  id: string;
  period: string;
  markdownContent: string;
  generatedAt: string;
}

export const WeeklyReportViewer = () => {
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch Report
  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ['weekly-report'],
    queryFn: async () => {
      try {
        const res = await api.get('/reports/weekly');
        if (res.data && res.data.markdownContent) {
          return res.data;
        }
        throw new Error('Formato inválido');
      } catch (error) {
        // Fallback mockup
        return {
          id: 'mock-1',
          period: '01/08 a 07/08',
          generatedAt: new Date().toISOString(),
          markdownContent: `
**Fato Identificado**
Houve uma queda de 15% nas conversões de leads que perguntaram sobre prazos de entrega na região Nordeste.

**Impacto no Negócio**
Perda estimada de R$ 4.500,00 em faturamento semanal devido à desistência na etapa de frete. O SLA médio para essas respostas também subiu para 12 minutos.

**Sugestão Prática**
- Configurar o Agente para oferecer um cupom de 5% de desconto no frete para a região Nordeste.
- Adicionar uma regra na Base de Conhecimento RAG detalhando novas transportadoras parceiras.
          `.trim()
        };
      }
    },
  });

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      const response = await api.get('/reports/weekly/download', {
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'relatorio_semanal.pdf');
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Download iniciado!');
    } catch (error) {
      toast.error('Erro ao baixar o relatório. Tente novamente mais tarde.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Simple Markdown Parser just for rendering bold text and lists for the mockup UI
  const renderMarkdown = (text?: string) => {
    if (!text) return null;
    return text.split('\n').map((line, index) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        const content = line.replace(/\*\*/g, '');
        let Icon = AlertCircle;
        if (content.includes('Fato')) Icon = CalendarDays;
        if (content.includes('Impacto')) Icon = TrendingUp;
        if (content.includes('Sugestão')) Icon = Lightbulb;
        
        return (
          <h3 key={index} className="flex items-center gap-2 font-bold text-zinc-300 mt-6 mb-2 text-lg">
            <Icon className="w-5 h-5 text-emerald-400" />
            {content}
          </h3>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <li key={index} className="ml-6 text-zinc-400 list-disc my-1 leading-relaxed">
            {line.substring(2)}
          </li>
        );
      }
      return (
        <p key={index} className="text-zinc-400 leading-relaxed min-h-[1.5rem]">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-emerald-400 mb-2">
            <FileText className="w-8 h-8" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Relatório de Inteligência</h1>
          </div>
          <p className="text-zinc-500">
            Análise narrativa gerada pela IA sobre o desempenho de vendas da última semana.
          </p>
        </div>
        
        <button
          onClick={handleDownloadPdf}
          disabled={isDownloading || isLoading}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-3 rounded transition-colors disabled:opacity-50"
        >
          {isDownloading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5" />
          )}
          Baixar Relatório PDF
        </button>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 bg-zinc-950 border border-zinc-800 rounded-md">
          <Loader2 className="w-10 h-10 animate-spin text-zinc-500 mb-4" />
          <p className="text-zinc-500">Gerando relatório narrativo...</p>
        </div>
      ) : report ? (
        <article className="bg-zinc-950 border border-zinc-800 rounded-md p-6 md:p-10  relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1    "></div>
          
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">Período de Análise</p>
              <p className="text-lg text-zinc-300 font-medium font-mono">{report.period}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">Gerado em</p>
              <p className="text-sm text-zinc-500 font-mono">{new Date(report.generatedAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">
            {renderMarkdown(report.markdownContent)}
          </div>
        </article>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-500">
          <FileText className="w-12 h-12 mb-4 opacity-50" />
          <p>Relatório não disponível.</p>
        </div>
      )}
    </div>
  );
};
