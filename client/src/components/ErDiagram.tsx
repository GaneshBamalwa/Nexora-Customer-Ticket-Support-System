import React, { useState, useRef, useCallback } from "react";

const HEADER_H = 40;
const ROW_H    = 33;
const CANVAS_W = 1080;

const tables = [
  {
    id: "Customers",
    name: "CUSTOMERS",
    x: 60, y: 60, width: 280,
    columns: [
      { name: "Customer_ID", type: "int",     key: "PK" },
      { name: "Name",        type: "varchar", key: "" },
      { name: "Email_ID",    type: "varchar", key: "" },
    ],
  },
  {
    id: "Support_Agents",
    name: "SUPPORT_AGENTS",
    x: 700, y: 60, width: 310,
    columns: [
      { name: "Agent_ID",         type: "int",     key: "PK" },
      { name: "Name",             type: "varchar", key: "" },
      { name: "Email_ID",         type: "varchar", key: "" },
      { name: "Role",             type: "varchar", key: "" },
      { name: "Password",         type: "varchar", key: "" },
      { name: "Is_Temp_Password", type: "boolean", key: "" },
    ],
  },
  {
    id: "Tickets",
    name: "TICKETS",
    x: 280, y: 350, width: 300,
    columns: [
      { name: "Ticket_ID",    type: "int",       key: "PK" },
      { name: "Customer_ID", type: "int",        key: "FK" },
      { name: "Agent_ID",    type: "int",        key: "FK" },
      { name: "Subject",     type: "varchar",    key: "" },
      { name: "Description", type: "text",       key: "" },
      { name: "Status",      type: "varchar",    key: "" },
      { name: "Priority",    type: "varchar",    key: "" },
      { name: "FollowUpCount",type:"int",        key: "" },
      { name: "Rating",      type: "int",        key: "" },
      { name: "Created_Date",type: "timestamp",  key: "" },
      { name: "Assigned_At", type: "datetime",   key: "" },
      { name: "Resolved_At", type: "datetime",   key: "" },
      { name: "Due_Date",    type: "datetime",   key: "" },
    ],
  },
  {
    id: "Ticket_Conversations",
    name: "TICKET_CONVERSATIONS",
    x: 280, y: 1020, width: 300,
    columns: [
      { name: "Message_ID",   type: "int",       key: "PK" },
      { name: "Ticket_ID",    type: "int",        key: "FK" },
      { name: "Sender_Role",  type: "varchar",   key: "" },
      { name: "Message_Text", type: "text",      key: "" },
      { name: "Timestamp",    type: "timestamp", key: "" },
    ],
  },
  {
    id: "Password_Change_Requests",
    name: "PASSWORD_CHANGE_REQUESTS",
    x: 700, y: 550, width: 310,
    columns: [
      { name: "Request_ID",   type: "int",       key: "PK" },
      { name: "Agent_ID",     type: "int",        key: "FK" },
      { name: "Status",       type: "varchar",   key: "" },
      { name: "Requested_At", type: "timestamp", key: "" },
    ],
  },
];

const connections = [
  { from: "Customers",      fromPort: "bottom", to: "Tickets",                  toPort: "top",   label: "raises" },
  { from: "Support_Agents", fromPort: "left",   to: "Tickets",                  toPort: "right", label: "assigned to" },
  { from: "Support_Agents", fromPort: "bottom", to: "Password_Change_Requests", toPort: "top",   label: "requests" },
  { from: "Tickets",        fromPort: "bottom", to: "Ticket_Conversations",      toPort: "top",   label: "has" },
];

function tableHeight(t: typeof tables[0]) { return HEADER_H + t.columns.length * ROW_H; }

function getPortCoords(table: typeof tables[0], port: string) {
  const h = tableHeight(table);
  if (port === "top")    return { x: table.x + table.width / 2, y: table.y };
  if (port === "bottom") return { x: table.x + table.width / 2, y: table.y + h };
  if (port === "left")   return { x: table.x,               y: table.y + h / 2 };
  if (port === "right")  return { x: table.x + table.width, y: table.y + h / 2 };
  return { x: table.x, y: table.y };
}

function bezierPath(s: {x:number,y:number}, e: {x:number,y:number}, sp: string, ep: string) {
  const o = 80;
  return `M ${s.x} ${s.y} C ${s.x+(sp==="right"?o:sp==="left"?-o:0)} ${s.y+(sp==="bottom"?o:sp==="top"?-o:0)}, ${e.x+(ep==="right"?o:ep==="left"?-o:0)} ${e.y+(ep==="bottom"?o:ep==="top"?-o:0)}, ${e.x} ${e.y}`;
}

function midBezier(s: {x:number,y:number}, e: {x:number,y:number}, sp: string, ep: string) {
  const o = 80;
  const c1x = s.x+(sp==="right"?o:sp==="left"?-o:0), c1y = s.y+(sp==="bottom"?o:sp==="top"?-o:0);
  const c2x = e.x+(ep==="right"?o:ep==="left"?-o:0), c2y = e.y+(ep==="bottom"?o:ep==="top"?-o:0);
  return { x:0.125*s.x+0.375*c1x+0.375*c2x+0.125*e.x, y:0.125*s.y+0.375*c1y+0.375*c2y+0.125*e.y };
}

function maskValue(colName: string, value: any): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-slate-600 italic">NULL</span>;
  if (/password/i.test(colName)) return <span className="text-slate-600 tracking-widest">••••••••</span>;
  const s = String(value);
  return s.length > 38 ? s.slice(0, 38) + "…" : s;
}

const CANVAS_H = Math.max(...tables.map(t => t.y + tableHeight(t))) + 60;
const TOOLTIP_W = 380;

interface TableMetadata { columns: string[]; rows: any[] }
interface Props { metadata: Record<string, TableMetadata> }

export default function ErDiagram({ metadata }: Props) {
  const [activeId,   setActiveId]   = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; flipY: boolean }>({ x: 0, y: 0, flipY: false });

  const overTable   = useRef(false);
  const overTooltip = useRef(false);
  const showTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!overTable.current && !overTooltip.current) setActiveId(null);
    }, 150);
  }, []);

  const handleTableEnter = (table: typeof tables[0]) => {
    overTable.current = true;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (showTimer.current) clearTimeout(showTimer.current);

    showTimer.current = setTimeout(() => {
      // Try right side first; fallback to left; then clamp within canvas
      let tx = table.x + table.width + 18;
      if (tx + TOOLTIP_W > CANVAS_W) {
        tx = table.x - TOOLTIP_W - 18;
      }
      // Hard clamp — never overflow canvas bounds
      tx = Math.max(10, Math.min(tx, CANVAS_W - TOOLTIP_W - 10));

      // Flip y upward if tooltip would spill below canvas bottom
      const tH = tableHeight(table);
      const flipY = (table.y + tH + 280) > CANVAS_H;
      const ty = flipY ? table.y + tH : table.y;

      setTooltipPos({ x: tx, y: ty, flipY });
      setActiveId(table.id);
    }, 500);
  };

  const handleTableLeave = () => {
    overTable.current = false;
    if (showTimer.current) clearTimeout(showTimer.current);
    scheduleHide();
  };

  const handleTooltipEnter = () => {
    overTooltip.current = true;
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  const handleTooltipLeave = () => {
    overTooltip.current = false;
    scheduleHide();
  };

  const activeTable = tables.find(t => t.id === activeId) ?? null;
  const preview = activeTable
    ? (metadata[activeTable.id] ?? { columns: activeTable.columns.map(c => c.name), rows: [] })
    : null;

  return (
    <div className="relative w-full mb-8">
      {/* Legend */}
      <div className="flex items-center gap-6 mb-3 px-1 flex-wrap">
        <span className="text-sm font-semibold text-[#00e5ff] font-syne">Entity Relationship Diagram</span>
        <span className="text-xs text-amber-400 font-bold">PK <span className="text-slate-400 font-normal">Primary Key</span></span>
        <span className="text-xs text-purple-400 font-bold">FK <span className="text-slate-400 font-normal">Foreign Key</span></span>
        <span className="ml-auto text-xs text-slate-500 italic">Hover a table to preview its data</span>
      </div>

      {/* Full-height canvas — no scroll */}
      <div
        className="relative rounded-xl border border-white/10 bg-[#020818]/60 overflow-x-auto"
        style={{ minHeight: CANVAS_H }}
      >
        {/* dot grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{ backgroundImage:"radial-gradient(circle, white 1px, transparent 0)", backgroundSize:"36px 36px" }} />

        {/* Inner canvas — fixed width */}
        <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>

          {/* SVG connections */}
          <svg className="absolute inset-0 pointer-events-none z-0" width={CANVAS_W} height={CANVAS_H}>
            <defs>
              <marker id="er-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#00e5ff" opacity="0.9" />
              </marker>
              <filter id="er-glow">
                <feGaussianBlur stdDeviation="3" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            {connections.map((conn, i) => {
              const fT = tables.find(t => t.id===conn.from)!;
              const tT = tables.find(t => t.id===conn.to)!;
              const s = getPortCoords(fT, conn.fromPort);
              const e = getPortCoords(tT, conn.toPort);
              const d = bezierPath(s, e, conn.fromPort, conn.toPort);
              const m = midBezier(s, e, conn.fromPort, conn.toPort);
              return (
                <g key={i}>
                  <path d={d} stroke="#00e5ff" strokeWidth="6" fill="none" opacity="0.07" filter="url(#er-glow)"/>
                  <path d={d} stroke="#00e5ff" strokeWidth="2" fill="none" opacity="0.65" strokeDasharray="7 4" markerEnd="url(#er-arrow)"/>
                  <rect x={m.x-32} y={m.y-10} width={64} height={18} rx={4} fill="#040f2a" opacity="0.92"/>
                  <text x={m.x} y={m.y+4} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace">{conn.label}</text>
                  <circle cx={s.x} cy={s.y} r="4.5" fill="#00e5ff" opacity="0.9"/>
                </g>
              );
            })}
          </svg>

          {/* Table cards */}
          {tables.map(table => (
            <div
              key={table.id}
              className={`absolute z-10 rounded-lg overflow-hidden transition-all duration-200 cursor-pointer select-none border
                ${activeId===table.id
                  ? "border-[#00e5ff]/80 shadow-[0_0_32px_rgba(0,229,255,0.25)] scale-[1.02]"
                  : "border-[#00e5ff]/25 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"}`}
              style={{ left: table.x, top: table.y, width: table.width }}
              onMouseEnter={() => handleTableEnter(table)}
              onMouseLeave={handleTableLeave}
            >
              <div className="bg-[#00e5ff]/10 border-b border-[#00e5ff]/25 h-[40px] flex items-center justify-center text-[#00e5ff] font-syne font-bold text-[0.72rem] tracking-widest">
                {table.name}
              </div>
              <div className="bg-[#060f24] divide-y divide-white/[0.04]">
                {table.columns.map((col, i) => (
                  <div key={i} className="flex items-center px-4 h-[33px] text-[0.7rem]">
                    <span className="w-[90px] text-slate-500 font-mono shrink-0">{col.type}</span>
                    <span className="flex-1 text-slate-200 font-medium truncate">{col.name}</span>
                    <span className={`w-7 text-right font-bold text-[0.65rem] shrink-0
                      ${col.key==="PK"?"text-amber-400":col.key==="FK"?"text-purple-400":""}`}>
                      {col.key}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Tooltip — absolute INSIDE the canvas div so coords are always stable */}
          {activeTable && preview && (
            <div
              className="absolute z-50 cursor-default"
              style={{
                left: tooltipPos.x,
                width: TOOLTIP_W,
                // flip upward when near canvas bottom
                ...(tooltipPos.flipY
                  ? { bottom: CANVAS_H - tooltipPos.y }
                  : { top: tooltipPos.y }),
              }}
              onMouseEnter={handleTooltipEnter}
              onMouseLeave={handleTooltipLeave}
            >
              <div className="bg-[#03091e]/97 border border-[#00e5ff]/35 rounded-xl shadow-[0_8px_50px_rgba(0,229,255,0.14)] backdrop-blur-md overflow-hidden">
                {/* header */}
                <div className="px-4 py-2.5 border-b border-[#00e5ff]/20 bg-[#00e5ff]/[0.06] flex items-center justify-between">
                  <span className="text-[#00e5ff] font-syne font-bold text-xs tracking-wider">{activeTable.name}</span>
                  <span className="text-slate-500 text-[0.65rem]">
                    {preview.rows.length > 0 ? `${preview.rows.length} row${preview.rows.length>1?"s":""} preview` : "empty table"}
                  </span>
                </div>
                {/* data */}
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left border-collapse text-[0.68rem]">
                    <thead>
                      <tr className="bg-white/[0.04] border-b border-white/10 sticky top-0">
                        {preview.columns.map(c => (
                          <th key={c} className="px-3 py-2 text-slate-400 font-semibold font-mono whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.length === 0
                        ? <tr><td colSpan={preview.columns.length} className="px-3 py-5 text-center text-slate-500 italic">No entries in this table</td></tr>
                        : preview.rows.map((row, ri) => (
                          <tr key={ri} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                            {preview.columns.map(c => (
                              <td key={c} className="px-3 py-2 text-slate-300 whitespace-nowrap">{maskValue(c, row[c])}</td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
