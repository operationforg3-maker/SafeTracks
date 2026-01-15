'use server';

/**
 * @fileOverview A train position prediction AI agent.
 *
 * - predictTrainPosition - A function that handles the train position prediction process.
 * - PredictTrainPositionInput - The input type for the predictTrainPosition function.
 * - PredictTrainPositionOutput - The return type for the predictTrainPosition function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictTrainPositionInputSchema = z.object({
  lastKnownPositionLat: z
    .number()
    .describe('The latitude of the last known train position.'),
  lastKnownPositionLon: z
    .number()
    .describe('The longitude of the last known train position.'),
  speed: z.number().describe('The speed of the train in km/h.'),
  timeSinceLastUpdate: z
    .number()
    .describe('The time since the last position update in seconds.'),
});
export type PredictTrainPositionInput = z.infer<typeof PredictTrainPositionInputSchema>;

const PredictTrainPositionOutputSchema = z.object({
  predictedLat: z
    .number()
    .describe('The predicted latitude of the train position.'),
  predictedLon: z
    .number()
    .describe('The predicted longitude of the train position.'),
});
export type PredictTrainPositionOutput = z.infer<typeof PredictTrainPositionOutputSchema>;

export async function predictTrainPosition(
  input: PredictTrainPositionInput
): Promise<PredictTrainPositionOutput> {
  return predictTrainPositionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'predictTrainPositionPrompt',
  input: {schema: PredictTrainPositionInputSchema},
  output: {schema: PredictTrainPositionOutputSchema},
  prompt: `You are an AI assistant specialized in predicting train positions.

  Given the last known position, speed, and time since the last update, predict the current position of the train.
  Provide the predicted latitude and longitude.

  Last Known Latitude: {{{lastKnownPositionLat}}}
  Last Known Longitude: {{{lastKnownPositionLon}}}
  Speed (km/h): {{{speed}}}
  Time Since Last Update (seconds): {{{timeSinceLastUpdate}}}

  Consider that trains usually move on tracks and cannot deviate significantly from their path.
  Also, take into account any potential acceleration or deceleration, but assume a constant speed if no other information is available.
  Output the predicted latitude and longitude. Do not include any additional explanation. Focus on the numerical prediction.
  Predicted Latitude:
  Predicted Longitude:`,
});

const predictTrainPositionFlow = ai.defineFlow(
  {
    name: 'predictTrainPositionFlow',
    inputSchema: PredictTrainPositionInputSchema,
    outputSchema: PredictTrainPositionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // Basic calculation as fallback if the AI does not return a valid value.
    let predictedLat = input.lastKnownPositionLat + (input.speed / 3600) * input.timeSinceLastUpdate * 0.009;
    let predictedLon = input.lastKnownPositionLon + (input.speed / 3600) * input.timeSinceLastUpdate * 0.014;

    //Attempt to parse values from AI model
    if(output?.predictedLat){
      predictedLat = output.predictedLat
    }
    if(output?.predictedLon){
      predictedLon = output.predictedLon
    }

    return {
      predictedLat: predictedLat,
      predictedLon: predictedLon,
    };
  }
);
