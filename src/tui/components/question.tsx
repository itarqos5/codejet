import React from "react";
import { Box, Text } from "ink";
import { COLOR, GLYPH, truncate } from "../theme.js";
import type { PendingQuestion } from "../state.js";

/**
 * Inline question panel for the ask() tool.
 *
 * Free-text answers reuse the main prompt (the parent routes submissions to the
 * pending question), so there is only ever one text input mounted. Two inputs
 * competing for the same keystrokes was why typed characters used to land in
 * both places.
 */
export function QuestionPrompt({
  question,
  selectedIndex,
  width,
}: {
  question: PendingQuestion;
  selectedIndex: number;
  width: number;
}) {
  const inner = Math.max(8, width - 4);
  const options = question.options ?? [];

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={COLOR.warning}
      paddingX={1}
    >
      <Box width={inner} flexDirection="row">
        <Text color={COLOR.warning} bold>
          {GLYPH.brand}{" "}
        </Text>
        <Box width={Math.max(4, inner - 2)}>
          <Text color={COLOR.text} wrap="wrap">
            {question.question}
          </Text>
        </Box>
      </Box>

      {options.length > 0 ? (
        <Box flexDirection="column" width={inner}>
          {options.map((opt, i) => (
            <Text key={i} wrap="truncate-end">
              <Text color={i === selectedIndex ? COLOR.warning : COLOR.muted}>
                {i === selectedIndex ? GLYPH.selected : " "}{" "}
              </Text>
              <Text
                color={i === selectedIndex ? COLOR.text : COLOR.textDim}
                bold={i === selectedIndex}
              >
                {truncate(opt, inner - 3)}
              </Text>
            </Text>
          ))}
          <Text color={COLOR.muted} dimColor wrap="truncate-end">
            ↑↓ move   ↵ answer
          </Text>
        </Box>
      ) : (
        <Text color={COLOR.muted} dimColor wrap="truncate-end">
          Type your answer below and press ↵
        </Text>
      )}
    </Box>
  );
}
