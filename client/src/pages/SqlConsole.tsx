import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { okaidia } from "@uiw/codemirror-theme-okaidia";
import {
  getSqlMetadata,
  runSqlQuery,
  getCurrentUser,
} from "../api";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { toast } from "sonner";
import {
  Database,
  ArrowLeft,
  Play,
  History,
  Trash2,
  Table as TableIcon,
  AlertTriangle,
  Download,
} from "lucide-react";
import ErDiagram from "../components/ErDiagram";

interface TableMetadata {
  columns: string[];
  rows: any[];
}

export default function SqlConsole() {
  const [, setLocation] = useLocation();
  const [metadata, setMetadata] = useState<Record<string, TableMetadata>>({});
  const [loadingSchema, setLoadingSchema] = useState(true);

  // Editor State
  const [query, setQuery] = useState("-- Write your SQL query here...\nSELECT * FROM Tickets;");
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{ columns: string[]; rows: any[]; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [execTime, setExecTime] = useState<number | null>(null);

  useEffect(() => {
    // Validate User
    const user = getCurrentUser();
    const role = user?.Role || user?.role;
    if (!user || (role !== "Administrator" && role !== "Agent")) {
      toast.error("Unauthorized Access");
      setLocation("/staff-login");
      return;
    }

    // Load schema metadata
    getSqlMetadata()
      .then((data) => {
        setMetadata(data);
        setLoadingSchema(false);
      })
      .catch((err) => {
        toast.error("Failed to load database schema: " + err.message);
        setLoadingSchema(false);
      });

    // Load History
    try {
      const h = JSON.parse(localStorage.getItem("sql_history") || "[]");
      setHistory(h);
    } catch {}
  }, [setLocation]);

  const saveHistory = (q: string) => {
    let h = [...history];
    h = h.filter((x) => x !== q);
    h.unshift(q);
    if (h.length > 5) h = h.slice(0, 5);
    setHistory(h);
    localStorage.setItem("sql_history", JSON.stringify(h));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("sql_history");
    setShowHistory(false);
  };

  const downloadCSV = () => {
    if (!result || !result.columns || result.rows.length === 0) return;

    const headers = result.columns.join(",");
    const rows = result.rows.map((row) =>
      result.columns
        .map((col) => {
          const val = row[col];
          const str = (val === null || val === undefined) ? "" : String(val);
          // Escape quotes and wrap in quotes
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `query_results_${new Date().getTime()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Downloaded");
  };

  const handleRunQuery = async () => {
    if (!query.trim()) return;

    saveHistory(query.trim());
    setIsExecuting(true);
    setError(null);
    setResult(null);
    setExecTime(null);

    const start = performance.now();
    try {
      const res = await runSqlQuery(query.trim());
      setExecTime(Math.round(performance.now() - start));
      setResult(res);
      if (res.columns && res.columns.length > 0) {
        toast.success("Query executed successfully.");
      } else {
        toast.success(res.message || "Query executed.");
      }
    } catch (err: any) {
      setError(err.message || "Execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020818] text-slate-200 relative pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-xs font-bold tracking-widest text-[#00e5ff] uppercase mb-1">
              <Database className="inline w-3 h-3 mr-1" /> Database Hub
            </p>
            <h1 className="text-3xl font-bold text-white tracking-tight font-syne">
              SQL Query Console
            </h1>
          </div>
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-white"
            onClick={() => {
              const u = getCurrentUser();
              const r = u?.Role || u?.role;
              setLocation(r === "Administrator" ? "/admin-dashboard" : "/agent-dashboard");
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </div>

        {/* ER Diagram / Entities Visual */}
        <ErDiagram metadata={metadata} />

        {/* Editor Section */}
        <Card className="bg-white/[0.03] border-white/[0.08] backdrop-blur-md">
          <CardContent className="p-0">
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/[0.08]">
              <h2 className="text-lg font-bold text-white font-syne flex items-center">
                <Database className="w-5 h-5 mr-2 text-[#00e5ff]" /> SQL Workspace
              </h2>
              <div className="flex gap-2 relative">
                <Button variant="ghost" size="icon" onClick={() => setQuery("")} title="Clear">
                  <Trash2 className="w-4 h-4 text-slate-400" />
                </Button>
                
                <div className="relative">
                  <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className="border-white/10 bg-white/5 hover:bg-white/10">
                    <History className="w-4 h-4 mr-2" /> History
                  </Button>
                  {showHistory && (
                    <div className="absolute right-0 mt-2 w-64 bg-[#060f2e] border border-white/10 rounded-lg shadow-xl z-20 py-2">
                      {history.length === 0 ? (
                        <div className="px-4 py-2 text-sm text-slate-500 italic">No history</div>
                      ) : (
                        <>
                          {history.map((h, i) => (
                            <button
                              key={i}
                              className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-white/5 font-mono truncate"
                              onClick={() => { setQuery(h); setShowHistory(false); }}
                            >
                              {h}
                            </button>
                          ))}
                          <div className="h-px bg-white/10 my-1" />
                          <button
                            className="w-full text-center px-4 py-1.5 text-xs text-red-400 hover:bg-red-400/10"
                            onClick={clearHistory}
                          >
                            Clear History
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CodeMirror */}
            <div className="border-b border-white/[0.08]">
               <CodeMirror
                  value={query}
                  height="250px"
                  theme={okaidia}
                  extensions={[sql()]}
                  onChange={(val) => setQuery(val)}
                  className="text-sm border-none outline-none font-mono"
                  style={{ backgroundColor: '#020818' }}
                />
            </div>

            <div className="px-6 py-4 flex justify-between items-center bg-black/20">
              <div className="text-xs text-slate-500">
                {execTime !== null && `Executed in ${execTime}ms`}
              </div>
              <Button 
                onClick={handleRunQuery} 
                disabled={isExecuting || !query.trim()}
                className="bg-gradient-to-r from-[#00e5ff]/20 to-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/40 hover:bg-[#00e5ff]/20 hover:border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)] transition-all font-syne font-semibold"
              >
                {isExecuting ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" /> Running...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2 fill-current" /> Run Query</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start text-red-400">
            <AlertTriangle className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-syne font-bold text-red-300">Execution Failed</h4>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Result Table */}
        {result && result.columns && result.columns.length > 0 && (
          <div className="mt-8 rounded-xl border border-white/[0.08] bg-black/20 overflow-hidden">
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-[#00e5ff] uppercase bg-[#0a1128] sticky top-0 font-syne tracking-wider z-10">
                  <tr>
                    {result.columns.map((col, idx) => (
                      <th key={idx} className="px-6 py-4 border-b border-white/[0.08] whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      {result.columns.map((col, colIdx) => (
                        <td key={colIdx} className="px-6 py-3 whitespace-pre-wrap max-w-md text-slate-300">
                          {row[col] !== null ? String(row[col]) : <i className="opacity-50">NULL</i>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {result.rows.length === 0 && (
                    <tr>
                      <td colSpan={result.columns.length} className="px-6 py-8 text-center text-slate-500 italic">
                        No rows matched your query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-white/[0.02] border-t border-white/[0.08] text-xs text-slate-500 flex justify-between items-center">
              <span>{result.message}</span>
              {result.rows.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadCSV}
                  className="h-7 text-[#00e5ff] hover:text-white hover:bg-[#00e5ff]/10 gap-2 border border-[#00e5ff]/20"
                >
                  <Download className="w-3 h-3" /> Download CSV
                </Button>
              )}
            </div>
          </div>
        )}
        
        {result && result.columns && result.columns.length === 0 && (
          <div className="mt-6 p-4 rounded-xl bg-[#00e5ff]/10 border border-[#00e5ff]/20 text-[#00e5ff] font-medium flex items-center gap-3">
             <Database className="w-5 h-5" />
             {result.message}
          </div>
        )}
      </div>
    </div>
  );
}
