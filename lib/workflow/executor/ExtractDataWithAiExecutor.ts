import { ExtractDataWithAITask } from "@/lib/workflow/task/ExtractDataWithAI";
import { ExecutionEnvironment } from "@/types/executor";
import OpenAI from "openai";

// Hardcoded API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function ExtractDataWithAiExecutor(
  environment: ExecutionEnvironment<typeof ExtractDataWithAITask>
): Promise<boolean> {
  try {
    // Still get credentials input for logging/compatibility but don't use it
    const credentials = environment.getInput("Credentials");
    if (!credentials) {
      environment.log.info("Credentials input not defined, using hardcoded API key");
    } else {
      environment.log.info("Using hardcoded API key instead of provided credentials");
    }

    const prompt = environment.getInput("Prompt");
    if (!prompt) {
      environment.log.error("input->prompt not defined");
      return false;
    }

    const content = environment.getInput("Content");
    if (!content) {
      environment.log.error("input->content not defined");
      return false;
    }

    // Create OpenAI client with the hardcoded API key
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a webscraper helper that extracts data from HTML or text. You will be given a piece of text or HTML content as input and also the prompt with the data you have to extract. The response should always be only the extracted data as a JSON array or object, without any additional words or explanations. Analyze the input carefully and extract data precisely based on the prompt. If no data is found, return an empty JSON array. Work only with the provided content and ensure the output is always a valid JSON array without any surrounding text",
        },
        {
          role: "user",
          content: content,
        },
        { role: "user", content: prompt },
      ],
      temperature: 1,
    });

    environment.log.info(`Prompt tokens: ${response.usage?.prompt_tokens}`);
    environment.log.info(
      `Completion tokens: ${response.usage?.completion_tokens}`
    );

    const result = response.choices[0].message?.content;
    if (!result) {
      environment.log.error("empty response from AI");
      return false;
    }

    environment.setOutput("Extracted data", result);
    return true;
  } catch (error: any) {
    environment.log.error(error.message);
    return false;
  }
}
