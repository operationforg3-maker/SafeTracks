/**
 * @fileOverview Calculates the estimated time of arrival (ETA) of trains at a user's location,
 * compensating for API delays by predicting train positions.
 *
 * - calculateETA - A function that calculates the ETA of a train.
 * - PredictiveETAInput - The input type for the calculateETA function.
 * - PredictiveETAOutput - The return type for the calculateETA function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictiveETAInputSchema = z.object({
  userLatitude: z
    .number()
    .describe('The latitude of the user.'),
  userLongitude: z
    .number()
    .describe('The longitude of the user.'),
  trainLatitude: z
    .number()
    .describe('The current latitude of the train.'),
  trainLongitude: z
    .number()
    .describe('The current longitude of the train.'),
  trainSpeed: z.number().describe('The current speed of the train in meters per second.'),
  timeSinceLastUpdate: z
    .number()
    .describe('The time in seconds since the last train data update.'),
});
export type PredictiveETAInput = z.infer<typeof PredictiveETAInputSchema>;

const PredictiveETAOutputSchema = z.object({
  estimatedArrivalTime: z
    .number()
    .describe(
      'The estimated time in seconds until the train arrives at the user location.'
    ),
  isSafe: z
    .boolean()
    .describe(
      'Whether or not the user is at a safe distance from the train based on the estimated arrival time.'
    ),
  alertLevel: z
    .enum(['safe', 'warning', 'critical'])
    .describe(
      'The alert level for the user, which is safe if the train is far away, warning if the train is nearby, and critical if the train is on a collision course.'
    ),
});
export type PredictiveETAOutput = z.infer<typeof PredictiveETAOutputSchema>;

export async function calculateETA(input: PredictiveETAInput): Promise<PredictiveETAOutput> {
  return predictiveETAFlow(input);
}

const prompt = ai.definePrompt({
  name: 'predictiveETAPrompt',
  input: {schema: PredictiveETAInputSchema},
  output: {schema: PredictiveETAOutputSchema},
  prompt: `You are a train safety expert. Calculate the estimated time of arrival (ETA) of a train at a user\'s location and determine the safety level for the user.

User Location: Latitude = {{{userLatitude}}}, Longitude = {{{userLongitude}}}
Train Information: Latitude = {{{trainLatitude}}}, Longitude = {{{trainLongitude}}}, Speed = {{{trainSpeed}}} m/s
Time Since Last Update: {{{timeSinceLastUpdate}}} seconds

Consider the train\'s speed, the time since the last update, and the distance between the train and the user. Compensate for API delays by predicting the train\'s position based on its speed and the time elapsed since the last update. This is very important. Do not simply calculate based on the current known location of the train, you must add to that location based on its speed and time since update.

Determine the estimated arrival time in seconds. Also determine if the user is at a safe distance from the train based on the estimated arrival time. Return an alert level of "safe", "warning", or "critical" based on the proximity and estimated arrival time. Assume a critical alert is < 30 seconds, warning is < 5 minutes, and safe is anything greater.

Ensure that the isSafe boolean is set to true or false correctly.
`,
});

const predictiveETAFlow = ai.defineFlow(
  {
    name: 'predictiveETAFlow',
    inputSchema: PredictiveETAInputSchema,
    outputSchema: PredictiveETAOutputSchema,
  },
  async input => {
    // Calculate the predicted train latitude and longitude based on speed and time since last update
    const predictedTrainLatitude = input.trainLatitude + (input.trainSpeed * input.timeSinceLastUpdate * (1 / 111111)); // Approximate meters to degrees latitude conversion
    const predictedTrainLongitude = input.trainLongitude + (input.trainSpeed * input.timeSinceLastUpdate * (1 / (111111 * Math.cos(input.trainLatitude * Math.PI / 180)))); // Approximate meters to degrees longitude conversion, accounting for latitude

    const newInput = {
      ...input,
      trainLatitude: predictedTrainLatitude,
      trainLongitude: predictedTrainLongitude,
    };

    const {output} = await prompt(newInput);
    return output!;
  }
);
