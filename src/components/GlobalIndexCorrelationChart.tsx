import React, { useState } from 'react';
import { BarChart2, Sparkles, Database, ArrowRight, Trash2, ShieldCheck, Filter, Info } from 'lucide-react';

interface IndexCorrelationItem {
  id: string;
  name: string;
  tableName: string;
  readFreqPerMin: number; // X-axis (0 - 1000)
  writeFreqPerMin: number; // Y-axis (0 - 500)
  storageCostMb: number; // Bubble size (5MB - 120MB)
  status: 'optimal' | 'under-utilized' | 'over-bloated' | 'write-heavy';
}

export const GlobalIndexCorrelationChart: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'bloated' | 'optimal' | 'under-utilized'>('all');
  const [hoveredIndex, setHoveredIndex] = useState<IndexCorrelationItem | null>(null);
  const [droppedIndexIds, setDroppedIndexIds] = useState<string[]>([]);

  const indexesData: IndexCorrelationItem[] = [
    { id: 'idx_1', name: 'idx_transactions_customer_id', tableName: 'transactions', readFreqPerMin: 850, writeFreqPerMin: 120, storageCostMb: 45, status: 'optimal' },
    { id: 'idx_2', name: 'idx_transactions_status_date', tableName: 'transactions', readFreqPerMin: 620, writeFreqPerMin: 90, storageCostMb: 32, status: 'optimal' },
    { id: 'idx_3', name: 'idx_order_items_legacy_log', tableName: 'order_items', readFreqPerMin: 12, writeFreqPerMin: 340, storageCostMb: 98, status: 'over-bloated' },
    { id: 'idx_4', name: 'idx_audit_logs_debug_flag', tableName: 'audit_logs', readFreqPerMin: 5, writeFreqPerMin: 480, storageCostMb: 115, status: 'over-bloated' },
    { id: 'idx_5', name: 'idx_customers_legacy_tier', tableName: 'customers', readFreqPerMin: 45, writeFreqPerMin: 210, storageCostMb: 64, status: 'write-heavy' },
    { id: 'idx_6', name: 'idx_products_category_search', tableName: 'products', readFreqPerMin: 310, writeFreqPerMin: 40, storageCostMb: 28, status: 'optimal' },
    { id: 'idx_7', name: 'idx_shipments_tracking_old', tableName: 'shipments', readFreqPerMin: 8, writeFreqPerMin: 15, storageCostMb: 72, status: 'under-utilized' },
    { id: 'idx_8', name: 'idx_inventory_warehouse_ref', tableName: 'inventory', readFreqPerMin: 490, writeFreqPerMin: 220, storageCostMb: 52, status: 'optimal' }
  ];

  const filteredIndexes = indexesData.filter(idx => {
    if (droppedIndexIds.includes(idx.id)) return false;
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'bloated') return idx.status === 'over-bloated' || idx.storageCostMb > 70;
    if (selectedFilter === 'optimal') return idx.status === 'optimal';
    if (selectedFilter === 'under-utilized') return idx.status === 'under-utilized' || idx.readFreqPerMin < 30;
    return true;
  });

  return (
    <div
      id="global-index-correlation-chart"
      data-testid="global-index-correlation-chart"
      className="p-5 bg-white rounded-2xl border border-zinc-200 shadow-lg space-y-4 font-sans text-zinc-900 animate-fadeIn"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-zinc-900 flex items-center gap-2">
              <span>Global Index Correlation Analysis</span>
              <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                Read vs Write vs Storage Bubble Map
              </span>
            </h3>
            <p className="text-xs text-zinc-500">
              X-Axis: Read Frequency (Queries/min) | Y-Axis: Write Frequency (Mutations/min) | Bubble Size: Storage Cost (MB)
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              selectedFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
            }`}
          >
            All Indexes ({indexesData.filter(i => !droppedIndexIds.includes(i.id)).length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('bloated')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              selectedFilter === 'bloated'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
            }`}
          >
            Over-Bloated ({indexesData.filter(i => i.status === 'over-bloated' && !droppedIndexIds.includes(i.id)).length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('under-utilized')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              selectedFilter === 'under-utilized'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            Under-Utilized ({indexesData.filter(i => i.status === 'under-utilized' && !droppedIndexIds.includes(i.id)).length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('optimal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              selectedFilter === 'optimal'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            Optimal ({indexesData.filter(i => i.status === 'optimal' && !droppedIndexIds.includes(i.id)).length})
          </button>
        </div>
      </div>

      {/* Bubble Chart Plot Area (Simulated 2D Scatter Map) */}
      <div className="relative p-6 bg-gradient-to-br from-zinc-950 via-zinc-900 to-indigo-950 rounded-2xl border border-zinc-800 shadow-inner min-h-[380px] flex flex-col justify-between overflow-hidden">
        {/* Grid Background Lines */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none opacity-10">
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
        </div>

        {/* Axis Labels */}
        <div className="absolute top-3 left-4 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
          ▲ High Write Frequency (Mutations / min)
        </div>
        <div className="absolute bottom-3 right-4 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
          High Read Frequency (Queries / min) ▶
        </div>

        {/* Quadrant Legend Watermarks */}
        <div className="absolute top-6 right-6 p-2 bg-rose-950/60 border border-rose-800/80 rounded-xl text-[10px] text-rose-200 font-mono pointer-events-none">
          🚨 Over-Bloated (High Write / Low Read)
        </div>
        <div className="absolute bottom-6 left-6 p-2 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-[10px] text-emerald-200 font-mono pointer-events-none">
          ✨ Optimal (High Read / Low Write)
        </div>

        {/* Bubbles Container */}
        <div className="relative w-full h-72 flex items-center justify-around my-auto z-10 px-4">
          {filteredIndexes.map((item) => {
            // Compute bubble size proportional to storageCostMb (e.g. 32px to 80px)
            const sizePx = Math.max(34, Math.min(84, item.storageCostMb * 0.75));
            const isHovered = hoveredIndex?.id === item.id;

            let bgColor = 'bg-emerald-500/80 border-emerald-300 text-white';
            if (item.status === 'over-bloated') {
              bgColor = 'bg-rose-500/80 border-rose-300 text-white animate-pulse';
            } else if (item.status === 'under-utilized') {
              bgColor = 'bg-amber-500/80 border-amber-300 text-white';
            } else if (item.status === 'write-heavy') {
              bgColor = 'bg-purple-500/80 border-purple-300 text-white';
            }

            return (
              <div
                key={item.id}
                id={`bubble-index-${item.id}`}
                data-testid={`bubble-index-${item.id}`}
                onMouseEnter={() => setHoveredIndex(item)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  width: `${sizePx}px`,
                  height: `${sizePx}px`,
                  left: `${(item.readFreqPerMin / 1000) * 80}%`,
                  bottom: `${(item.writeFreqPerMin / 500) * 75}%`
                }}
                className={`absolute rounded-full border-2 flex flex-col items-center justify-center p-1 text-center cursor-pointer shadow-xl transition-transform hover:scale-110 ${bgColor} ${
                  isHovered ? 'ring-4 ring-white z-30 scale-110' : 'z-20'
                }`}
              >
                <span className="text-[9px] font-mono font-bold truncate max-w-full px-0.5">
                  {item.name.replace('idx_', '').substring(0, 8)}..
                </span>
                <span className="text-[8px] font-mono opacity-90">
                  {item.storageCostMb}MB
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected / Hovered Index Detail Card & Drop Action */}
      {hoveredIndex ? (
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-600 text-white rounded-lg">
              <Database className="w-4 h-4" />
            </span>
            <div>
              <div className="font-bold text-zinc-900 font-mono text-xs flex items-center gap-2">
                <span>{hoveredIndex.name}</span>
                <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase ${
                  hoveredIndex.status === 'over-bloated' ? 'bg-rose-100 text-rose-800' :
                  hoveredIndex.status === 'under-utilized' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {hoveredIndex.status}
                </span>
              </div>
              <div className="text-[11px] text-zinc-600 mt-0.5 flex items-center gap-3">
                <span>Table: <strong className="text-zinc-900">{hoveredIndex.tableName}</strong></span>
                <span>Reads: <strong className="text-zinc-900">{hoveredIndex.readFreqPerMin}/min</strong></span>
                <span>Writes: <strong className="text-zinc-900">{hoveredIndex.writeFreqPerMin}/min</strong></span>
                <span>Storage Cost: <strong className="text-zinc-900">{hoveredIndex.storageCostMb} MB</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id={`btn-drop-bloated-index-${hoveredIndex.id}`}
              data-testid={`btn-drop-bloated-index-${hoveredIndex.id}`}
              onClick={() => {
                setDroppedIndexIds(prev => [...prev, hoveredIndex.id]);
                setHoveredIndex(null);
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Drop Bloated Index</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-500 flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Hover over any bubble on the Global Index Correlation chart to inspect read/write frequency metrics and drop unutilized, over-bloated storage indexes.</span>
        </div>
      )}
    </div>
  );
};
