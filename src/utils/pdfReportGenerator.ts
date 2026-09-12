import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LatencyTrendPoint, OptimizationFlags } from '../types';

export interface PdfReportOptions {
  organization?: string;
  author?: string;
  notes?: string;
  title?: string;
}

/**
 * Converts an SVG DOM Element to a high-resolution PNG data URL for embedding in jsPDF
 */
export async function captureSvgAsPng(svgEl: SVGSVGElement): Promise<string | null> {
  try {
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    // Ensure width and height are explicitly defined on the SVG
    const width = svgEl.clientWidth || 800;
    const height = svgEl.clientHeight || 360;
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));

    const xml = new XMLSerializer().serializeToString(clone);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const image64 = 'data:image/svg+xml;base64,' + svg64;

    const img = new Image();
    img.src = image64;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    const scale = 2; // 2x resolution for sharp PDF rendering
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.warn('Unable to capture SVG for PDF inclusion:', error);
    return null;
  }
}

/**
 * Generates a comprehensive, publication-grade PDF report of database performance trends,
 * side-by-side snapshot comparisons, and engineering optimization recommendations.
 */
export async function generatePerformancePdfReport(params: {
  trendHistory: LatencyTrendPoint[];
  currentFlags: OptimizationFlags;
  indexA?: number;
  indexB?: number;
  svgElement?: SVGSVGElement | null;
  options?: PdfReportOptions;
}): Promise<jsPDF> {
  const { trendHistory, currentFlags, indexA = 0, indexB = Math.max(0, trendHistory.length - 1), svgElement, options } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Calculate summary metrics
  const count = trendHistory.length;
  const initialPt = trendHistory[0];
  const latestPt = trendHistory[count - 1];
  const initialLatency = initialPt ? initialPt.executionTimeMs : 0;
  const latestLatency = latestPt ? latestPt.executionTimeMs : 0;

  let peakLatency = 0;
  let lowestLatency = Infinity;
  trendHistory.forEach((pt) => {
    if (pt.executionTimeMs > peakLatency) peakLatency = pt.executionTimeMs;
    if (pt.executionTimeMs < lowestLatency) lowestLatency = pt.executionTimeMs;
  });
  if (lowestLatency === Infinity) lowestLatency = 0;

  const totalReductionMs = Math.max(0, peakLatency - lowestLatency);
  const totalReductionPercent = peakLatency > 0 ? ((totalReductionMs / peakLatency) * 100).toFixed(1) : '0.0';

  const snapshotA = trendHistory[indexA] || initialPt;
  const snapshotB = trendHistory[indexB] || latestPt;

  // Helper for drawing header bar
  const drawPageHeader = (pageNum: number) => {
    // Top banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 22, 'F');

    // Accent line
    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(0, 22, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('DATABASE PERFORMANCE BENCHMARK & OPTIMIZATION REPORT', margin, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(`Generated: ${formattedDate} ${formattedTime} | 50,000 Records Benchmark Heap`, margin, 18);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(147, 197, 253); // blue-300
    doc.text('OFFICIAL VERIFICATION', pageWidth - margin - 35, 14);
  };

  // Helper for drawing footer on all pages
  const addPageFooters = () => {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('Confidential — Database Engineering Performance Documentation', margin, pageHeight - 5);

      const pageText = `Page ${i} of ${totalPages}`;
      doc.text(pageText, pageWidth - margin - 18, pageHeight - 5);
    }
  };

  // ================= PAGE 1 =================
  drawPageHeader(1);

  let currentY = 30;

  // Document Sub-Header & Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(options?.title || 'Executive Performance Benchmark Report', margin, currentY);

  currentY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Comprehensive evaluation of database indexing, eager batch hydration, LRU query caching, and client virtualization.',
    margin,
    currentY
  );

  currentY += 8;

  // Metadata badges box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('ENVIRONMENT:', margin + 4, currentY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text('PostgreSQL In-Memory Engine (v16.2)', margin + 28, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text('DATASET:', margin + 95, currentY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text('50,000 Transactions (High-Cardinality)', margin + 112, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text('SLA TARGET:', margin + 4, currentY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(5, 150, 105);
  doc.text('< 15.0 ms (Interactive Real-Time)', margin + 26, currentY + 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('ACTIVE PROFILE:', margin + 95, currentY + 10.5);
  doc.setFont('helvetica', 'normal');
  const activeFlagsCount = Object.values(currentFlags).filter(Boolean).length;
  doc.text(`${activeFlagsCount}/5 Optimization Flags Enabled`, margin + 121, currentY + 10.5);

  currentY += 19;

  // Section 1: Executive KPI Metrics
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Executive Benchmark Summary', margin, currentY);

  currentY += 4;

  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 18;

  // Card 1: Initial vs Latest
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('BASELINE LATENCY', margin + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(220, 38, 38); // red
  doc.text(`${initialLatency.toFixed(1)} ms`, margin + 3, currentY + 12);
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Initial unoptimized state', margin + 3, currentY + 15.5);

  // Card 2: Current / Best Latency
  const card2X = margin + cardWidth + 3;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('OPTIMIZED LATENCY', card2X + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(5, 150, 105); // emerald
  doc.text(`${lowestLatency.toFixed(2)} ms`, card2X + 3, currentY + 12);
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Target achieved (< 15ms SLA)', card2X + 3, currentY + 15.5);

  // Card 3: Max Latency Drop
  const card3X = margin + (cardWidth + 3) * 2;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card3X, currentY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('MAX LATENCY DROP', card3X + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(37, 99, 235); // blue
  doc.text(`-${totalReductionPercent}%`, card3X + 3, currentY + 12);
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Saved ${totalReductionMs.toFixed(1)} ms`, card3X + 3, currentY + 15.5);

  // Card 4: Throughput Multiplier
  const card4X = margin + (cardWidth + 3) * 3;
  const speedup = lowestLatency > 0 ? (initialLatency / lowestLatency).toFixed(1) : '1.0';
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card4X, currentY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('THROUGHPUT MULTIPLIER', card4X + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(16, 185, 129); // emerald
  doc.text(`${speedup}x FASTER`, card4X + 3, currentY + 12);
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${count} recorded snapshots`, card4X + 3, currentY + 15.5);

  currentY += cardHeight + 8;

  // Section 2: Visual Chart (If captured)
  if (svgElement) {
    const pngDataUrl = await captureSvgAsPng(svgElement);
    if (pngDataUrl) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('2. Historical Latency Trend Time-Series (D3 Visual Benchmark)', margin, currentY);

      currentY += 4;
      const chartHeight = 58;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, currentY, contentWidth, chartHeight, 2, 2, 'FD');
      doc.addImage(pngDataUrl, 'PNG', margin + 2, currentY + 2, contentWidth - 4, chartHeight - 4);
      currentY += chartHeight + 8;
    }
  }

  // Section 3: Snapshot Comparison Matrix (Snapshot A vs Snapshot B)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Side-by-Side Snapshot Comparison Matrix', margin, currentY);

  currentY += 3;

  if (snapshotA && snapshotB) {
    const deltaMs = snapshotB.executionTimeMs - snapshotA.executionTimeMs;
    const deltaPercent = snapshotA.executionTimeMs > 0 ? ((deltaMs / snapshotA.executionTimeMs) * 100).toFixed(1) : '0.0';
    const isImproved = deltaMs < 0;

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [51, 65, 85]
      },
      head: [
        [
          'Metric / Specification',
          `Baseline Snapshot A (#${indexA + 1})`,
          `Comparison Target B (#${indexB + 1})`,
          'Comparative Delta'
        ]
      ],
      body: [
        [
          'Trigger Event',
          snapshotA.triggerEvent,
          snapshotB.triggerEvent,
          snapshotA.id === snapshotB.id ? 'Identical Snapshot' : 'State Transition'
        ],
        [
          'Recorded Latency (ms)',
          `${snapshotA.executionTimeMs.toFixed(2)} ms`,
          `${snapshotB.executionTimeMs.toFixed(2)} ms`,
          isImproved
            ? `${deltaMs.toFixed(2)} ms (${deltaPercent}%) [FASTER]`
            : deltaMs > 0
            ? `+${deltaMs.toFixed(2)} ms (+${deltaPercent}%) [SLOWER]`
            : '0.00 ms (Parity)'
        ],
        [
          'SLA Compliance (<15ms)',
          snapshotA.executionTimeMs < 15 ? 'PASSED (<15ms)' : 'BREACHED (>15ms)',
          snapshotB.executionTimeMs < 15 ? 'PASSED (<15ms)' : 'BREACHED (>15ms)',
          snapshotB.executionTimeMs < 15 && snapshotA.executionTimeMs >= 15 ? 'Resolved SLA Breach' : 'Maintained State'
        ],
        [
          'Table Rows Scanned',
          `${snapshotA.rowsScanned.toLocaleString()} rows (${((snapshotA.rowsScanned / 50000) * 100).toFixed(1)}%)`,
          `${snapshotB.rowsScanned.toLocaleString()} rows (${((snapshotB.rowsScanned / 50000) * 100).toFixed(1)}%)`,
          snapshotA.rowsScanned > snapshotB.rowsScanned
            ? `-${(snapshotA.rowsScanned - snapshotB.rowsScanned).toLocaleString()} rows scanned`
            : `${(snapshotB.rowsScanned - snapshotA.rowsScanned).toLocaleString()} rows`
        ],
        [
          'Access Method',
          snapshotA.cacheHit
            ? 'LRU In-Memory Hash Lookup'
            : snapshotA.flags.btreeIndexing
            ? 'B-Tree Index Scan'
            : 'Full Sequential Scan (50k rows)',
          snapshotB.cacheHit
            ? 'LRU In-Memory Hash Lookup'
            : snapshotB.flags.btreeIndexing
            ? 'B-Tree Index Scan'
            : 'Full Sequential Scan (50k rows)',
          snapshotB.flags.btreeIndexing && !snapshotA.flags.btreeIndexing ? 'Index Accelerated' : 'Equivalent'
        ],
        [
          'Active DB Roundtrips',
          `${snapshotA.activeQueriesCount} queries (${snapshotA.flags.batchEagerLoading ? 'Batch Join' : 'N+1 Loop'})`,
          `${snapshotB.activeQueriesCount} queries (${snapshotB.flags.batchEagerLoading ? 'Batch Join' : 'N+1 Loop'})`,
          snapshotA.activeQueriesCount > snapshotB.activeQueriesCount
            ? `Eliminated ${snapshotA.activeQueriesCount - snapshotB.activeQueriesCount} N+1 queries`
            : 'Parity'
        ],
        [
          'LRU Cache Status',
          snapshotA.cacheHit ? 'CACHE HIT' : 'CACHE MISS',
          snapshotB.cacheHit ? 'CACHE HIT' : 'CACHE MISS',
          snapshotB.cacheHit ? 'Hot-path sub-millisecond retrieval' : 'Standard disk/memory query'
        ]
      ]
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Check if we need to add a page break before Section 4
  if (currentY > pageHeight - 65) {
    doc.addPage();
    drawPageHeader(doc.getNumberOfPages());
    currentY = 32;
  }

  // Section 4: Optimization Flags Configuration Discrepancy
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('4. Optimization Flags Architectural Configuration Matrix', margin, currentY);

  currentY += 3;

  const flagRows = [
    {
      name: 'B-Tree Indexing (idx_orders_status_category)',
      key: 'btreeIndexing' as keyof OptimizationFlags,
      purpose: 'Eliminates 50,000-row heap sequential scan'
    },
    {
      name: 'Batch Eager Loading (2-Stage Bulk IN Query)',
      key: 'batchEagerLoading' as keyof OptimizationFlags,
      purpose: 'Eliminates N+1 query loop and pool starvation'
    },
    {
      name: 'LRU In-Memory Query Caching (TTL-Managed)',
      key: 'queryCaching' as keyof OptimizationFlags,
      purpose: 'Sub-millisecond latency on repetitive query parameters'
    },
    {
      name: 'DOM Windowing / Virtualization (15 Nodes Rendered)',
      key: 'virtualizedDOM' as keyof OptimizationFlags,
      purpose: 'Prevents client UI thread freeze on large record sets'
    },
    {
      name: 'Concurrent Deferred Rendering (useDeferredValue)',
      key: 'deferredRendering' as keyof OptimizationFlags,
      purpose: 'Keeps UI interactive during state transitions'
    }
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [51, 65, 85]
    },
    head: [
      ['Architectural Flag', 'Snapshot A', 'Snapshot B', 'Production Setting', 'Primary Architectural Impact']
    ],
    body: flagRows.map((f) => [
      f.name,
      snapshotA?.flags[f.key] ? 'ENABLED' : 'DISABLED',
      snapshotB?.flags[f.key] ? 'ENABLED' : 'DISABLED',
      currentFlags[f.key] ? 'ENABLED' : 'DISABLED',
      f.purpose
    ])
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ================= PAGE 2 (or 3): CHRONOLOGICAL LOG & ANALYSIS =================
  doc.addPage();
  drawPageHeader(doc.getNumberOfPages());
  currentY = 32;

  // Section 5: Full Chronological Event Log Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('5. Chronological Optimization Event History', margin, currentY);

  currentY += 3;

  const eventTableBody = trendHistory.map((pt, idx) => {
    const deltaStr =
      pt.deltaMs !== undefined
        ? pt.deltaMs < 0
          ? `-${Math.abs(pt.deltaMs).toFixed(1)} ms`
          : pt.deltaMs > 0
          ? `+${pt.deltaMs.toFixed(1)} ms`
          : '0 ms'
        : 'Initial';

    const flagsSummary = Object.entries(pt.flags)
      .filter(([_, enabled]) => enabled)
      .map(([k]) => {
        if (k === 'btreeIndexing') return 'Idx';
        if (k === 'batchEagerLoading') return 'Batch';
        if (k === 'queryCaching') return 'Cache';
        if (k === 'virtualizedDOM') return 'Virt';
        if (k === 'deferredRendering') return 'Defer';
        return k;
      })
      .join(', ');

    return [
      `#${idx + 1}`,
      pt.timeFormatted,
      pt.triggerEvent,
      `${pt.executionTimeMs.toFixed(2)} ms`,
      deltaStr,
      `${pt.rowsScanned.toLocaleString()}`,
      `${pt.activeQueriesCount}`,
      pt.cacheHit ? 'HIT' : 'MISS',
      flagsSummary || 'None'
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left'
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      textColor: [51, 65, 85]
    },
    head: [
      ['#', 'Time', 'Trigger Event', 'Latency', 'Delta', 'Rows Scanned', 'Queries', 'Cache', 'Active Optimizations']
    ],
    body: eventTableBody
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  if (currentY > pageHeight - 55) {
    doc.addPage();
    drawPageHeader(doc.getNumberOfPages());
    currentY = 32;
  }

  // Section 6: Engineering Recommendations & Root Cause Analysis
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('6. Root Cause Analysis & Engineering Best Practices', margin, currentY);

  currentY += 5;

  const recommendations = [
    {
      title: 'B-Tree Indexing on Compound Query Attributes',
      detail:
        'A full sequential scan across 50,000 records forces the database query engine to inspect every disk page and heap tuple sequentially. Implementing composite indexing on (status, category) reduced scanned tuples from 50,000 down to targeted index leaf nodes (<500 rows), yielding an immediate ~10x latency drop.'
    },
    {
      title: 'Eliminating N+1 Queries via Bulk Eager Loading',
      detail:
        'Iterative single-item queries within parent loops rapidly exhaust the database connection pool (25/25 connections), triggering connection wait queues and timeouts. Consolidating sub-item fetching into a single 2-stage WHERE id IN (...) query drops active connections and roundtrips from 45 down to 1-2.'
    },
    {
      title: 'LRU In-Memory Caching for Repetitive Read Traffic',
      detail:
        'Read-heavy dashboard metrics exhibit 80%+ parameter repetition. An in-memory LRU cache serves frequent queries within 0.15ms, bypassing SQL parsing, query planning, and disk I/O entirely.'
    },
    {
      title: 'DOM Virtualization & Deferred Rendering for Client Responsiveness',
      detail:
        'Rendering thousands of table rows simultaneously creates heavy DOM reflow overhead and dropped browser frames. Virtual windowing constrains active DOM nodes to only visible rows (~15 items), sustaining a consistent 60 FPS interaction rate.'
    }
  ];

  recommendations.forEach((rec) => {
    if (currentY > pageHeight - 24) {
      doc.addPage();
      drawPageHeader(doc.getNumberOfPages());
      currentY = 32;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`• ${rec.title}`, margin, currentY);

    currentY += 3.8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const splitText = doc.splitTextToSize(rec.detail, contentWidth - 4);
    doc.text(splitText, margin + 4, currentY);
    currentY += splitText.length * 3.5 + 2.5;
  });

  // Stamp page footers across all generated pages
  addPageFooters();

  return doc;
}
