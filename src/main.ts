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

async function initializeDriver() {
  const port = await detectSerialPort();
  const driver = new Driver(port, {
    logConfig: {
      enabled: true,  // Enable internal transports
      level: "debug",  // Increase logging level to debug
      transports: [consoleTransport],  // Use the custom transports
    },
    securityKeys: {
      S0_Legacy: Buffer.from("00112233445566778899AABBCCDDEEFF", "hex"),
      S2_Unauthenticated: Buffer.from("11223344556677889900AABBCCDDEEFF", "hex"),
      S2_Authenticated: Buffer.from("22334455667788990011AABBCCDDEEFF", "hex"),
      S2_AccessControl: Buffer.from("33445566778899001122AABBCCDDEEFF", "hex"),
    },
    securityKeysLongRange: {
      S2_AccessControl: Buffer.from("44556677889900112233AABBCCDDEEFF", "hex"),
      S2_Authenticated: Buffer.from("55667788990011223344AABBCCDDEEFF", "hex"),
    },
  });

  driver.on("error", (e) => {
    console.error(`Driver error: ${e}`);
  });

  driver.once("driver ready", async () => {
    console.log("Driver is ready! Initializing nodes...");

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

    driver.controller.on("node added", (node) => {
      console.log(`Node ${node.id} added to the network.`);

      node.on("ready", () => {
        console.log(`Node ${node.id} is ready.`);

        // Define the value IDs for the specific sensors
        const sensorValueIDs = [
          { id: "UV", valueId: { commandClass: 49, property: "UV" } },
          { id: "Motion", valueId: { commandClass: 113, property: "Motion" } },
          { id: "Temperature", valueId: { commandClass: 49, property: "Air temperature" } },
          { id: "Light", valueId: { commandClass: 49, property: "Illuminance" } },
          { id: "Vibration", valueId: { commandClass: 113, property: "Vibration" } },
        ];

        sensorValueIDs.forEach(({ id, valueId }) => {
          const value = node.getValue(valueId);
          console.log(`${id} Value: ${value}`);
        });

        node.on("value updated", (valueId, value) => {
          console.log(`Node ${node.id} value updated: ${valueId.id} = ${value}`);
        });
      });
    });
  });

  async function startDriver() {
    try {
      await driver.start();
      console.log("Z-Wave driver started successfully.");
    } catch (error) {
      console.error(`Failed to start Z-Wave driver: ${error}`);
    }
  }

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      console.log(`Received ${signal}. Shutting down...`);
      try {
        await driver.destroy();
        console.log("Driver destroyed successfully.");
      } catch (error) {
        console.error(`Error destroying driver: ${error}`);
      } finally {
        if (isDebug) {
          stream.end();
        }
        process.exit(0);
      }
    });
  }

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

  startDriver();
}

initializeDriver().catch(error => {
  console.error(`Failed to initialize driver: ${error}`);
});