import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("payouts.retryFailedPayouts", { minutes: 15 }, internal.payouts.retryFailedPayouts);

export default crons;
