import React, { useMemo, useEffect, useState } from "react";
import { Box, Text } from "ink";
import figlet from "figlet";
import { VERSION } from "../models.js";

function AnimatedGlow() {
  const [glowColor, setGlowColor] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setGlowColor((g) => (g + 1) % 6);
    }, 500);
    return () => clearInterval(interval);
  }, []);
  
  const colors = ["#00ffff", "#00ff88", "#ff00ff", "#ffff00", "#ff8800", "#00ffff"];
  return <Text color={colors[glowColor]}>{colors[glowColor]}</Text>;
}

export function Header({ model, mode }: { model: string; mode: string }) {
  const columns = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;

  const asciiArt = useMemo(() => {
    const font = columns >= 60 ? "ANSI Shadow" : "Small";
    const raw = figlet.textSync("CODEJET", { font, horizontalLayout: "fitted" });
    const lines = raw.split("\n");
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    return lines;
  }, [columns]);

  const modeColor = mode === "build" ? "blue" : "yellow";
  const modeBg = mode === "build" ? "#0066cc" : "#ccaa00";

  // Push header down when terminal is tall (above 30 rows)
  const headerLines = asciiArt.length + 1; // ASCII + info line
  const statusBarLines = 1;
  const inputLines = 3;
  const available = rows - headerLines - statusBarLines - inputLines;
  const topPad = rows > 30 ? Math.floor(available * 0.15) : 0;

  // Generate a futuristic border effect
  const borderWidth = Math.min(columns - 4, 60);
  const leftBorder = "▓".repeat(Math.floor(borderWidth / 2));
  const rightBorder = "▒".repeat(Math.floor(borderWidth / 2));

  return (
    <Box flexDirection="column" alignItems="center" paddingTop={topPad}>
      {/* Futuristic top bar */}
      <Box width={borderWidth} gap={0}>
        <Text color="cyan" dimColor>{leftBorder}</Text>
        <Text color="magenta">◆</Text>
        <Text color="cyan" dimColor>{rightBorder}</Text>
      </Box>
      
      {asciiArt.map((line, i) => (
        <Box key={i} width={borderWidth} justifyContent="center">
          <Text color="cyan" bold>
            {line}
          </Text>
        </Box>
      ))}
      
      {/* Info bar with futuristic styling */}
      <Box marginTop={1} gap={2} alignItems="center">
        <Text color="gray">┌─</Text>
        <Box gap={1}>
          <Text color="cyan">⌘</Text>
          <Text color="white" bold>v{VERSION}</Text>
        </Box>
        <Text color="gray">├─</Text>
        <Box gap={1}>
          <Text color="magenta">◈</Text>
          <Text color="yellow" bold>{model}</Text>
        </Box>
        <Text color="gray">├─</Text>
        <Box paddingX={1} paddingY={0} borderStyle="bold" borderColor={modeColor} backgroundColor={modeColor === "blue" ? "#001a33" : "#332200"}>
          <Text color={modeColor} bold>
            {mode.toUpperCase()}
          </Text>
        </Box>
        <Text color="gray">┤</Text>
      </Box>
      
      {/* Futuristic bottom accent */}
      <Box width={borderWidth} marginTop={1}>
        <Text color="gray" dimColor>
          {"─".repeat(Math.min(borderWidth - 10, 40))}
        </Text>
      </Box>
    </Box>
  );
}
