import Groq from "groq-sdk";
import { models } from "./models";
import { getRetrivalPrompt } from "./prompts";
import OpenAI from "openai";

import { config } from "./config";
// import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
// import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
// import { registerInstrumentations } from "@opentelemetry/instrumentation";

// const provider = new NodeTracerProvider();
// provider.register();

// registerInstrumentations({
//   instrumentations: [new OpenAIInstrumentation()],
// });

// import { NodeSDK } from "@opentelemetry/sdk-node";
// import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
// import { Resource } from "@opentelemetry/resources";
// import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

// const sdk = new NodeSDK({
//   resource: new Resource({
//     [SemanticResourceAttributes.SERVICE_NAME]: "yourServiceName",
//     [SemanticResourceAttributes.SERVICE_VERSION]: "1.0",
//   }),
//   traceExporter: new ConsoleSpanExporter(),
// });

// sdk.start();

async function getGPTCompletion(prompt: any) {
  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4o-mini",
  });

  return completion.choices[0].message.content;
}

async function getGroqCompletion(config: any) {
  const output = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: config.prompt,
      },
    ],
    model: config.model || "llama3-8b-8192",
  });

  return output.choices[0].message.content;
}

async function getGroqCompletionObject(config: any) {
  return new Promise((resolve, reject) => {
    try {
      resolve(
        groq.chat.completions.create({
          messages: [
            {
              role: "user",
              content: config.prompt,
            },
          ],
          model: config.model || "llama3-8b-8192",
        })
      );
    } catch (err) {
      reject(err);
    }
  });
}

const generateCode = async (task: any, model: any) => {
  const prompt = `Write a Python function to ${task}. Include comments explaining the code.`;
  return await getGroqCompletion({ prompt, model });
};

const generateTestCases = async (code: any, model: any) => {
  const prompt = `"Given the following Python code, generate 3 test cases to verify its functionality. Include both input and expected output for each test case:\n\n${code}`;
  return await getGroqCompletion({ prompt, model });
};

const runTests = async (code: any, testCases: any, model: any) => {
  const prompt = `
    Given the following Python code and test cases, run the tests and report the results. 
    If any tests fail, explain why and suggest fixes.
    Code:
    ${code}
    Test Cases:
    ${testCases}
    For each test case, respond with:
    1. "PASS" if the test passes
    2. "FAIL" if the test fails, along with an explanation of why it failed and a suggested fix
    `;
  return await getGroqCompletion({ prompt, model });
};

const debugCode = async (code: any, testResults: any, model: any) => {
  const prompt = `
    Given the following Python code and test results, debug the code to fix any issues.
    Provide the corrected code along with explanations of the changes made.
    Original Code:
    ${code}
    Test Results:
    ${testResults}
    `;

  return await getGroqCompletion({ prompt, model });
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface Analytics {
  model: string;
  user?: string;
  agent?: string;
  cost: number;
  speed: number;
  relevancy: string;
  inputCost?: number;
  outputCost?: number;
  ratings?: number;
}

const sortBySpeed = (analytics: any) => analytics.sort((a: any) => a.speed);

const sortByCost = (analytics: any) =>
  analytics.sort((a: any, b: any) => a.cost - b.cost);

const sortByRatings = (analytics: any) => {
  return analytics.sort((a: any) => {
    return a.ratings;
  });
};

const promptChain = async (
  initialPrompt: any,
  followUpPrompts: any,
  model: any
) => {
  let result = await getGroqCompletion({ prompt: initialPrompt, model });

  if (!result) {
    throw new Error("Initial prompt failed.");
  }
  result = result?.choices[0].message.content;

  console.log(`Initial output: ${result}\n"`);

  for (let [idx, prompt] of followUpPrompts) {
    const fullPrompt = `${prompt}\n\nPrevious output: ${result}`;
    const xs = await getGroqCompletion({ prompt: fullPrompt, model });
    result = xs?.choices[0].message.content;

    if (!result) {
      throw new Error(`Prompt ${idx} failed.`);
    }

    console.log(`Step ${idx} output: ${result}\n`);
  }

  return result;
};

export async function main() {
  console.log("running...");

  let result = [];
  const userQuery = config.researchAgentPrompt;
  // const userQuery = config.writerAgentPrompt;
  // const userQuery = config.reviewAgentPrompt;

  for await (let model of models) {
    const { choices, usage } = await getGroqCompletionObject({
      prompt: userQuery,
      model: model.id,
    });

    const agentResponse = choices[0].message.content;

    const retrivalPrompt = getRetrivalPrompt(userQuery, agentResponse);
    const relevancy = await getGPTCompletion(retrivalPrompt);
    const ratingString = await getGPTCompletion(
      config.judgePrompt(userQuery, agentResponse)
    );

    const ratings = parseFloat(ratingString?.split(":")[1]!);
    const inputCost = (usage.prompt_tokens / 1000000) * model.inputTokenCost;
    const outputCost = (usage.prompt_tokens / 1000000) * model.outputTokenCost;

    let report: Analytics = {
      model: model.id,
      //user: userQuery,
      speed: usage.total_time,

      cost: inputCost + outputCost,
      ratings: ratings!,
      relevancy: relevancy!,
      //agent: agentResponse,

      //   inputCost: inputCost,
      //   outputCost: outputCost,
    };

    console.log(`==> ${model.id} : `, agentResponse);

    result.push(report);
  }
  const gptOutput = await getGPTCompletion(userQuery);
  console.log("\n===> gpt-4o-mini : ", gptOutput);

  result = sortBySpeed(result);
  console.log("\nLLM Benchmark");
  console.table(result);
  //   console.log("\nSort by cost");
  //   console.table(sortByCost(result));
  //   console.log("\nSort by Ratings");
  //   console.table(sortByRatings(result));
}

async function execute() {
  console.log("running...");
  const task = config.prompt;
  const model = "llama3-8b-8192";

  // Step 1: Generate initial code
  const initialCode = await generateCode(task, model);
  console.log("\nInitial Code:", initialCode);

  // Step 2: Generate test cases

  const testCases = await generateTestCases(initialCode, model);
  console.log("\nGenerated Test Cases:", testCases);

  // Step 3: Run tests

  const testResults = await runTests(initialCode, testCases, model);
  console.log(testResults);
  // Step 4: Debug code if necessary
  if (testResults?.includes("FAIL")) {
    const debuggedCode = await debugCode(initialCode, testResults, model);
    console.log(debuggedCode);
    console.log("\nRe-running tests on debugged code...");
    const finalTestResults = await runTests(debuggedCode, testCases, model);
    console.log("\nFinal Test Results:", finalTestResults);
    return debuggedCode;
  } else {
    console.log("\nAll tests passed. No debugging necessary.");
    return initialCode;
  }
}

main();
// execute();
