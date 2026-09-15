import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion } from 'motion/react';

const BG = '#0b0f14';
const FG = '#e6edf3';
const MUTED = '#94a3b8';
const LINE = '#1e293b';
const CARD = '#111827';
const ACCENT = '#1d4ed8';
const RED = '#ef4444';
const GREEN = '#22c55e';
const AMBER = '#f59e0b';

const ease = [0.22, 1, 0.36, 1] as const;

function useClock() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const handler = (event: Event) => setT((event as CustomEvent<number>).detail);
    window.addEventListener('dm-tick', handler);
    return () => window.removeEventListener('dm-tick', handler);
  }, []);
  return t;
}

function Scene({ children, show, hide }: { children: React.ReactNode; show: number; hide: number; }) {
  const t = useClock();
  const fadeInStart = show - 700;
  const fadeOutEnd = hide + 500;
  if (t < fadeInStart || t > fadeOutEnd) {
    return null;
  }
  const opacity = t < show ? Math.max(0, (t - fadeInStart) / 700) : t > hide ? Math.max(0, (fadeOutEnd - t) / 500) : 1;
  return <div style={{ position: 'absolute', inset: 0, opacity }}>{children}</div>;
}

function enter(delay: number, options: { y?: number; duration?: number; scale?: number } = {}) {
  return {
    initial: { opacity: 0, y: options.y ?? 26, scale: options.scale ?? 1 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { delay, duration: options.duration ?? 0.7, ease },
  };
}

function Caption({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.div
      {...enter(delay, { y: 14 })}
      style={{ position: 'absolute', left: 160, top: 926, color: MUTED, fontSize: 26, fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '0.01em' }}
    >
      {text}
    </motion.div>
  );
}

function Mono({ children, color = '#cbd5e1', size = 30 }: { children: React.ReactNode; color?: string; size?: number }) {
  return <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color, fontSize: size }}>{children}</span>;
}

function TitleScene() {
  return (
    <Scene show={0} hide={6400}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <motion.div
          initial={{ scale: 1.12, opacity: 0, filter: 'blur(8px)' }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.2, ease }}
          style={{ fontSize: 150, fontWeight: 650, letterSpacing: '-0.04em', color: FG }}
        >
          Design Memory
        </motion.div>
        <motion.div {...enter(0.6)} style={{ marginTop: 26, fontSize: 34, color: MUTED }}>
          Deterministic guardrails and memory for the agents writing your UI
        </motion.div>
        <motion.div {...enter(1.1)} style={{ marginTop: 44, display: 'flex', gap: 16 }}>
          {['MCP server', 'net-new-only', 'local-first', 'DTCG-native'].map((label) => (
            <span key={label} style={{ border: `1px solid ${LINE}`, borderRadius: 999, padding: '10px 22px', color: '#cbd5e1', fontSize: 22 }}>
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </Scene>
  );
}

function DashboardScene() {
  return (
    <Scene show={6400} hide={15200}>
      <div style={{ position: 'absolute', inset: 0, padding: '110px 150px', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <motion.div {...enter(0.7, { y: 40 })} style={{ border: `1px solid ${LINE}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.5)' }}>
          <img src="./assets/app-suppliers.png" style={{ width: '100%', display: 'block' }} />
        </motion.div>
        <motion.div {...enter(1.5)} style={{ position: 'absolute', left: 176, top: 700, background: 'rgba(11,15,20,0.92)', border: `1px solid ${LINE}`, borderRadius: 12, padding: '18px 24px' }}>
          <div style={{ color: FG, fontSize: 30, fontWeight: 600 }}>Northwind Procurement Console</div>
          <div style={{ color: MUTED, fontSize: 24, marginTop: 6 }}>React 19 · Tailwind v4 · 36 DTCG tokens · 6 component contracts</div>
        </motion.div>
      </div>
      <Caption text="A product surface agents are asked to extend every day." delay={2.2} />
    </Scene>
  );
}

function EditScene() {
  return (
    <Scene show={15200} hide={27600}>
      <div style={{ position: 'absolute', inset: 0, padding: '110px 170px', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <motion.div {...enter(0.3)} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ width: 12, height: 12, borderRadius: 999, background: AMBER }} />
          <span style={{ color: FG, fontSize: 34, fontWeight: 600 }}>Agent task: add a savings column with a muted teal accent</span>
        </motion.div>

        <motion.div {...enter(0.9)} style={{ marginTop: 44, background: '#0f172a', border: `1px solid ${LINE}`, borderRadius: 16, padding: '36px 42px' }}>
          <div style={{ marginTop: 10 }}><Mono color={MUTED}>// src/ui/DataTable.tsx</Mono></div>
          <motion.div {...enter(1.4, { y: 10, duration: 0.45 })} style={{ marginTop: 18 }}><Mono>{'<div className="overflow-x-auto rounded-md border'}</Mono></motion.div>
          <motion.div {...enter(1.7, { y: 10, duration: 0.45 })} style={{ marginTop: 18 }}>
            <Mono>{'  border-border bg-surface '}</Mono>
            <motion.span initial={{ backgroundColor: 'rgba(239,68,68,0)', color: '#cbd5e1' }} animate={{ backgroundColor: 'rgba(239,68,68,0.22)', color: '#fca5a5' }} transition={{ delay: 2.4, duration: 0.6 }} style={{ padding: '4px 8px', borderRadius: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 30 }}>text-[#0f766e]</motion.span>
            <Mono>{'"'}</Mono>
          </motion.div>
          <motion.div {...enter(2, { y: 10, duration: 0.45 })} style={{ marginTop: 18 }}><Mono>{'</div>'}</Mono></motion.div>
        </motion.div>

        <motion.div {...enter(3.2)} style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Mono color={MUTED} size={28}>$</Mono>
          <Mono size={28}>design-memory audit</Mono>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 4.2, duration: 0.6, ease }}
          style={{ marginTop: 26, border: '1px solid #7f1d1d', background: '#1c0f0f', borderRadius: 16, padding: '30px 36px', width: 1180 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: RED, fontSize: 34, fontWeight: 700 }}>✗ blocked</span>
            <span style={{ color: '#fca5a5', fontSize: 26, fontFamily: 'ui-monospace, Menlo, monospace' }}>color.raw-hex</span>
            <span style={{ marginLeft: 'auto', background: '#450a0a', color: '#fecaca', borderRadius: 999, padding: '6px 16px', fontSize: 22 }}>wouldBlock: true</span>
          </div>
          <div style={{ marginTop: 16, color: '#e2e8f0', fontSize: 26 }}>src/ui/DataTable.tsx:16</div>
          <div style={{ marginTop: 8, color: MUTED, fontSize: 26 }}>
            Replace <Mono color="#fca5a5" size={26}>text-[#0f766e]</Mono> with <Mono color={GREEN} size={26}>text-info</Mono> (token color.info)
          </div>
        </motion.div>
      </div>
      <Caption text="The gate is deterministic. No model decides this." delay={3.4} />
    </Scene>
  );
}

function McpScene() {
  return (
    <Scene show={27600} hide={39600}>
      <div style={{ position: 'absolute', inset: 0, padding: '110px 170px', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <motion.div {...enter(0.3)} style={{ color: FG, fontSize: 34, fontWeight: 600 }}>The agent asks before it writes again</motion.div>

        <motion.div {...enter(0.8)} style={{ marginTop: 40, background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: '30px 36px' }}>
          <Mono color="#93c5fd" size={28}>dm_get_context</Mono>
          <Mono color={MUTED} size={28}>{'  { paths: ["src/ui/DataTable.tsx"] }'}</Mono>
          <div style={{ marginTop: 18, display: 'flex', gap: 14 }}>
            {['tokens 20', 'contracts 1', 'decisions 1', 'response 2.5 KB (measured)'].map((chip, index) => (
              <motion.span key={chip} {...enter(1.3 + index * 0.18, { y: 12, duration: 0.4 })} style={{ border: '1px solid #1f3a8a', background: '#0f1b3d', color: '#bfdbfe', borderRadius: 999, padding: '8px 18px', fontSize: 22, fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {chip}
              </motion.span>
            ))}
          </div>
        </motion.div>

        <motion.div {...enter(2.6)} style={{ marginTop: 26, background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: '30px 36px' }}>
          <Mono color="#93c5fd" size={28}>dm_suggest_token</Mono>
          <Mono color={MUTED} size={28}>{'  { value: "#0f766e", kind: "color" }'}</Mono>
          <motion.div {...enter(3.2, { y: 12, duration: 0.4 })} style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 18 }}>
            <Mono color={GREEN} size={30}>exact: none</Mono>
            <Mono color="#bfdbfe" size={30}>near: color.info #0e7490 · text-info · score 0.95</Mono>
          </motion.div>
        </motion.div>

        <motion.div {...enter(4.2)} style={{ marginTop: 34, background: '#0f172a', border: `1px solid ${LINE}`, borderRadius: 16, padding: '34px 42px' }}>
          <div style={{ marginTop: 6 }}><Mono>{'<div className="overflow-x-auto rounded-md border'}</Mono></div>
          <motion.div {...enter(4.6, { y: 10, duration: 0.45 })} style={{ marginTop: 18 }}>
            <Mono>{'  border-border bg-surface '}</Mono>
            <motion.span initial={{ backgroundColor: 'rgba(239,68,68,0.22)', color: '#fca5a5' }} animate={{ backgroundColor: 'rgba(34,197,94,0.18)', color: '#86efac' }} transition={{ delay: 5.4, duration: 0.8 }} style={{ padding: '4px 8px', borderRadius: 8, fontSize: 30, fontFamily: 'ui-monospace, Menlo, monospace' }}>
              text-info
            </motion.span>
            <Mono>{'"'}</Mono>
          </motion.div>
        </motion.div>
      </div>
      <Caption text="Repairs come from the system's own vocabulary, not the model's memory." delay={4.4} />
    </Scene>
  );
}

function MemoryScene() {
  return (
    <Scene show={39600} hide={51600}>
      <div style={{ position: 'absolute', inset: 0, padding: '110px 170px', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <motion.div {...enter(0.3)} style={{ color: FG, fontSize: 34, fontWeight: 600 }}>Accepted drift becomes memory with a lifecycle</motion.div>

        <motion.div {...enter(0.8)} style={{ marginTop: 40, background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: '34px 40px', width: 1220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ background: '#14532d', color: '#bbf7d0', borderRadius: 999, padding: '6px 18px', fontSize: 22, fontWeight: 600 }}>ACTIVE</span>
            <Mono color={MUTED} size={26}>dec_8c0fb886c366</Mono>
            <span style={{ marginLeft: 'auto', color: MUTED, fontSize: 24 }}>recorded via dm_record_decision</span>
          </div>
          <div style={{ marginTop: 22, color: FG, fontSize: 27, lineHeight: 1.6 }}>
            <strong>Target</strong> <Mono color={MUTED} size={26}>src/ui/DataTable.tsx · value 13px</Mono><br />
            <strong>Reason</strong> Dense numeric columns use a 13px step for scanability, reviewed by design.<br />
            <strong>Token dependency</strong> <Mono color={MUTED} size={26}>fontSize.sm = 14px at creation</Mono>
          </div>
        </motion.div>

        <motion.div {...enter(2.2)} style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ background: '#14532d', color: '#bbf7d0', borderRadius: 999, padding: '8px 20px', fontSize: 24 }}>active</span>
          <Mono color={MUTED} size={30}>→ fontSize.sm changes →</Mono>
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.8, duration: 0.6 }} style={{ background: '#450a0a', color: '#fecaca', borderRadius: 999, padding: '8px 20px', fontSize: 24 }}>
            invalidated · blocks again until re-reviewed
          </motion.span>
        </motion.div>

        <motion.div {...enter(4.6)} style={{ marginTop: 34, border: '1px solid #14532d', background: '#0d1a12', borderRadius: 14, padding: '22px 30px', width: 940 }}>
          <Mono color={GREEN} size={28}>✓ 8 MCP tests · 14 bake scenarios · deterministic in CI</Mono>
        </motion.div>
      </div>
      <Caption text="Expiry, invalidation, and supersede chains are enforced, not documented." delay={2.0} />
    </Scene>
  );
}

function CloseScene() {
  return (
    <Scene show={51600} hide={63000}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <motion.div {...enter(0.3)} style={{ background: '#0f172a', border: `1px solid ${LINE}`, borderRadius: 16, padding: '34px 48px' }}>
          <Mono color={GREEN} size={34}>✓ No design-system drift found.</Mono>
          <Mono color={MUTED} size={30}>{'   exit 0'}</Mono>
        </motion.div>
        <motion.div {...enter(1.3)} style={{ marginTop: 54, fontSize: 84, fontWeight: 650, letterSpacing: '-0.03em', color: FG }}>
          Design Memory
        </motion.div>
        <motion.div {...enter(1.8)} style={{ marginTop: 18, fontSize: 30, color: MUTED }}>
          Deterministic gate · agent-readable memory · MCP-native
        </motion.div>
        <motion.div {...enter(2.3)} style={{ marginTop: 40 }}>
          <span style={{ border: `1px solid ${LINE}`, borderRadius: 999, padding: '12px 26px', color: '#cbd5e1', fontSize: 26 }}>
            github.com/derinbarutcu17/DesignMemory
          </span>
        </motion.div>
      </div>
    </Scene>
  );
}

function App() {
  return (
    <div style={{ position: 'relative', width: 1920, height: 1080, background: BG, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(1200px 700px at 70% -10%, rgba(29,78,216,0.16), transparent 60%)' }} />
      <TitleScene />
      <DashboardScene />
      <EditScene />
      <McpScene />
      <MemoryScene />
      <CloseScene />
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
