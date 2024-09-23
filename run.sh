#!/bin/bash

# Path to the askpass script
export SUDO_ASKPASS=$(pwd)/askpass.sh

# Detect the available serial port
PORT=$(ls /dev/ttyACM* | head -n 1)

if [ -z "$PORT" ]; then
  echo "No serial port found."
  exit 1
fi

# Set the permissions for the detected port using askpass
sudo -A chmod 666 "$PORT"

# Export the port so it's available to the TypeScript script
export MY_VAR="$PORT"

# Run the TypeScript script using the locally installed ts-node
npx ts-node --transpile-only src/main.ts