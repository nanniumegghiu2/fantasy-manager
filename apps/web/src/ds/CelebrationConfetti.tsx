import { useMemo } from "react";
import { motion } from "framer-motion";
import { Crown, Star, Trophy } from "lucide-react";

interface Particle {
  id: number;
  x: number; // %
  size: number;
  delay: number;
  duration: number;
  rotation: number;
  color: string;
  type: "rect" | "star" | "trophy" | "crown";
}

const COLORS = [
  "#f5c518", // Oro brillante
  "#ffe066", // Giallo champagne
  "#ffffff", // Bianco lucido
  "#ffab00", // Ambra
  "#3ddc6b", // Smeraldo festivo
  "#38bdf8", // Azzurro vittoria
];

export function CelebrationConfetti() {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: 50 }, (_, i) => {
      const isSpecial = i % 8 === 0;
      return {
        id: i,
        x: Math.random() * 100,
        size: isSpecial ? 18 + Math.random() * 12 : 8 + Math.random() * 10,
        delay: Math.random() * 2,
        duration: 2.8 + Math.random() * 2.5,
        rotation: Math.random() * 720 - 360,
        color: COLORS[i % COLORS.length]!,
        type: i % 12 === 0 ? "trophy" : i % 10 === 0 ? "crown" : i % 5 === 0 ? "star" : "rect",
      };
    });
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {/* Raggi di luce dorata di sfondo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.35, scale: 1.2, rotate: 360 }}
        transition={{
          rotate: { duration: 30, repeat: Infinity, ease: "linear" },
          opacity: { duration: 1 },
          scale: { duration: 1.5, ease: "easeOut" },
        }}
        className="absolute -inset-1/2 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(245, 197, 24, 0.15) 30deg, transparent 60deg, rgba(255, 234, 0, 0.2) 90deg, transparent 120deg, rgba(245, 197, 24, 0.15) 180deg, transparent 210deg, rgba(255, 215, 0, 0.2) 270deg, transparent 300deg)",
        }}
      />

      {/* Particelle di coriandoli e stelle in caduta */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: "-10vh", x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 0.5 }}
          animate={{
            y: "110vh",
            x: `${p.x + (p.id % 2 === 0 ? 8 : -8)}vw`,
            rotate: p.rotation,
            opacity: [1, 1, 0.9, 0],
            scale: [0.6, 1.1, 1, 0.7],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeIn",
          }}
          className="absolute top-0 flex items-center justify-center"
          style={{ color: p.color }}
        >
          {p.type === "star" ? (
            <Star size={p.size} className="fill-current drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]" />
          ) : p.type === "trophy" ? (
            <Trophy size={p.size} className="fill-current drop-shadow-[0_0_10px_rgba(245,197,24,0.9)]" />
          ) : p.type === "crown" ? (
            <Crown size={p.size} className="fill-current drop-shadow-[0_0_10px_rgba(255,215,0,0.9)]" />
          ) : (
            <span
              className="block rounded-sm drop-shadow-md"
              style={{
                width: `${p.size}px`,
                height: `${p.size * 1.6}px`,
                backgroundColor: p.color,
              }}
            />
          )}
        </motion.div>
      ))}

      {/* Flash visivi di festa */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.25, 0, 0.15, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        className="absolute inset-0 bg-gradient-to-t from-[#f5c518]/20 via-transparent to-[#f5c518]/10"
      />
    </div>
  );
}
