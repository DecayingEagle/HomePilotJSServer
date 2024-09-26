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

  let nodesStartedToBeAdded = false;
  // Error handler before starting the driver
  driver.on("error", (e) => {
    console.error(`Driver error: ${e}`);
  });

  // Event listener for driver readiness
  driver.once("driver ready", () => {
    console.log("Driver is ready! Initializing nodes...");
    setInterval(getData, 1000);
    driver.controller.on("node added", (node) => {
      console.log("Node added");
      console.log(`Node ${node.id}`);
      nodesStartedToBeAdded = true;
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
  
  
  async function getData() {
    if (nodesStartedToBeAdded) {
      console.log("Attempting to get data");
      driver.controller.nodes.forEach(node => {
        console.log(`Node ${node.id}`);
        let definedValueIDs = node.getDefinedValueIDs();
        let values: Map<string, any> = new Map();
        definedValueIDs.forEach(valueID => {
          values.set(valueID.commandClassName, node.getValue(valueID));
        });
        console.log(values);
      })
    } else {
      console.log("No nodes yet");
    }
  }
  
  //run every second
  
  
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
  };

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