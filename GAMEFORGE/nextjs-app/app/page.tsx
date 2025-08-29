"use client";
import React, { useEffect, useRef, useState } from "react";

/**
 * Simple Pong / Ping-Pong implementation using HTML5 canvas.
 * Player: left paddle (W/S or ArrowUp/ArrowDown or mouse/touch drag).
 * Opponent: CPU (or second-player toggle).
 */

export default function PingPongPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Game config
  const CANVAS_W = 900;
  const CANVAS_H = 540;
  const PADDLE_W = 12;
  const PADDLE_H = 100;
  const BALL_R = 9;
  const WIN_SCORE = 10;

  // State (UI-driven states not inside animation loop state to avoid re-renders)
  const [scoreL, setScoreL] = useState(0);
  const [scoreR, setScoreR] = useState(0);
  const [paused, setPaused] = useState(false);
  const [twoPlayer, setTwoPlayer] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState(0.12); // 0.05 (easy) -> 0.25 (hard)
  const [winner, setWinner] = useState<string | null>(null);

  // Mutable game state (kept in refs)
  const stateRef = useRef({
    // paddles
    leftY: CANVAS_H / 2 - PADDLE_H / 2,
    rightY: CANVAS_H / 2 - PADDLE_H / 2,
    // ball
    ballX: CANVAS_W / 2,
    ballY: CANVAS_H / 2,
    ballVX: 5 * (Math.random() > 0.5 ? 1 : -1),
    ballVY: 2 * (Math.random() > 0.5 ? 1 : -1),
    // keys
    pressingUp: false,
    pressingDown: false,
    pressingW: false,
    pressingS: false,
    // mouse dragging
    dragging: false,
    dragOffsetY: 0,
    // playing
    running: true,
    // speed multiplier (increases slowly)
    speedMultiplier: 1,
  });

  // reset ball to center with direction toward last scorer (dir: -1 left, 1 right, 0 random)
  function resetBall(dir = 0) {
    const s = stateRef.current;
    s.ballX = CANVAS_W / 2;
    s.ballY = CANVAS_H / 2;
    const angle = (Math.random() * Math.PI) / 4 - Math.PI / 8; // -22.5deg .. +22.5deg
    const baseSpeed = 5;
    let sign = Math.random() > 0.5 ? 1 : -1;
    if (dir === 1) sign = 1;
    if (dir === -1) sign = -1;
    s.ballVX = baseSpeed * sign * Math.cos(angle);
    s.ballVY = baseSpeed * Math.sin(angle);
    s.speedMultiplier = 1;
  }

  // restart entire match
  function restartMatch() {
    setScoreL(0);
    setScoreR(0);
    setWinner(null);
    resetBall(0);
  }

  // clamp helper
  const clamp = (v: number, a: number, b: number) =>
    Math.max(a, Math.min(b, v));

  // main loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let lastTs = performance.now();

    const loop = (ts: number) => {
      const s = stateRef.current;
      const delta = Math.min(40, ts - lastTs) / 16.6667; // normalized to ~60fps units
      lastTs = ts;

      if (!s.running || paused || winner) {
        // still render paused screen
        drawFrame(ctx);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Update paddles from keys
      const paddleSpeed = 6 * delta;
      if (s.pressingW) s.leftY -= paddleSpeed;
      if (s.pressingS) s.leftY += paddleSpeed;
      if (s.pressingUp) s.rightY -= paddleSpeed;
      if (s.pressingDown) s.rightY += paddleSpeed;

      // Clamp paddle positions
      s.leftY = clamp(s.leftY, 0, CANVAS_H - PADDLE_H);
      s.rightY = clamp(s.rightY, 0, CANVAS_H - PADDLE_H);

      // AI or second player control for right paddle
      if (!twoPlayer) {
        // simple predictive AI: moves toward ball's y with smoothing
        const centerPaddle = s.rightY + PADDLE_H / 2;
        const deltaY = s.ballY - centerPaddle;
        s.rightY += deltaY * aiDifficulty * delta * (1 + s.speedMultiplier * 0.05);
        s.rightY = clamp(s.rightY, 0, CANVAS_H - PADDLE_H);
      }

      // Move ball
      s.ballX += s.ballVX * s.speedMultiplier;
      s.ballY += s.ballVY * s.speedMultiplier;

      // top/bottom collision
      if (s.ballY - BALL_R <= 0) {
        s.ballY = BALL_R;
        s.ballVY *= -1;
      }
      if (s.ballY + BALL_R >= CANVAS_H) {
        s.ballY = CANVAS_H - BALL_R;
        s.ballVY *= -1;
      }

      // left paddle collision
      if (
        s.ballX - BALL_R <= PADDLE_W &&
        s.ballX - BALL_R >= 0 &&
        s.ballY >= s.leftY &&
        s.ballY <= s.leftY + PADDLE_H
      ) {
        s.ballX = PADDLE_W + BALL_R;
        // reflect with angle depending on hit position
        const relative = (s.ballY - (s.leftY + PADDLE_H / 2)) / (PADDLE_H / 2);
        const bounceAngle = relative * (Math.PI / 3); // up to ±60 degrees
        const speed = Math.hypot(s.ballVX, s.ballVY) * 1.03; // slightly increase speed
        s.ballVX = Math.abs(speed * Math.cos(bounceAngle)); // ensures going right
        s.ballVY = speed * Math.sin(bounceAngle);
        // small speed multiplier increase for gradual difficulty
        s.speedMultiplier *= 1.01;
      }

      // right paddle collision
      if (
        s.ballX + BALL_R >= CANVAS_W - PADDLE_W &&
        s.ballX + BALL_R <= CANVAS_W &&
        s.ballY >= s.rightY &&
        s.ballY <= s.rightY + PADDLE_H
      ) {
        s.ballX = CANVAS_W - PADDLE_W - BALL_R;
        const relative = (s.ballY - (s.rightY + PADDLE_H / 2)) / (PADDLE_H / 2);
        const bounceAngle = relative * (Math.PI / 3);
        const speed = Math.hypot(s.ballVX, s.ballVY) * 1.03;
        s.ballVX = -Math.abs(speed * Math.cos(bounceAngle)); // ensures going left
        s.ballVY = speed * Math.sin(bounceAngle);
        s.speedMultiplier *= 1.01;
      }

      // Score: left missed
      if (s.ballX + BALL_R < 0) {
        setScoreR((r) => {
          const nr = r + 1;
          if (nr >= WIN_SCORE) {
            setWinner("Right Player");
            s.running = false;
          } else {
            // serve to left (right scored so ball goes left-to-right next serve)
            setTimeout(() => resetBall(-1), 300);
          }
          return nr;
        });
      }

      // Score: right missed
      if (s.ballX - BALL_R > CANVAS_W) {
        setScoreL((l) => {
          const nl = l + 1;
          if (nl >= WIN_SCORE) {
            setWinner("Left Player");
            s.running = false;
          } else {
            setTimeout(() => resetBall(1), 300);
          }
          return nl;
        });
      }

      drawFrame(ctx);
      rafRef.current = requestAnimationFrame(loop);
    };

    // draw function
    function drawFrame(ctx: CanvasRenderingContext2D) {
      const s = stateRef.current;
      // clear
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // background
      ctx.fillStyle = "#0f172a"; // navy-ish
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // center dashed line
      ctx.strokeStyle = "#94a3b8";
      ctx.setLineDash([10, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CANVAS_W / 2, 0);
      ctx.lineTo(CANVAS_W / 2, CANVAS_H);
      ctx.stroke();
      ctx.setLineDash([]);

      // paddles
      ctx.fillStyle = "#e2e8f0";
      // left paddle
      ctx.fillRect(0, s.leftY, PADDLE_W, PADDLE_H);
      // right paddle
      ctx.fillRect(CANVAS_W - PADDLE_W, s.rightY, PADDLE_W, PADDLE_H);

      // ball
      ctx.beginPath();
      ctx.fillStyle = "#fb7185";
      ctx.arc(s.ballX, s.ballY, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();

      // scores
      ctx.fillStyle = "#f8fafc";
      ctx.font = "28px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto";
      ctx.textAlign = "center";
      ctx.fillText(String(scoreL), CANVAS_W * 0.25, 40);
      ctx.fillText(String(scoreR), CANVAS_W * 0.75, 40);

      // paused or winner overlay
      if (paused) {
        ctx.fillStyle = "rgba(2,6,23,0.6)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "#fff";
        ctx.font = "36px serif";
        ctx.fillText("Paused", CANVAS_W / 2, CANVAS_H / 2);
      }
      if (winner) {
        ctx.fillStyle = "rgba(2,6,23,0.75)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "#fff";
        ctx.font = "36px serif";
        ctx.fillText(`${winner} Wins!`, CANVAS_W / 2, CANVAS_H / 2 - 20);
        ctx.font = "22px serif";
        ctx.fillText("Press Restart to play again", CANVAS_W / 2, CANVAS_H / 2 + 20);
      }
    }

    // initial draw
    drawFrame(ctx);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, twoPlayer, aiDifficulty, winner]);

  // input handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === "ArrowUp") s.pressingUp = true;
      if (e.key === "ArrowDown") s.pressingDown = true;
      if (e.key === "w" || e.key === "W") s.pressingW = true;
      if (e.key === "s" || e.key === "S") s.pressingS = true;
      if (e.key === " " || e.key === "Spacebar") {
        setPaused((p) => !p);
      }
      // 2-player toggle (T)
      if (e.key === "t" || e.key === "T") setTwoPlayer((v) => !v);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === "ArrowUp") s.pressingUp = false;
      if (e.key === "ArrowDown") s.pressingDown = false;
      if (e.key === "w" || e.key === "W") s.pressingW = false;
      if (e.key === "s" || e.key === "S") s.pressingS = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // mouse / touch for left paddle (drag)
  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const rect = () => canvas.getBoundingClientRect();

    const start = (clientY: number) => {
      const s = stateRef.current;
      const r = rect();
      const y = clientY - r.top;
      // if click near left paddle area -> start dragging
      if (y >= s.leftY && y <= s.leftY + PADDLE_H && s.ballX < CANVAS_W / 2) {
        s.dragging = true;
        s.dragOffsetY = y - s.leftY;
      } else if (s.ballX >= CANVAS_W / 2 && y >= stateRef.current.rightY && y <= stateRef.current.rightY + PADDLE_H && twoPlayer) {
        // allow dragging right paddle only in two-player
        stateRef.current.dragging = true;
        stateRef.current.dragOffsetY = y - stateRef.current.rightY;
      }
    };

    const move = (clientY: number) => {
      const s = stateRef.current;
      if (!s.dragging) return;
      const r = rect();
      const y = clientY - r.top;
      // move left paddle
      if (canvas && (y - s.dragOffsetY) !== undefined) {
        // determine whether we are dragging left or right paddle by tracking which side of canvas the pointer is on
        if (clientY - r.top && clientY - r.left !== undefined) {
          // choose left or right by pointer x
        }
      }
      // Use pointer position to place left paddle center
      const pointerX = (window as any).lastPointerX || 0;
      const isLeftSide = pointerX - rect().left < CANVAS_W / 2;
      if (isLeftSide) {
        stateRef.current.leftY = clamp(y - s.dragOffsetY, 0, CANVAS_H - PADDLE_H);
      } else if (twoPlayer) {
        stateRef.current.rightY = clamp(y - s.dragOffsetY, 0, CANVAS_H - PADDLE_H);
      }
    };

    const end = () => {
      stateRef.current.dragging = false;
    };

    const handlePointerDown = (ev: PointerEvent) => {
      (window as any).lastPointerX = ev.clientX;
      start(ev.clientY);
      canvas.setPointerCapture(ev.pointerId);
    };
    const handlePointerMove = (ev: PointerEvent) => {
      (window as any).lastPointerX = ev.clientX;
      move(ev.clientY);
    };
    const handlePointerUp = (ev: PointerEvent) => {
      end();
      try {
        canvas.releasePointerCapture(ev.pointerId);
      } catch {}
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [twoPlayer]);

  // UI controls
  function togglePause() {
    setPaused((p) => !p);
  }

  function toggleTwoPlayer() {
    setTwoPlayer((t) => !t);
  }

  function setAi(diff: number) {
    setAiDifficulty(diff);
  }

  // small effect to reset ball initially
  useEffect(() => {
    resetBall(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start gap-4 py-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <h1 className="text-3xl font-bold">Ping Pong — Web Canvas</h1>

      <div className="flex gap-3 items-center">
        <div className="px-3 py-2 bg-white/5 rounded-lg">Player Score: <span className="font-bold text-xl">{scoreL}</span></div>
        <div className="px-3 py-2 bg-white/5 rounded-lg">Right Score: <span className="font-bold text-xl">{scoreR}</span></div>
        <button
          onClick={() => {
            restartMatch();
            setWinner(null);
            stateRef.current.running = true;
            setPaused(false);
          }}
          className="px-3 py-2 bg-emerald-500 rounded-md shadow"
        >
          Restart
        </button>
        <button onClick={togglePause} className="px-3 py-2 bg-yellow-500 rounded-md shadow">
          {paused ? "Resume" : "Pause"}
        </button>

        <label className="flex items-center gap-2 ml-2">
          <input type="checkbox" checked={twoPlayer} onChange={toggleTwoPlayer} />
          2-Player
        </label>

        <div className="flex items-center gap-2 ml-4">
          <span className="text-sm">AI:</span>
          <button className="px-2 py-1 bg-white/5 rounded" onClick={() => setAi(0.08)}>Easy</button>
          <button className="px-2 py-1 bg-white/5 rounded" onClick={() => setAi(0.12)}>Normal</button>
          <button className="px-2 py-1 bg-white/5 rounded" onClick={() => setAi(0.18)}>Hard</button>
        </div>
      </div>

      <div className="mt-4 rounded-lg shadow-lg bg-black">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ display: "block" }} />
      </div>

      <div className="text-sm text-gray-300">
        Controls: Left = W / S (or drag). Right = ArrowUp / ArrowDown (or toggle 2-player to drag). Space = pause.
      </div>

      <div className="text-xs text-gray-400 mt-2">First to {WIN_SCORE} wins.</div>
    </div>
  );
}
