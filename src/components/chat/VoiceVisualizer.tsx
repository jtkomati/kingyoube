import { useEffect, useRef } from 'react';

interface VoiceVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
}

export function VoiceVisualizer({ isActive, isSpeaking }: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const barsRef = useRef<number[]>(Array(50).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;
      const barCount = 50;
      const barWidth = width / barCount;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < barCount; i++) {
        // Animação mais intensa quando está falando
        const targetHeight = isSpeaking 
          ? Math.random() * height * 0.8 
          : isActive 
            ? Math.random() * height * 0.2 
            : 0;
        
        // Suavizar transição
        barsRef.current[i] += (targetHeight - barsRef.current[i]) * 0.2;
        
        const barHeight = Math.max(2, barsRef.current[i]);
        const x = i * barWidth;
        const y = (height - barHeight) / 2;

        // Gradiente vermelho inspirado no "Her"
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
        gradient.addColorStop(0.5, 'rgba(220, 38, 38, 1)');
        gradient.addColorStop(1, 'rgba(185, 28, 28, 0.8)');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth - 2, barHeight);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isSpeaking]);

  return (
    <div className="relative w-full h-32 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={800}
        height={128}
        className="w-full h-full"
        style={{ filter: 'blur(0.5px)' }}
      />
    </div>
  );
}
