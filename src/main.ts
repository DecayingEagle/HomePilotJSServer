import { createDefaultTransportFormat } from "@zwave-js/core";
import { Writable } from "stream";
import winston from "winston";
import { Driver } from "zwave-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { SerialPort } from "serialport";

// Get the filename and directory name in an ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDebug = process.env.DEBUG === "true";  // Check if the DEBUG mode is enabled

// Create the logs directory if it doesn't exist
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Generate a timestamped log file name
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `zwave-debug-${timestamp}.log`);
const stream: Writable = fs.createWriteStream(logFile, { flags: "a" });

// Create custom winston transports
const fileTransport = new winston.transports.Stream({
  stream,
  format: createDefaultTransportFormat(
    /* colorize: */ false,  // Disable colorization for file transport
    /* shortTimestamps: */ true,
  ),
});

const consoleTransport = new winston.transports.Console({
  format: createDefaultTransportFormat(
    /* colorize: */ true,  // Enable colorization for console transport
    /* shortTimestamps: */ true,
  ),
});

// Function to detect the correct serial port
async function detectSerialPort(): Promise<string> {
  const ports = await SerialPort.list();
  const zwavePort = ports.find(port => port.path.includes("ttyACM"));
  if (!zwavePort) {
    throw new Error("No Z-Wave serial port found");
  }
  return zwavePort.path;
}

// Initialize the Z-Wave driver with the custom transports
async function initializeDriver() {
  const port = await detectSerialPort();
  const driver = new Driver(port, {
    logConfig: {
      enabled: false,  // Disable internal transports
      level: "silly",
      transports: [fileTransport, consoleTransport],  // Use the custom transports
    },
    // TODO: Add your own security keys here
    securityKeys: {
      S0_Legacy: Buffer.from("00112233445566778899AABBCCDDEEFF", "hex"),
      S2_Unauthenticated: Buffer.from("00112233445566778899AABBCCDDEEFF", "hex"),
      S2_Authenticated: Buffer.from("00112233445566778899AABBCCDDEEFF", "hex"),
      S2_AccessControl: Buffer.from("00112233445566778899AABBCCDDEEFF", "hex"),
    },
  });

  // Error handler before starting the driver
  driver.on("error", (e) => {
    console.error(`Driver error: ${e}`);
  });

  // Event listener for driver readiness
  driver.once("driver ready", async () => {
    console.log("Driver is ready! Initializing nodes...");

    // Add a new node to the network
    console.log("Starting inclusion process...");
    try {
      const inclusionResult = await driver.controller.beginInclusion();
      if (inclusionResult) {
        console.log("Node inclusion started successfully.");
      } else {
        console.log("Node inclusion failed to start.");
      }
    } catch (error) {
      console.error(`Error during node inclusion: ${error}`);
    }

    // Listen for node added event
    driver.controller.on("node added", (node) => {
      console.log(`Node ${node.id} added to the network.`);
      node.on("ready", () => {
        console.log(`Node ${node.id} is ready.`);
        // Read values from the sensor
        node.getDefinedValueIDs().forEach((valueId) => {
          const value = node.getValue(valueId);
          console.log(`Value ID: ${valueId}, Value: ${value}`);
        });
      });

      node.on("value updated", (valueId, value) => {
        console.log(`Node ${node.id} value updated: ${valueId.id} = ${value}`);
      });
    });
  });

  // Start the Z-Wave driver
  async function startDriver() {
    try {
      await driver.start();
      console.log("Z-Wave driver started successfully.");
    } catch (error) {
      console.error(`Failed to start Z-Wave driver: ${error}`);
    }
  }

  // Handle the SIGINT or SIGTERM signals for graceful shutdown
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      console.log(`Received ${signal}. Shutting down...`);
      try {
        await driver.destroy();  // Ensure this completes before exiting
        console.log("Driver destroyed successfully.");
      } catch (error) {
        console.error(`Error destroying driver: ${error}`);
      } finally {
        if (isDebug){
          stream.end();
        }
        process.exit(0);  // Exit after the driver is destroyed
      }
    });
  }

  // Ensure the driver is destroyed on process exit
  process.on('exit', async () => {
    try {
      await driver.destroy();
      console.log("Driver destroyed on process exit.");
    } catch (error) {
      console.error(`Error destroying driver on process exit: ${error}`);
    } finally {
      if (isDebug) {
        stream.end();
      }
    }
  });

  // Call the driver start function
  startDriver();
}

// Initialize the driver
initializeDriver().catch(error => {
  console.error(`Failed to initialize driver: ${error}`);
});