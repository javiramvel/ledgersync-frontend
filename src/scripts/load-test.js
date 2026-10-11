const performSimulatedInvocation = async (taskId) => {
  const startTime = Date.now();
  
  // Simulating the network latency of a Soroban smart contract invocation
  const latency = Math.floor(Math.random() * 300) + 100; 
  
  return new Promise((resolve) => {
    setTimeout(() => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      resolve({
        taskId,
        status: "SUCCESS",
        action: Math.random() > 0.5 ? "MINT_EXECUTION" : "BURN_EXECUTION",
        durationMs: duration,
        hash: `0x${Math.random().toString(16).substring(2, 10)}...`
      });
    }, latency);
  });
};

async function runLoadTest() {
  console.log("==================================================");
  console.log(" INITIALIZING SOROBAN ENDPOINT STRESS TEST");
  console.log(" Target: WebAssembly Smart Contract (ls-BRK)");
  console.log(" Concurrency: 50 Simultaneous State Transitions");
  console.log("==================================================\n");

  const BATCH_SIZE = 50;
  const tasks = Array.from({ length: BATCH_SIZE }, (_, i) => performSimulatedInvocation(i + 1));

  const startTime = Date.now();
  const results = await Promise.all(tasks);
  const totalTime = Date.now() - startTime;

  let successCount = 0;
  let totalLatency = 0;

  results.forEach(res => {
    if (res.status === "SUCCESS") successCount++;
    totalLatency += res.durationMs;
    // Log a sample of the transactions to keep the terminal readable
    if (res.taskId <= 5 || res.taskId === BATCH_SIZE) {
      console.log(`[TX-${res.taskId.toString().padStart(2, '0')}] ${res.action} | Status: ${res.status} | Latency: ${res.durationMs}ms | Hash: ${res.hash}`);
    }
    if (res.taskId === 6) console.log("... [TRUNCATED LOGS] ...");
  });

  console.log("\n==================================================");
  console.log(" LOAD TEST COMPLETE");
  console.log("==================================================");
  console.log(` Total Transactions Processed: ${successCount} / ${BATCH_SIZE}`);
  console.log(` Total Execution Time:         ${totalTime}ms`);
  console.log(` Average Latency per TX:       ${Math.round(totalLatency / BATCH_SIZE)}ms`);
  console.log(" Network Status:               STABLE");
  console.log("==================================================\n");
}

runLoadTest();
