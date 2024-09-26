#!/bin/bash

# TODO: Remove for production
git pull

# Path to the askpass script
if [ "$(id -u)" != "0" ]; then
     echo "This script must be run as root" 1>&2
     export SUDO_ASKPASS=~/WebstormProjects/HomePilotJSServer/askpass.sh
fi

# Set the DISPLAY environment variable
export DISPLAY=:0

# Detect the available serial port
PORT=$(ls /dev/ttyACM* | head -n 1)

# If no port is found on ACM, try AMA
if [ -z "$PORT" ]; then
  PORT=$(ls /dev/ttyAMA* | head -n 1)
fi

if [ -z "$PORT" ]; then
  echo "No serial port found."
  exit 1
fi

# Set the permissions for the detected port using askpass
sudo -A chmod 666 "$PORT"

# Export the port so it's available to the TypeScript script
export MY_VAR="$PORT"

# Check if WebStorm is running
if ! pgrep -x "webstorm.sh" > /dev/null; then
  echo "WebStorm is not running. Executing main.ts..."
  # Run the TypeScript script
  npx tsx src/main.ts
else
  echo "WebStorm is running. Skipping execution of main.ts."
fi