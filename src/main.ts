import { Driver } from "zwave-js";

const port = "/dev/ttyACM0";

// Tell the driver which serial port to use
const driver = new Driver(port, {
  logConfig: {
    level: "debug",  // Change to "info" or "warn" in production
    enabled: true
  }});
// You must add a handler for the error event before starting the driver
driver.on("error", (e) => {
  // Do something with it
  console.error(e);
});
// Listen for the driver ready event before doing anything with the driver
driver.once("driver ready", () => {
  /*
  Now the controller interview is complete. This means we know which nodes
  are included in the network, but they might not be ready yet.
  The node interview will continue in the background.
  */

  for (const [nodeId, node] of driver.controller.nodes) {
    console.log(`Node ${nodeId} -> ${node.deviceConfig?.label}`);
  }

  driver.controller.nodes.forEach((_node) => {
    // e.g. add event handlers to all known nodes
  });

  // When a node is marked as ready, it is safe to control it
  const node = driver.controller.nodes.get(2);
  // @ts-ignore
  node.once("ready", async () => {
    // e.g. perform a BasicCC::Set with target value 50
    // @ts-ignore
    await node.commandClasses.Basic.set(50);
  });
});
// Start the driver. To await this method, put this line into an async method
await driver.start();

//* Here goes the code to handle the driver events


// When you want to exit:
await driver.destroy();

// Or when the application gets a SIGINT or SIGTERM signal
// Shutting down after SIGINT is optional, but the handler must exist
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await driver.destroy();
    process.exit(0);
  });
}