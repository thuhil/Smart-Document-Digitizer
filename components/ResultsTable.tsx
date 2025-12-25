import React, { useState } from 'react';
import { ExtractedDataRow } from '../types';
import { downloadCSV } from '../utils/fileUtils';
import { Download, Table as TableIcon, ArrowLeft, RefreshCw } from 'lucide-react';

interface ResultsTableProps {
  data: ExtractedDataRow[];
  onReset: () => void;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data, onReset }) => {
  const [tableData, setTableData] = useState<ExtractedDataRow[]>(data);

  if (tableData.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="app-text-muted">No data extracted.</p>
        <button onClick={onReset} className="mt-4 app-accent-text hover:underline">Try Again</button>
      </div>
    );
  }

  const headers = Array.from(new Set(tableData.flatMap(row => Object.keys(row))));

  const handleCellChange = (rowIndex: number, key: string, value: string) => {
    const newData = [...tableData];
    newData[rowIndex] = { ...newData[rowIndex], [key]: value };
    setTableData(newData);
  };

  return (
    <div className="flex flex-col h-full app-card rounded-xl shadow-lg border app-border">
      <div className="p-4 border-b app-border flex flex-wrap justify-between items-center gap-4 bg-[var(--bg-sidebar)]">
        <div className="flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold app-text">Extracted Data</h3>
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full font-medium">
                {tableData.length} Rows
            </span>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={onReset}
                className="flex items-center gap-2 px-3 py-1.5 app-text-muted hover:app-text hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors text-sm font-medium"
            >
                <ArrowLeft className="w-4 h-4" /> Start Over
            </button>
            <button 
                onClick={() => downloadCSV(tableData)}
                className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
            >
                <Download className="w-4 h-4" /> Export CSV
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-0.5">
        <table className="w-full min-w-[600px] border-collapse text-sm text-left">
            <thead className="bg-[var(--bg-sidebar)] app-text-muted sticky top-0 z-10 shadow-sm">
                <tr>
                    <th className="p-3 font-semibold border-b border-r app-border w-12 text-center">#</th>
                    {headers.map(header => (
                        <th key={header} className="p-3 font-semibold border-b border-r app-border min-w-[150px]">
                            {header}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y app-border">
                {tableData.map((row, rIndex) => (
                    <tr key={rIndex} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                        <td className="p-2 text-center app-text-muted border-r app-border select-none">
                            {rIndex + 1}
                        </td>
                        {headers.map((header, cIndex) => (
                            <td key={`${rIndex}-${cIndex}`} className="p-0 border-r app-border relative">
                                <input
                                    type="text"
                                    className="w-full h-full p-3 bg-transparent border-none outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent)] transition-all app-text"
                                    value={String(row[header] ?? '')}
                                    onChange={(e) => handleCellChange(rIndex, header, e.target.value)}
                                />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
      <div className="p-2 bg-[var(--bg-sidebar)] border-t app-border text-xs text-center app-text-muted">
        Tip: You can edit the cells before exporting.
      </div>
    </div>
  );
};

export default ResultsTable;