import React from "react";
import { Box, Text } from "ink";

export function Banner() {
  const width = Math.min(process.stdout.columns || 80, 80);
  const separator = "═".repeat(width);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">{separator}</Text>
      </Box>
      <Box>
        <Text bold color="white">
          {"\n"}
          {"   __  __  ___ ___    ___         _    _                                  \n"}
          {"  |  \\/  |/ __| _ \\  | _ \\___ __ _ (_)__| |_ _ _ _  _                   \n"}
          {"  | |\\/| | (__|  _/  |   / -_) _` || (_-<  _| '_| || |                   \n"}
          {"  |_|  |_|\\___|_|    |_|_\\___\\__, ||_/__/\\__|_|  \\_, |                  \n"}
          {"                              |___/              |__/                     \n"}
          {"            /_\\   ______ (_)__| |_ __ _ _ _| |_                          \n"}
          {"           / _ \\ (_-< (_-< | (_-<  _/ _` | ' \\  _|                       \n"}
          {"          /_/ \\_\\/__/ /__/_|/__/\\__\\__,_|_||_\\__|                       \n"}
          {"\n"}
        </Text>
      </Box>
      <Box>
        <Text bold color="cyan">{separator}</Text>
      </Box>
    </Box>
  );
}
