import React from "react";
import { Box, Text } from "ink";

export function Banner() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">╭─────────────────────────────────────────────────────────────────╮</Text>
      </Box>
      <Box>
        <Text bold color="cyan">│ </Text>
        <Text bold color="white">MCP Registry Assistant                                      </Text>
        <Text bold color="cyan">│</Text>
      </Box>
      <Box>
        <Text bold color="cyan">╰─────────────────────────────────────────────────────────────────╯</Text>
      </Box>
    </Box>
  );
}
