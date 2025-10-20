import React from "react";
import { Box, Text } from "ink";
import type { CommandOption } from "../utils/commands.js";

interface CommandSuggestionsProps {
  suggestions: CommandOption[];
  selectedIndex: number;
}

export function CommandSuggestions({ suggestions, selectedIndex }: CommandSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
      <Box marginBottom={1}>
        <Text color="gray" dimColor>
          Command suggestions (↑↓ to navigate, Tab to complete):
        </Text>
      </Box>
      {suggestions.map((suggestion, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={suggestion.command}>
            <Text color={isSelected ? "cyan" : "gray"} bold={isSelected}>
              {isSelected ? "› " : "  "}
              {suggestion.command}
            </Text>
            <Text color="gray"> - {suggestion.description}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
