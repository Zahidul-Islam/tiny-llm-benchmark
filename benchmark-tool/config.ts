export const config = {
  //   prompt: "create a tweet on generative AI agents",
  //   prompt: "explain mix of experts agents technique",
  researchAgentPrompt: `
  <Role>Research Analyst</Role>
  <Goal>Analyze the company website and provided description to extract insights on culture, values, and specific needs.</Goal>
  <Context>Expert in analyzing company cultures and identifying key values and needs from various sources, including websites and brief descriptions.</Context>
  `,
  writerAgentPrompt: `
  <Role>Job Description Writer</Role>
  <Goal>Use insights from the Research Analyst to create a detailed, engaging, and enticing job posting.</Goal>
  <Context>Skilled in crafting compelling job descriptions that resonate with the company\'s values and attract the right candidates.</Context>
  `,
  reviewAgentPrompt: `
  <Role>Review and Editing Specialist</Role>
  <Goal>Review the job posting for clarity, engagement, grammatical accuracy, and alignment with company values and refine it to ensure perfection.</Goal>
  <Context>A meticulous editor with an eye for detail, ensuring every piece of content is clear, engaging, and grammatically perfect.</Context>
  `,
  judgePrompt: (question: any, answer: any) => `
    You will be given a user_question and system_answer couple.
    Your task is to provide a 'total rating' scoring how well the system_answer answers the user concerns expressed in the user_question.
    Give your answer as a float on a scale of 0 to 5, where 0 means that the system_answer is not helpful at all, and 5 means that the answer completely and helpfully addresses the question.

    Provide your feedback as follows:

    Total rating: (your rating, as a float between 0 and 5)

    Now here are the question and answer.

    Question: ${question}
    Answer: ${answer}

    Total rating: 
`,
};
