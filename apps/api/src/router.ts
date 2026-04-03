import { authRouter } from "./routers/auth";
import { router } from "./trpc";
import { identityTransformer } from "./lib/identityTransformer";

export const appRouter = router({
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
export * from "./types/user";
export { identityTransformer };
