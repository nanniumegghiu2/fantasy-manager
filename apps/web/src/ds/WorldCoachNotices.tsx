import { motion } from "framer-motion";
import { Newspaper, UserCheck, XCircle } from "lucide-react";
import type { WorldCoachNotice } from "@app/game-engine";

interface WorldCoachNoticesProps {
  notices: WorldCoachNotice[];
}

export function WorldCoachNotices({ notices }: WorldCoachNoticesProps) {
  if (!notices || notices.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 my-2">
      {notices.map((n) => {
        const isEsonero = n.kind === "esonero" || n.kind === "dimissioni";

        return (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-start gap-3 rounded-2xl border p-3.5 shadow-sm text-xs ${
              isEsonero
                ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {isEsonero ? (
              <XCircle size={18} className="shrink-0 text-rose-400 mt-0.5" />
            ) : (
              <UserCheck size={18} className="shrink-0 text-emerald-400 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Newspaper size={13} className="opacity-80" />
                <span className="font-bold tracking-wider uppercase text-[10px]">
                  {n.kind === "esonero"
                    ? "Notiziario Panchine — Esonero"
                    : n.kind === "dimissioni"
                      ? "Notiziario Panchine — Dimissioni"
                      : "Notiziario Panchine — Nuovo Ingaggio"}
                </span>
              </div>
              <p className="font-medium leading-relaxed">{n.message}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
