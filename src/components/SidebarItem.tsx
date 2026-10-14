import { cn } from '../lib/utils.ts';

export function SidebarItem({ label, sub, active, onClick }: { label: string, sub: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-3.5 rounded-2xl transition-all",
        active ? "bg-surface-card shadow-sm" : "hover:bg-white/50"
      )}
    >
      <div className="text-left flex-1">
        <p className={cn("text-xs font-bold", active ? "text-accent-impact" : "text-text-primary")}>{label}</p>
        <p className={cn("text-[8px] font-bold uppercase tracking-widest mt-0.5", active ? "text-accent-impact/60" : "text-text-hint")}>{sub}</p>
      </div>
      {active && <div className="w-1.5 h-1.5 bg-btn-primary rounded-full shrink-0 ml-2" />}
    </button>
  );
}
