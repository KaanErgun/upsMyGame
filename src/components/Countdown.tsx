import { useState, useEffect } from 'react';

interface CountdownProps {
  onComplete: () => void;
}

export default function Countdown({ onComplete }: CountdownProps) {
  const [count, setCount] = useState(3);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (count <= 0) {
      onComplete();
      return;
    }

    setScale(1.3);
    const shrinkTimer = setTimeout(() => setScale(1), 150);
    const nextTimer = setTimeout(() => setCount(c => c - 1), 800);

    return () => {
      clearTimeout(shrinkTimer);
      clearTimeout(nextTimer);
    };
  }, [count, onComplete]);

  if (count <= 0) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative text-8xl font-black text-white transition-transform duration-150"
        style={{
          transform: `scale(${scale})`,
          textShadow: '0 0 40px rgba(56, 189, 248, 0.5)',
        }}
      >
        {count}
      </div>
    </div>
  );
}
